const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || '15m';
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS) || 30;

module.exports = {
    ACCESS_TOKEN_EXPIRATION,
    REFRESH_TOKEN_MS: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000, // Convert days to milliseconds
};