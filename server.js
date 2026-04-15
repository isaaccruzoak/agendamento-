require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { initDb } = require('./src/database/db');
const clientRoutes      = require('./src/routes/clients');
const appointmentRoutes = require('./src/routes/appointments');
const dashboardRoutes   = require('./src/routes/dashboard');
const settingsRoutes    = require('./src/routes/settings');
const whatsappRoutes    = require('./src/routes/whatsapp');
const { startScheduler } = require('./src/services/schedulerService');
const { initWhatsApp }   = require('./src/services/whatsappService');
const { generalLimiter } = require('./src/middleware/rateLimiter');

const app  = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: false,       // API-only server
  xPoweredBy: false,                  // remove X-Powered-By: Express
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// Remove server fingerprinting
app.disable('x-powered-by');

// CORS restrito à origem do frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Payload máximo de 50 KB — evita DoS por corpo gigante
app.use(express.json({ limit: '50kb' }));

// Rate limit global
app.use('/api', generalLimiter);

app.use('/api/clients', clientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Agendamento API', version: '1.0.0' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Global error handler — never leak stack traces to clients
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

initDb();
startScheduler();

if (process.env.WHATSAPP_ENABLED !== 'false') {
  // Small delay to let the server start first
  setTimeout(() => initWhatsApp(), 2000);
}

app.listen(PORT, () => {
  console.log(`\n✅ Backend rodando em http://localhost:${PORT}`);
  console.log(`📋 API disponível em http://localhost:${PORT}/api`);
});
