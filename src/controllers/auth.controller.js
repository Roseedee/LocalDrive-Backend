const crypto = require('crypto');

const userRepo = require('../repositories/user.repository');
const deviceRepo = require('../repositories/device.repository');
const tokenRepo = require('../repositories/token.repository');

const { signAccess, verifyAccess } = require('../utils/jwt');
const { generateRefreshToken, hashToken } = require('../utils/token');

exports.init = async (req, res) => {
    const userId = await userRepo.createUser();

    const deviceUUID = crypto.randomUUID();
    const deviceName = req.body["device_name"];

    // console.log("Initializing new session for user", userId, "with device UUID", deviceUUID, "and name", deviceName);

    if (!deviceName || !deviceUUID || !userId) {
        return res.status(401).json({ message: "Invalid request data" });
    }

    await deviceRepo.createDevice(userId, deviceUUID, deviceName);

    const accessToken = signAccess({
        user_id: userId,
        device_uuid: deviceUUID
    });

    const refreshToken = generateRefreshToken();
    const hash = hashToken(refreshToken);

    await tokenRepo.createToken(userId, deviceUUID, hash, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Expires in 30 days

    res.cookie("refreshToken", refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "Strict"
    });

    res.json({
        accessToken: accessToken,
        user: { id: userId },
        device_name: deviceName
    });
}

exports.refresh = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        console.log("No refresh token provided");
        return res.status(401).json({ message: "No refresh token" });
    }

    console.log("Received refresh token:", refreshToken);
    const hash = hashToken(refreshToken);

    const tokenRecord = await tokenRepo.findByHash(hash);

    if(!tokenRecord) {
        console.log("Refresh token not found in database");
        return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
        console.log("Refresh token expired");
        return res.status(401).json({ message: "Refresh token expired" });
    }

    const deviceRecord = await deviceRepo.findByUUID(tokenRecord.device_uuid);

    if (!deviceRecord) {
        console.log("Device not found");
        return res.status(401).json({ message: "Device not found" });
    }

    const newRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRefreshToken);

    await tokenRepo.updateToken(tokenRecord.id, newHash, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const accessToken = signAccess({
        user_id: deviceRecord.user_id,
        device_uuid: deviceRecord.device_name
    });

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict"
    });

    res.json({
        accessToken: accessToken,
        user: { id: tokenRecord.user_id },
        device_name: tokenRecord.device_name
    });

}    

exports.me = async (req, res) => {
    res.json({
        user: req.user,
        device_name: req.device.device_name,
    });
}

exports.logout = async (req, res) => {
    res.clearCookie('refreshToken');
    res.json({ message: "Logged out successfully" });
}