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

module.exports = router;
