const rateLimit = require('express-rate-limit')

// General API limiter: 200 req / 15 min por IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
})

// Strict limiter para endpoints sensíveis (WhatsApp connect, test message): 10 req / 15 min
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de tentativas atingido. Aguarde antes de tentar novamente.' },
})

// Write limiter para criação/atualização de dados: 60 req / 15 min
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas operações em pouco tempo. Aguarde e tente novamente.' },
})

module.exports = { generalLimiter, strictLimiter, writeLimiter }
