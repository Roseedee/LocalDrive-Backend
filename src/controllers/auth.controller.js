const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { REFRESH_TOKEN_MS } = require('../config/auth.config');

const userRepo = require('../repositories/user.repository');
const deviceRepo = require('../repositories/device.repository');
const tokenRepo = require('../repositories/token.repository');

const { signAccess, signDeiveSelection } = require('../utils/jwt');
const { generateRefreshToken, hashToken } = require('../utils/token');

exports.init = async (req, res) => {
    const userId = await userRepo.createUser();

    const deviceUUID = crypto.randomUUID();
    const deviceName = req.body["device_name"];

    // console.log("Initializing new session for user", userId, "with device UUID", deviceUUID, "and name", deviceName);

    if (!deviceName || !deviceUUID || !userId) {
        return res.status(401).json({ message: "Invalid request data" });
    }

    const deviceId = await deviceRepo.createDevice(userId, deviceUUID, deviceName);

    const accessToken = signAccess({
        user_id: userId,
        device_id: deviceId,
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
        device: {
            name: deviceName,
            uuid: deviceUUID
        }
    });
}

exports.login = async (req, res) => {

    try {
        const username = req.body["username"]
        const password = req.body["password"]
        // console.log("username : ", username, " : password : ", password)

        if(!username || !password) {
            return res.status(400).json({
                message: "Invalid request data"
            })
        }

        const user = await userRepo.findByUsername(username)

        if(!user) {
            return res.status(401).json({
                message: "Invalid username or password"
            })
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const selectionToken = signDeiveSelection(user.id);

        return res.json({
            selectionToken,
            user: {
                id: user.id,
                name: user.name
            },
        })
    } catch(err) {
        console.error("Login error : ", err)
        return res.status(500).json({
            message: "Internal server error"
        })
    }

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
        device_id: deviceRecord.id,
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
        device: {
            id: deviceRecord.id,
            name: deviceRecord.device_name,
            uuid: deviceRecord.device_uuid
        }
    });
}    

exports.me = async (req, res) => {
    console.log("Authenticated user:", req.user, "Device:", req.device);
    const deviceRecord = await deviceRepo.findByUUID(req.device.uuid);
    // console.log("Device record : ", deviceRecord);
    res.json({
        user: req.user,
        device: {
            id: deviceRecord.id,
            name: deviceRecord.device_name,
            uuid: deviceRecord.device_uuid
        }
    });
}

exports.findReplaceableDevices = async (req, res) => {
    try {
        const devices = await deviceRepo.findByUserID(req.user.id);
        return res.json({
            devices: devices.map( device => ({
                id: device.id,
                name: device.device_name,
                uuid: device.device_uuid,
                type: device.type
            }))
        })
    }catch (err) {
        console.error("Find devices error: ", err)

        return res.status(500).json({ message: "Internal server error" })
    }
}

exports.selectDevice = async (req, res) => {
    try {
        const userID = req.user.id;
        const { deviceID, deviceName } = req.body;

        let device;

        if(deviceID) {
            device = await deviceRepo.findByID(deviceID);

            if(!device || String(device.user_id) !== String(userID)) {
                return res.status(403).json({ message: "Device access denied"})
            }
        }else {
            if(!deviceName || !deviceName.trim()) {
                return res.status(400).json({ message: "Device name is required"})
            }

            const deviceUUID = crypto.randomUUID();

            const lastInsertID = await deviceRepo.createDevice(userID, deviceUUID, deviceName);

            device = await deviceRepo.findByUUID(deviceUUID);

            if(!device || String(device.id) !== String(lastInsertID)) {
                return res.status(500).json({ message: "Failed to create device"})
            }
        }

        const accessToken = signAccess({
            user_id: userID,
            device_id: device.id,
            device_uuid: device.device_uuid
        })

        const refreshToken = generateRefreshToken();
        const hash = hashToken(refreshToken);

        await tokenRepo.createToken(userID, device.device_uuid, hash, new Date(Date.now() + REFRESH_TOKEN_MS))

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: REFRESH_TOKEN_MS,
            path: '/'
        })

        return res.json({
            accessToken,
            user: {
                id: userID
            },
            device: {
                id: device.id,
                uuid: device.device_uuid,
                name: device.name,
            },
        })

    }catch(err) {
        console.error("Select device error: ", err)
        return res.status(500).json({ message: "Internal server error" })
    }
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