// middleware/auth.js

const { verifyAccess } = require('../utils/jwt');

module.exports = (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth) {
        return res.status(401).json({ message: "No token" });
    }

    const [type, token] = auth.split(' ');

    if (type !== 'Bearer' || !token) {
        return res.status(401).json({ message: "Invalid format" });
    }

    try {
        const decoded = verifyAccess(token);

        req.user = {
            id: decoded.user_id
        };

        req.device = {
            uuid: decoded.device_uuid
        };

        next();

    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};