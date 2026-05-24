import { BadRequestError } from "../exceptions/BadRequestError.js";
import { ConflictError } from "../exceptions/ConflictError.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import { getActivationTokenHours } from "../config/env.js";
import { generateToken, hashToken } from "../utils/tokens.js";
import * as homeModel from "../models/home.model.js";
import * as userModel from "../models/user.model.js";
import * as tokenModel from "../models/activationToken.model.js";
import { sendInvitationEmail } from "./mail.service.js";
import { withTransaction } from "./home.service.js";

function sanitizeMember(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listMembers(homeId) {
  const rows = await userModel.listByHomeId(homeId);
  return rows.map(sanitizeMember);
}

async function createInvitation({ homeId, homeName, email }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    if (existing.home_id === homeId) {
      if (existing.status === "active") {
        throw new ConflictError("Esa persona ya es miembro activo del hogar.");
      }
      throw new ConflictError(
        "Ya hay una invitación pendiente para ese email. Puedes reenviarla desde la lista."
      );
    }
    throw new ConflictError("Ese email ya está registrado en otro hogar.");
  }

  const { rawToken } = await withTransaction(async (conn) => {
    const uid = await userModel.createUser(
      {
        homeId,
        email: normalizedEmail,
        name: "",
        role: "member",
        status: "pending",
      },
      conn
    );
    await userModel.createWallet(uid, conn);

    const raw = generateToken();
    const expires = new Date(Date.now() + getActivationTokenHours() * 3600 * 1000);
    await tokenModel.createToken(uid, hashToken(raw), expires, conn);
    return { userId: uid, rawToken: raw };
  });

  const mail = await sendInvitationEmail({
    email: normalizedEmail,
    homeName,
    token: rawToken,
  });

  return {
    message: "Invitación enviada. La persona debe revisar su correo para activar la cuenta.",
    devLink: mail.devLink,
  };
}

export async function inviteMember(homeId, { email }) {
  if (!email?.trim()) {
    throw new BadRequestError("El correo electrónico es obligatorio.");
  }

  const home = await homeModel.findHomeById(homeId);
  if (!home) throw new NotFoundError("Hogar no encontrado.");

  return createInvitation({
    homeId,
    homeName: home.name,
    email,
  });
}

export async function resendInvitation(homeId, memberId) {
  const member = await userModel.findByIdInHome(memberId, homeId);
  if (!member) throw new NotFoundError("Miembro no encontrado en este hogar.");

  if (member.status !== "pending") {
    throw new BadRequestError("Solo se puede reenviar la invitación a cuentas pendientes.");
  }

  const home = await homeModel.findHomeById(homeId);
  if (!home) throw new NotFoundError("Hogar no encontrado.");

  const rawToken = await withTransaction(async (conn) => {
    await tokenModel.invalidateUserTokens(member.id, conn);
    const raw = generateToken();
    const expires = new Date(Date.now() + getActivationTokenHours() * 3600 * 1000);
    await tokenModel.createToken(member.id, hashToken(raw), expires, conn);
    return raw;
  });

  const mail = await sendInvitationEmail({
    email: member.email,
    homeName: home.name,
    token: rawToken,
  });

  return {
    message: "Invitación reenviada.",
    devLink: mail.devLink,
  };
}
