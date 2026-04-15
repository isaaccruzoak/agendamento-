const { getDb } = require('../database/db');
const { sendReminderNow } = require('../services/reminderService');
const {
  sanitizeStr, sanitizePhone, isValidPhone,
  isValidDate, isValidTime, isValidStatus, isValidPrice,
  safeError, internalError,
} = require('../middleware/validate');

const VALID_SERVICES = new Set([
  'Corte de cabelo', 'Manicure', 'Pedicure', 'Coloração', 'Hidratação',
  'Escova', 'Sobrancelha', 'Maquiagem', 'Massagem', 'Limpeza de pele',
  'Consulta', 'Outro',
])

const JOIN_CLIENT = `
  SELECT a.id, a.client_id, a.service, a.date, a.time, a.status,
         a.reminders_enabled, a.custom_message, a.price, a.created_at,
         c.name AS client_name, c.phone AS client_phone
  FROM appointments a
  JOIN clients c ON a.client_id = c.id
`

function getAllAppointments(req, res) {
  try {
    const db = getDb();
    const { date, status, client_id, dateFrom, dateTo } = req.query;

    let q = JOIN_CLIENT + ' WHERE 1=1';
    const params = [];

    if (date) {
      if (!isValidDate(date)) return safeError(res, 400, 'Formato de data inválido');
      q += ' AND a.date = ?'; params.push(date);
    }
    if (dateFrom) {
      if (!isValidDate(dateFrom)) return safeError(res, 400, 'Formato de data inválido (dateFrom)');
      q += ' AND a.date >= ?'; params.push(dateFrom);
    }
    if (dateTo) {
      if (!isValidDate(dateTo)) return safeError(res, 400, 'Formato de data inválido (dateTo)');
      q += ' AND a.date <= ?'; params.push(dateTo);
    }
    if (status) {
      if (!isValidStatus(status)) return safeError(res, 400, 'Status inválido');
      q += ' AND a.status = ?'; params.push(status);
    }
    if (client_id) {
      const cid = parseInt(client_id, 10);
      if (!Number.isInteger(cid) || cid <= 0) return safeError(res, 400, 'client_id inválido');
      q += ' AND a.client_id = ?'; params.push(cid);
    }

    q += ' ORDER BY a.date ASC, a.time ASC';

    res.json(db.prepare(q).all(...params));
  } catch {
    internalError(res);
  }
}

