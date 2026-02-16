const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (toEmail, code) => {
  const mailOptions = {
    from: `"Robot Delivery" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify your email',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <strong>${code}</strong></p>`,
  };
  await transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (toEmail, token) => {
  const resetLink = `http://yourapp.com/reset-password?token=${token}`;
  const mailOptions = {
    from: `"Robot Delivery" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Password Reset',
    text: `Click the link to reset your password: ${resetLink}`,
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };