const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../config/database.config')

const { pipeline } = require('stream/promises')
const { Transform } = require('stream');

const fileRepo = require('../repositories/file.repository')

function sanitizePath(input) {
    if (!input) return '';

    // แปลง \ → /
    let p = input.replace(/\\/g, '/');

    // normalize path
    p = path.posix.normalize(p);

    // ลบ ../../ ด้านหน้า
    p = p.replace(/^(\.\.(\/|$))+/, '');

    // กัน absolute path (/xxx)
    p = p.replace(/^\/+/, '');

    // กัน null byte
    p = p.replace(/\0/g, '');

    return p;
}

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

    // 📥 handle file
    busboy.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;

        const safePath = sanitizePath(filename);
        const parts = safePath.split('/');

        const actualName = parts.pop();
        const folders = parts;

        if (!actualName) {
            file.resume(); // 🔥 สำคัญ กัน stream ค้าง
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
                        fileSize += chunk.length; // 🔥 size
                        cb(null, chunk);
                    }
                });

                // 🔥 stream + hash + write
                await pipeline(file, hashStream, writeStream);

                const fileHash = hash.digest('hex');

                const finalPath = path.join(
                    __dirname,
                    '../..',
                    'storage',
                    fileHash.slice(0, 2),
                    fileHash.slice(2, 4),
                    fileHash
                );

                await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });

                // 🔥 ถ้ามีอยู่แล้ว (dedup)
                try {
                    await fs.promises.access(finalPath);
                    // มีอยู่แล้ว → ลบ temp
                    await fs.promises.unlink(tempPath);
                } catch {
                    // ไม่มี → move
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
                    extension: ext
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

    // 📦 handle fields
    busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
    });

    // ✅ finish
    busboy.on('finish', async () => {
        try {
            await Promise.all(tasks);

            // 🔥 DB part
            for (const f of files) {

                // 1. blob (dedup by hash)
                const blobId = await fileRepo.getOrCreateBlob(
                    f.hash,
                    f.storagePath,
                    f.type,
                    f.size
                );

                // 2. folder tree
                let parentId = null;

                for (const folderName of f.folders) {
                    parentId = await fileRepo.getOrCreateFolder(
                        userID,
                        parentId,
                        folderName
                    );
                }

                // 3. file
                await fileRepo.insertFile(
                    userID,
                    deviceID,
                    parentId,
                    blobId,
                    f.originalName
                );
            }

            res.json({
                status: 'ok',
                count: files.length
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'upload failed' });
        }
    });

    req.pipe(busboy);
};

exports.getItemsList = async (req, res) => {
    try {
        const userID = req.user.id;
        const parentId = req.query.parent_id || null;


        const row = await fileRepo.getItemsList(userID, parentId)

        res.json({
            status: 'ok',
            items: row
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'failed to fetch files' });
    }
};

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

        res.setHeader('Content-Type', mime);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', stat.size);

        const filename = encodeURIComponent(file.name || 'file');

        const isDownload = req.query.download === 'true';

        res.setHeader(
            'Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`
        );

        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

            const chunkSize = end - start + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mime,
            });

            fs.createReadStream(filePath, { start, end }).pipe(res);
            return;
        }

        const stream = fs.createReadStream(filePath);

        stream.on('error', (err) => {
            console.error(err);
            res.status(500).end();
        });

        stream.pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed to serve file" });
    }
};