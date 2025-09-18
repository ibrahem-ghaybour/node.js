const jwt = require('jsonwebtoken');

// Defaults: 15 minutes access, 30 days refresh
const DEFAULT_ACCESS_EXPIRE = '15m';
const DEFAULT_REFRESH_EXPIRE = '30d';

const generateToken = (id, expiresIn = process.env.JWT_EXPIRE || DEFAULT_ACCESS_EXPIRE) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: expiresIn,
  });
};

const generateRefreshToken = (id, expiresIn = process.env.JWT_REFRESH_EXPIRE || DEFAULT_REFRESH_EXPIRE) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: expiresIn,
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = { 
  generateToken, 
  generateRefreshToken, 
  verifyToken, 
  verifyRefreshToken 
};
