const bcrypt = require('bcrypt');
const { getDatabase } = require('../database/db');
const { getResourceByUuid } = require('../database/queries');

function requireResourceAuth(resourceType, getResourceIdFromParams) {
    return async (req, res, next) => {
        try {
            const resourceId = await getResourceIdFromParams(req);

            if (!resourceId) {
                return res.status(404).json({ error: 'Resource not found' });
            }

            // Store resourceId for potential reuse by fetchResource
            req.resourceId = resourceId;

            const db = getDatabase();

            const credentialsQuery = `
                SELECT username, password
                FROM credentials
                WHERE resource_type = ? AND resource_id = ?
            `;

            db.all(credentialsQuery, [resourceType, resourceId], (err, credentials) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (credentials.length === 0) {
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

                const validCredential = credentials.find(cred =>
                    cred.username === username && bcrypt.compareSync(password, cred.password)
                );

                if (validCredential) {
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

function fetchResource(resourceType) {
    return async (req, res, next) => {
        try {
            const { uuid } = req.params;
            const resource = await getResourceByUuid(resourceType, uuid);

            if (!resource) {
                return res.status(404).json({ error: `${resourceType} not found` });
            }

            req.resource = resource;

            // Also store resourceId if not already set by requireResourceAuth
            if (!req.resourceId) {
                req.resourceId = resource.id;
            }

            next();
        } catch (error) {
            return res.status(500).json({ error: 'Database error' });
        }
    };
}

module.exports = {
    requireResourceAuth,
    fetchResource
};
