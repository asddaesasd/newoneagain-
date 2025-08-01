const admin = require('firebase-admin');
const config = require('./config');
const crypto = require('crypto');

// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(config.FIREBASE_CONFIG),
    databaseURL: config.DATABASE_URL
});

const db = admin.database();
const keysRef = db.ref('keys');
const appsRef = db.ref('applications');

// Helper functions
function generateKey() {
    return crypto.randomBytes(16).toString('hex');
}

function calculateExpiration(type) {
    const now = new Date();
    switch (type) {
        case 'second':
            return now.getTime() + 1000; // 1 second (for testing)
        case 'day':
            return now.getTime() + 24 * 60 * 60 * 1000; // 1 day
        case '3day':
            return now.getTime() + 3 * 24 * 60 * 60 * 1000; // 3 days
        case 'week':
            return now.getTime() + 7 * 24 * 60 * 60 * 1000; // 1 week
        case 'month':
            return now.getTime() + 30 * 24 * 60 * 60 * 1000; // 30 days
        case 'lifetime':
            return now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000; // 10 years
        default:
            return now.getTime() + 24 * 60 * 60 * 1000; // Default: 1 day
    }
}

// Database functions
const database = {
    // Create a new key
    async createKey(type, userId = null, username = null) {
        const keyString = generateKey();
        const now = new Date().getTime();

        await keysRef.child(keyString).set({
            type,
            createdAt: now,
            expiresAt: calculateExpiration(type),
            isActive: true,
            isBanned: false,
            userId,
            username
        });

        return {
            key: keyString,
            type,
            expiresAt: new Date(calculateExpiration(type)).toLocaleString()
        };
    },

    // Delete a key
    async deleteKey(key) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        await keysRef.child(key).remove();
        return { success: true };
    },

    // Ban a key
    async banKey(key) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        await keysRef.child(key).update({ isBanned: true });
        return { success: true };
    },

    // Unban a key
    async unbanKey(key) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        await keysRef.child(key).update({ isBanned: false });
        return { success: true };
    },

    // Pause a key
    async pauseKey(key) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        await keysRef.child(key).update({ isActive: false });
        return { success: true };
    },

    // Resume a key
    async resumeKey(key) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        await keysRef.child(key).update({ isActive: true });
        return { success: true };
    },

    // Extend a key
    async extendKey(key, type) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        const keyData = snapshot.val();
        const newExpiry = keyData.expiresAt + (calculateExpiration(type) - new Date().getTime());

        await keysRef.child(key).update({ expiresAt: newExpiry });
        return {
            success: true,
            expiresAt: new Date(newExpiry).toLocaleString()
        };
    },

    // Get key info
    async getKeyInfo(key) {
        const snapshot = await keysRef.child(key).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Key not found' };
        }

        const keyData = snapshot.val();
        return {
            success: true,
            key,
            type: keyData.type,
            createdAt: new Date(keyData.createdAt).toLocaleString(),
            expiresAt: new Date(keyData.expiresAt).toLocaleString(),
            isActive: keyData.isActive,
            isBanned: keyData.isBanned,
            lastUsed: keyData.lastUsed ? new Date(keyData.lastUsed).toLocaleString() : 'Never',
            hwid: keyData.hwid || 'None',
            username: keyData.username || 'None'
        };
    },

    // List all keys
    async listKeys() {
        const snapshot = await keysRef.once('value');
        const keys = [];

        snapshot.forEach(childSnapshot => {
            const key = childSnapshot.key;
            const data = childSnapshot.val();

            keys.push({
                key,
                type: data.type,
                expiresAt: new Date(data.expiresAt).toLocaleString(),
                isActive: data.isActive,
                isBanned: data.isBanned,
                username: data.username || 'None'
            });
        });

        return keys;
    },

    // Pause all keys
    async pauseAllKeys() {
        const snapshot = await keysRef.once('value');
        const updates = {};

        snapshot.forEach(childSnapshot => {
            updates[`${childSnapshot.key}/isActive`] = false;
        });

        await keysRef.update(updates);
        return { success: true };
    },

    // Resume all keys
    async resumeAllKeys() {
        const snapshot = await keysRef.once('value');
        const updates = {};

        snapshot.forEach(childSnapshot => {
            updates[`${childSnapshot.key}/isActive`] = true;
        });

        await keysRef.update(updates);
        return { success: true };
    },

    // Initialize applications
    async initializeApps() {
        const snapshot = await appsRef.once('value');
        if (!snapshot.exists()) {
            await appsRef.child('default').set({ isActive: true });
        }
    },

    // Add application
    async addApp(name) {
        const snapshot = await appsRef.child(name).once('value');
        if (snapshot.exists()) {
            return { success: false, message: 'Application already exists' };
        }

        await appsRef.child(name).set({ isActive: true });
        return { success: true };
    },

    // Delete application
    async deleteApp(name) {
        if (name === 'default') {
            return { success: false, message: 'Cannot delete default application' };
        }

        const snapshot = await appsRef.child(name).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Application not found' };
        }

        await appsRef.child(name).remove();
        return { success: true };
    },

    // Pause application
    async pauseApp(name) {
        const snapshot = await appsRef.child(name).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Application not found' };
        }

        await appsRef.child(name).update({ isActive: false });
        return { success: true };
    },

    // Resume application
    async resumeApp(name) {
        const snapshot = await appsRef.child(name).once('value');
        if (!snapshot.exists()) {
            return { success: false, message: 'Application not found' };
        }

        await appsRef.child(name).update({ isActive: true });
        return { success: true };
    },

    // List applications
    async listApps() {
        const snapshot = await appsRef.once('value');
        const apps = [];

        snapshot.forEach(childSnapshot => {
            apps.push({
                name: childSnapshot.key,
                isActive: childSnapshot.val().isActive
            });
        });

        return apps;
    }
};

module.exports = database;