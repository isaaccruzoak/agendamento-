const { getDb } = require('../database/db');
const {
  sanitizeStr, sanitizePhone,
  isValidPhone,
  safeError, internalError,
} = require('../middleware/validate');

// Columns returned to the client — never expose internal fields by accident
const SAFE_COLS = 'id, name, phone, notes, created_at';

function getAllClients(req, res) {
  try {
    const db = getDb();
    const clients = db.prepare(`SELECT ${SAFE_COLS} FROM clients ORDER BY name ASC`).all();
    res.json(clients);
  } catch {
    internalError(res);
  }
}

function getClientById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  try {
    const db = getDb();
    const client = db.prepare(`SELECT ${SAFE_COLS} FROM clients WHERE id = ?`).get(id);
    if (!client) return safeError(res, 404, 'Cliente não encontrado');
    res.json(client);
  } catch {
    internalError(res);
  }
}

function createClient(req, res) {
  const { name, phone, notes } = req.body;

  if (!name || !phone) return safeError(res, 400, 'Nome e telefone são obrigatórios');

  const cleanName  = sanitizeStr(name, 120);
  const cleanPhone = sanitizePhone(phone);
  const cleanNotes = sanitizeStr(notes, 500);

  if (!cleanName)              return safeError(res, 400, 'Nome inválido');
  if (!isValidPhone(cleanPhone)) return safeError(res, 400, 'Telefone inválido (mínimo 10 dígitos)');

  try {
    const db = getDb();

    // Prevent duplicate phone numbers
    const dup = db.prepare('SELECT id FROM clients WHERE phone = ?').get(cleanPhone);
    if (dup) return safeError(res, 409, 'Já existe um cliente com este número de telefone');

    const result = db.prepare(
      'INSERT INTO clients (name, phone, notes) VALUES (?, ?, ?)'
    ).run(cleanName, cleanPhone, cleanNotes);

    const client = db.prepare(`SELECT ${SAFE_COLS} FROM clients WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(client);
  } catch {
    internalError(res);
  }
}

function updateClient(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existing) return safeError(res, 404, 'Cliente não encontrado');

    const { name, phone, notes } = req.body;

    const cleanName  = name  !== undefined ? sanitizeStr(name, 120)    : existing.name;
    const cleanPhone = phone !== undefined ? sanitizePhone(phone)       : existing.phone;
    const cleanNotes = notes !== undefined ? sanitizeStr(notes, 500)    : existing.notes;

    if (!cleanName)                return safeError(res, 400, 'Nome inválido');
    if (!isValidPhone(cleanPhone)) return safeError(res, 400, 'Telefone inválido (mínimo 10 dígitos)');

    // Check duplicate phone for another client
    if (phone !== undefined) {
      const dup = db.prepare('SELECT id FROM clients WHERE phone = ? AND id != ?').get(cleanPhone, id);
      if (dup) return safeError(res, 409, 'Já existe outro cliente com este número de telefone');
    }

    db.prepare('UPDATE clients SET name = ?, phone = ?, notes = ? WHERE id = ?')
      .run(cleanName, cleanPhone, cleanNotes, id);

    res.json(db.prepare(`SELECT ${SAFE_COLS} FROM clients WHERE id = ?`).get(id));
  } catch {
    internalError(res);
  }
}

function deleteClient(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(id);
    if (!existing) return safeError(res, 404, 'Cliente não encontrado');

    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ message: 'Cliente removido com sucesso' });
  } catch {
    internalError(res);
  }
}

module.exports = { getAllClients, getClientById, createClient, updateClient, deleteClient };
