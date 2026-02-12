const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Отримати всі нарахування зарплат (JOIN final_reports, report_entries, workers)
app.get('/salary-entries', (req, res) => {
    const sql = `
        SELECT report_entries.id, final_reports.job_number, final_reports.report_date, workers.name AS worker_name, report_entries.hours_worked, report_entries.actual_hourly_rate, report_entries.additional_cost, report_entries.heavy, report_entries.tips, report_entries.gas, report_entries.paid
        FROM report_entries
        LEFT JOIN final_reports ON report_entries.final_report_id = final_reports.id
        LEFT JOIN workers ON report_entries.worker_id = workers.id
        ORDER BY final_reports.report_date DESC, final_reports.job_number DESC, report_entries.id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Оновити статус paid для конкретного запису report_entries
app.put('/salary-entries/:id/paid', (req, res) => {
    const { id } = req.params;
    const { paid } = req.body;
    db.run('UPDATE report_entries SET paid = ? WHERE id = ?', [paid ? 1 : 0, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(200).json({ id, paid: paid ? 1 : 0 });
    });
});

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
        email TEXT,
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
        paid INTEGER DEFAULT 0,
        FOREIGN KEY (final_report_id) REFERENCES final_reports(id),
        FOREIGN KEY (worker_id) REFERENCES workers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )`);

    const insertWorkers = db.prepare("INSERT OR IGNORE INTO workers (id, name, phone_number, email, default_hourly_rate) VALUES (?, ?, ?, ?, ?)");
    insertWorkers.run(1, 'Іван Петров', '099-111-22-33', 'ivan@example.com', 150);
    insertWorkers.run(2, 'Марія Іванова', '067-444-55-66', 'maria@example.com', 175);
    insertWorkers.finalize();

    const testReportDate = '2025-08-29T10:00';
    const insertFinalReport = db.prepare(`INSERT OR IGNORE INTO final_reports (id, job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertFinalReport.run(1, 'JOB001', testReportDate, 50, 30, 20, 10, 100, 50, 25, 300, (err) => {
        if (err) console.error('Error inserting test final report:', err);
    });
    insertFinalReport.finalize();

    const insertReportEntry = db.prepare(`INSERT OR IGNORE INTO report_entries (final_report_id, worker_id, hours_worked, actual_hourly_rate, additional_cost, heavy, tips, gas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertReportEntry.run(1, 1, 8, 150, 50, 1, 1, 0, (err) => {
        if (err) console.error('Error inserting test report entry:', err);
    });
    insertReportEntry.finalize();
});

function logAction(action, details) {
    const timestamp = new Date().toISOString();
    db.run(`INSERT INTO logs (action, details, timestamp) VALUES (?, ?, ?)`, [action, details, timestamp], (err) => {
        if (err) {
            console.error('Помилка запису в лог:', err.message);
        }
    });
}

app.get('/workers', (req, res) => {
    db.all("SELECT id, name, phone_number, email, default_hourly_rate FROM workers", [], (err, rows) => {
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
        console.log('Дані, повернуті з /final-reports:', rows);
        res.json(rows);
    });
});

app.post('/final-reports', (req, res) => {
    const { job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, reports, total_labor_cost } = req.body;
    if (!job_number || !reports || reports.length === 0) {
        return res.status(400).json({ error: "Job number and reports are required" });
    }

    console.log('Вхідна report_date:', report_date);
    let final_report_date;
    if (report_date) {
        const parsed = new Date(report_date);
        if (isNaN(parsed.getTime())) {
            return res.status(400).json({ error: "Invalid report_date" });
        }
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        const hours = String(parsed.getHours()).padStart(2, '0');
        const minutes = String(parsed.getMinutes()).padStart(2, '0');
        final_report_date = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        final_report_date = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    console.log('Збережена final_report_date:', final_report_date);

    db.get('SELECT id FROM final_reports WHERE job_number = ?', [job_number], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            return res.status(400).json({ error: `Звіт з номером роботи '${job_number}' вже існує.` });
        }

        db.run('BEGIN TRANSACTION', (beginErr) => {
            if (beginErr) {
                console.error('Помилка початку транзакції:', beginErr.message);
                return res.status(500).json({ error: beginErr.message });
            }

            db.run(`INSERT INTO final_reports (job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [job_number, final_report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost || 0],
                function(insertErr) {
                    if (insertErr) {
                        db.run('ROLLBACK');
                        console.error('Помилка вставки в final_reports:', insertErr.message);
                        return res.status(500).json({ error: insertErr.message });
                    }

                    const final_report_id = this.lastID;
                    logAction('ADD_REPORT', `Додано звіт з номером ${job_number} (ID: ${final_report_id})`);

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
});

// Оновлення фінального звіту (PUT /final-reports/:id)
app.put('/final-reports/:id', (req, res) => {
    const { id } = req.params;
    const { job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, reports, total_labor_cost } = req.body;
    if (!job_number || !reports || reports.length === 0) {
        return res.status(400).json({ error: "Job number and reports are required" });
    }

    db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            return res.status(500).json({ error: beginErr.message });
        }
        db.run(`UPDATE final_reports SET job_number = ?, report_date = ?, cash_sum = ?, zelle_sum = ?, cc_sum = ?, venmo_sum = ?, heavy_sum = ?, tips_sum = ?, gas_sum = ?, total_labor_cost = ? WHERE id = ?`,
            [job_number, report_date, cash_sum, zelle_sum, cc_sum, venmo_sum, heavy_sum, tips_sum, gas_sum, total_labor_cost || 0, id],
            function(updateErr) {
                if (updateErr) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: updateErr.message });
                }
                db.run(`DELETE FROM report_entries WHERE final_report_id = ?`, [id], function(deleteErr) {
                    if (deleteErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: deleteErr.message });
                    }
                    const stmt = db.prepare(`INSERT INTO report_entries (final_report_id, worker_id, hours_worked, actual_hourly_rate, additional_cost, heavy, tips, gas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                    const insertEntries = (index) => {
                        if (index >= reports.length) {
                            stmt.finalize();
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    return res.status(500).json({ error: commitErr.message });
                                }
                                return res.status(200).json({ id, message: "Final report updated successfully" });
                            });
                            return;
                        }
                        const report = reports[index];
                        stmt.run(id, report.worker_id, report.hours_worked, report.actual_hourly_rate, report.additional_cost || 0, report.heavy ? 1 : 0, report.tips ? 1 : 0, report.gas ? 1 : 0, (runErr) => {
                            if (runErr) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: runErr.message });
                            }
                            insertEntries(index + 1);
                        });
                    };
                    insertEntries(0);
                });
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

            db.all(`SELECT report_entries.*, workers.name AS worker_name, workers.phone_number, workers.email 
                    FROM report_entries 
                    LEFT JOIN workers ON report_entries.worker_id = workers.id 
                    WHERE final_report_id = ?`, 
                [reportId], 
                (err, entries) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    reportData.entries = entries;
                    console.log('Дані, повернуті з /final-reports/:id:', reportData);
                    res.json(reportData);
                });
        });
});

