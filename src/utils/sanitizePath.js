const path = require('path');

function sanitizePath(input) {
    if (!input) return '';
    let p = input.replace(/\\/g, '/');
    p = path.posix.normalize(p);
    p = p.replace(/^(\.\.(\/|$))+/, '');
    p = p.replace(/^\/+/, '');
    p = p.replace(/\0/g, '');
    return p;
}

module.exports = {
    sanitizePath
}