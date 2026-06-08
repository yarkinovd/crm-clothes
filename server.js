const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { pool, initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['New', 'In Progress', 'Won', 'Lost'];

const timeConditionSQL = (timeframe) => {
  switch (timeframe) {
    case 'today': return `created_at >= CURRENT_DATE`;
    case 'week':  return `created_at >= DATE_TRUNC('week', CURRENT_DATE)`;
    case 'month': return `created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    default:      return 'TRUE';
  }
};

// ─── GET /api/dashboard ───────────────────────────────────────────────────────

app.get('/api/dashboard', async (req, res) => {
  const timeframe = req.query.timeframe || 'all';
  const status    = req.query.status    || 'all';

  const timeCondition = timeConditionSQL(timeframe);

  const params = [];
  let statusCondition = 'TRUE';
  if (status !== 'all' && VALID_STATUSES.includes(status)) {
    params.push(status);
    statusCondition = `status = $${params.length}`;
  }

  const mainWhere = `WHERE ${timeCondition} AND ${statusCondition}`;

  try {
    const [totalLeads, activeDeals, wonRevenue, convData, recent] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count FROM leads ${mainWhere}`, params),
      pool.query(`SELECT COUNT(*) AS count FROM leads WHERE ${timeCondition} AND status = 'In Progress'`),
      pool.query(`SELECT COALESCE(SUM(revenue), 0) AS total FROM leads WHERE ${timeCondition} AND status = 'Won'`),
      pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'Won') AS won
         FROM leads ${mainWhere}`,
        params
      ),
      pool.query(
        `SELECT * FROM leads ${mainWhere} ORDER BY created_at DESC LIMIT 5`,
        params
      ),
    ]);

    const total = parseInt(convData.rows[0].total, 10);
    const won   = parseInt(convData.rows[0].won,   10);
    const conversionRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

    res.json({
      totalLeads:     parseInt(totalLeads.rows[0].count, 10),
      activeDeals:    parseInt(activeDeals.rows[0].count, 10),
      wonRevenue:     parseFloat(wonRevenue.rows[0].total),
      conversionRate,
      recentActivity: recent.rows,
    });
  } catch (err) {
    console.error('[GET /api/dashboard]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/leads ───────────────────────────────────────────────────────────

app.get('/api/leads', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leads ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/leads]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/leads ──────────────────────────────────────────────────────────

app.post('/api/leads', async (req, res) => {
  const { name, company, email, phone, status = 'New', revenue = 0 } = req.body;

  if (!name || !company || !email) {
    return res.status(400).json({ error: 'name, company and email are required' });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO leads (name, company, email, phone, status, revenue)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, company, email, phone || null, status, parseFloat(revenue) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/leads]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/leads/:id/status ────────────────────────────────────────────────

app.put('/api/leads/:id/status', async (req, res) => {
  const id      = parseInt(req.params.id, 10);
  const { status, revenue } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    let result;
    if (revenue !== undefined && revenue !== null) {
      result = await pool.query(
        `UPDATE leads SET status = $1, revenue = $2 WHERE id = $3 RETURNING *`,
        [status, parseFloat(revenue), id]
      );
    } else {
      result = await pool.query(
        `UPDATE leads SET status = $1 WHERE id = $2 RETURNING *`,
        [status, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/leads/:id/status]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/login ────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_TOKEN    = 'crm-admin-secret-token-2026';

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: ADMIN_TOKEN });
  }
  res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
});

// ─── GET /api/products ────────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/products]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/leads/:id ────────────────────────────────────────────────────

app.delete('/api/leads/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      'DELETE FROM leads WHERE id = $1 RETURNING id', [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/leads/:id]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/leads/:id (status + revenue update) ────────────────────────────

app.put('/api/leads/:id', async (req, res) => {
  const id      = parseInt(req.params.id, 10);
  const { status, revenue } = req.body;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const result = await pool.query(
      `UPDATE leads
       SET status  = COALESCE($1, status),
           revenue = COALESCE($2, revenue)
       WHERE id = $3 RETURNING *`,
      [status || null, revenue !== undefined ? parseFloat(revenue) : null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/leads/:id]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/customers/register ────────────────────────────────────────────

app.post('/api/customers/register', async (req, res) => {
  const { name, company, email, phone, product_interest } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Ism va email majburiy' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email noto\'g\'ri formatda' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM customers WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    await pool.query(
      `INSERT INTO customers (name, company, email, phone) VALUES ($1, $2, $3, $4)`,
      [name, company || null, email, phone || null]
    );

    const leadCompany = company || name;
    const leadNote   = product_interest || null;

    await pool.query(
      `INSERT INTO leads (name, company, email, phone, status, revenue)
       VALUES ($1, $2, $3, $4, 'New', 0)`,
      [name, leadCompany, email, phone || null]
    );

    res.status(201).json({
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz',
      product_interest: leadNote,
    });
  } catch (err) {
    console.error('[POST /api/customers/register]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const start = async () => {
    try {
      await initDB();
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`CRM server running on port ${PORT}`);
      });
    } catch (err) {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    }
  };
  start();
} else {
  initDB().catch(err => console.error('DB init failed:', err.message));
}

module.exports = app;
