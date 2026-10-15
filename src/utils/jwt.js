const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_EXPIRATION, DEVICE_SELECTION_TOKEN_EXPIRATION } = require('../config/auth.config');

exports.signAccess = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

exports.verifyAccess = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}

exports.signDeiveSelection = (userID) => {
    return jwt.sign(
        {
            user_id: userID,
            token_type: "device_selection"
        },
        process.env.JWT_DEVICE_SELECTION_SECRET,
        {
            expiresIn: DEVICE_SELECTION_TOKEN_EXPIRATION
        }
    );
};

exports.verifyDeviceSelection = (token) => {
    const decoded = jwt.verify(
        token,
        process.env.JWT_DEVICE_SELECTION_SECRET
    )

    if(decoded.token_type !== "device_selection") {
        throw new Error("Invalid token type");
    }

    return decoded;
}