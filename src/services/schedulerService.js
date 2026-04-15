const cron = require('node-cron');
const { checkAndSendReminders } = require('./reminderService');

function startScheduler() {
  // Check every minute
  cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendReminders();
    } catch (err) {
      console.error('Erro no scheduler de lembretes:', err.message);
    }
  });

  console.log('⏰ Scheduler iniciado — lembretes verificados a cada minuto');
}

module.exports = { startScheduler };
