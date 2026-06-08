const db = require('../config/database.config');

exports.createUser = async () => {
    const [result] = await db.execute(`INSERT INTO users () VALUES ()`);
    return result.insertId;
}

exports.findById = async (id) => {
    const [result] = await db.execute(`SELECT * FROM users WHERE id = ?`, [id]);
    return result[0];
}

exports.findByNameOrUsername = async (query) => {
    const startsWith = `${query}%`;
    const contains = `%${query}%`;

    const [result] = await db.execute(
        `
        SELECT
            *
        FROM users
        WHERE name LIKE ?
           OR username LIKE ?
           OR name LIKE ?
           OR username LIKE ?
        ORDER BY
            CASE
                WHEN username LIKE ? THEN 1
                WHEN name LIKE ? THEN 2
                ELSE 3
            END
        LIMIT 10
        `,
        [
            startsWith,
            startsWith,
            contains,
            contains,
            startsWith,
            startsWith
        ]
    );

    return result;
};