
const jwt = require('jsonwebtoken');

class TokenService {
    generate(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            firmId: user.law_firm_id
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN,
                issuer: process.env.JWT_ISSUER,
                audience: process.env.JWT_AUDIENCE
            }
        );

        return token;
    }

    verifyToken(token) {
        return jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                issuer: process.env.JWT_ISSUER,
                audience: process.env.JWT_AUDIENCE
            }
        );
    }

    compare(token, user) {
        try {
            const decoded = this.verifyToken(token);
            return decoded.sub === user.id && decoded.firmId === user.law_firm_id;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new TokenService();