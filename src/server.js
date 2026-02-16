const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const robotRoutes = require('./routes/robotRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/robot', robotRoutes);

app.get('/', (req, res) => {
  res.send('Robot Delivery API');
});

module.exports = app;