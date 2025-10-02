const { getDatabase } = require('./db');

const RESOURCE_TABLES = {
    track: 'tracks',
    playlist: 'playlists'
};

function getIdFromUuid(resourceType, uuid) {
    const tableName = RESOURCE_TABLES[resourceType];
    if (!tableName) {
        return Promise.reject(new Error(`Invalid resource type: ${resourceType}`));
    }

    const db = getDatabase();
    const query = `SELECT id FROM ${tableName} WHERE uuid = ?`;

    return new Promise((resolve, reject) => {
        db.get(query, [uuid], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.id : null);
        });
    });
}

function getResourceByUuid(resourceType, uuid) {
    const tableName = RESOURCE_TABLES[resourceType];
    if (!tableName) {
        return Promise.reject(new Error(`Invalid resource type: ${resourceType}`));
    }

    const db = getDatabase();
    const query = `SELECT * FROM ${tableName} WHERE uuid = ?`;

    return new Promise((resolve, reject) => {
        db.get(query, [uuid], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

module.exports = {
    getIdFromUuid,
    getResourceByUuid
};
