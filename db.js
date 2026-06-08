const { Pool } = require('pg');

const pool = new Pool({
  user:     process.env.PGUSER     || 'crmuser',
  host:     process.env.PGHOST     || 'db',
  database: process.env.PGDATABASE || 'crmdb',
  password: process.env.PGPASSWORD || 'crmpassword',
  port:     parseInt(process.env.PGPORT) || 5432,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const initDB = async (retries = 7) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(255) NOT NULL,
          company    VARCHAR(255) NOT NULL,
          email      VARCHAR(255) NOT NULL,
          phone      VARCHAR(50),
          status     VARCHAR(50)      DEFAULT 'New',
          revenue    NUMERIC(12, 2)   DEFAULT 0,
          created_at TIMESTAMP        DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id          SERIAL PRIMARY KEY,
          name        VARCHAR(255)   NOT NULL,
          category    VARCHAR(100),
          description TEXT,
          price       NUMERIC(10, 2) NOT NULL,
          min_order   INTEGER        DEFAULT 50,
          color       VARCHAR(50)    DEFAULT '#4f46e5',
          emoji       VARCHAR(10)    DEFAULT '👔',
          image_url   TEXT,
          created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(255) NOT NULL,
          company    VARCHAR(255),
          email      VARCHAR(255) UNIQUE NOT NULL,
          phone      VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Re-seed leads whenever the new canary email is absent
      const { rows: leadCheck } = await client.query(
        "SELECT COUNT(*) FROM leads WHERE email = 'dilnoza@tgfashion.uz'"
      );
      if (parseInt(leadCheck[0].count) === 0) {
        await client.query('DELETE FROM leads');
        await client.query(`
          INSERT INTO leads (name, company, email, phone, status, revenue, created_at) VALUES
          ('Dilnoza Xasanova',  'Toshkent Fashion Group',    'dilnoza@tgfashion.uz',     '+998-90-123-4567', 'In Progress',  18500.00, NOW() - INTERVAL  '2 hours'),
          ('Alisher Nazarov',   'Buxoro Style House',        'alisher@buxorostyle.uz',   '+998-91-234-5678', 'New',              0.00, NOW() - INTERVAL  '5 hours'),
          ('Shaxlo Mirzayeva',  'Samarqand Textile Center',  'shaxlo@samtextile.uz',     '+998-93-345-6789', 'Won',          52000.00, NOW() - INTERVAL  '2 days'),
          ('Otabek Jurayev',    'Namangan Kiyim Bozori',     'otabek@namangankiyim.uz',  '+998-94-456-7890', 'In Progress',  31000.00, NOW() - INTERVAL  '3 days'),
          ('Gulnora Tursunova', 'Qoqon Bazm Liboslari',      'gulnora@qqnlibos.uz',      '+998-95-567-8901', 'New',              0.00, NOW() - INTERVAL  '4 days'),
          ('Jasur Toshmatov',   'Fergana Premium Clothes',   'jasur@ferganapremium.uz',  '+998-97-678-9012', 'Won',          75000.00, NOW() - INTERVAL  '9 days'),
          ('Kamola Razzaqova',  'Andijon Mode Center',       'kamola@andijonmode.uz',    '+998-99-789-0123', 'Lost',             0.00, NOW() - INTERVAL '13 days'),
          ('Sardor Hamidov',    'Toshkent Optom Bazar',      'sardor@toptombazar.uz',    '+998-90-890-1234', 'In Progress',  42000.00, NOW() - INTERVAL '17 days'),
          ('Mohira Yusupova',   'Xorazm Textile Hub',        'mohira@xorazmtextile.uz',  '+998-91-901-2345', 'New',              0.00, NOW() - INTERVAL '21 days'),
          ('Firdavs Ortiqov',   'Jizzax Kiyim Markazi',      'firdavs@jizzaxkiyim.uz',   '+998-93-012-3456', 'Won',          28000.00, NOW() - INTERVAL '25 days'),
          ('Zulfiya Karimova',  'Surxondaryo Style Group',   'zulfiya@surxstyle.uz',     '+998-94-123-4568', 'Won',          95000.00, NOW() - INTERVAL '35 days'),
          ('Ulugbek Rajabov',   'Qashqadaryo Optom LLC',     'ulugbek@qqdoptom.uz',      '+998-95-234-5679', 'Lost',             0.00, NOW() - INTERVAL '45 days'),
          ('Nargiza Tillayeva', 'Sirdaryo Libos Bozori',     'nargiza@sirdaryolibos.uz', '+998-97-345-6790', 'In Progress',  22000.00, NOW() - INTERVAL '55 days')
        `);
        console.log('Database seeded with realistic Uzbek clothing business leads.');
      }

      // Re-seed products whenever image_url is absent (first run or schema upgrade)
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT`);
      const { rows: prodCheck } = await client.query(
        'SELECT COUNT(*) FROM products WHERE image_url IS NOT NULL'
      );
      if (parseInt(prodCheck[0].count) === 0) {
        await client.query('TRUNCATE TABLE products RESTART IDENTITY');
        await client.query(`
          INSERT INTO products (name, category, description, price, min_order, color, emoji, image_url) VALUES
          ('Erkaklar biznes ko''ylagi', 'Erkaklar', 'Yuqori sifatli 100% paxta, klassik kesim, ulgurji savdo uchun ideal',     12.00, 100, '#1d4ed8', '👔', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=480&q=80'),
          ('Ayollar bluzasi',           'Ayollar',  'Zamonaviy dizayn, nafis material, turli ranglarda mavjud',                10.00, 100, '#7c3aed', '👗', 'https://images.unsplash.com/photo-1485518882345-15568b007407?auto=format&fit=crop&w=480&q=80'),
          ('Denim shim (uniseks)',       'Uniseks',  'Premium denim, kuchli tikuv, uzoq muddat xizmat qiladi',                 18.00,  50, '#1e3a5f', '👖', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=480&q=80'),
          ('Sport kostyum to''plami',   'Sport',    'Nafas oladigan material, qulay fit, mashg''ulot va dam olish uchun',      22.00,  50, '#065f46', '🏃', 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=480&q=80'),
          ('Qishki kurtka',             'Qishki',   'Issiq astari bor, suv o''tkazmaydigan tashqi qatlam, stylish ko''rinish', 45.00,  30, '#92400e', '🧥', 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=480&q=80'),
          ('Paxta futbolka (uniseks)',   'Asosiy',  'Oddiy va qulay, logotip bosish uchun ideal, korporativ sovg''a',           6.00, 200, '#374151', '👕', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=480&q=80'),
          ('Biznes kostyum (erkaklar)', 'Erkaklar', 'To''liq to''plam: jacket va shim, rasmiy tadbirlar uchun',               80.00,  20, '#1f2937', '🤵', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=480&q=80'),
          ('Yozgi ko''ylak (ayollar)',  'Ayollar',  'Yengil chit material, gul naqshlar, yozgi mavsum uchun',                 14.00, 100, '#be185d', '👒', 'https://images.unsplash.com/photo-1572804013427-4d7ca7268217?auto=format&fit=crop&w=480&q=80')
        `);
        console.log('Database seeded with products (real Unsplash images).');
      }

      console.log('Database initialized successfully.');
      return;
    } catch (err) {
      if (client) client.release();
      if (attempt < retries) {
        console.log(`DB connection attempt ${attempt}/${retries} failed — retrying in 3s... (${err.message})`);
        await sleep(3000);
      } else {
        throw err;
      }
    } finally {
      if (client) client.release();
    }
  }
};

module.exports = { pool, initDB };
