const mysql = require('mysql2/promise');
require('dotenv').config();

// Usage: node db/promote_admin.js <username>
// Promotes a user to admin role.

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error('Usage: node db/promote_admin.js <username>');
    console.error('Example: node db/promote_admin.js admin');
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // Check if role column exists (migration may not have run)
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
      [process.env.DB_NAME]
    );

    if (cols.length === 0) {
      console.error('The "role" column does not exist yet. Run the migration first:');
      console.error('  mysql -u root -p millionaire < db/migrate_add_role.sql');
      console.error('Or rebuild the Docker container:');
      console.error('  docker-compose down -v && docker-compose up -d');
      process.exit(1);
    }

    // Find the user
    const [users] = await pool.execute('SELECT id, username, role FROM users WHERE username = ?', [username]);

    if (users.length === 0) {
      console.error(`User "${username}" not found.`);
      process.exit(1);
    }

    const user = users[0];

    if (user.role === 'admin') {
      console.log(`User "${username}" is already an admin.`);
      process.exit(0);
    }

    await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
    console.log(`✅ User "${username}" (id: ${user.id}) has been promoted to admin.`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
