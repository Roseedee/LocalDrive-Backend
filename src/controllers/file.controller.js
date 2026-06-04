const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pipeline } = require('stream/promises')
const { Transform } = require('stream');
const { nanoid } = require('nanoid')


const fileRepo = require('../repositories/file.repository')
const db = require('../config/database.config')

//utils
const { sanitizePath } = require('../utils/sanitizePath');
const { sanitizeFileName } = require('../utils/sanitizeFileName')
const { generateThumbnail } = require('../utils/generateThumbnail');

//test
const { delay } = require('../utils/delay')

exports.create = async (req, res) => {
    // ถ้ามี file → upload
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        return exports.upload(req, res);
    }

    // ถ้าไม่มี → create folder
    const { name, parentId } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'name required' });
    }

    const publicID = nanoid();

    const folderId = await fileRepo.getOrCreateFolder(
        publicID,
        req.user.id,
        req.device.id,
        parentId ?? null,
        name
    );

    res.json({
        status: 'ok',
        items: [{
            id: folderId,
            public_id: publicID,
            name: name,
            type: 'folder'
        }]
    });
};

exports.upload = async (req, res) => {
    const userID = req.user.id;
    const deviceID = req.device.id;
    const deviceUUID = req.device.uuid;

    const busboy = Busboy({ headers: req.headers });

    const uploadsDir = path.join(__dirname, '../..', 'upload-temp', String(userID), String(deviceUUID));
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const files = [];
    const fields = {};
    const tasks = [];

    busboy.on('file', (fieldname, file, info) => {
        let { filename, mimeType } = info;

        filename = Buffer.from(filename, 'latin1').toString('utf8'); // แปลงชื่อไฟล์เป็น UTF-8

        const safePath = sanitizePath(filename);
        const parts = safePath.split('/');

        const actualName = parts.pop();
        const folders = parts;

        if (!actualName) {
            file.resume();
            return;
        }

        const ext = path.extname(actualName);

        const tempPath = path.join(uploadsDir, `temp-${uuidv4()}`);

        const task = (async () => {
            let fileSize = 0;

            try {
                const writeStream = fs.createWriteStream(tempPath);
                const hash = crypto.createHash('sha256');

                const hashStream = new Transform({
                    transform(chunk, enc, cb) {
                        hash.update(chunk);
                        fileSize += chunk.length;
                        cb(null, chunk);
                    }
                });

                await pipeline(file, hashStream, writeStream);

                const fileHash = hash.digest('hex');

                const finalPath = path.join(
                    __dirname,
                    '../..',
                    'storage',
                    'original',
                    fileHash.slice(0, 2),
                    fileHash.slice(2, 4),
                    fileHash
                );

                await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });

                try {
                    await fs.promises.access(finalPath);
                    await fs.promises.unlink(tempPath);
                } catch {
                    await fs.promises.rename(tempPath, finalPath);
                }

                const result = {
                    originalName: actualName,
                    path: safePath,
                    folders,
                    hash: fileHash,
                    storagePath: finalPath,
                    type: mimeType,
                    size: fileSize,
                    extension: ext,
                };

                files.push(result);
                return result;

            } catch (err) {
                await fs.promises.unlink(tempPath).catch(() => { });
                throw err;
            }
        })();

        tasks.push(task);
    });

    busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
    });

    busboy.on('finish', async () => {
        try {
            await Promise.all(tasks);

            const fileUploadsSuccess = [];

            for (const f of files) {

                let thumbPath = null;

                if (f.type.startsWith('image/')) {
                    try {
                        thumbPath = await generateThumbnail({
                            inputPath: f.storagePath,
                            hash: f.hash
                        });
                    } catch (err) {
                        console.error('Failed to generate thumbnail for', f.originalName, err);
                    }
                }

                const blobId = await fileRepo.getOrCreateBlob(
                    f.hash,
                    f.storagePath,
                    f.type,
                    f.size,
                    thumbPath
                );

                let parentId = fields.parent_id || null;

                for (const folderName of f.folders) {
                    const publicID = nanoid();
                    parentId = await fileRepo.getOrCreateFolder(
                        publicID,
                        userID,
                        deviceID,
                        parentId,
                        folderName
                    );
                }

                const fileId = await fileRepo.insertFile(
                    userID,
                    deviceID,
                    parentId,
                    blobId,
                    f.originalName
                );
                const file = {
                    id: fileId,
                    uploaded_by_device_id: deviceID,
                    parent_id: parentId,
                    name: f.originalName,
                    type: 'file',
                    size: f.size,
                    mime_type: f.type,
                    hash: f.hash
                }
                fileUploadsSuccess.push(file);
            }

            res.json({
                status: 'ok',
                items: fileUploadsSuccess
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'upload failed' });
        }
    });

    req.pipe(busboy);
};

