--
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();

// 1) Порт для Railway / будь-якого PaaS
const PORT = process.env.PORT || 3000;

// 2) Підключення до Postgres (Railway надає DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Якщо провайдер вимагає SSL (інколи потрібно):
  // ssl: { rejectUnauthorized: false }
});

// 3) Базові мідлвари і, за потреби, статика (можеш прибрати, якщо фронт на Hostinger)
app.use(cors({
  origin: [
    'http://localhost:8080',
    'https://brakedown.up.railway.app'
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
}));
app.use(express.json());
app.use(express.static('frontend'));

// 4) Ініціалізація схеми (одноразово; "IF NOT EXISTS" — безпечний)
async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS workers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone_number TEXT,
        email TEXT,
        default_hourly_rate NUMERIC(10,2) NOT NULL
      );
    `);

    // final_reports — заголовок звіту
    await client.query(`
      CREATE TABLE IF NOT EXISTS final_reports (
        id SERIAL PRIMARY KEY,
        job_number TEXT NOT NULL UNIQUE,
        report_date TIMESTAMP NOT NULL,
        cash_sum   NUMERIC(10,2) DEFAULT 0,
        zelle_sum  NUMERIC(10,2) DEFAULT 0,
        cc_sum     NUMERIC(10,2) DEFAULT 0,
        venmo_sum  NUMERIC(10,2) DEFAULT 0,
        heavy_sum  NUMERIC(10,2) DEFAULT 0,
        tips_sum   NUMERIC(10,2) DEFAULT 0,
        gas_sum    NUMERIC(10,2) DEFAULT 0,
        total_labor_cost NUMERIC(10,2) DEFAULT 0
      );
    `);

    // report_entries — рядки звіту
    // worker_id: якщо працівника видалили — SET NULL
    // final_report_id: якщо звіт видалили — CASCADE (рядки підуть за ним)
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_entries (
        id SERIAL PRIMARY KEY,
        final_report_id INTEGER REFERENCES final_reports(id) ON DELETE CASCADE,
        worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
        hours_worked NUMERIC(10,2) NOT NULL,
        actual_hourly_rate NUMERIC(10,2) NOT NULL,
        additional_cost NUMERIC(10,2) DEFAULT 0,
        heavy BOOLEAN DEFAULT FALSE,
        tips  BOOLEAN DEFAULT FALSE,
        gas   BOOLEAN DEFAULT FALSE,
        paid  BOOLEAN DEFAULT FALSE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL
      );
    `);

    await client.query('COMMIT');
    console.log('Schema is ready.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Schema init error:', e);
    throw e;
  } finally {
    client.release();
  }
}

// 5) Утиліта логування дій
async function logAction(action, details) {
  try {
    await pool.query(
      `INSERT INTO logs (action, details, timestamp) VALUES ($1, $2, now())`,
      [action, details]
    );
  } catch (e) {
    console.error('Log write error:', e.message);
  }
}

// 6) Health-check
app.get('/health', (req, res) => res.send('ok'));

// 7) Маршрути

