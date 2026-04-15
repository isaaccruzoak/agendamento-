const path = require('path');

let Client, LocalAuth, qrcodeTerminal;
let clientInstance = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';

// Lazy-load to avoid crash if puppeteer is not available
function loadLibs() {
  try {
    const wwjs = require('whatsapp-web.js');
    Client = wwjs.Client;
    LocalAuth = wwjs.LocalAuth;
    qrcodeTerminal = require('qrcode-terminal');
    return true;
  } catch (e) {
    console.warn('⚠️  whatsapp-web.js não disponível:', e.message);
    return false;
  }
}

async function initWhatsApp() {
  if (!loadLibs()) {
    connectionStatus = 'unavailable';
    return;
  }

  if (clientInstance && connectionStatus === 'ready') {
    console.log('WhatsApp já conectado.');
    return;
  }

  console.log('🟡 Inicializando WhatsApp...');
  connectionStatus = 'connecting';

  clientInstance = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '../../../data/whatsapp_session'),
    }),
    puppeteer: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  });

  clientInstance.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code abaixo com seu WhatsApp:');
    qrcodeTerminal.generate(qr, { small: true });
    qrCodeData = qr;
    connectionStatus = 'qr';
  });

  clientInstance.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    qrCodeData = null;
    connectionStatus = 'ready';
  });

  clientInstance.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
    connectionStatus = 'disconnected';
    qrCodeData = null;
    clientInstance = null;
  });

  clientInstance.on('auth_failure', (msg) => {
    console.error('❌ Falha de autenticação WhatsApp:', msg);
    connectionStatus = 'error';
    clientInstance = null;
  });

  try {
    await clientInstance.initialize();
  } catch (err) {
    console.error('❌ Erro ao inicializar WhatsApp:', err.message);
    connectionStatus = 'error';
    clientInstance = null;
  }
}

async function sendMessage(phone, message) {
  if (!clientInstance || connectionStatus !== 'ready') {
    throw new Error(`WhatsApp não está conectado. Status atual: ${connectionStatus}`);
  }

  const formatted = formatPhone(phone);
  const chatId = `${formatted}@c.us`;

  await clientInstance.sendMessage(chatId, message);
  console.log(`📤 Mensagem enviada para +${formatted}`);
  return true;
}

function formatPhone(phone) {
  let n = phone.replace(/\D/g, '');
  // Add Brazil country code if missing
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return n;
}

function getStatus() {
  return connectionStatus;
}

function getQRCode() {
  return qrCodeData;
}

async function disconnect() {
  if (clientInstance) {
    try { await clientInstance.logout(); } catch (_) {}
    clientInstance = null;
    connectionStatus = 'disconnected';
    qrCodeData = null;
    console.log('WhatsApp desconectado.');
  }
}

module.exports = { initWhatsApp, sendMessage, getStatus, getQRCode, disconnect };
