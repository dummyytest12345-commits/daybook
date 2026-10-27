import { env } from '../config/env.js'

/**
 * Email templates in the Daybook look: indigo brand header, white card, rounded button.
 * Built with tables and inline styles because email clients ignore modern CSS (and SVG).
 * Every dynamic value is HTML-escaped. Each template returns { subject, html, text }.
 */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const C = { brand: '#4f46e5', brand2: '#7c83ff', ink: '#0f172a', muted: '#475569', line: '#e2e8f0', canvas: '#f1f5f9', soft: '#eef2ff', ok: '#16a34a' }
const FONT = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Round "book" logo mark made of table cells, so it renders everywhere. */
const logo = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;vertical-align:middle">
  <tr>
    <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;border-radius:10px;background:${C.brand2};background-image:linear-gradient(135deg,${C.brand2},#4338ca);font-family:${FONT};font-size:20px;line-height:40px;color:#ffffff;font-weight:800">&#10003;</td>
    <td style="padding-left:10px;font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.2px">Daybook</td>
  </tr>
</table>`

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px">
  <tr><td align="center" bgcolor="${C.brand}" style="border-radius:10px;background:${C.brand}">
    <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}</a>
  </td></tr>
</table>`

/** A mini project card (colour dot, name, key, who) shown inside the message. */
const projectCard = ({ name, key, color, by, role }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border:1px solid ${C.line};border-radius:12px;background:${C.soft}">
  <tr>
    <td width="6" style="width:6px;background:${esc(color || C.brand)};border-radius:12px 0 0 12px">&nbsp;</td>
    <td style="padding:16px 18px;font-family:${FONT}">
      <div style="font-size:18px;font-weight:800;color:${C.ink}">${esc(name)} <span style="font-family:Consolas,monospace;font-size:12px;font-weight:600;color:${C.muted};background:#ffffff;border:1px solid ${C.line};border-radius:6px;padding:2px 6px;vertical-align:middle">${esc(key)}</span></div>
      <div style="margin-top:6px;font-size:14px;color:${C.muted}">Invited by <b style="color:${C.ink}">${esc(by)}</b> &middot; role: <b style="color:${C.ink}">${esc(role)}</b></div>
    </td>
  </tr>
</table>`

const features = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">
  ${['Add your own progress (0–100%) on shared tasks', 'Chat with the team inside each project', 'See everyone’s progress in one place'].map((t) => `<tr><td width="24" valign="top" style="padding:4px 0;font-family:${FONT};color:${C.ok};font-weight:800">&#10003;</td><td style="padding:4px 0;font-family:${FONT};font-size:15px;color:${C.ink}">${esc(t)}</td></tr>`).join('')}
</table>`

function layout({ preheader, title, bodyHtml, footerNote }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.canvas}"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
    <tr><td align="left" bgcolor="${C.brand}" style="padding:22px 28px;background:${C.brand};background-image:linear-gradient(135deg,#6366f1,#4338ca);border-radius:16px 16px 0 0">${logo}</td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:32px 28px;font-family:${FONT};color:${C.ink};border-left:1px solid ${C.line};border-right:1px solid ${C.line}">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;color:${C.ink}">${esc(title)}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 28px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};border:1px solid ${C.line};border-top:0;border-radius:0 0 16px 16px">
      <hr style="border:0;border-top:1px solid ${C.line};margin:0 0 16px">
      ${footerNote}<br>Sent by Daybook &middot; the work diary that writes your report.
    </td></tr>
  </table>
</td></tr></table></body></html>`
}

const p = (html) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.muted}">${html}</p>`

/** An existing Daybook user was added to a shared project. */
export function addedToProject({ toName, by, project, role }) {
  const link = `${env.appUrl}/team/${project.id}`
  const subject = `${by} added you to “${project.name}” on Daybook`
  const html = layout({
    preheader: `${by} added you to ${project.name}. Open it to add your progress.`,
    title: `You’re on the team, ${toName.split(' ')[0]}`,
    bodyHtml: `${p(`<b style="color:${C.ink}">${esc(by)}</b> added you to a shared project. You can already see its tasks, add your progress and chat with the team.`)}${projectCard({ ...project, by, role })}${features}${button(link, 'Open the project')}
      <p style="margin:8px 0 0;font-size:13px;color:${C.muted}">Button not working? Copy this link into your browser:<br><a href="${esc(link)}" style="color:${C.brand};word-break:break-all">${esc(link)}</a></p>`,
    footerNote: `You received this because you have a Daybook account with this email address.`,
  })
  const text = `${by} added you to "${project.name}" (${project.key}) on Daybook as ${role}.\n\nOpen the project: ${link}\n\nYou can add your progress on shared tasks and chat with the team.`
  return { subject, html, text }
}

/** The email has no account yet: invite them to register and join. */
export function inviteNewUser({ email, by, project, role, token, reminder = false }) {
  const link = `${env.appUrl}/join?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  const subject = `${reminder ? 'Reminder: ' : ''}${by} invited you to “${project.name}” on Daybook`
  const html = layout({
    preheader: `${by} invited you to collaborate on ${project.name}. Create a free account to join.`,
    title: `${by} invited you to collaborate`,
    bodyHtml: `${p(`Daybook is a work diary where teams track tasks together. <b style="color:${C.ink}">${esc(by)}</b> would like you to join their project. Create a free account with <b style="color:${C.ink}">${esc(email)}</b> and you will be added automatically.`)}${projectCard({ ...project, by, role })}${features}${button(link, 'Create account and join')}
      <p style="margin:8px 0 0;font-size:13px;color:${C.muted}">This invitation expires in 14 days. Button not working? Copy this link:<br><a href="${esc(link)}" style="color:${C.brand};word-break:break-all">${esc(link)}</a></p>`,
    footerNote: `You received this because ${esc(by)} entered your email address. If you don&#8217;t know them, you can ignore this email and nothing will happen.`,
  })
  const text = `${by} invited you to "${project.name}" (${project.key}) on Daybook as ${role}.\n\nCreate a free account with ${email} and you will be added automatically:\n${link}\n\nThis invitation expires in 14 days. If you don't know ${by}, ignore this email.`
  return { subject, html, text }
}
