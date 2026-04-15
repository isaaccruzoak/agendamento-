const { getDb } = require('../database/db');
const {
  filterSettingsPayload, ALLOWED_SETTINGS_KEYS,
  sanitizeStr, sanitizePhone, isValidHour, isValidPrice,
  safeError, internalError,
} = require('../middleware/validate');

function getSettings(req, res) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    // Only return known keys — never expose unexpected DB rows
    const settings = {};
    rows.forEach(r => {
      if (ALLOWED_SETTINGS_KEYS.has(r.key)) settings[r.key] = r.value;
    });
    res.json(settings);
  } catch {
    internalError(res);
  }
}

function updateSettings(req, res) {
  // Strip unknown keys and limit value length
  const payload = filterSettingsPayload(req.body);

  if (Object.keys(payload).length === 0) {
    return safeError(res, 400, 'Nenhuma configuração válida enviada');
  }

  // Validate specific keys
  if ('working_hours_start' in payload && !isValidHour(payload.working_hours_start, 0, 23)) {
    return safeError(res, 400, 'Hora de início inválida (0–23)');
  }
  if ('working_hours_end' in payload && !isValidHour(payload.working_hours_end, 1, 24)) {
    return safeError(res, 400, 'Hora de encerramento inválida (1–24)');
  }
  if ('price_per_slot' in payload && !isValidPrice(payload.price_per_slot)) {
    return safeError(res, 400, 'Preço inválido');
  }
  if ('reminders_enabled' in payload && !['true', 'false'].includes(payload.reminders_enabled)) {
    return safeError(res, 400, 'Valor inválido para reminders_enabled');
  }

  // Sanitize phone
  if ('whatsapp_sender_phone' in payload) {
    payload.whatsapp_sender_phone = sanitizePhone(payload.whatsapp_sender_phone);
  }

  // Sanitize message templates
  if ('reminder_message_1day' in payload) {
    payload.reminder_message_1day = sanitizeStr(payload.reminder_message_1day, 1000);
  }
  if ('reminder_message_1hour' in payload) {
    payload.reminder_message_1hour = sanitizeStr(payload.reminder_message_1hour, 1000);
  }

  try {
    const db = getDb();
    const upsert = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );

    const transaction = db.transaction((updates) => {
      for (const [key, value] of Object.entries(updates)) {
        upsert.run(key, String(value));
      }
    });

    transaction(payload);

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      if (ALLOWED_SETTINGS_KEYS.has(r.key)) settings[r.key] = r.value;
    });
    res.json(settings);
  } catch {
    internalError(res);
  }
}

module.exports = { getSettings, updateSettings };
