const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateThumbnail({ inputPath, hash }) {
    const thumbPath = path.join(
        __dirname,
        '../..',
        'storage',
        'thumbnails',
        hash.slice(0, 2),
        hash.slice(2, 4),
        hash + '.webp'
    );

    await fs.promises.mkdir(path.dirname(thumbPath), { recursive: true });

    // check file exists
    try {
        await fs.promises.stat(thumbPath);
        return thumbPath;
    } catch (err) {}

    try {
        await sharp(inputPath)
            .rotate()
            .resize(200, 200, {
                fit: 'inside',           // ✅ ไม่ crop ไม่เสียสัดส่วน
                withoutEnlargement: true // กันภาพเล็กโดนขยาย
            })
            .withMetadata(false)
            .webp({
                quality: 75
            })
            .toFile(thumbPath);

        return thumbPath;

    } catch (err) {
        try {
            await fs.promises.unlink(thumbPath);
        } catch (_) {}

        throw err;
    }
}

module.exports = {
    generateThumbnail
};