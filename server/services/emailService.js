const nodemailer = require('nodemailer')

/**
 * Email transport strategy:
 *   - SMTP_HOST set → use real SMTP relay (Brevo, SES, Mailpit, etc.)
 *   - SMTP_HOST not set → console-only mode: log the full email to stdout.
 *     No network connection required, no SSL issues, works on every OS.
 *
 * To use a real SMTP relay, add to server/.env:
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=you@example.com
 *   SMTP_PASS=yourpassword
 */

const APP_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const FROM = process.env.EMAIL_FROM || 'Streakr <noreply@streakr.app>'

// ---------------------------------------------------------------------------
// Transporter — built once and cached
// ---------------------------------------------------------------------------

let _transporter = null
let _devMode = false

function getTransporter() {
  if (_transporter) return _transporter

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  } else {
    // Console transport — prints the email body to stdout.
    // No external service, no SSL, no network required.
    _devMode = true
    _transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    })
    console.log('[EMAIL] No SMTP_HOST configured — running in console-only mode.')
    console.log('[EMAIL] All emails will be printed to this terminal.')
  }

  return _transporter
}

// ---------------------------------------------------------------------------
// Dev helper — pretty-print the message and highlight the important link
// ---------------------------------------------------------------------------
function logDevEmail(label, toEmail, link) {
  const divider = '─'.repeat(60)
  console.log(`\n[EMAIL] ${divider}`)
  console.log(`[EMAIL] To:      ${toEmail}`)
  console.log(`[EMAIL] Subject: ${label}`)
  console.log(`[EMAIL] Link:    ${link}`)
  console.log(`[EMAIL] ${divider}\n`)
}

// ---------------------------------------------------------------------------
// sendPasswordResetEmail
// ---------------------------------------------------------------------------
async function sendPasswordResetEmail(toEmail, rawToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`

  if (_devMode || !process.env.SMTP_HOST) {
    getTransporter() // ensure _devMode flag is set
    logDevEmail('Reset your Streakr password', toEmail, resetUrl)
    return
  }

  await getTransporter().sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Reset your Streakr password',
    text: [
      'You requested a password reset for your Streakr account.',
      '',
      `Reset link (valid for 1 hour): ${resetUrl}`,
      '',
      "If you didn't request this, you can safely ignore this email."
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
}

// ---------------------------------------------------------------------------
// sendPartnerInviteEmail
// ---------------------------------------------------------------------------
async function sendPartnerInviteEmail(toEmail, inviterEmail, rawToken) {
  const inviteUrl = `${APP_URL}/accept-invite?token=${rawToken}`

  if (_devMode || !process.env.SMTP_HOST) {
    getTransporter()
    logDevEmail(`${inviterEmail} invited you on Streakr`, toEmail, inviteUrl)
    return
  }

  await getTransporter().sendMail({
    from: FROM,
    to: toEmail,
    subject: `${inviterEmail} wants you as their accountability partner on Streakr`,
    text: [
      `${inviterEmail} has invited you to be their accountability partner on Streakr.`,
      '',
      "As a partner, you'll be able to see their weekly completion rate and send encouragement.",
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
}

// ---------------------------------------------------------------------------
// sendWeeklyDigest
// ---------------------------------------------------------------------------
async function sendWeeklyDigest(toEmail, ownerEmail, completionRate) {
  if (_devMode || !process.env.SMTP_HOST) {
    getTransporter()
    logDevEmail(
      `${ownerEmail}'s weekly Streakr update`,
      toEmail,
      `${APP_URL} (${completionRate}% completion this week)`
    )
    return
  }

  await getTransporter().sendMail({
    from: FROM,
    to: toEmail,
    subject: `${ownerEmail}'s weekly Streakr update`,
    text: `Your friend ${ownerEmail} completed ${completionRate}% of their habits this week. Send them some encouragement!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1e293b">
        <h2 style="color:#0f172a">Weekly update</h2>
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
}

module.exports = { sendPasswordResetEmail, sendPartnerInviteEmail, sendWeeklyDigest }
