const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT,
        default_hourly_rate REAL NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS final_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_number TEXT NOT NULL,
        report_date TEXT NOT NULL,
        cash_sum REAL DEFAULT 0,
        zelle_sum REAL DEFAULT 0,
        cc_sum REAL DEFAULT 0,
        venmo_sum REAL DEFAULT 0,
        heavy_sum REAL DEFAULT 0,
        tips_sum REAL DEFAULT 0,
        gas_sum REAL DEFAULT 0,
        total_labor_cost REAL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS report_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        final_report_id INTEGER,
        worker_id INTEGER,
        hours_worked REAL NOT NULL,
        actual_hourly_rate REAL NOT NULL,
        additional_cost REAL DEFAULT 0,
        heavy INTEGER DEFAULT 0,
        tips INTEGER DEFAULT 0,
        gas INTEGER DEFAULT 0,
        FOREIGN KEY (final_report_id) REFERENCES final_reports(id),
        FOREIGN KEY (worker_id) REFERENCES workers(id)
    )`);

    const insertWorkers = db.prepare("INSERT OR IGNORE INTO workers (id, name, phone_number, default_hourly_rate) VALUES (?, ?, ?, ?)");
    insertWorkers.run(1, 'Іван Петров', '099-111-22-33', 150);
    insertWorkers.run(2, 'Марія Іванова', '067-444-55-66', 175);
    insertWorkers.finalize();

    const insertFinalReport = db.prepare(`INSERT OR IGNORE INTO final_reports (id, job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertFinalReport.run(1, 'JOB001', '2025-08-29', 50, 30, 20, 10, 100, 50, 25, 300, (err) => {
        if (err) console.error('Error inserting test final report:', err);
    });
    insertFinalReport.finalize();

    const insertReportEntry = db.prepare(`INSERT OR IGNORE INTO report_entries (final_report_id, worker_id, hours_worked, actual_hourly_rate, additional_cost, heavy, tips, gas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertReportEntry.run(1, 1, 8, 150, 50, 1, 1, 0, (err) => {
        if (err) console.error('Error inserting test report entry:', err);
    });
    insertReportEntry.finalize();
});

app.get('/workers', (req, res) => {
    db.all("SELECT id, name, phone_number, default_hourly_rate FROM workers", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/final-reports', (req, res) => {
    const sql = `
        SELECT 
            final_reports.id,
            final_reports.job_number,
            final_reports.report_date,
            final_reports.cash_sum,
            final_reports.zelle_sum,
            final_reports.cc_sum,
            final_reports.venmo_sum,
            (final_reports.cash_sum + final_reports.zelle_sum + final_reports.cc_sum + final_reports.venmo_sum) AS total_payment,
            final_reports.heavy_sum,
            final_reports.tips_sum,
            final_reports.gas_sum,
            final_reports.total_labor_cost,
            COUNT(report_entries.id) AS worker_count,
            SUM((report_entries.hours_worked * report_entries.actual_hourly_rate) + report_entries.additional_cost) AS total_cost
        FROM final_reports
        LEFT JOIN report_entries ON final_reports.id = report_entries.final_report_id
        GROUP BY final_reports.id
        ORDER BY final_reports.id DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/final-reports', (req, res) => {
    const { job_number, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, reports, total_labor_cost } = req.body;
    if (!job_number || !reports || reports.length === 0) {
        return res.status(400).json({ error: "Job number and reports are required" });
    }

    const report_date = new Date().toISOString().split('T')[0];
    
    db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            console.error('Помилка початку транзакції:', beginErr.message);
            return res.status(500).json({ error: beginErr.message });
        }

        db.run(`INSERT INTO final_reports (job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost || 0], 
            function(insertErr) {
                if (insertErr) {
                    db.run('ROLLBACK');
                    console.error('Помилка вставки в final_reports:', insertErr.message);
                    return res.status(500).json({ error: insertErr.message });
                }

                const final_report_id = this.lastID;
                const stmt = db.prepare(`INSERT INTO report_entries (final_report_id, worker_id, hours_worked, actual_hourly_rate, additional_cost, heavy, tips, gas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

                const insertReportEntries = (index) => {
                    if (index >= reports.length) {
                        stmt.finalize();
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                console.error('Помилка COMMIT:', commitErr.message);
                                return res.status(500).json({ error: commitErr.message });
                            }
                            return res.status(201).json({ id: final_report_id, message: "Final report created successfully" });
                        });
                        return;
                    }

                    const report = reports[index];
                    stmt.run(final_report_id, report.worker_id, report.hours_worked, report.actual_hourly_rate, report.additional_cost, report.heavy ? 1 : 0, report.tips ? 1 : 0, report.gas ? 1 : 0, (runErr) => {
                        if (runErr) {
                            db.run('ROLLBACK');
                            console.error('Помилка вставки в report_entries:', runErr.message);
                            return res.status(500).json({ error: runErr.message });
                        }
                        insertReportEntries(index + 1);
                    });
                };
                
                insertReportEntries(0);
            });
    });
});

app.get('/final-reports/:id', (req, res) => {
    const reportId = req.params.id;
    const reportData = {};

    db.get(`SELECT 
            final_reports.*,
            (final_reports.cash_sum + final_reports.zelle_sum + final_reports.cc_sum + final_reports.venmo_sum) AS total_payment
        FROM final_reports WHERE final_reports.id = ?`, 
        [reportId], 
        (err, reportRow) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!reportRow) {
                return res.status(404).json({ error: "Report not found" });
            }
            reportData.report = reportRow;

            db.all(`SELECT report_entries.*, workers.name AS worker_name, workers.phone_number 
                    FROM report_entries 
                    LEFT JOIN workers ON report_entries.worker_id = workers.id 
                    WHERE final_report_id = ?`, 
                [reportId], 
                (err, entries) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    reportData.entries = entries;
                    res.json(reportData);
                });
        });
});

app.post('/workers', (req, res) => {
    const { name, phone_number, default_hourly_rate } = req.body;
    if (!name || !default_hourly_rate) {
        res.status(400).json({ error: "Name and default_hourly_rate are required" });
        return;
    }
    db.run(`INSERT INTO workers (name, phone_number, default_hourly_rate) VALUES (?, ?, ?)`,
        [name, phone_number || null, default_hourly_rate],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json({ id: this.lastID, name });
        });
});

app.put('/workers/:id', (req, res) => {
    const { id } = req.params;
    const { name, phone_number, default_hourly_rate } = req.body;
    if (!name || !default_hourly_rate) {
        res.status(400).json({ error: "Name and default_hourly_rate are required" });
        return;
    }
    db.run(`UPDATE workers SET name = ?, phone_number = ?, default_hourly_rate = ? WHERE id = ?`,
        [name, phone_number || null, default_hourly_rate, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(200).json({ updatedID: id });
        });
});

app.delete('/final-reports/:id', (req, res) => {
    const { id } = req.params;

    db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            return res.status(500).json({ error: beginErr.message });
        }

        db.run(`DELETE FROM report_entries WHERE final_report_id = ?`, id, (deleteEntriesErr) => {
            if (deleteEntriesErr) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: deleteEntriesErr.message });
            }

            db.run(`DELETE FROM final_reports WHERE id = ?`, id, (deleteReportErr) => {
                if (deleteReportErr) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: deleteReportErr.message });
                }

                db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                        return res.status(500).json({ error: commitErr.message });
                    }
                    res.status(200).json({ message: "Звіт успішно видалено" });
                });
            });
        });
    });
});

app.delete('/workers/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM workers WHERE id = ?`, id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(200).json({ deletedID: id });
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});