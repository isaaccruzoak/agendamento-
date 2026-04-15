const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'agendamento.db');

let db = null;

function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  seedDefaultSettings();

  console.log('✅ Banco de dados inicializado em', DB_PATH);
  return db;
}

function getDb() {
  if (!db) return initDb();
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      phone     TEXT    NOT NULL,
      notes     TEXT    DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id                INTEGER  PRIMARY KEY AUTOINCREMENT,
      client_id         INTEGER  NOT NULL,
      service           TEXT     NOT NULL,
      date              TEXT     NOT NULL,
      time              TEXT     NOT NULL,
      status            TEXT     DEFAULT 'scheduled',
      reminders_enabled INTEGER  DEFAULT 1,
      custom_message    TEXT     DEFAULT '',
      price             REAL     DEFAULT 0,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_logs (
      id               INTEGER  PRIMARY KEY AUTOINCREMENT,
      appointment_id   INTEGER  NOT NULL,
      reminder_type    TEXT     NOT NULL,
      sent_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      status           TEXT     DEFAULT 'sent',
      message          TEXT     DEFAULT '',
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedDefaultSettings() {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const defaults = [
    ['reminders_enabled',      'true'],
    ['working_hours_start',    '8'],
    ['working_hours_end',      '18'],
    ['price_per_slot',         '100'],
    ['reminder_message_1day',  'Olá, {nome}! 📅 Lembrete do seu horário *amanhã* dia {data} às {hora} para *{servico}*. Qualquer dúvida, entre em contato. Te esperamos!'],
    ['reminder_message_1hour', 'Olá, {nome}! ⏰ Seu horário é *daqui a 1 hora*, às {hora} para *{servico}*. Já estamos te aguardando! 😊'],
    ['whatsapp_sender_phone',  ''],
  ];
  for (const [key, value] of defaults) ins.run(key, value);
}

module.exports = { initDb, getDb };