// exports.createFolder = async (req, res) => {
//     try {
//         const userID = req.user.id;
//         const deviceID = req.device.id;
//         const { name, parent_id } = req.body;
//         const folderId = await fileRepo.getOrCreateFolder(userID, deviceID, parent_id, name);

//         res.json({  
//             status: 'ok',
//             folder_id: folderId
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'failed to create folder' });
//     }   
// };

exports.getItemsList = async (req, res) => {
    try {
        const userID = req.user.id;
        const publicId = req.query.public_id || null;

        let parentID = null;
        if(publicId) {
            parentID = await fileRepo.getFolderIDByPublicID(publicId)  ;
        }

        const row = await fileRepo.getItemsList(userID, parentID)

        const path = await fileRepo.getFullPathByParentID(userID, parentID)
        // console.log(row);

        res.json({
            status: 'ok',
            parent_id: parentID,
            path: path,
            items: row
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'failed to fetch files' });
    }
};

exports.serveThumbnail = async (req, res) => {
    try {
        const hash = req.params.hash;

        const filePath = path.join(
            __dirname,
            "../..",
            "storage",
            "thumbnails",
            hash.slice(0, 2),
            hash.slice(2, 4),
            `${hash}.webp`
        );

        if (!fs.existsSync(filePath)) {
            return res.status(404).end();
        }

        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=31536000");

        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        console.log("Error serving thumbnail:", err);
        res.status(401).end();

    };
}

exports.serveFile = async (req, res) => {
    try {
        const userID = req.user.id;
        const fileID = req.params.id;

        const file = await fileRepo.getFileById(userID, fileID);

        if (!file || !file.storage_path) {
            return res.status(404).json({ message: "File not found" });
        }

        const filePath = file.storage_path;
        const mime = file.mime_type || 'application/octet-stream';

        await fs.promises.access(filePath);
        const stat = await fs.promises.stat(filePath);

        const filename = encodeURIComponent(file.name || 'file');
        const isDownload = req.query.download === 'true';

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        res.setHeader(
            'Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${filename}`
        );

        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

            if (start >= stat.size || end >= stat.size) {
                return res.status(416).send('Requested range not satisfiable');
            }

            const chunkSize = end - start + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Content-Length': chunkSize,
                'Content-Type': mime,
            });

            const stream = fs.createReadStream(filePath, { start, end });

            res.on('close', () => stream.destroy());

            stream.pipe(res);
            return;
        }

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Length', stat.size);

        const stream = fs.createReadStream(filePath);

        res.on('close', () => stream.destroy());

        stream.pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to serve file" });
    }
};

exports.deleteFile = async (req, res) => {
    // await delay(1000)
    try {
        const userID = req.user.id;
        const fileID = req.params.id;

        const result = await fileRepo.deleteFile(userID, fileID);

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: "File not found" });
        }

        if (result.affectedRows > 0) {
            return res.status(200).json({ status: 'ok', message: 'File deleted successfully', file_id: fileID });
        }

        // res.json({ status: 'ok', message: 'File deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to delete file" });
    }
};

exports.updateFile = async (req, res) => {
    try {
        const userID = req.user.id;
        const fileID = req.params.id;

        const payload = req.body;

        const allowedFields = [
            'name',
            'parent_id'
        ];

        const updates = {};

        for (const key of allowedFields) {
            if (payload[key] !== undefined) {
                updates[key] = payload[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(500).json({
                error: 'No fields to update'
            })
        }

        if (updates.name !== undefined) {
            updates.name = sanitizeFileName(updates.name)

            if (!updates.name) {
                return res.status(400).json({
                    error: 'Invalid file name'
                });
            }
        }

        const result = await fileRepo.updateFile(userID, fileID, updates);

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({
                error: 'File not found'
            })
        }

        res.json({
            status: 'ok',
            updated: updates
        })



    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'failed to update file'
        })
    }


}

exports.favorites = async (req, res) => {

    try {
        const userID = req.user.id;
        const fileID = req.params.id;

        // console.log(userID, fileID)

        const favoriteID = await fileRepo.getFileFavoriteByFileID(userID, fileID);
        
        const result = await fileRepo.addOrRemoveFavorite(favoriteID, userID, fileID);
        if(!result) {
            return res.json({
                status: 'ok',
                favorite_id: null,
                action: 'removed'
            })
        }
        return res.json({
            status: 'ok',
            favorite_id: result,
            action: 'added'
        })
    }catch (err) {
        console.error(err)
        res.status(500).json({
            error: 'failed to toggle file favorites'
        })
    }
}