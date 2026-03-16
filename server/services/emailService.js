const nodemailer = require('nodemailer')

/**
 * Creates a nodemailer transporter from environment variables.
 * All free options:
 *   - Dev:  SMTP_HOST=smtp.ethereal.email  (auto-catch, no real emails sent)
 *   - Prod: any SMTP relay (Brevo free tier, Mailpit self-hosted, etc.)
 *
 * If no SMTP config is provided, falls back to Ethereal (free ephemeral accounts)
 * and logs the preview URL to console — useful for dev without any setup.
 */

let transporter = null

async function getTransporter() {
  if (transporter) return transporter

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  } else {
    // Auto-create a free Ethereal test account for zero-config dev.
    // tls.rejectUnauthorized:false is required on Windows where Node.js
    // rejects Ethereal's self-signed certificate chain.
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      },
      tls: { rejectUnauthorized: false }
    })
    console.log('[EMAIL] No SMTP config found — using Ethereal test account.')
    console.log(`[EMAIL] Ethereal user: ${testAccount.user}`)
  }

  return transporter
}

const FROM = process.env.EMAIL_FROM || 'Streakr <noreply@streakr.app>'
const APP_URL = process.env.CLIENT_URL || 'http://localhost:5173'

/**
 * Send a password reset email.
 * @param {string} toEmail
 * @param {string} rawToken - the unhashed token to embed in the link
 */
async function sendPasswordResetEmail(toEmail, rawToken) {
  const transport = await getTransporter()
  const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`

  // Always log the link in dev so it's usable even when SMTP is unreachable
  if (!process.env.SMTP_HOST) {
    console.log(`[EMAIL] Password reset link for ${toEmail}: ${resetUrl}`)
  }

  const info = await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Reset your Streakr password',
    text: [
      'You requested a password reset for your Streakr account.',
      '',
      `Reset link (valid for 1 hour): ${resetUrl}`,
      '',
      "If you didn't request this, you can safely ignore this email.",
      'Your password will not change until you click the link above and choose a new one.'
    ].join('\n'),
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1e293b">
        <h2 style="color:#0f172a;margin-bottom:8px">Reset your password</h2>
        <p style="color:#475569">You requested a password reset for your Streakr account.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#14b8a6;color:white;text-decoration:none;border-radius:10px;font-weight:600">
          Reset Password
        </a>
        <p style="color:#94a3b8;font-size:13px">
          This link expires in 1 hour.<br>
          If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#cbd5e1;font-size:12px">Streakr &mdash; Habit tracking without the guilt</p>
      </body>
      </html>
    `
  })

  // In dev with Ethereal, log the preview URL
  if (!process.env.SMTP_HOST) {
    console.log(`[EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
  }

  return info
}

/**
 * Send a partner invite email.
 * @param {string} toEmail
 * @param {string} inviterEmail
 * @param {string} rawToken
 */
async function sendPartnerInviteEmail(toEmail, inviterEmail, rawToken) {
  const transport = await getTransporter()
  const inviteUrl = `${APP_URL}/accept-invite?token=${rawToken}`

  const info = await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${inviterEmail} wants you as their accountability partner on Streakr`,
    text: [
      `${inviterEmail} has invited you to be their accountability partner on Streakr.`,
      '',
      "As a partner, you'll be able to see their weekly completion rate and send encouragement.",
      "You won't be penalized if they miss a habit — it's purely supportive.",
      '',
      `Accept invite: ${inviteUrl}`,
      '',
      'This link expires in 7 days.'
    ].join('\n'),
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1e293b">
        <h2 style="color:#0f172a;margin-bottom:8px">You've been invited!</h2>
        <p style="color:#475569">
          <strong>${inviterEmail}</strong> wants you to be their accountability partner on Streakr.
        </p>
        <p style="color:#475569;font-size:14px">
          As a partner, you'll see their weekly completion rate and can send encouragement.
          No one gets penalized for missing habits — Streakr is zero-punishment.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#14b8a6;color:white;text-decoration:none;border-radius:10px;font-weight:600">
          Accept Invite
        </a>
        <p style="color:#94a3b8;font-size:13px">This link expires in 7 days.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#cbd5e1;font-size:12px">Streakr &mdash; Habit tracking without the guilt</p>
      </body>
      </html>
    `
  })

  if (!process.env.SMTP_HOST) {
    console.log(`[EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
  }

  return info
}

/**
 * Send weekly partner digest.
 * @param {string} toEmail - partner's email
 * @param {string} ownerEmail
 * @param {number} completionRate - percentage 0-100
 */
async function sendWeeklyDigest(toEmail, ownerEmail, completionRate) {
  const transport = await getTransporter()

  const info = await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${ownerEmail}'s weekly Streakr update`,
    text: `Your friend ${ownerEmail} completed ${completionRate}% of their habits this week. Send them some encouragement!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1e293b">
        <h2 style="color:#0f172a">Weekly update 🎉</h2>
        <p style="color:#475569">
          <strong>${ownerEmail}</strong> completed
          <strong style="font-size:24px;color:#14b8a6">${completionRate}%</strong>
          of their habits this week.
        </p>
        <a href="${APP_URL}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#14b8a6;color:white;text-decoration:none;border-radius:10px;font-weight:600">
          Send encouragement
        </a>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#cbd5e1;font-size:12px">Streakr &mdash; Habit tracking without the guilt</p>
      </body>
      </html>
    `
  })

  if (!process.env.SMTP_HOST) {
    console.log(`[EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
  }

  return info
}

module.exports = { sendPasswordResetEmail, sendPartnerInviteEmail, sendWeeklyDigest }
