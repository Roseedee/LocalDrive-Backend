const db = require('../config/database');

exports.createUser = async () => {
    const [result] = await db.execute(`INSERT INTO users () VALUES ()`);
    return result.insertId;
}

exports.findById = async (id) => {
    const [rows] = await db.execute(`SELECT * FROM users WHERE id = ?`, [id]);
    return rows[0];
}