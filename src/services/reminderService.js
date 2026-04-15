const { getDb } = require('../database/db');
const { sendMessage } = require('./whatsappService');

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function buildMessage(template, appt) {
  return template
    .replace(/{nome}/g,    appt.client_name)
    .replace(/{data}/g,    formatDateBR(appt.date))
    .replace(/{hora}/g,    appt.time)
    .replace(/{servico}/g, appt.service);
}

function getSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

async function sendReminderNow(appt, type) {
  const settings = getSettings();

  if (settings.reminders_enabled !== 'true') return;

  let template;
  if (type === 'confirmation') {
    template = `Olá, {nome}! ✅ Agendamento confirmado para *{data}* às *{hora}* — {servico}. Te esperamos!`;
  } else if (type === '1_day') {
    template = appt.custom_message || settings.reminder_message_1day;
  } else if (type === '1_hour') {
    template = appt.custom_message || settings.reminder_message_1hour;
  } else {
    return;
  }

  const message = buildMessage(template, appt);

  try {
    await sendMessage(appt.client_phone, message);
    logReminder(appt.id, type, 'sent', message);
    console.log(`✅ Lembrete [${type}] enviado para ${appt.client_name}`);
  } catch (err) {
    console.error(`❌ Falha no lembrete [${type}] para ${appt.client_name}:`, err.message);
    logReminder(appt.id, type, 'failed', err.message);
  }
}

function logReminder(appointmentId, type, status, message) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO reminder_logs (appointment_id, reminder_type, status, message) VALUES (?, ?, ?, ?)'
    ).run(appointmentId, type, status, message);
  } catch (e) {
    console.error('Erro ao registrar log de lembrete:', e.message);
  }
}

async function checkAndSendReminders() {
  const settings = getSettings();
  if (settings.reminders_enabled !== 'true') return;

  const db = getDb();
  const now = new Date();

  // Fetch appointments in the next 25 hours that are scheduled and reminders enabled
  const appts = db.prepare(`
    SELECT a.*, c.name AS client_name, c.phone AS client_phone
    FROM appointments a
    JOIN clients c ON a.client_id = c.id
    WHERE a.status = 'scheduled'
      AND a.reminders_enabled = 1
  `).all();

  for (const appt of appts) {
    const apptTime = new Date(`${appt.date}T${appt.time}:00`);
    const diffMs = apptTime.getTime() - now.getTime();
    const diffMin = diffMs / 60000;

    if (diffMin < 0) continue; // already passed

    // 1 day reminder: between 23h and 25h before
    if (diffMin >= 23 * 60 && diffMin <= 25 * 60) {
      const sent = db.prepare(
        "SELECT id FROM reminder_logs WHERE appointment_id = ? AND reminder_type = '1_day' AND status = 'sent'"
      ).get(appt.id);
      if (!sent) await sendReminderNow(appt, '1_day');
    }

    // 1 hour reminder: between 55 and 65 minutes before
    if (diffMin >= 55 && diffMin <= 65) {
      const sent = db.prepare(
        "SELECT id FROM reminder_logs WHERE appointment_id = ? AND reminder_type = '1_hour' AND status = 'sent'"
      ).get(appt.id);
      if (!sent) await sendReminderNow(appt, '1_hour');
    }
  }
}

module.exports = { sendReminderNow, checkAndSendReminders };
