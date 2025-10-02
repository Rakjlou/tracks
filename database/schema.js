const { getDatabase } = require('./db');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    duration REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    parent_id INTEGER,
    timestamp REAL NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    is_closed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credentials_resource ON credentials(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_comments_track ON comments(track_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON comments(track_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
`;

function createTables() {
    return new Promise((resolve, reject) => {
        const db = getDatabase();

        db.exec(SCHEMA_SQL, (err) => {
            if (err) {
                console.error('Error creating tables:', err);
                reject(err);
            } else {
                console.log('Database tables created successfully');
                resolve();
            }
        });
  });
}

module.exports = {
    createTables
};