function createAppointment(req, res) {
  try {
    const { client_id, name, phone, service, date, time, reminders_enabled, custom_message, price } = req.body;

    if (!service || !date || !time) {
      return safeError(res, 400, 'Serviço, data e hora são obrigatórios');
    }

    if (!client_id && (!name || !phone)) {
      return safeError(res, 400, 'Informe o cliente ou nome + telefone');
    }

    if (!isValidDate(date)) return safeError(res, 400, 'Data inválida (use YYYY-MM-DD)');
    if (!isValidTime(time)) return safeError(res, 400, 'Hora inválida (use HH:MM)');

    const cleanService = sanitizeStr(service, 100);
    if (!VALID_SERVICES.has(cleanService)) return safeError(res, 400, 'Serviço não permitido');

    if (price !== undefined && !isValidPrice(price)) {
      return safeError(res, 400, 'Valor inválido');
    }

    const cleanMessage = sanitizeStr(custom_message, 1000);
    const safePrice    = isValidPrice(price) ? Number(price) : 0;

    const db = getDb();

    // Resolve or auto-create client
    let cid;
    if (client_id) {
      cid = parseInt(client_id, 10);
      if (!Number.isInteger(cid) || cid <= 0) return safeError(res, 400, 'Cliente inválido');
      const exists = db.prepare('SELECT id FROM clients WHERE id = ?').get(cid);
      if (!exists) return safeError(res, 404, 'Cliente não encontrado');
    } else {
      const cleanName  = sanitizeStr(name, 200);
      const cleanPhone = sanitizePhone(phone);
      if (!cleanName)              return safeError(res, 400, 'Nome inválido');
      if (!isValidPhone(cleanPhone)) return safeError(res, 400, 'Telefone inválido (10–13 dígitos)');

      // Find by phone or create
      const existing = db.prepare('SELECT id FROM clients WHERE phone = ?').get(cleanPhone);
      if (existing) {
        cid = existing.id;
      } else {
        const r = db.prepare('INSERT INTO clients (name, phone) VALUES (?, ?)').run(cleanName, cleanPhone);
        cid = r.lastInsertRowid;
      }
    }

    // Check slot availability
    const conflict = db.prepare(
      "SELECT id FROM appointments WHERE date = ? AND time = ? AND status != 'cancelled'"
    ).get(date, time);
    if (conflict) return safeError(res, 409, 'Este horário já está ocupado');

    const result = db.prepare(`
      INSERT INTO appointments (client_id, service, date, time, reminders_enabled, custom_message, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      cid, cleanService, date, time,
      reminders_enabled !== false ? 1 : 0,
      cleanMessage,
      safePrice,
    );

    const appt = db.prepare(JOIN_CLIENT + ' WHERE a.id = ?').get(result.lastInsertRowid);

    if (appt.reminders_enabled) {
      sendReminderNow(appt, 'confirmation').catch(() => {});
    }

    res.status(201).json(appt);
  } catch {
    internalError(res);
  }
}

function updateAppointment(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!existing) return safeError(res, 404, 'Agendamento não encontrado');

    const { service, date, time, status, reminders_enabled, custom_message, price } = req.body;

    if (date   !== undefined && !isValidDate(date))     return safeError(res, 400, 'Data inválida');
    if (time   !== undefined && !isValidTime(time))     return safeError(res, 400, 'Hora inválida');
    if (status !== undefined && !isValidStatus(status)) return safeError(res, 400, 'Status inválido');
    if (price  !== undefined && !isValidPrice(price))   return safeError(res, 400, 'Valor inválido');

    let cleanService = existing.service;
    if (service !== undefined) {
      cleanService = sanitizeStr(service, 100);
      if (!VALID_SERVICES.has(cleanService)) return safeError(res, 400, 'Serviço não permitido');
    }

    db.prepare(`
      UPDATE appointments SET
        service = ?, date = ?, time = ?, status = ?,
        reminders_enabled = ?, custom_message = ?, price = ?
      WHERE id = ?
    `).run(
      cleanService,
      date   ?? existing.date,
      time   ?? existing.time,
      status ?? existing.status,
      reminders_enabled !== undefined ? (reminders_enabled ? 1 : 0) : existing.reminders_enabled,
      custom_message    !== undefined ? sanitizeStr(custom_message, 1000) : existing.custom_message,
      price             !== undefined ? Number(price) : existing.price,
      id,
    );

    res.json(db.prepare(JOIN_CLIENT + ' WHERE a.id = ?').get(id));
  } catch {
    internalError(res);
  }
}

function cancelAppointment(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  try {
    const db = getDb();
    const existing = db.prepare('SELECT id, status FROM appointments WHERE id = ?').get(id);
    if (!existing) return safeError(res, 404, 'Agendamento não encontrado');
    if (existing.status === 'cancelled') return safeError(res, 409, 'Agendamento já está cancelado');

    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
    res.json({ message: 'Agendamento cancelado com sucesso' });
  } catch {
    internalError(res);
  }
}

function getReminderLogs(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  try {
    const db = getDb();
    // Ensure appointment exists before returning logs
    const apptExists = db.prepare('SELECT id FROM appointments WHERE id = ?').get(id);
    if (!apptExists) return safeError(res, 404, 'Agendamento não encontrado');

    const logs = db.prepare(
      'SELECT id, appointment_id, reminder_type, sent_at, status, message FROM reminder_logs WHERE appointment_id = ? ORDER BY sent_at DESC'
    ).all(id);
    res.json(logs);
  } catch {
    internalError(res);
  }
}

module.exports = { getAllAppointments, createAppointment, updateAppointment, cancelAppointment, getReminderLogs };
