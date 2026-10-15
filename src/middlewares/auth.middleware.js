// middleware/auth.js

const { verifyAccess } = require('../utils/jwt');

module.exports = (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth) {
        return res.status(401).json({ message: "No token" });
    }

    const [type, token, ...extra] = auth.split(' ');

    if (type !== 'Bearer' || !token || extra.length) {
        // console.log("Invalid authorization header format");
        return res.status(401).json({ message: "Invalid format" });
    }

    try {
        const decoded = verifyAccess(token);

        if (
            !decoded.user_id ||
            !decoded.device_id ||
            !decoded.device_uuid
        ) {
            return res.status(401).json({
                message: 'Invalid access token payload'
            });
        }

        req.user = {
            id: decoded.user_id
        };

        req.device = {
            id: decoded.device_id,
            uuid: decoded.device_uuid
        };

        next();

    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};