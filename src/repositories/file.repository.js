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

exports.getOrCreateFolder = async (publicID, userID, deviceID, parentId, name) => {
    const [rows] = await db.execute(
        `SELECT id FROM files 
         WHERE public_id = ? AND user_id = ? AND uploaded_by_device_id = ? AND parent_id <=> ? AND name = ? AND type = 'folder' AND deleted_at IS NULL`,
        [publicID, userID, deviceID, parentId, name]
    );

    if (rows.length > 0) {
        return rows[0].id;
    }

    const [result] = await db.execute(
        `INSERT INTO files (public_id, user_id, uploaded_by_device_id, parent_id, name, type)
         VALUES (?, ?, ?, ?, ?, 'folder')`,
        [publicID, userID, deviceID, parentId, name]
    );

    return result.insertId;
}

exports.getFolderIDByPublicID = async (publicID) => {
    const [rows] = await db.execute(
        `SELECT id FROM files 
         WHERE public_id = ? AND type = 'folder' AND deleted_at IS NULL`,
        [publicID]
    )

    if (rows.length > 0) {
        return rows[0].id;
    }
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
            f.public_id,
            f.uploaded_by_device_id,
            f.name,
            f.type,
            f.parent_id,
            f.created_at,
            f.updated_at,
            b.hash,
            b.size,
            b.mime_type,
            CASE
                WHEN fav.file_id IS NOT NULL THEN TRUE
                ELSE FALSE
            END AS is_favorite
        FROM files f
        LEFT JOIN blobs b
            ON f.blob_id = b.id
        LEFT JOIN favorites fav
            ON fav.file_id = f.id
            AND fav.user_id = ?
        WHERE f.user_id = ?
          AND f.parent_id <=> ?
          AND f.deleted_at IS NULL
        ORDER BY (f.type = 'folder') DESC, f.created_at DESC, f.id DESC`,
        [userID, userID, parentID]
    );

    // const results = rows.map((item) => {
    //     return {
    //         id: item.id,
    //         uploaded_by_device_id: item.uploaded_by_device_id,
    //         parent_id: item.parent_id,
    //         name: item.name,
    //         type: item.type,
    //         size: item.size,
    //         mime_type: item.mime_type,
    //         created_at: item.created_at,
    //         updated_at: item.updated_at
    //     }
    // })

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

exports.deleteFile = async (userID, fileID) => {
    const [result] = await db.execute(
        `UPDATE files SET deleted_at = NOW() WHERE user_id = ? AND id = ?`,
        [userID, fileID]
    );

    return result;
};

exports.updateFile = async (userID, fileID, updates) => {

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }

    values.push(userID);
    values.push(fileID);

    const [result] = await db.execute(
        `
        UPDATE files
        SET ${fields.join(', ')}
        WHERE user_id = ?
          AND id = ?
        `,
        values
    );

    return result;
}

exports.getFullPathByParentID = async (userID, parentID) => {
    const [rows] = await db.execute(
        `
    WITH RECURSIVE parent_chain AS (
      SELECT
        id,
        public_id,
        parent_id,
        name,
        type,
        1 AS lvl
      FROM files
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
        AND type = 'folder'

      UNION ALL

      SELECT
        f.id,
        f.public_id,
        f.parent_id,
        f.name,
        f.type,
        pc.lvl + 1
      FROM files f
      JOIN parent_chain pc ON f.id = pc.parent_id
      WHERE f.user_id = ?
        AND f.deleted_at IS NULL
        AND f.type = 'folder'
    )

    SELECT 
      id,
      public_id,
      name,
      parent_id,
      lvl
    FROM parent_chain
    ORDER BY lvl DESC;
    `,
        [parentID, userID, userID]
    );

    // reverse ให้เป็น root → current
    return rows;
};

exports.getFileFavoriteByFileID = async (userID, fileID) => {
    const [row] = await db.execute(
        `
        SELECT * FROM favorites WHERE file_id=? AND user_id=?
        `,
        [fileID, userID]
    );

    return row[0]?.id || null;
}

exports.addOrRemoveFavorite = async (favoriteID, userID, fileID) => {
    if (favoriteID) {
        const [result] = await db.execute(
            `DELETE FROM favorites WHERE id = ? AND user_id = ? AND file_id = ?`,
            [favoriteID, userID, fileID]
        );
        return null;
    } else {
        const [result] = await db.execute(
            `INSERT INTO favorites (user_id, file_id) VALUES (?, ?)`,
            [userID, fileID]
        );
        return result?.insertId || null;
    }
}
