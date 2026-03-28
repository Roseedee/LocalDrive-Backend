const jwt = require('jsonwebtoken');

exports.signAccess = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10s' });
}

exports.verifyAccess = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}