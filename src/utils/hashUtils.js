const bcrypt = require('bcrypt');
const saltRounds = 10;

const hashData = async (data) => {
  return await bcrypt.hash(data, saltRounds);
};

const compareData = async (data, hash) => {
  return await bcrypt.compare(data, hash);
};

module.exports = { hashData, compareData };