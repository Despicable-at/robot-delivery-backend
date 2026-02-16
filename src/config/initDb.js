const pool = require('./db');

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // offices
    await client.query(`
      CREATE TABLE IF NOT EXISTS offices (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL,
        password_hash VARCHAR(255) NOT NULL,
        robot_pin_hash VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // email_verifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // password_resets
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // refresh_tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create enum type safely
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE robot_status_type AS ENUM ('available', 'busy');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // robot_status (single row)
    await client.query(`
      CREATE TABLE IF NOT EXISTS robot_status (
        id SERIAL PRIMARY KEY,
        status robot_status_type NOT NULL DEFAULT 'available',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `);

    // Insert default robot status if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM robot_status');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`INSERT INTO robot_status (status) VALUES ('available')`);
    }

    await client.query('COMMIT');
    console.log('Database tables initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', err);
    throw err; // rethrow so server.js can handle it
  } finally {
    client.release();
  }
};

module.exports = createTables;