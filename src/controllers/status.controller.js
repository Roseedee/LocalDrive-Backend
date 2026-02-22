const db = require('../config/database');

exports.getStatus = async (req, res) => {
    res.status(200).json({
        status: "ok"
    });
}

exports.getHealth = async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.status(200).json({
            status: "ok",
            database: "ok",
            uptime: process.uptime(),
            timestamp: new Date().toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok"
            }),
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            database: "down",
        });
    }
};