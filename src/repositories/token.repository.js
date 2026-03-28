const db = require('../config/database');

exports.createToken = async (userId, deviceUUID, tokenHash, expiresAt) => {
    const [result] = await db.execute(
        `INSERT INTO refresh_tokens (user_id, device_uuid, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [userId, deviceUUID, tokenHash, expiresAt]
    );

    return result.insertId;
};


exports.findByHash = async (tokenHash) => {
    const [result] = await db.execute(
        `SELECT * FROM refresh_tokens WHERE token_hash = ?`,
        [tokenHash]
    );
    return result[0];
}

exports.updateToken = async (id, newHash, newExpiresAt) => {
    await db.execute(
        `UPDATE refresh_tokens 
         SET token_hash = ?, expires_at = ?
         WHERE id = ?`,
        [newHash, newExpiresAt, id]
    );
};


exports.deleteByHash = async (tokenHash) => {
    await db.execute(
        `DELETE FROM refresh_tokens WHERE token_hash = ?`,
        [tokenHash]
    );
};


exports.deleteAllByUser = async (userId) => {
    await db.execute(
        `DELETE FROM refresh_tokens WHERE user_id = ?`,
        [userId]
    );
};


exports.deleteByDevice = async (deviceUUID) => {
    await db.execute(
        `DELETE FROM refresh_tokens WHERE device_uuid = ?`,
        [deviceUUID]
    );
};


// 🧹 ลบ token ที่หมดอายุ
exports.deleteExpired = async () => {
    await db.execute(
        `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
    );
};