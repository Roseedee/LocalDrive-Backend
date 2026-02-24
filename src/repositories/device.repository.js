const db = require('../config/database');

exports.createDevice = async (userId, uuid, name) => {
    const [result] = await db.execute(`INSERT INTO devices (user_id, device_uuid, device_name) VALUES (?, ?, ?)`, [userId, uuid, name]);
    return result.insertId;
}

exports.findByUUID = async (uuid) => {
    const [rows] = await db.execute(`SELECT * FROM devices WHERE device_uuid = ?`, [uuid]);
    return rows[0];
}

exports.updateLastUsed = async (uuid) => {
    const [result] = await db.execute(`UPDATE devices SET last_used_at = NOW() WHERE device_uuid = ?`, [uuid]);
    return result.affectedRows > 0;
}