const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const config = require('./config');
const database = require('./database');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Check user roles
function checkUserRoles(member) {
    // Default to no permissions if member is undefined (like in DMs)
    if (!member) return { isAdmin: false, isManager: false };

    // Check if user is an admin
    const isAdmin = config.ADMIN_IDS.includes(member.id);

    // Check if MANAGEMENT_ROLE_IDS exists in config
    if (!config.MANAGEMENT_ROLE_IDS) {
        console.warn("MANAGEMENT_ROLE_IDS not defined in config.js");
        return { isAdmin, isManager: isAdmin }; // If admin, also grant manager permissions
    }

    // Check if user has management role
    const isManager = member.roles?.cache?.some(role =>
        config.MANAGEMENT_ROLE_IDS.includes(role.id)
    ) || isAdmin; // Admins also have manager permissions

    return { isAdmin, isManager };
}

// Bot commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.PREFIX)) return;

    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Get user roles
    const { isAdmin, isManager } = checkUserRoles(message.member);

    // Help command
    if (command === 'help') {
        let helpEmbed = new EmbedBuilder()
            .setTitle('Key Authentication Bot Commands')
            .setColor('#0099ff');

        if (isAdmin) {
            helpEmbed.setDescription('Admin Commands:')
                .addFields(
                    { name: `${config.PREFIX}create <type> [user] [username]`, value: 'Create a new key (types: day, 3day, week, month, lifetime)' },
                    { name: `${config.PREFIX}delete <key>`, value: 'Delete a key' },
                    { name: `${config.PREFIX}ban <key>`, value: 'Ban a key' },
                    { name: `${config.PREFIX}unban <key>`, value: 'Unban a key' },
                    { name: `${config.PREFIX}extend <key> <type>`, value: 'Extend a key\'s expiration' },
                    { name: `${config.PREFIX}pause <key>`, value: 'Pause a key (deactivate)' },
                    { name: `${config.PREFIX}resume <key>`, value: 'Resume a key (activate)' },
                    { name: `${config.PREFIX}pauseall`, value: 'Pause all keys' },
                    { name: `${config.PREFIX}resumeall`, value: 'Resume all keys' },
                    { name: `${config.PREFIX}info <key>`, value: 'Get information about a key' },
                    { name: `${config.PREFIX}list`, value: 'List all keys' },
                    { name: `${config.PREFIX}applist`, value: 'List all applications' },
                    { name: `${config.PREFIX}appadd <name>`, value: 'Add a new application' },
                    { name: `${config.PREFIX}appdelete <name>`, value: 'Delete an application' },
                    { name: `${config.PREFIX}apppause <name>`, value: 'Pause an application' },
                    { name: `${config.PREFIX}appresume <name>`, value: 'Resume an application' }
                );
        } else if (isManager) {
            helpEmbed.setDescription('Management Commands:')
                .addFields(
                    { name: `${config.PREFIX}create <type> [user] [username]`, value: 'Create a new key (types: day, 3day, week, month, lifetime)' },
                    { name: `${config.PREFIX}delete <key>`, value: 'Delete a key' },
                    { name: `${config.PREFIX}extend <key> <type>`, value: 'Extend a key\'s expiration' },
                    { name: `${config.PREFIX}info <key>`, value: 'Get information about a key' },
                    { name: `${config.PREFIX}list`, value: 'List all keys' }
                );
        } else {
            helpEmbed.setDescription('User Commands:')
                .addFields(
                    { name: `${config.PREFIX}help`, value: 'Show this help message' },
                    { name: `${config.PREFIX}info <key>`, value: 'Get information about your key' }
                );
        }

        message.reply({ embeds: [helpEmbed] });
    }

    // Management commands (create, delete, extend, info, list)
    else if (isManager) {
        if (command === 'create') {
            const keyType = args[0];
            const userId = args[1] || null;
            const username = args.slice(2).join(' ') || null;

            if (!keyType || !['day', '3day', 'week', 'month', 'lifetime', 'second'].includes(keyType)) {
                return message.reply('Please provide a valid key type: day, 3day, week, month, lifetime, second');
            }

            try {
                const result = await database.createKey(keyType, userId, username);
                const embed = new EmbedBuilder()
                    .setTitle('Key Created')
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Key', value: `\`${result.key}\`` },
                        { name: 'Type', value: keyType },
                        { name: 'Expires', value: result.expiresAt }
                    );
                message.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error creating key:', error);
                message.reply('Error creating key. Please try again.');
            }
        }
        else if (command === 'delete') {
            const key = args[0];
            if (!key) {
                return message.reply('Please provide a key to delete.');
            }

            try {
                const result = await database.deleteKey(key);
                if (!result.success) {
                    return message.reply(result.message);
                }
                message.reply(`Key \`${key}\` deleted successfully.`);
            } catch (error) {
                console.error('Error deleting key:', error);
                message.reply('Error deleting key. Please try again.');
            }
        }
        else if (command === 'extend') {
            const key = args[0];
            const keyType = args[1];

            if (!key || !keyType) {
                return message.reply('Please provide a key and type to extend.');
            }

            if (!['day', '3day', 'week', 'month', 'lifetime', 'second'].includes(keyType)) {
                return message.reply('Please provide a valid key type: day, 3day, week, month, lifetime, second');
            }

            try {
                const result = await database.extendKey(key, keyType);
                if (!result.success) {
                    return message.reply(result.message);
                }
                message.reply(`Key \`${key}\` extended successfully. New expiration: ${result.expiresAt}`);
            } catch (error) {
                console.error('Error extending key:', error);
                message.reply('Error extending key. Please try again.');
            }
        }
        else if (command === 'info') {
            const key = args[0];
            if (!key) {
                return message.reply('Please provide a key to check.');
            }

            try {
                const result = await database.getKeyInfo(key);
                if (!result.success) {
                    return message.reply(result.message);
                }

                const status = result.isBanned ? 'BANNED' : (result.isActive ? 'ACTIVE' : 'PAUSED');
                const embed = new EmbedBuilder()
                    .setTitle('Key Information')
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Key', value: `\`${result.key}\`` },
                        { name: 'Type', value: result.type },
                        { name: 'Status', value: status },
                        { name: 'Created', value: result.createdAt },
                        { name: 'Expires', value: result.expiresAt },
                        { name: 'Last Used', value: result.lastUsed },
                        { name: 'HWID', value: result.hwid },
                        { name: 'Username', value: result.username }
                    );
                message.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error getting key info:', error);
                message.reply('Error getting key info. Please try again.');
            }
        }
        else if (command === 'list') {
            try {
                const keys = await database.listKeys();
                if (keys.length === 0) {
                    return message.reply('No keys found.');
                }

                let keyList = '';
                keys.forEach((key, index) => {
                    const status = key.isBanned ? 'BANNED' : (key.isActive ? 'ACTIVE' : 'PAUSED');
                    keyList += `${index + 1}. \`${key.key}\` - ${key.type} - ${status} - Expires: ${key.expiresAt}\n`;
                    if (key.username !== 'None') {
                        keyList += `   User: ${key.username}\n`;
                    }
                });

                const embed = new EmbedBuilder()
                    .setTitle('Key List')
                    .setColor('#0099ff')
                    .setDescription(keyList);
                message.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error listing keys:', error);
                message.reply('Error listing keys. Please try again.');
            }
        }

        // Admin-only commands - only process if user is admin
        else if (isAdmin) {
            if (command === 'ban') {
                const key = args[0];
                if (!key) {
                    return message.reply('Please provide a key to ban.');
                }

                try {
                    const result = await database.banKey(key);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Key \`${key}\` banned successfully.`);
                } catch (error) {
                    console.error('Error banning key:', error);
                    message.reply('Error banning key. Please try again.');
                }
            }
            else if (command === 'unban') {
                const key = args[0];
                if (!key) {
                    return message.reply('Please provide a key to unban.');
                }

                try {
                    const result = await database.unbanKey(key);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Key \`${key}\` unbanned successfully.`);
                } catch (error) {
                    console.error('Error unbanning key:', error);
                    message.reply('Error unbanning key. Please try again.');
                }
            }
            else if (command === 'pause') {
                const key = args[0];
                if (!key) {
                    return message.reply('Please provide a key to pause.');
                }

                try {
                    const result = await database.pauseKey(key);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Key \`${key}\` paused successfully.`);
                } catch (error) {
                    console.error('Error pausing key:', error);
                    message.reply('Error pausing key. Please try again.');
                }
            }
            else if (command === 'resume') {
                const key = args[0];
                if (!key) {
                    return message.reply('Please provide a key to resume.');
                }

                try {
                    const result = await database.resumeKey(key);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Key \`${key}\` resumed successfully.`);
                } catch (error) {
                    console.error('Error resuming key:', error);
                    message.reply('Error resuming key. Please try again.');
                }
            }
            else if (command === 'pauseall') {
                try {
                    await database.pauseAllKeys();
                    message.reply('All keys paused successfully.');
                } catch (error) {
                    console.error('Error pausing all keys:', error);
                    message.reply('Error pausing all keys. Please try again.');
                }
            }
            else if (command === 'resumeall') {
                try {
                    await database.resumeAllKeys();
                    message.reply('All keys resumed successfully.');
                } catch (error) {
                    console.error('Error resuming all keys:', error);
                    message.reply('Error resuming all keys. Please try again.');
                }
            }
            else if (command === 'applist') {
                try {
                    const apps = await database.listApps();
                    if (apps.length === 0) {
                        return message.reply('No applications found.');
                    }

                    let appList = '';
                    apps.forEach((app, index) => {
                        const status = app.isActive ? 'ACTIVE' : 'PAUSED';
                        appList += `${index + 1}. ${app.name} - ${status}\n`;
                    });

                    const embed = new EmbedBuilder()
                        .setTitle('Application List')
                        .setColor('#0099ff')
                        .setDescription(appList);
                    message.reply({ embeds: [embed] });
                } catch (error) {
                    console.error('Error listing applications:', error);
                    message.reply('Error listing applications. Please try again.');
                }
            }
            else if (command === 'appadd') {
                const appName = args[0];
                if (!appName) {
                    return message.reply('Please provide an application name.');
                }

                try {
                    const result = await database.addApp(appName);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Application \`${appName}\` added successfully.`);
                } catch (error) {
                    console.error('Error adding application:', error);
                    message.reply('Error adding application. Please try again.');
                }
            }
            else if (command === 'appdelete') {
                const appName = args[0];
                if (!appName) {
                    return message.reply('Please provide an application name.');
                }

                try {
                    const result = await database.deleteApp(appName);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Application \`${appName}\` deleted successfully.`);
                } catch (error) {
                    console.error('Error deleting application:', error);
                    message.reply('Error deleting application. Please try again.');
                }
            }
            else if (command === 'apppause') {
                const appName = args[0];
                if (!appName) {
                    return message.reply('Please provide an application name.');
                }

                try {
                    const result = await database.pauseApp(appName);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Application \`${appName}\` paused successfully.`);
                } catch (error) {
                    console.error('Error pausing application:', error);
                    message.reply('Error pausing application. Please try again.');
                }
            }
            else if (command === 'appresume') {
                const appName = args[0];
                if (!appName) {
                    return message.reply('Please provide an application name.');
                }

                try {
                    const result = await database.resumeApp(appName);
                    if (!result.success) {
                        return message.reply(result.message);
                    }
                    message.reply(`Application \`${appName}\` resumed successfully.`);
                } catch (error) {
                    console.error('Error resuming application:', error);
                    message.reply('Error resuming application. Please try again.');
                }
            }
        }
    }
    // User commands (non-admin, non-manager)
    else if (command === 'info') {
        const key = args[0];
        if (!key) {
            return message.reply('Please provide a key to check.');
        }

        try {
            const result = await database.getKeyInfo(key);
            if (!result.success) {
                return message.reply(result.message);
            }

            // For security, only show limited information to non-admins/non-managers
            const status = result.isBanned ? 'BANNED' : (result.isActive ? 'ACTIVE' : 'PAUSED');
            const embed = new EmbedBuilder()
                .setTitle('Key Information')
                .setColor('#0099ff')
                .addFields(
                    { name: 'Type', value: result.type },
                    { name: 'Status', value: status },
                    { name: 'Expires', value: result.expiresAt }
                );
            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error getting key info:', error);
            message.reply('Error getting key info. Please try again.');
        }
    }
});

// Initialize bot
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Initialize applications
    try {
        await database.initializeApps();
        console.log('Applications initialized');
    } catch (error) {
        console.error('Error initializing applications:', error);
    }
});

// Login to Discord
client.login(config.BOT_TOKEN);
             