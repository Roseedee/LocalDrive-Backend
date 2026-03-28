const db = require('../config/database');

exports.createUser = async () => {
    const [result] = await db.execute(`INSERT INTO users () VALUES ()`);
    return result.insertId;
}

exports.findById = async (id) => {
    const [result] = await db.execute(`SELECT * FROM users WHERE id = ?`, [id]);
    return result[0];
}