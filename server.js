const express = require('express');
const path = require('path');
const { initDatabase } = require('./database/db');
const { createTables } = require('./database/schema');
const { requireAdminAuth } = require('./middleware/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('<h1>Sound Review</h1><p>Audio comment widget server is running!</p>');
});

app.use('/admin', adminRoutes);

app.get('/admin', requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
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
