const { getDb } = require('../database/db');
const { isValidDate, internalError, safeError } = require('../middleware/validate');

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function getDashboardStats(req, res) {
  try {
    const db = getDb();
    const today = req.query.date || getTodayStr();

    const settings = {};
    db.prepare('SELECT key, value FROM settings').all().forEach(r => { settings[r.key] = r.value; });

    const workStart    = parseInt(settings.working_hours_start || 8);
    const workEnd      = parseInt(settings.working_hours_end   || 18);
    const pricePerSlot = parseFloat(settings.price_per_slot    || 100);
    const totalSlots   = workEnd - workStart;

    // Appointments today
    const appts = db.prepare(`
      SELECT a.*, c.name AS client_name
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.date = ? AND a.status != 'cancelled'
      ORDER BY a.time ASC
    `).all(today);

    // Compute free slots
    const bookedHours = appts.map(a => parseInt(a.time.split(':')[0]));
    const allHours    = Array.from({ length: totalSlots }, (_, i) => workStart + i);
    const freeHours   = allHours.filter(h => !bookedHours.includes(h));

    // Revenue
    const revenue          = appts.filter(a => a.status === 'completed').reduce((s, a) => s + (a.price || 0), 0);
    const potentialRevenue = appts.reduce((s, a) => s + (a.price || pricePerSlot), 0);
    const potentialLost    = freeHours.length * pricePerSlot;

    // Occupancy
    const occupancyRate = totalSlots > 0 ? Math.round((appts.length / totalSlots) * 100) : 0;
    const dayStatus = occupancyRate >= 70 ? 'green' : occupancyRate >= 30 ? 'yellow' : 'red';

    // Upcoming appointments (next 7 days)
    const upcoming = db.prepare(`
      SELECT a.*, c.name AS client_name
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.date > ? AND a.status = 'scheduled'
      ORDER BY a.date ASC, a.time ASC
      LIMIT 10
    `).all(today);

    // Monthly revenue
    const monthStart = today.substring(0, 7) + '-01';
    const monthStats = db.prepare(`
      SELECT COUNT(*) AS total, SUM(price) AS revenue
      FROM appointments
      WHERE date >= ? AND date <= ? AND status != 'cancelled'
    `).get(monthStart, today);

    res.json({
      today,
      appointments: appts,
      upcoming,
      stats: {
        totalSlots,
        bookedSlots:    appts.length,
        freeSlots:      freeHours.length,
        freeSlotsList:  freeHours.map(h => `${pad(h)}:00`),
        allSlotsList:   allHours.map(h => ({ hour: `${pad(h)}:00`, booked: bookedHours.includes(h) })),
        occupancyRate,
        revenue,
        potentialRevenue,
        potentialLost,
        dayStatus,
      },
      month: {
        total:   monthStats.total   || 0,
        revenue: monthStats.revenue || 0,
      },
    });
  } catch (err) {
    console.error('[dashboard] getDashboardStats:', err.message);
    internalError(res);
  }
}

function getFreeSlots(req, res) {
  try {
    const { date } = req.query;
    if (!date) return safeError(res, 400, 'Data é obrigatória');
    if (!isValidDate(date)) return safeError(res, 400, 'Formato de data inválido');

    const db = getDb();
    const settings = {};
    db.prepare('SELECT key, value FROM settings').all().forEach(r => { settings[r.key] = r.value; });

    const workStart = parseInt(settings.working_hours_start || 8);
    const workEnd   = parseInt(settings.working_hours_end   || 18);

    const booked = db.prepare(
      "SELECT time FROM appointments WHERE date = ? AND status != 'cancelled'"
    ).all(date).map(a => a.time);

    const allSlots = Array.from({ length: workEnd - workStart }, (_, i) => `${pad(workStart + i)}:00`);
    const free     = allSlots.filter(s => !booked.includes(s));

    res.json({ date, allSlots, booked, freeSlots: free });
  } catch (err) {
    console.error('[dashboard] getFreeSlots:', err.message);
    internalError(res);
  }
}

module.exports = { getDashboardStats, getFreeSlots };
