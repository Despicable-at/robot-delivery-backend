process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🚀 Server starting...');

try {
  console.log('1. Loading express...');
  const express = require('express');
  console.log('2. Loading cors...');
  const cors = require('cors');
  console.log('3. Loading dotenv...');
  require('dotenv').config();
  console.log('4. Loading routes...');
  const authRoutes = require('./routes/authRoutes');
  const userRoutes = require('./routes/userRoutes');
  const robotRoutes = require('./routes/robotRoutes');
  console.log('5. Routes loaded successfully.');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/robot', robotRoutes);

  app.get('/', (req, res) => {
    res.send('Robot Delivery API');
  });

  const PORT = process.env.PORT || 5000;
  console.log('6. PORT =', PORT);

  console.log('7. Loading database pool...');
  const pool = require('./config/db');
  console.log('8. Loading table initializer...');
  const createTables = require('./config/initDb');

  console.log('9. Attempting database connection...');
  pool.connect()
    .then(async () => {
      console.log('10. ✅ Connected to PostgreSQL');
      await createTables();
      console.log('11. Tables initialized');
      app.listen(PORT, () => {
        console.log(`12. ✅ Server running on port ${PORT}`);
      });
    })
    .catch(err => {
      console.error('❌ Database connection or initialization error:', err);
      process.exit(1);
    });

} catch (err) {
  console.error('❌ Fatal error during startup:', err);
  process.exit(1);
}