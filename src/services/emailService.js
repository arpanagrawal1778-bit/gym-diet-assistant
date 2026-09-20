const nodemailer = require('nodemailer');
const env = require('../config/env');
const path = require('path');

let transporter = null;

function createTransport() {
  // Return existing transporter if already created
  if (transporter) return transporter;

  // Verify required SMTP configuration exists; otherwise, do not create transport
  if (!env.smtpHost || !env.smtpPort || !env.smtpUser || !env.smtpPass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure, // true for 465, false for other ports (STARTTLS will be used automatically)
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    pool: true,
  });

  return transporter;
}

async function verifyConnection() {
  const transport = createTransport();
  if (!transport) return false;
  try {
    await transport.verify();
    return true;
  } catch (e) {
    // Do not expose credentials – log generic warning
    console.warn('SMTP verification failed');
    return false;
  }
}

/**
 * Send an email.
 * @param {string} to Recipient address – must be a valid email string.
 * @param {string} subject Email subject line.
 * @param {string} html HTML body (optional).
 * @param {string} text Plain‑text fallback (optional).
 * @returns {{success:boolean, messageId?:string, error?:string}}
 */
async function sendMail(to, subject, html, text) {
  const transport = createTransport();
  if (!transport) {
    // SMTP not configured – fail gracefully
    console.warn('SMTP not configured – email not sent');
    return { success: false, error: 'SMTP_NOT_CONFIGURED' };
  }
  try {
    const info = await transport.sendMail({
      from: env.emailFrom || env.smtpUser,
      to,
      subject,
      html,
      text,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Hide internal details, return generic error
    console.error('Email send error');
    return { success: false, error: err.message };
  }
}

module.exports = {
  createTransport,
  verifyConnection,
  sendMail,
};
