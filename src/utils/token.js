const crypto = require('crypto');

exports.generateRefreshToken = () => {
    return crypto.randomBytes(64).toString('hex');
}

exports.hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
}

