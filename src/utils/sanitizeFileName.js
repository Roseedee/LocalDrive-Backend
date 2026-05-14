function sanitizeFileName(name) {
    if (!name) return '';

    return name
        .replace(/[\/\\]/g, '') // กัน path separator
        .replace(/\0/g, '')     // กัน null byte
        .trim();
}

module.exports = {
    sanitizeFileName
}