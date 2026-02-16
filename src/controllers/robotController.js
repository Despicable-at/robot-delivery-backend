const pool = require('../config/db');
const { hashData } = require('../utils/hashUtils');

// Get all users (for modal)
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, o.name as office_name
      FROM users u
      LEFT JOIN offices o ON u.office_id = o.id
      ORDER BY u.last_name, u.first_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT u.first_name, u.last_name, u.email, u.phone_number, o.name as office
      FROM users u
      LEFT JOIN offices o ON u.office_id = o.id
      WHERE u.id = $1
    `, [userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update robot PIN
const updateRobotPin = async (req, res) => {
  const { newPin } = req.body; // newPin is the plain text PIN
  if (!newPin || newPin.length < 4 || newPin.length > 6) {
    return res.status(400).json({ message: 'PIN must be 4-6 digits' });
  }
  try {
    const pinHash = await hashData(newPin);
    await pool.query('UPDATE users SET robot_pin_hash = $1 WHERE id = $2', [pinHash, req.user.id]);
    res.json({ message: 'Robot PIN updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllUsers, getProfile, updateRobotPin };