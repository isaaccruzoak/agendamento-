const router  = require('express').Router();
const qrcode  = require('qrcode');
const { getStatus, getQRCode, initWhatsApp, disconnect, sendMessage } = require('../services/whatsappService');
const { sendReminderNow } = require('../services/reminderService');
const { getDb } = require('../database/db');
const { strictLimiter } = require('../middleware/rateLimiter');
const { adminAuth } = require('../middleware/adminAuth');
const { sanitizeStr, isValidPhone, sanitizePhone, internalError, safeError } = require('../middleware/validate');

router.get('/status', adminAuth, (req, res) => {
  res.json({ status: getStatus() });
});

router.get('/qr', adminAuth, async (req, res) => {
  const qrData = getQRCode();
  if (!qrData) return res.json({ qr: null, status: getStatus() });

  try {
    const qrImage = await qrcode.toDataURL(qrData);
    res.json({ qr: qrImage, status: getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/connect', adminAuth, strictLimiter, async (req, res) => {
  try {
    initWhatsApp(); // non-blocking intentional
    res.json({ message: 'Iniciando conexão com WhatsApp...' });
  } catch {
    internalError(res)
  }
});

router.post('/disconnect', adminAuth, strictLimiter, async (req, res) => {
  try {
    await disconnect();
    res.json({ message: 'WhatsApp desconectado com sucesso' });
  } catch {
    internalError(res)
  }
});

router.post('/test', adminAuth, strictLimiter, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return safeError(res, 400, 'Telefone e mensagem são obrigatórios');

  const cleanPhone = sanitizePhone(phone);
  if (!isValidPhone(cleanPhone)) return safeError(res, 400, 'Número de telefone inválido');

  const cleanMessage = sanitizeStr(message, 1000);
  if (!cleanMessage) return safeError(res, 400, 'Mensagem inválida');

  try {
    await sendMessage(cleanPhone, cleanMessage);
    res.json({ message: 'Mensagem de teste enviada!' });
  } catch {
    internalError(res)
  }
});

const VALID_REMINDER_TYPES = new Set(['1_day', '1_hour', 'confirmation'])

router.post('/send-reminder/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return safeError(res, 400, 'ID inválido');

  const type = req.body.type || '1_day';
  if (!VALID_REMINDER_TYPES.has(type)) return safeError(res, 400, 'Tipo de lembrete inválido');

  try {
    const db = getDb();
    const appt = db.prepare(`
      SELECT a.*, c.name AS client_name, c.phone AS client_phone
      FROM appointments a JOIN clients c ON a.client_id = c.id
      WHERE a.id = ?
    `).get(id);

    if (!appt) return safeError(res, 404, 'Agendamento não encontrado');

    await sendReminderNow(appt, type);
    res.json({ message: 'Lembrete enviado com sucesso!' });
  } catch {
    internalError(res)
  }
});

module.exports = router;
