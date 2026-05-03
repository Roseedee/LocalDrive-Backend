const db = require('../config/database.config')

exports.getOrCreateBlob = async (fileHash, storagePath, mimeType, size, thumbnailPath) => {
    // 🔍 หา hash ก่อน
    const [rows] = await db.execute(
        'SELECT id FROM blobs WHERE `hash` = ?',
        [fileHash]
    );

    if (rows.length > 0) {
        return rows[0].id; // ♻️ ใช้ของเดิม
    }

    // ❗ insert ใหม่
    const [result] = await db.execute(
        `INSERT INTO blobs (hash, size, mime_type, storage_path, thumbnailPath)
         VALUES (?, ?, ?, ?, ?)`,
        [fileHash, size, mimeType, storagePath, thumbnailPath]
    );

    return result.insertId;
}

exports.getOrCreateFolder = async (userID, parent_id, name) => {
    const [rows] = await db.execute(
        `SELECT id FROM files 
         WHERE user_id = ? AND parent_id <=> ? AND name = ? AND type = 'folder' AND deleted_at IS NULL`,
        [userID, parentId, name]
    );

    if (rows.length > 0) {
        return rows[0].id;
    }

    const [result] = await db.execute(
        `INSERT INTO files (user_id, parent_id, name, type)
         VALUES (?, ?, ?, 'folder')`,
        [userID, parentId, name]
    );

    return result.insertId;
}

exports.insertFile = async (userID, deviceID, parentId, blobId, name) => {
    const [result] = await db.execute(
        `INSERT INTO files (user_id, uploaded_by_device_id, parent_id, blob_id, name, type, original_name)
         VALUES (?, ?, ?, ?, ?, 'file', ?)`,
        [userID, deviceID, parentId, blobId, name, name]
    );

    return result.insertId;
}

exports.getItemsList = async (userID, parentID) => {
    const [rows] = await db.execute(
        `SELECT 
                f.id,
                f.uploaded_by_device_id,
                f.name,
                f.type,
                f.parent_id,
                f.created_at,
                f.updated_at,
                b.hash,
                b.size,
                b.mime_type
            FROM files f
            LEFT JOIN blobs b ON f.blob_id = b.id
            WHERE f.user_id = ?
              AND f.parent_id <=> ?
              AND f.deleted_at IS NULL
            ORDER BY f.created_at DESC`,
        [userID, parentID]
    );

    const results = rows.map((item) => {
        return {
            id: item.id,
            uploaded_by_device_id: item.uploaded_by_device_id,
            parent_id: item.parent_id,
            name: item.name,
            type: item.type,
            size: item.size,
            mime_type: item.mime_type,
            created_at: item.created_at,
            updated_at: item.updated_at
        }
    })

    return rows;
}

exports.getFileById = async (userID, fileID) => {
    const [rows] = await db.execute(`
        SELECT 
            f.id,
            f.name,
            f.parent_id,
            f.user_id,
            f.blob_id,
            f.created_at,

            b.hash,
            b.storage_path,
            b.mime_type,
            b.size

        FROM files f
        JOIN blobs b ON f.blob_id = b.id
        WHERE f.user_id = ? AND f.id = ?
        LIMIT 1
    `, [userID, fileID]);

    return rows[0] || null;
};