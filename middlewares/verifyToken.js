
const TokenService = require('../services/TokenService');

function verifyToken(req, res, next) {
    const authorization = req.headers.authorization;
    const [scheme, token] = authorization ? authorization.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        req.user = TokenService.verifyToken(token);
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired authentication token' });
    }
}

module.exports = verifyToken;