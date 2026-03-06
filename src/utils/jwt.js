const jwt = require('jsonwebtoken');

exports.sign = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
}

exports.verify = (token, options = {}) => {
    return jwt.verify(token, process.env.JWT_SECRET, options);
}