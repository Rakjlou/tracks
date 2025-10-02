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

module.exports = router;
