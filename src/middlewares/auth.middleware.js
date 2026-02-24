const { sign, verify } = require('../utils/jwt');
const deviceRepo = require('../repositories/device.repository');

module.exports = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = verify(token);

        const device = await deviceRepo.findByUUID(decoded.device_uuid);
        if (!device) {
            return res.status(401).json({ message: "Device not found" });
        }

        await deviceRepo.updateLastUsed(decoded.device_uuid);

        req.user = { id: device.user_id };
        req.device = device;

        return next();

    } catch (err) {
        if (err.name === "TokenExpiredError") {

            const decoded = verify(token, { ignoreExpiration: true });

            const device = await deviceRepo.findByUUID(decoded.device_uuid);
            if (!device) {
                return res.status(401).json({ message: "Device not found" });
            }

            const newToken = sign({
                user_id: device.user_id,
                device_uuid: device.device_uuid
            });

            res.cookie("token", newToken, {
                httpOnly: true,
                sameSite: "Strict"
            });

            await deviceRepo.updateLastUsed(device.device_uuid);

            req.user = { id: device.user_id };
            req.device = device;

            return next();
        }

        return res.status(401).json({ message: "Invalid token" });
    }
}