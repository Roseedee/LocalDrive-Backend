const crypto = require('crypto');

const { REFRESH_TOKEN_MS } = require('../config/auth.config');

const userRepo = require('../repositories/user.repository');
const deviceRepo = require('../repositories/device.repository');
const tokenRepo = require('../repositories/token.repository');

const { signAccess } = require('../utils/jwt');
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

    await tokenRepo.createToken(userId, deviceUUID, hash, new Date(Date.now() + REFRESH_TOKEN_MS)); // Expires in 30 days

    res.cookie("refreshToken", refreshToken, {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: "Strict",
        maxAge: REFRESH_TOKEN_MS
    });

    res.json({
        accessToken: accessToken,
        user: { id: userId },
        device_name: deviceName,
        device_uuid: deviceUUID
    });
}

exports.refresh = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        console.log("No refresh token provided");
        return res.status(401).json({ message: "No refresh token" });
    }

    const hash = hashToken(refreshToken);

    const tokenRecord = await tokenRepo.findByHash(hash);

    if(!tokenRecord) {
        console.log("Refresh token not found in database");
        return res.status(403).json({ message: "Invalid refresh token" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
        console.log("Refresh token expired");
        return res.status(403).json({ message: "Refresh token expired" });
    }

    const deviceRecord = await deviceRepo.findByUUID(tokenRecord.device_uuid);
    // console.log("Found device record for refresh token:", deviceRecord);

    if (!deviceRecord) {
        console.log("Device not found");
        return res.status(403).json({ message: "Device not found" });
    }

    const newRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRefreshToken);

    await tokenRepo.updateToken(tokenRecord.id, newHash, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const accessToken = signAccess({
        user_id: deviceRecord.user_id,
        device_uuid: deviceRecord.device_uuid
    });

    res.cookie("refreshToken", newRefreshToken, {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: "Strict",
        maxAge: REFRESH_TOKEN_MS
    });

    res.json({
        accessToken: accessToken,
        user: { id: deviceRecord.user_id },
        device_name: deviceRecord.device_name,
        device_uuid: deviceRecord.device_uuid
    });
}    

exports.me = async (req, res) => {
    console.log("Authenticated user:", req.user, "Device:", req.device);
    res.json({
        user: req.user,
        device_name: req.device.device_name,
    });
}

exports.logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        const hash = hashToken(refreshToken);
        await tokenRepo.deleteByHash(hash);
    }

    res.clearCookie('refreshToken');
    res.json({ message: "Logged out successfully" });
}