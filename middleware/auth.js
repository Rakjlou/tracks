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

function requireResourceAuth(resourceType, getResourceIdFromParams) {
    return async (req, res, next) => {
        try {
            const resourceId = await getResourceIdFromParams(req);

            if (!resourceId) {
                return res.status(404).json({ error: 'Resource not found' });
            }

            const db = getDatabase();

            const credentialsQuery = `
                SELECT username, password
                FROM credentials
                WHERE resource_type = ? AND resource_id = ?
            `;

            db.get(credentialsQuery, [resourceType, resourceId], (err, credential) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!credential) {
                    return next();
                }

                const authHeader = req.headers.authorization;

                if (!authHeader || !authHeader.startsWith('Basic ')) {
                    res.setHeader('WWW-Authenticate', 'Basic realm="Resource Access"');
                    return res.status(401).json({ error: 'Authentication required' });
                }

                const base64Credentials = authHeader.split(' ')[1];
                const credString = Buffer.from(base64Credentials, 'base64').toString('ascii');
                const [username, password] = credString.split(':');

                if (credential.username === username && bcrypt.compareSync(password, credential.password)) {
                    req.authenticatedUser = username;
                    next();
                } else {
                    res.setHeader('WWW-Authenticate', 'Basic realm="Resource Access"');
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
            });

        } catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
    };
}

module.exports = {
    requireAdminAuth,
    requireResourceAuth
};
