/**
 * Input validation & sanitization helpers.
 * Used by controllers to reject or clean untrusted data before it reaches the DB.
 */

// Strip HTML/script tags and trim. Prevents stored-XSS via text fields.
function sanitizeStr(val, maxLen = 500) {
  if (val === null || val === undefined) return ''
  if (typeof val !== 'string') return ''
  return val.trim().replace(/<[^>]*>/g, '').replace(/[^\S\r\n]+/g, ' ').slice(0, maxLen)
}

// Phone: digits only, 10–13 digits (BR numbers with or without country code)
function isValidPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13
}

function sanitizePhone(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 13)
}

// Date: must be YYYY-MM-DD and a real calendar date
function isValidDate(val) {
  if (typeof val !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false
  const d = new Date(val + 'T12:00:00')
  return !isNaN(d.getTime())
}

// Time: HH:MM (24h)
function isValidTime(val) {
  return typeof val === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(val)
}

// Status whitelist for appointments
const VALID_STATUSES = new Set(['scheduled', 'completed', 'cancelled', 'no_show'])
function isValidStatus(val) {
  return VALID_STATUSES.has(val)
}

// Price: non-negative number, max R$99999
function isValidPrice(val) {
  const n = Number(val)
  return !isNaN(n) && n >= 0 && n <= 99999
}

// Integer hour 0–23 or 1–24
function isValidHour(val, min = 0, max = 24) {
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= min && n <= max
}

// Allowed settings keys — prevents arbitrary key injection
const ALLOWED_SETTINGS_KEYS = new Set([
  'reminders_enabled',
  'working_hours_start',
  'working_hours_end',
  'price_per_slot',
  'reminder_message_1day',
  'reminder_message_1hour',
  'whatsapp_sender_phone',
])

function filterSettingsPayload(body) {
  const safe = {}
  for (const key of ALLOWED_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      safe[key] = String(body[key]).slice(0, 1000)
    }
  }
  return safe
}

// Generic safe error — never exposes internal stack/message to clients
function safeError(res, code, msg) {
  return res.status(code).json({ error: msg })
}

function internalError(res) {
  return res.status(500).json({ error: 'Erro interno. Tente novamente.' })
}

module.exports = {
  sanitizeStr,
  sanitizePhone,
  isValidPhone,
  isValidDate,
  isValidTime,
  isValidStatus,
  isValidPrice,
  isValidHour,
  filterSettingsPayload,
  ALLOWED_SETTINGS_KEYS,
  safeError,
  internalError,
}
