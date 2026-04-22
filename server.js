require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const pool = require('./db');

const app = express();
const allowedDomains = ['gmail.com', 'nmims.in'];
const allowedCities = ['Chandigarh', 'Panchkula', 'Zirakpur'];

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'iamaryan',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
  })
);

app.use(express.static(path.join(__dirname)));

function sanitizeUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    userType: row.user_type,
    city: row.city
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Login required.' });
  }
  return next();
}

/** Log full error server-side; in development include message in JSON for easier debugging. */
function send500(res, error, publicMessage) {
  console.error(publicMessage, error);
  const message =
    process.env.NODE_ENV === 'production'
      ? publicMessage
      : `${publicMessage} (${error && error.message ? error.message : error})`;
  return res.status(500).json({ message });
}

app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, password, userType, city } = req.body;
    if (!fullName || !email || !password || !userType || !city) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    const domain = normalizedEmail.split('@')[1];
    if (!allowedDomains.includes(domain)) {
      return res.status(400).json({ message: 'Only @gmail.com or @nmims.in emails are allowed.' });
    }
    if (!allowedCities.includes(city)) {
      return res.status(400).json({ message: 'City must be Chandigarh, Panchkula, or Zirakpur.' });
    }
    if (!['student', 'teacher'].includes(userType)) {
      return res.status(400).json({ message: 'Invalid user type.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, user_type, city) VALUES (?, ?, ?, ?, ?)',
      [fullName.trim(), normalizedEmail, passwordHash, userType, city]
    );

    return res.status(201).json({ message: 'Registration successful.', userId: result.insertId });
  } catch (error) {
    return send500(res, error, 'Server error during registration.');
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password || '', user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const safeUser = sanitizeUser(user);
    req.session.user = safeUser;
    return res.json({ message: 'Login successful.', user: safeUser });
  } catch (error) {
    return send500(res, error, 'Server error during login.');
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

app.get('/api/session', (req, res) => {
  return res.json({ user: req.session.user || null });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [myRides] = await pool.query(
      'SELECT r.*, u.full_name AS rider_name FROM rides r JOIN users u ON u.id = r.rider_id WHERE r.rider_id = ? ORDER BY r.ride_date, r.ride_time',
      [userId]
    );
    const [availableRides] = await pool.query(
      "SELECT r.*, u.full_name AS rider_name FROM rides r JOIN users u ON u.id = r.rider_id WHERE r.status = 'active' AND r.available_seats > 0 ORDER BY r.ride_date, r.ride_time"
    );
    const [myRequests] = await pool.query(
      `SELECT rr.id, rr.status, rr.ride_id, r.pickup_city, r.pickup_point, r.ride_date, r.ride_time, u.full_name AS rider_name
       FROM ride_requests rr
       LEFT JOIN rides r ON r.id = rr.ride_id
       LEFT JOIN users u ON u.id = r.rider_id
       WHERE rr.requester_id = ?
       ORDER BY rr.created_at DESC`,
      [userId]
    );
    const [incomingRequests] = await pool.query(
      `SELECT rr.id, rr.status, rr.ride_id, rr.created_at, r.pickup_city, r.pickup_point, r.ride_date, r.ride_time, r.available_seats, u.full_name AS requester_name
       FROM ride_requests rr
       JOIN rides r ON r.id = rr.ride_id
       JOIN users u ON u.id = rr.requester_id
       WHERE r.rider_id = ? AND rr.status = 'pending'
       ORDER BY rr.created_at DESC`,
      [userId]
    );

    return res.json({ myRides, availableRides, myRequests, incomingRequests });
  } catch (error) {
    return send500(res, error, 'Could not load dashboard.');
  }
});

app.post('/api/rides', requireAuth, async (req, res) => {
  try {
    const { pickupCity, pickupPoint, rideDate, rideTime, totalSeats } = req.body;
    const seats = Number(totalSeats);
    if (!allowedCities.includes(pickupCity) || !pickupPoint || !rideDate || !rideTime || seats < 1) {
      return res.status(400).json({ message: 'Please enter valid ride details.' });
    }

    const [result] = await pool.query(
      `INSERT INTO rides (rider_id, pickup_city, pickup_point, ride_date, ride_time, total_seats, available_seats, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [req.session.user.id, pickupCity, pickupPoint.trim(), rideDate, rideTime, seats, seats]
    );

    return res.status(201).json({ message: 'Ride created successfully.', rideId: result.insertId });
  } catch (error) {
    return send500(res, error, 'Could not create ride.');
  }
});

app.patch('/api/rides/:rideId/toggle', requireAuth, async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const [rows] = await pool.query('SELECT * FROM rides WHERE id = ? AND rider_id = ?', [rideId, req.session.user.id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const ride = rows[0];
    const newStatus = ride.status === 'off' ? (ride.available_seats > 0 ? 'active' : 'full') : 'off';
    await pool.query('UPDATE rides SET status = ? WHERE id = ?', [newStatus, rideId]);
    return res.json({ message: 'Ride status updated.' });
  } catch (error) {
    return send500(res, error, 'Could not update ride.');
  }
});

app.post('/api/rides/:rideId/request', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const rideId = Number(req.params.rideId);
    await connection.beginTransaction();

    const [rideRows] = await connection.query('SELECT * FROM rides WHERE id = ? FOR UPDATE', [rideId]);
    if (!rideRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const ride = rideRows[0];
    if (ride.rider_id === req.session.user.id) {
      await connection.rollback();
      return res.status(400).json({ message: 'You cannot request your own ride.' });
    }
    if (ride.status !== 'active' || ride.available_seats <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Ride not available.' });
    }

    const [existing] = await connection.query(
      'SELECT id, status FROM ride_requests WHERE ride_id = ? AND requester_id = ?',
      [rideId, req.session.user.id]
    );
    if (existing.length) {
      if (existing[0].status === 'rejected') {
        await connection.query(
          'UPDATE ride_requests SET status = ? WHERE id = ?',
          ['pending', existing[0].id]
        );
        await connection.commit();
        return res.json({ message: 'Ride request submitted again.' });
      }
      await connection.rollback();
      return res.status(409).json({ message: 'You already have a request for this ride.' });
    }

    await connection.query(
      'INSERT INTO ride_requests (ride_id, requester_id, status) VALUES (?, ?, ?)',
      [rideId, req.session.user.id, 'pending']
    );

    await connection.commit();
    return res.json({ message: 'Ride request submitted. Waiting for rider approval.' });
  } catch (error) {
    await connection.rollback();
    return send500(res, error, 'Could not request ride.');
  } finally {
    connection.release();
  }
});

app.patch('/api/ride-requests/:requestId/decision', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const decision = String(req.body.decision || '').toLowerCase();
    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be accepted or rejected.' });
    }

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT rr.id, rr.status AS request_status, r.id AS ride_id, r.rider_id, r.available_seats, r.status AS ride_status
       FROM ride_requests rr
       JOIN rides r ON r.id = rr.ride_id
       WHERE rr.id = ?
       FOR UPDATE`,
      [requestId]
    );
    if (!rows.length || rows[0].rider_id !== req.session.user.id) {
      await connection.rollback();
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    const requestRow = rows[0];
    if (requestRow.request_status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: 'Only pending requests can be updated.' });
    }

    if (decision === 'rejected') {
      await connection.query('UPDATE ride_requests SET status = ? WHERE id = ?', ['rejected', requestId]);
      await connection.commit();
      return res.json({ message: 'Request rejected.' });
    }

    if (requestRow.available_seats <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'No seats available for this ride.' });
    }

    const newSeats = requestRow.available_seats - 1;
    const newStatus = newSeats <= 0 ? 'full' : requestRow.ride_status === 'off' ? 'off' : 'active';
    await connection.query('UPDATE rides SET available_seats = ?, status = ? WHERE id = ?', [newSeats, newStatus, requestRow.ride_id]);
    await connection.query('UPDATE ride_requests SET status = ? WHERE id = ?', ['accepted', requestId]);

    await connection.commit();
    return res.json({ message: 'Request accepted and seat booked.' });
  } catch (error) {
    await connection.rollback();
    return send500(res, error, 'Could not update ride request.');
  } finally {
    connection.release();
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  pool
    .query('SELECT 1')
    .then(() => console.log('Database: connection OK.'))
    .catch((err) => {
      console.error('Database: connection FAILED. Start MySQL in XAMPP, set DB_PORT in .env to match my.ini, then import sql/nmims_carpool.sql.');
      console.error(err.message);
    });
});