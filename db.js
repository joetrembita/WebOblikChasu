// db.js — клієнт до PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,    // Railway додасть цю змінну сам
  // ssl: { rejectUnauthorized: false }          // якщо раптом буде вимагатись SSL
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
