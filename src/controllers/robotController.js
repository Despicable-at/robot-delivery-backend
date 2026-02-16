const pool = require('../config/db');

// Get robot status
const getStatus = async (req, res) => {
  try {
    const result = await pool.query('SELECT status, updated_at, notes FROM robot_status LIMIT 1');
    res.json(result.rows[0] || { status: 'unknown' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update robot status (could be admin-only)
const updateStatus = async (req, res) => {
  const { status, notes } = req.body;
  if (!['available', 'busy'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    await pool.query(
      'UPDATE robot_status SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [status, notes]
    );
    res.json({ message: 'Robot status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getStatus, updateStatus };