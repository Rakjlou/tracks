const ADMIN_CONFIG = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

function getAdminCredentials() {
    return ADMIN_CONFIG;
}

module.exports = {
    getAdminCredentials
};