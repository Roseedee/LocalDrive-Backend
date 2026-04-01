const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_EXPIRATION } = require('../config/auth.config');

exports.signAccess = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

exports.verifyAccess = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}