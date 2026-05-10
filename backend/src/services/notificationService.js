import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { Notification } from '../models/Notification.js';

const hasSmtp = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass }
    })
  : null;

export const createNotification = async ({ user, type, title, message, relatedComplaint }) => {
  return Notification.create({ user, type, title, message, relatedComplaint });
};

export const sendEmail = async ({ to, subject, text }) => {
  if (!transporter || !to) {
    return { skipped: true };
  }

  return transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text
  });
};
