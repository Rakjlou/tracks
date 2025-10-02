const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/audio/');
    },
    filename: (req, file, cb) => {
        const uuid = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${uuid}${ext}`);
        req.uploadUuid = uuid;
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

router.use(requireAdminAuth);

router.get('/tracks', (req, res) => {
    const db = getDatabase();

    const query = `
        SELECT id, uuid, filename, title, duration, created_at, updated_at
        FROM tracks
        ORDER BY created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ tracks: rows });
    });
});

router.post('/tracks', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    const { title } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const db = getDatabase();
    const uuid = req.uploadUuid;
    const filename = req.file.filename;

    const insertQuery = `
        INSERT INTO tracks (uuid, filename, title)
        VALUES (?, ?, ?)
    `;

    db.run(insertQuery, [uuid, filename, title], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to save track' });
        }

        res.status(201).json({
            message: 'Track uploaded successfully',
            track: {
                id: this.lastID,
                uuid: uuid,
                filename: filename,
                title: title
            }
        });
    });
});

router.get('/playlists', (req, res) => {
    const db = getDatabase();

    const query = `
        SELECT p.id, p.uuid, p.title, p.created_at, p.updated_at,
               COUNT(pt.track_id) as track_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ playlists: rows });
    });
});

router.post('/playlists', (req, res) => {
    const { title } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const db = getDatabase();
    const uuid = uuidv4();

    const insertQuery = 'INSERT INTO playlists (uuid, title) VALUES (?, ?)';

    db.run(insertQuery, [uuid, title.trim()], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to create playlist' });
        }

        res.status(201).json({
            message: 'Playlist created successfully',
            playlist: {
                id: this.lastID,
                uuid: uuid,
                title: title.trim(),
                track_count: 0
            }
        });
    });
});

router.put('/playlists/:id', (req, res) => {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const db = getDatabase();
    const updateQuery = 'UPDATE playlists SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

    db.run(updateQuery, [title.trim(), id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update playlist' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json({ message: 'Playlist updated successfully' });
    });
});

router.delete('/playlists/:id', (req, res) => {
    const { id } = req.params;

    const db = getDatabase();
    const deleteQuery = 'DELETE FROM playlists WHERE id = ?';

    db.run(deleteQuery, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete playlist' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json({ message: 'Playlist deleted successfully' });
    });
});

router.post('/playlists/:id/regenerate-uuid', (req, res) => {
    const { id } = req.params;
    const newUuid = uuidv4();

    const db = getDatabase();
    const updateQuery = 'UPDATE playlists SET uuid = ? WHERE id = ?';

    db.run(updateQuery, [newUuid, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to regenerate UUID' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json({ message: 'UUID regenerated successfully', uuid: newUuid });
    });
});

router.get('/playlists/:id/tracks', (req, res) => {
    const { id } = req.params;

    const db = getDatabase();
    const query = `
        SELECT t.id, t.uuid, t.title, t.filename, pt.position
        FROM playlist_tracks pt
        JOIN tracks t ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC
    `;

    db.all(query, [id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ tracks: rows });
    });
});

router.post('/playlists/:id/tracks', (req, res) => {
    const { id } = req.params;
    const { trackId } = req.body;

    if (!trackId) {
        return res.status(400).json({ error: 'Track ID is required' });
    }

    const db = getDatabase();

    // Get next position
    const positionQuery = 'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_tracks WHERE playlist_id = ?';
    db.get(positionQuery, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const insertQuery = 'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)';
        db.run(insertQuery, [id, trackId, result.next_position], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Track already in playlist' });
                }
                return res.status(500).json({ error: 'Failed to add track to playlist' });
            }

            res.status(201).json({ message: 'Track added to playlist successfully' });
        });
    });
});

router.delete('/playlists/:id/tracks/:trackId', (req, res) => {
    const { id, trackId } = req.params;

    const db = getDatabase();
    const deleteQuery = 'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?';

    db.run(deleteQuery, [id, trackId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to remove track from playlist' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Track not found in playlist' });
        }

        res.json({ message: 'Track removed from playlist successfully' });
    });
});

router.post('/tracks/:id/credentials', (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();
    const bcrypt = require('bcrypt');

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to hash password' });
        }

        const insertQuery = 'INSERT INTO credentials (resource_type, resource_id, username, password) VALUES (?, ?, ?, ?)';

        db.run(insertQuery, ['track', id, username.trim(), hashedPassword], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to save credentials' });
            }

            res.json({
                message: 'Track credentials added successfully',
                credential: {
                    id: this.lastID,
                    username: username.trim()
                }
            });
        });
    });
});

router.post('/playlists/:id/credentials', (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();
    const bcrypt = require('bcrypt');

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to hash password' });
        }

        const insertQuery = 'INSERT INTO credentials (resource_type, resource_id, username, password) VALUES (?, ?, ?, ?)';

        db.run(insertQuery, ['playlist', id, username.trim(), hashedPassword], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to save credentials' });
            }

            res.json({
                message: 'Playlist credentials added successfully',
                credential: {
                    id: this.lastID,
                    username: username.trim()
                }
            });
        });
    });
});

router.delete('/tracks/:id/credentials', (req, res) => {
    const { id } = req.params;

    const db = getDatabase();
    const deleteQuery = 'DELETE FROM credentials WHERE resource_type = ? AND resource_id = ?';

    db.run(deleteQuery, ['track', id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to remove credentials' });
        }

        res.json({ message: 'All track credentials removed successfully' });
    });
});

router.delete('/playlists/:id/credentials', (req, res) => {
    const { id } = req.params;

    const db = getDatabase();
    const deleteQuery = 'DELETE FROM credentials WHERE resource_type = ? AND resource_id = ?';

    db.run(deleteQuery, ['playlist', id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to remove credentials' });
        }

        res.json({ message: 'All playlist credentials removed successfully' });
    });
});

router.delete('/credentials/:credentialId', (req, res) => {
    const { credentialId } = req.params;

    const db = getDatabase();
    const deleteQuery = 'DELETE FROM credentials WHERE id = ?';

    db.run(deleteQuery, [credentialId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to remove credential' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Credential not found' });
        }

        res.json({ message: 'Credential removed successfully' });
    });
});

router.get('/tracks/:id/credentials', (req, res) => {
    const { id } = req.params;

    const db = getDatabase();
    const query = 'SELECT id, username FROM credentials WHERE resource_type = ? AND resource_id = ?';

    db.all(query, ['track', id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({
            hasCredentials: rows.length > 0,
            credentials: rows.map(row => ({ id: row.id, username: row.username }))
        });
    });
});

router.get('/playlists/:id/credentials', (req, res) => {
    const { id } = req.params;

    const db = getDatabase();
    const query = 'SELECT id, username FROM credentials WHERE resource_type = ? AND resource_id = ?';

    db.all(query, ['playlist', id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({
            hasCredentials: rows.length > 0,
            credentials: rows.map(row => ({ id: row.id, username: row.username }))
        });
    });
});

module.exports = router;
