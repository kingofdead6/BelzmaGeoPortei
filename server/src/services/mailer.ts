import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtpEnabled) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

interface Message {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoie un message. Sans configuration SMTP — cas courant en développement —
 * le contenu est journalisé plutôt qu'envoyé, et l'appelant n'échoue pas :
 * une réinitialisation de mot de passe reste testable en local.
 */
async function send(message: Message): Promise<void> {
  const mailer = getTransporter();

  if (!mailer) {
    logger.info(
      { to: message.to, subject: message.subject, body: message.text },
      "SMTP non configuré — message journalisé au lieu d'être envoyé",
    );
    return;
  }

  try {
    await mailer.sendMail({ from: env.SMTP_FROM, ...message });
  } catch (error) {
    // Un échec d'envoi ne doit pas faire échouer l'inscription ni révéler
    // qu'une adresse est enregistrée.
    logger.error({ err: error, to: message.to }, "Envoi du message impossible");
  }
}

const SIGNATURE = "\n\n—\nGéoportail du Parc National de Belezma\nWilaya de Batna, Algérie";

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string,
): Promise<void> {
  const link = `${env.CLIENT_ORIGIN[0] ?? ""}/verification-email/${token}`;
  await send({
    to,
    subject: "Confirmez votre adresse — Géoportail du Parc National de Belezma",
    text:
      `Bonjour ${displayName},\n\n` +
      "Votre compte a été créé sur le géoportail du Parc National de Belezma. " +
      "Confirmez votre adresse pour pouvoir déposer des contributions :\n\n" +
      `${link}\n\n` +
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message." +
      SIGNATURE,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  displayName: string,
  token: string,
): Promise<void> {
  const link = `${env.CLIENT_ORIGIN[0] ?? ""}/reinitialiser-mot-de-passe?token=${token}`;
  await send({
    to,
    subject: "Réinitialisation de votre mot de passe — Géoportail Belezma",
    text:
      `Bonjour ${displayName},\n\n` +
      "Vous avez demandé à réinitialiser votre mot de passe. Ce lien reste valable une heure :\n\n" +
      `${link}\n\n` +
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe " +
      "actuel reste inchangé." +
      SIGNATURE,
  });
}

/** Le motif du refus est transmis au contributeur (§8). */
export async function sendRejectionEmail(
  to: string,
  displayName: string,
  title: string,
  reason: string,
): Promise<void> {
  await send({
    to,
    subject: `Votre contribution « ${title} » n'a pas été publiée`,
    text:
      `Bonjour ${displayName},\n\n` +
      `Votre contribution « ${title} » a été examinée par l'équipe du parc et n'a pas été publiée ` +
      "pour le motif suivant :\n\n" +
      `${reason}\n\n` +
      "Vous pouvez la corriger depuis votre espace personnel et demander à nouveau sa publication." +
      SIGNATURE,
  });
}

export async function sendApprovalEmail(to: string, displayName: string, title: string): Promise<void> {
  await send({
    to,
    subject: `Votre contribution « ${title} » est publiée`,
    text:
      `Bonjour ${displayName},\n\n` +
      `Votre contribution « ${title} » a été validée par l'équipe du parc : elle est désormais ` +
      "visible de tous sur le géoportail." +
      SIGNATURE,
  });
}
