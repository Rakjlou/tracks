const express = require('express');
const path = require('path');
const { getDatabase } = require('../database/db');

const router = express.Router();

router.get('/track/:uuid', (req, res) => {
    const { uuid } = req.params;

    const db = getDatabase();
    const query = 'SELECT id, uuid, title FROM tracks WHERE uuid = ?';

    db.get(query, [uuid], (err, track) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        if (!track) {
            return res.status(404).send('Track not found');
        }

        res.sendFile(path.join(__dirname, '..', 'views', 'track.html'));
    });
});

router.get('/api/track/:uuid', (req, res) => {
    const { uuid } = req.params;

    const db = getDatabase();
    const query = `
        SELECT id, uuid, filename, title, duration, created_at
        FROM tracks
        WHERE uuid = ?
    `;

    db.get(query, [uuid], (err, track) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        res.json({ track });
    });
});

router.get('/api/track/:uuid/audio', (req, res) => {
    const { uuid } = req.params;

    const db = getDatabase();
    const query = 'SELECT filename FROM tracks WHERE uuid = ?';

    db.get(query, [uuid], (err, track) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        const audioPath = path.join(__dirname, '..', 'public', 'uploads', 'audio', track.filename);
        res.sendFile(audioPath);
    });
});

router.get('/api/track/:uuid/comments', (req, res) => {
    const { uuid } = req.params;

    const db = getDatabase();

    const trackQuery = 'SELECT id FROM tracks WHERE uuid = ?';
    db.get(trackQuery, [uuid], (err, track) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        const commentsQuery = `
            SELECT id, parent_id, timestamp, username, content, is_closed, created_at
            FROM comments
            WHERE track_id = ?
            ORDER BY timestamp ASC, created_at ASC
        `;

        db.all(commentsQuery, [track.id], (err, comments) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ comments });
        });
    });
});

router.post('/api/track/:uuid/comments', (req, res) => {
    const { uuid } = req.params;
    const { timestamp, username, content } = req.body;

    if (!timestamp || !username || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();

    const trackQuery = 'SELECT id FROM tracks WHERE uuid = ?';
    db.get(trackQuery, [uuid], (err, track) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        const insertQuery = `
            INSERT INTO comments (track_id, timestamp, username, content)
            VALUES (?, ?, ?, ?)
        `;

        db.run(insertQuery, [track.id, timestamp, username.trim(), content.trim()], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to save comment' });
            }

            res.status(201).json({
                message: 'Comment added successfully',
                comment: {
                    id: this.lastID,
                    track_id: track.id,
                    timestamp: timestamp,
                    username: username.trim(),
                    content: content.trim(),
                    created_at: new Date().toISOString()
                }
            });
        });
    });
});

router.post('/api/track/:uuid/comments/:commentId/reply', (req, res) => {
    const { uuid, commentId } = req.params;
    const { username, content } = req.body;

    if (!username || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();

    // First verify the track exists
    const trackQuery = 'SELECT id FROM tracks WHERE uuid = ?';
    db.get(trackQuery, [uuid], (err, track) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Then verify the parent comment exists and get its timestamp
        const parentQuery = 'SELECT id, timestamp FROM comments WHERE id = ? AND track_id = ?';
        db.get(parentQuery, [commentId, track.id], (err, parentComment) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!parentComment) {
                return res.status(404).json({ error: 'Parent comment not found' });
            }

            // Insert the reply
            const insertQuery = `
                INSERT INTO comments (track_id, parent_id, timestamp, username, content)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.run(insertQuery, [track.id, commentId, parentComment.timestamp, username.trim(), content.trim()], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to save reply' });
                }

                res.status(201).json({
                    message: 'Reply added successfully',
                    comment: {
                        id: this.lastID,
                        track_id: track.id,
                        parent_id: parseInt(commentId),
                        timestamp: parentComment.timestamp,
                        username: username.trim(),
                        content: content.trim(),
                        created_at: new Date().toISOString()
                    }
                });
            });
        });
    });
});

router.put('/api/track/:uuid/comments/:commentId/close', (req, res) => {
    const { uuid, commentId } = req.params;

    const db = getDatabase();

    // First verify the track exists
    const trackQuery = 'SELECT id FROM tracks WHERE uuid = ?';
    db.get(trackQuery, [uuid], (err, track) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Verify the comment exists and is a root comment
        const commentQuery = 'SELECT id, is_closed FROM comments WHERE id = ? AND track_id = ? AND parent_id IS NULL';
        db.get(commentQuery, [commentId, track.id], (err, comment) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!comment) {
                return res.status(404).json({ error: 'Root comment not found' });
            }

            if (comment.is_closed) {
                return res.status(400).json({ error: 'Thread is already closed' });
            }

            // Close the thread
            const updateQuery = 'UPDATE comments SET is_closed = 1 WHERE id = ?';
            db.run(updateQuery, [commentId], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to close thread' });
                }

                res.json({
                    message: 'Thread closed successfully',
                    commentId: parseInt(commentId)
                });
            });
        });
    });
});

module.exports = router;
