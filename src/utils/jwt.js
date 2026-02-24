const jwt = require('jsonwebtoken');

exports.sign = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
}

exports.verify = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        console.error("JWT verification failed:", err.message);
        return null;
    }
}