app.post('/workers', (req, res) => {
    const { name, phone_number, email, default_hourly_rate } = req.body;
    if (!name || !default_hourly_rate) {
        res.status(400).json({ error: "Name and default_hourly_rate are required" });
        return;
    }
    db.run(`INSERT INTO workers (name, phone_number, email, default_hourly_rate) VALUES (?, ?, ?, ?)`,
        [name, phone_number || null, email || null, default_hourly_rate],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            logAction('ADD_WORKER', `Додано працівника ${name} (ID: ${this.lastID})`);
            res.status(201).json({ id: this.lastID, name });
        });
});

app.put('/workers/:id', (req, res) => {
    const { id } = req.params;
    const { name, phone_number, email, default_hourly_rate } = req.body;
    if (!name || !default_hourly_rate) {
        res.status(400).json({ error: "Name and default_hourly_rate are required" });
        return;
    }
    db.run(`UPDATE workers SET name = ?, phone_number = ?, email = ?, default_hourly_rate = ? WHERE id = ?`,
        [name, phone_number || null, email || null, default_hourly_rate, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            logAction('UPDATE_WORKER', `Оновлено працівника з ID ${id}: ${name}`);
            res.status(200).json({ updatedID: id });
        });
});

app.delete('/final-reports/:id', (req, res) => {
    const { id } = req.params;

    db.get(`SELECT job_number FROM final_reports WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: "Report not found" });
            return;
        }

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
                        logAction('DELETE_REPORT', `Видалено звіт з номером ${row.job_number} (ID: ${id})`);
                        res.status(200).json({ message: "Звіт успішно видалено" });
                    });
                });
            });
        });
    });
});

app.delete('/workers/:id', (req, res) => {
    const { id } = req.params;

    db.get(`SELECT name FROM workers WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: "Worker not found" });
            return;
        }

        db.run(`DELETE FROM workers WHERE id = ?`, id, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            logAction('DELETE_WORKER', `Видалено працівника ${row.name} (ID: ${id})`);
            res.status(200).json({ deletedID: id });
        });
    });
});

app.get('/logs', (req, res) => {
    db.all(`SELECT action, details, timestamp FROM logs ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.delete('/logs', (req, res) => {
    db.run(`DELETE FROM logs`, (err) => {
        if (err) {
            console.error('Помилка при очищенні логу:', err.message);
            return res.status(500).json({ error: err.message });
        }
        logAction('CLEAR_LOGS', 'Всі записи логу очищено');
        res.status(200).json({ message: "Лог успішно очищено" });
    });
});

app.post('/logs', (req, res) => {
    const { action, details } = req.body;
    if (!action || !details) {
        return res.status(400).json({ error: "Action and details are required" });
    }
    logAction(action, details);
    res.status(201).json({ message: "Log entry created successfully" });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});