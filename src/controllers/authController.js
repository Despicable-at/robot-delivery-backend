const pool = require('../config/db');
const { hashData, compareData } = require('../utils/hashUtils');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
};

// Signup
const signup = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, officeId, password } = req.body;
  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const passwordHash = await hashData(password);
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, office_id, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [firstName, lastName, email, phoneNumber, officeId, passwordHash]
    );
    const userId = result.rows[0].id;

    // Generate verification code
    const code = generateVerificationCode();
    const codeHash = await hashData(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await pool.query(
      `INSERT INTO email_verifications (user_id, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, codeHash, expiresAt]
    );

    // Send email
    await sendVerificationEmail(email, code);

    res.status(201).json({ message: 'Verification email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) return res.status(400).json({ message: 'User not found' });
    if (user.rows[0].is_verified) return res.status(400).json({ message: 'Already verified' });

    const verification = await pool.query(
      `SELECT * FROM email_verifications 
       WHERE user_id = $1 AND used = false AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [user.rows[0].id]
    );
    if (verification.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const valid = await compareData(code, verification.rows[0].code_hash);
    if (!valid) return res.status(400).json({ message: 'Invalid code' });

    // Mark as used and update user
    await pool.query('UPDATE email_verifications SET used = true WHERE id = $1', [verification.rows[0].id]);
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [user.rows[0].id]);

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login
const login = async (req, res) => {
  const { email, password, rememberMe } = req.body;
  try {
    const user = await pool.query(
      'SELECT id, first_name, password_hash, is_verified FROM users WHERE email = $1',
      [email]
    );
    if (user.rows.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.rows[0].is_verified) {
      return res.status(403).json({ message: 'Please verify your email first' });
    }

    const validPassword = await compareData(password, user.rows[0].password_hash);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const userId = user.rows[0].id;

    // Create tokens
    const accessToken = jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: rememberMe ? '30d' : process.env.REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token hash
    const refreshTokenHash = await hashData(refreshToken);
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, refreshTokenHash, expiresAt]
    );

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      // Don't reveal that user doesn't exist
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const userId = user.rows[0].id;

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await hashData(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    // Send email
    await sendPasswordResetEmail(email, token);

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    // Find unused, non-expired reset request
    const resets = await pool.query(
      `SELECT * FROM password_resets 
       WHERE used = false AND expires_at > NOW()`
    );
    // We need to check token hash manually because we cannot filter by hash directly (we'll compare one by one)
    let resetRecord = null;
    for (const row of resets.rows) {
      const match = await compareData(token, row.token_hash);
      if (match) {
        resetRecord = row;
        break;
      }
    }
    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Update password
    const passwordHash = await hashData(newPassword);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetRecord.user_id]);

    // Mark reset as used
    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [resetRecord.id]);

    // Optionally delete all refresh tokens for this user (force re-login)
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [resetRecord.user_id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Refresh token
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(401);

  try {
    // Find token in DB
    const tokens = await pool.query('SELECT * FROM refresh_tokens WHERE expires_at > NOW()');
    let tokenRecord = null;
    for (const row of tokens.rows) {
      const match = await compareData(refreshToken, row.token_hash);
      if (match) {
        tokenRecord = row;
        break;
      }
    }
    if (!tokenRecord) return res.sendStatus(403);

    // Verify JWT
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) return res.sendStatus(403);

      const user = await pool.query('SELECT id, email FROM users WHERE id = $1', [decoded.id]);
      if (user.rows.length === 0) return res.sendStatus(403);

      const newAccessToken = jwt.sign(
        { id: user.rows[0].id, email: user.rows[0].email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
      );

      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout (invalidate refresh token)
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  try {
    // Find and delete the token
    const tokens = await pool.query('SELECT id, token_hash FROM refresh_tokens');
    for (const row of tokens.rows) {
      const match = await compareData(refreshToken, row.token_hash);
      if (match) {
        await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
        break;
      }
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  signup,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
};