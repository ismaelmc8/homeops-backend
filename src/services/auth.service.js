import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getJwtSecret, getJwtExpiresIn, getActivationTokenHours } from "../config/env.js";
import { generateToken, hashToken } from "../utils/tokens.js";
import { validatePasswordPair } from "../utils/password.js";
import { ConflictError } from "../exceptions/ConflictError.js";
import { UnauthorizedError } from "../exceptions/UnauthorizedError.js";
import { BadRequestError } from "../exceptions/BadRequestError.js";
import { ForbiddenError } from "../exceptions/ForbiddenError.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import * as homeModel from "../models/home.model.js";
import * as userModel from "../models/user.model.js";
import * as tokenModel from "../models/activationToken.model.js";
import { sendActivationEmail } from "./mail.service.js";
import { withTransaction } from "./home.service.js";

const BCRYPT_ROUNDS = 10;

export async function register({ email, name, homeName }) {
  if (!email?.trim() || !name?.trim() || !homeName?.trim()) {
    throw new BadRequestError("Email, nombre y nombre del hogar son obligatorios.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) throw new ConflictError("El email ya está registrado.");

  const homeCount = await homeModel.countHomes();
  if (homeCount > 0) {
    throw new ConflictError(
      "Ya existe un hogar. Los nuevos miembros se añadirán por invitación (E4)."
    );
  }

  const { userId, rawToken } = await withTransaction(async (conn) => {
    const homeId = await homeModel.createHome(homeName.trim(), conn);
    const uid = await userModel.createUser(
      {
        homeId,
        email: normalizedEmail,
        name: name.trim(),
        role: "admin",
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

  const mail = await sendActivationEmail({
    email: normalizedEmail,
    name: name.trim(),
    token: rawToken,
  });

  return {
    message: "Revisa tu correo para establecer tu contraseña.",
    userId,
    devLink: mail.devLink,
  };
}

export async function validateActivationToken(token) {
  if (!token) throw new BadRequestError("Token requerido.");
  const row = await tokenModel.findValidToken(hashToken(token));
  if (!row) throw new NotFoundError("Enlace inválido o caducado.");
  const needsName = !row.name?.trim();
  return {
    valid: true,
    email: row.email,
    name: needsName ? null : row.name,
    homeName: row.home_name,
    needsName,
  };
}

export async function setPassword({ token, password, passwordConfirm, name }) {
  const err = validatePasswordPair(password, passwordConfirm);
  if (err) throw new BadRequestError(err);

  const row = await tokenModel.findValidToken(hashToken(token));
  if (!row) throw new NotFoundError("Enlace inválido o caducado.");

  const needsName = !row.name?.trim();
  if (needsName && !name?.trim()) {
    throw new BadRequestError("Indica cómo quieres que te llamen en la app.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await withTransaction(async (conn) => {
    if (needsName) {
      await userModel.setName(row.user_id, name.trim(), conn);
    }
    await userModel.setPassword(row.user_id, passwordHash, conn);
    await tokenModel.markTokenUsed(row.id, conn);
    await tokenModel.invalidateUserTokens(row.user_id, conn);
  });

  const user = await userModel.findById(row.user_id);
  const jwtToken = signToken(user);
  return { message: "Cuenta activada.", token: jwtToken, user: sanitizeUser(user) };
}

export async function login({ email, password }) {
  if (!email || !password) throw new BadRequestError("Email y contraseña requeridos.");

  const user = await userModel.findByEmail(email.trim().toLowerCase());
  if (!user || !user.password_hash) {
    throw new UnauthorizedError("Credenciales incorrectas.");
  }
  if (user.status === "pending") {
    throw new ForbiddenError("Cuenta pendiente; revisa tu correo para activar.");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new UnauthorizedError("Credenciales incorrectas.");

  const token = signToken(user);
  const coins = await userModel.getWallet(user.id);
  return { token, user: { ...sanitizeUser(user), coins } };
}

export async function getMe(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw new NotFoundError("Usuario no encontrado.");
  const home = await homeModel.findHomeById(user.home_id);
  const coins = await userModel.getWallet(userId);
  return {
    ...sanitizeUser(user),
    coins,
    home: home ? { id: home.id, name: home.name } : null,
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, homeId: user.home_id, role: user.role },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    homeId: user.home_id,
    xp: user.xp,
  };
}

export { signToken };
