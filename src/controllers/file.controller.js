const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.uploadFile = async (req, res) => {
    const userID = req.user.id;
    const deviceUUID = req.device.uuid;

    const busboy = Busboy({ headers: req.headers });

    const uploadsDir = path.join(__dirname, '..', 'uploads', userID.toString(), deviceUUID.toString());
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let uploadedBytes = 0;
    const totalBytes = parseInt(req.headers['content-length'], 10);

    const files = [];
    const fields = {};


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
        const { filename, encoding, mimeType } = info
        const ext = path.extname(filename);
        const newName = `${uuidv4()}${ext}`;
        const saveTo = path.join(uploadsDir, newName);

        const writeStream = fs.createWriteStream(saveTo);

        file.pipe(writeStream);

        file.on('data', (data) => {
            // optional: track per-file progress
        });

        file.on('end', () => {
            files.push({
                originalName: filename,
                savedName: newName,
                type: mimeType
            });

            console.log(`\n📄 Saved: ${filename} -> ${newName}`);
        });
    });

    // 📦 handle fields
    busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
    });

    // ✅ finish
    busboy.on('finish', async () => {
        console.log('🎯 All files processed');

        // try {
        //     // ตัวอย่าง insert DB
        //     await Promise.all(
        //         files.map(f =>
        //             db.insertFiles(
        //                 f.originalName,
        //                 f.savedName,
        //                 0,
        //                 f.type,
        //                 fields.uploadByID,
        //                 fields.uploadToID
        //             )
        //         )
        //     );

        //     res.json({
        //         status: 'ok',
        //         fields,
        //         files
        //     });

        // } catch (err) {
        //     console.error(err);

        //     // cleanup
        //     files.forEach(f => {
        //         fs.unlink(path.join(uploadDir, f.savedName), () => {});
        //     });

        //     res.status(500).json({ error: 'DB error' });
        // }

        res.json({
            status: 'ok',
            fields,
            files
        });
    });

    req.pipe(busboy);
}