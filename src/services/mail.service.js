import nodemailer from "nodemailer";
import { getActivationTokenHours, getFrontendUrl, getSmtpConfig } from "../config/env.js";

function createTransport(smtp) {
  const secure = smtp.port === 465;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure,
    requireTLS: !secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    tls: {
      rejectUnauthorized: smtp.tlsRejectUnauthorized,
    },
  });
}

function buildActivationContent({ name, url, hours }) {
  const subject = "Activa tu cuenta HomeOps";
  const text = [
    `Hola ${name},`,
    "",
    "Gracias por registrarte en HomeOps. Para crear tu contraseña y activar tu cuenta, abre este enlace:",
    url,
    "",
    `El enlace caduca en ${hours} horas.`,
    "",
    "Si no te registraste, puedes ignorar este correo.",
  ].join("\n");

  const html = `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Gracias por registrarte en <strong>HomeOps</strong>.</p>
    <p><a href="${url}">Crear contraseña y activar cuenta</a></p>
    <p>O copia este enlace en el navegador:<br><code>${url}</code></p>
    <p>El enlace caduca en <strong>${hours} horas</strong>.</p>
    <p>Si no te registraste, ignora este correo.</p>
  `.trim();

  return { subject, text, html };
}

function buildInvitationContent({ homeName, url, hours }) {
  const subject = `Te han invitado a ${homeName} en HomeOps`;
  const text = [
    "Hola,",
    "",
    `Te han invitado a unirte al hogar «${homeName}» en HomeOps.`,
    "Al abrir el enlace podrás elegir tu nombre, crear tu contraseña y entrar en la app:",
    url,
    "",
    `El enlace caduca en ${hours} horas.`,
    "",
    "Si no esperabas esta invitación, puedes ignorar este correo.",
  ].join("\n");

  const html = `
    <p>Hola,</p>
    <p>Te han invitado a unirte al hogar <strong>${homeName}</strong> en HomeOps.</p>
    <p>Al abrir el enlace podrás elegir tu nombre, crear tu contraseña y entrar en la app.</p>
    <p><a href="${url}">Unirme al hogar</a></p>
    <p>O copia este enlace en el navegador:<br><code>${url}</code></p>
    <p>El enlace caduca en <strong>${hours} horas</strong>.</p>
    <p>Si no esperabas esta invitación, ignora este correo.</p>
  `.trim();

  return { subject, text, html };
}

async function deliverMail({ email, subject, text, html, logLabel, url }) {
  const smtp = getSmtpConfig();

  if (!smtp.host) {
    console.log(`\n========== HomeOps — ${logLabel} ==========`);
    console.log(`Para: ${email}`);
    console.log(`Enlace: ${url}`);
    console.log("====================================================\n");
    return { sent: false, devLink: url };
  }

  if (!smtp.user || !smtp.pass) {
    throw new Error("SMTP_HOST definido pero faltan SMTP_USER o SMTP_PASS.");
  }

  const transport = createTransport(smtp);
  await transport.sendMail({
    from: `"HomeOps" <${smtp.from}>`,
    to: email,
    subject,
    text,
    html,
  });

  console.log(`[mail] ${logLabel} enviado a ${email} vía ${smtp.host}`);
  return { sent: true, devLink: url };
}

/**
 * Sin SMTP_HOST imprime el enlace en consola. Con SMTP configurado, envía email real.
 */
export async function sendActivationEmail({ email, name, token }) {
  const url = `${getFrontendUrl()}/establecer-contrasena?token=${token}`;
  const hours = getActivationTokenHours();
  const { subject, text, html } = buildActivationContent({ name, url, hours });
  return deliverMail({
    email,
    subject,
    text,
    html,
    logLabel: "Activación de cuenta",
    url,
  });
}

export async function sendInvitationEmail({ email, homeName, token }) {
  const url = `${getFrontendUrl()}/establecer-contrasena?token=${token}`;
  const hours = getActivationTokenHours();
  const { subject, text, html } = buildInvitationContent({ homeName, url, hours });
  return deliverMail({
    email,
    subject,
    text,
    html,
    logLabel: "Invitación al hogar",
    url,
  });
}