// A) Отримати всі нарахування (JOIN) — heavy/tips/gas/paid віддамо як 0/1 для сумісності з фронтом
app.get('/salary-entries', async (req, res) => {
  const sql = `
    SELECT 
      re.id,
      fr.job_number,
      fr.report_date,
      w.name AS worker_name,
      re.hours_worked,
      re.actual_hourly_rate,
      re.additional_cost,
      CASE WHEN re.heavy THEN 1 ELSE 0 END AS heavy,
      CASE WHEN re.tips  THEN 1 ELSE 0 END AS tips,
      CASE WHEN re.gas   THEN 1 ELSE 0 END AS gas,
      CASE WHEN re.paid  THEN 1 ELSE 0 END AS paid
    FROM report_entries re
    LEFT JOIN final_reports fr ON re.final_report_id = fr.id
    LEFT JOIN workers w        ON re.worker_id = w.id
    ORDER BY fr.report_date DESC, fr.job_number DESC, re.id DESC
  `;
  try {
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// B) Оновити статус paid для конкретного запису report_entries
app.put('/salary-entries/:id/paid', async (req, res) => {
  const { id } = req.params;
  const { paid } = req.body;
  try {
    await pool.query(`UPDATE report_entries SET paid = $1 WHERE id = $2`, [!!paid, id]);
    res.status(200).json({ id, paid: !!paid ? 1 : 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// C) Список працівників
app.get('/workers', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone_number, email, default_hourly_rate FROM workers ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// D) Додати працівника
app.post('/workers', async (req, res) => {
  const { name, phone_number, email, default_hourly_rate } = req.body;
  if (!name || default_hourly_rate == null) {
    return res.status(400).json({ error: 'Name and default_hourly_rate are required' });
  }
  try {
    const q = `
      INSERT INTO workers (name, phone_number, email, default_hourly_rate)
      VALUES ($1,$2,$3,$4) RETURNING id
    `;
    const { rows } = await pool.query(q, [name, phone_number || null, email || null, default_hourly_rate]);
    await logAction('ADD_WORKER', `Додано працівника ${name} (ID: ${rows[0].id})`);
    res.status(201).json({ id: rows[0].id, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// E) Оновити працівника
app.put('/workers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone_number, email, default_hourly_rate } = req.body;
  if (!name || default_hourly_rate == null) {
    return res.status(400).json({ error: 'Name and default_hourly_rate are required' });
  }
  try {
    await pool.query(
      `UPDATE workers SET name=$1, phone_number=$2, email=$3, default_hourly_rate=$4 WHERE id=$5`,
      [name, phone_number || null, email || null, default_hourly_rate, id]
    );
    await logAction('UPDATE_WORKER', `Оновлено працівника з ID ${id}: ${name}`);
    res.status(200).json({ updatedID: id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// F) Видалити працівника (worker_id у report_entries стане NULL завдяки ON DELETE SET NULL)
app.delete('/workers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`DELETE FROM workers WHERE id=$1 RETURNING id, name`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Worker not found' });
    await logAction('DELETE_WORKER', `Видалено працівника ${rows[0].name} (ID: ${id})`);
    res.status(200).json({ deletedID: id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// G) Список фінальних звітів (з агрегатами)
app.get('/final-reports', async (req, res) => {
  const sql = `
    SELECT 
      fr.id,
      fr.job_number,
      fr.report_date,
      fr.cash_sum, fr.zelle_sum, fr.cc_sum, fr.venmo_sum,
      fr.heavy_sum, fr.tips_sum, fr.gas_sum,
      fr.total_labor_cost,
      COUNT(re.id) AS worker_count,
      COALESCE(SUM((re.hours_worked * re.actual_hourly_rate) + re.additional_cost), 0) AS total_cost
    FROM final_reports fr
    LEFT JOIN report_entries re ON fr.id = re.final_report_id
    GROUP BY fr.id
    ORDER BY fr.id DESC
  `;
  try {
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// H) Створити фінальний звіт з рядками (транзакція)
app.post('/final-reports', async (req, res) => {
  let { job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, reports, total_labor_cost } = req.body;
  if (!job_number || !Array.isArray(reports) || reports.length === 0) {
    return res.status(400).json({ error: 'Job number and reports are required' });
  }

  // уніфікуємо дату до "YYYY-MM-DDTHH:mm"
  function toIsoMinute(s) {
    const d = s ? new Date(s) : new Date();
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
  const final_report_date = toIsoMinute(report_date);
  if (!final_report_date) return res.status(400).json({ error: 'Invalid report_date' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // перевірка унікальності job_number
    const existing = await client.query(`SELECT id FROM final_reports WHERE job_number=$1`, [job_number]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Звіт з номером роботи '${job_number}' вже існує.` });
    }

    const ins = `
      INSERT INTO final_reports
        (job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `;
    const { rows } = await client.query(ins, [
      job_number,
      final_report_date,
      cash_sum || 0, zelle_sum || 0, cc_sum || 0, venmo_sum || 0,
      heavy_sum || 0, tips_sum || 0, gas_sum || 0,
      total_labor_cost || 0
    ]);
    const final_report_id = rows[0].id;

    const stmt = `
      INSERT INTO report_entries
        (final_report_id, worker_id, hours_worked, actual_hourly_rate, additional_cost, heavy, tips, gas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `;
    for (const r of reports) {
      await client.query(stmt, [
        final_report_id,
        r.worker_id ?? null,
        r.hours_worked,
        r.actual_hourly_rate,
        r.additional_cost || 0,
        !!r.heavy,
        !!r.tips,
        !!r.gas
      ]);
    }

    await client.query('COMMIT');
    await logAction('ADD_REPORT', `Додано звіт з номером ${job_number} (ID: ${final_report_id})`);
    res.status(201).json({ id: final_report_id, message: 'Final report created successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// I) Оновлення фінального звіту (перезапис рядків)
app.put('/final-reports/:id', async (req, res) => {
  const { id } = req.params;
  let { job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, reports, total_labor_cost } = req.body;
  if (!job_number || !Array.isArray(reports) || reports.length === 0) {
    return res.status(400).json({ error: 'Job number and reports are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE final_reports
         SET job_number=$1, report_date=$2, cash_sum=$3, zelle_sum=$4, cc_sum=$5, venmo_sum=$6,
             heavy_sum=$7, tips_sum=$8, gas_sum=$9, total_labor_cost=$10
       WHERE id=$11
    `, [
      job_number, report_date, cash_sum || 0, zelle_sum || 0, cc_sum || 0, venmo_sum || 0,
      heavy_sum || 0, tips_sum || 0, gas_sum || 0, total_labor_cost || 0, id
    ]);

    await client.query(`DELETE FROM report_entries WHERE final_report_id=$1`, [id]);

    const stmt = `
      INSERT INTO report_entries
        (final_report_id, worker_id, hours_worked, actual_hourly_rate, additional_cost, heavy, tips, gas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `;
    for (const r of reports) {
      await client.query(stmt, [
        id,
        r.worker_id ?? null,
        r.hours_worked,
        r.actual_hourly_rate,
        r.additional_cost || 0,
        !!r.heavy,
        !!r.tips,
        !!r.gas
      ]);
    }

    await client.query('COMMIT');
    res.status(200).json({ id, message: 'Final report updated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// J) Один звіт + його рядки
app.get('/final-reports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const report = await pool.query(`
      SELECT fr.*,
             (COALESCE(fr.cash_sum,0) + COALESCE(fr.zelle_sum,0) + COALESCE(fr.cc_sum,0) + COALESCE(fr.venmo_sum,0)) AS total_payment
      FROM final_reports fr
      WHERE fr.id = $1
    `, [id]);

    if (!report.rowCount) return res.status(404).json({ error: 'Report not found' });

    const entries = await pool.query(`
      SELECT re.*,
             w.name AS worker_name,
             w.phone_number,
             w.email
      FROM report_entries re
      LEFT JOIN workers w ON re.worker_id = w.id
      WHERE re.final_report_id = $1
      ORDER BY re.id
    `, [id]);

    res.json({ report: report.rows[0], entries: entries.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// K) Видалити фінальний звіт (рядки видаляться завдяки ON DELETE CASCADE)
app.delete('/final-reports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // отримаємо job_number для логів
    const r = await pool.query(`DELETE FROM final_reports WHERE id=$1 RETURNING job_number`, [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Report not found' });
    await logAction('DELETE_REPORT', `Видалено звіт з номером ${r.rows[0].job_number} (ID: ${id})`);
    res.status(200).json({ message: 'Звіт успішно видалено' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// L) Логи
app.get('/logs', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT action, details, timestamp FROM logs ORDER BY timestamp DESC`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/logs', async (req, res) => {
  try {
    await pool.query(`DELETE FROM logs`);
    await logAction('CLEAR_LOGS', 'Всі записи логу очищено');
    res.status(200).json({ message: 'Лог успішно очищено' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/logs', async (req, res) => {
  const { action, details } = req.body;
  if (!action || !details) return res.status(400).json({ error: 'Action and details are required' });
  await logAction(action, details);
  res.status(201).json({ message: 'Log entry created successfully' });
});

// 8) Запускаємо сервер і схему
initSchema()
  .then(() => app.listen(PORT, () => console.log(`Server is running on port ${PORT}`)))
  .catch(err => {
    console.error('Failed to init schema:', err);
    process.exit(1);
  });
