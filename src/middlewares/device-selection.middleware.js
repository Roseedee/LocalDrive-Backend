const { verifyDeviceSelection } = require("../utils/jwt")

module.exports = (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth) {
        return res.status(401).json({ message: 'No token' });
    }

    const [type, token, ...extra] = auth.split(' ');

    if (type !== 'Bearer' || !token || extra.length) {
        return res.status(401).json({ message: 'Invalid format' })
    }

    try {
        const decoded = verifyDeviceSelection(token);

        req.user = {
            id: decoded.user_id
        };

        next();
    }catch {
        return res.status(401).json({
            message: 'Invalid or expired device selection token'
        });
    }

}