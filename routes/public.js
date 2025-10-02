const express = require('express');
const path = require('path');
const { getDatabase } = require('../database/db');
const { requireResourceAuth, fetchResource } = require('../middleware/resource');
const { getIdFromUuid } = require('../database/queries');

const router = express.Router();

function getResourceIdFromUuid(resourceType) {
    return (req) => {
        const { uuid } = req.params;
        return getIdFromUuid(resourceType, uuid);
    };
}

router.get('/track/:uuid', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'track.html'));
});

router.get('/playlist/:uuid', requireResourceAuth('playlist', getResourceIdFromUuid('playlist')), fetchResource('playlist'), (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'playlist.html'));
});

router.get('/api/playlist/:uuid', requireResourceAuth('playlist', getResourceIdFromUuid('playlist')), fetchResource('playlist'), (req, res) => {
    const playlist = req.resource;
    const db = getDatabase();

    // Get tracks in playlist
    const tracksQuery = `
        SELECT t.id, t.uuid, t.title, t.filename, pt.position
        FROM playlist_tracks pt
        JOIN tracks t ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC
    `;

    db.all(tracksQuery, [playlist.id], (err, tracks) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({
            playlist: {
                ...playlist,
                tracks: tracks
            }
        });
    });
});

router.get('/api/track/:uuid', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    res.json({ track: req.resource });
});

router.get('/api/track/:uuid/audio', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    const audioPath = path.join(__dirname, '..', 'public', 'uploads', 'audio', req.resource.filename);
    res.sendFile(audioPath);
});

router.get('/api/track/:uuid/comments', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    const db = getDatabase();
    const commentsQuery = `
        SELECT id, parent_id, timestamp, username, content, is_closed, created_at
        FROM comments
        WHERE track_id = ?
        ORDER BY timestamp ASC, created_at ASC
    `;

    db.all(commentsQuery, [req.resource.id], (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ comments });
    });
});

router.post('/api/track/:uuid/comments', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    const { timestamp, username, content } = req.body;

    if (!timestamp || !username || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();

    const insertQuery = `
        INSERT INTO comments (track_id, timestamp, username, content)
        VALUES (?, ?, ?, ?)
    `;

    db.run(insertQuery, [req.resource.id, timestamp, username.trim(), content.trim()], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to save comment' });
        }

        res.status(201).json({
            message: 'Comment added successfully',
            comment: {
                id: this.lastID,
                track_id: req.resource.id,
                timestamp: timestamp,
                username: username.trim(),
                content: content.trim(),
                created_at: new Date().toISOString()
            }
        });
    });
});

router.post('/api/track/:uuid/comments/:commentId/reply', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    const { commentId } = req.params;
    const { username, content } = req.body;

    if (!username || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDatabase();

    const parentQuery = 'SELECT id, timestamp FROM comments WHERE id = ? AND track_id = ?';
    db.get(parentQuery, [commentId, req.resource.id], (err, parentComment) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!parentComment) {
            return res.status(404).json({ error: 'Parent comment not found' });
        }

        const insertQuery = `
            INSERT INTO comments (track_id, parent_id, timestamp, username, content)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(insertQuery, [req.resource.id, commentId, parentComment.timestamp, username.trim(), content.trim()], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to save reply' });
            }

            res.status(201).json({
                message: 'Reply added successfully',
                comment: {
                    id: this.lastID,
                    track_id: req.resource.id,
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

router.put('/api/track/:uuid/comments/:commentId/close', requireResourceAuth('track', getResourceIdFromUuid('track')), fetchResource('track'), (req, res) => {
    const { commentId } = req.params;

    const db = getDatabase();

    const commentQuery = 'SELECT id, is_closed FROM comments WHERE id = ? AND track_id = ? AND parent_id IS NULL';
    db.get(commentQuery, [commentId, req.resource.id], (err, comment) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!comment) {
            return res.status(404).json({ error: 'Root comment not found' });
        }

        if (comment.is_closed) {
            return res.status(400).json({ error: 'Thread is already closed' });
        }

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

module.exports = router;
