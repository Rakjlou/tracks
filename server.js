const express = require('express');
const path = require('path');
const { initDatabase } = require('./database/db');
const { createTables } = require('./database/schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('<h1>Sound Review</h1><p>Audio comment widget server is running!</p>');
});

async function startServer() {
    try {
        await initDatabase();
        await createTables();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
