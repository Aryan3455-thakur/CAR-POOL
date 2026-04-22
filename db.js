require('dotenv').config();
const mysql = require('mysql2/promise');
// XAMPP: MySQL often listens on 3307 when port 3306 is already in use — set DB_PORT in .env to match XAMPP Control Panel.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nmims_carpool',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
module.exports = pool;