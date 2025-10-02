const bcrypt = require('bcrypt');
const { getAdminCredentials } = require('../config/admin');
const { getDatabase } = require('../database/db');

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ error: 'Authentication required' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const adminCreds = getAdminCredentials();

    if (username === adminCreds.username && password === adminCreds.password) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ error: 'Invalid credentials' });
    }
}

module.exports = {
    requireAdminAuth
};
