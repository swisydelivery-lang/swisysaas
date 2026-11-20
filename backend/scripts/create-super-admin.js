const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const [name, phone, password] = process.argv.slice(2);
if (!name || !phone || !password) {
  console.error('Usage: node --env-file=.env scripts/create-super-admin.js "<name>" <phone> <password>');
  process.exit(1);
}

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "INSERT INTO users (role, full_name, phone, password_hash) VALUES ('super_admin', $1, $2, $3) RETURNING id",
      [name, phone, hash],
    );
    console.log('Super admin created, id =', r.rows[0].id);
  } catch (e) {
    console.error('Failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
