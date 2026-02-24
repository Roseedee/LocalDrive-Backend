const crypto = require('crypto');
const userRepo = require('../repositories/user.repository');
const deviceRepo = require('../repositories/device.repository');
const { sign, verify } = require('../utils/jwt');

exports.init = async (req, res) => {
    if (req.cookies.token) { // ถ้ามี token อยู่แล้ว แสดงว่าเคยล็อกอินมาแล้ว
        return res.json({ message: "Already initialized" });
    }

    const userId = await userRepo.createUser();

    const deviceUUID = crypto.randomUUID();
    const deviceName = req.headers["user-agent"] || "Unknown Device";

    await deviceRepo.createDevice(userId, deviceUUID, deviceName);

    const token = sign({
        user_id: userId,
        device_uuid: deviceUUID
    });

    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "Strict"
    });

    res.json({ message: "Authentication successful" });
}

exports.me = async (req, res) => {
    res.json({
        user: req.user,
        device: req.device.device_name,
    });
}

exports.logout = async (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out successfully" });
}