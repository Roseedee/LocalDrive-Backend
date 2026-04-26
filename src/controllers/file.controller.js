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

    const uploadsDir = path.join(__dirname, '../..', 'upload-temp', userID.toString(), deviceUUID.toString());
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let uploadedBytes = 0;
    const totalBytes = parseInt(req.headers['content-length'], 10);

    const files = [];
    const fields = {};
    const tasks = [];


    req.on('data', chunk => {
        uploadedBytes += chunk.length;

        if (totalBytes) {
            const progress = Math.round((uploadedBytes / totalBytes) * 100);
            console.log(`Upload progress: ${progress}%`);
        }
    })

    req.on('end', () => {
        console.log('Upload complete');
    });

    // 📥 handle file
    busboy.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;

        // 🔥 sanitize แต่ยังเก็บ folder
        const safePath = sanitizePath(filename);

        const parts = safePath.split('/');
        const actualName = parts.pop();
        const folders = parts;

        if (!actualName) {
            throw new Error('Invalid filename');
        }
        const tempPath = path.join(uploadsDir, `temp-${uuidv4()}`);

        const task = (async () => {
            try {
                const writeStream = fs.createWriteStream(tempPath);
                const hash = crypto.createHash('sha256');

                const hashStream = new Transform({
                    transform(chunk, enc, cb) {
                        hash.update(chunk);
                        cb(null, chunk);
                    }
                });

                // 🔥 ใช้ hashStream จริง
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
                await fs.promises.rename(tempPath, finalPath);

                const result = {
                    originalName: actualName,
                    path: safePath,
                    folders,
                    hash: fileHash,
                    storagePath: finalPath,
                    type: mimeType
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
        console.log('🎯 All files processed');
        try {
            await Promise.all(tasks);

            for (const f of files) {

                // 1. blob
                const blobId = await fileRepo.getOrCreateBlob(
                    f.hash,
                    f.storagePath,
                    f.type,
                    0 // size (ค่อยเพิ่มทีหลัง)
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

            res.json({ status: 'ok' });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB error' });
        }
    });

    req.pipe(busboy);
}

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