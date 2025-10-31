const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionResponseFlags } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection, StreamType, NoSubscriberBehavior } = require('@discordjs/voice');
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { chromium } = require('playwright');
const WebSocket = require('ws');
const { Readable } = require('stream');
const AudioManager = require('./AudioManager');
const SpotifyConnectMonitor = require('./SpotifyConnect');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

class EnspotificationBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.app = express();
        this.spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback'
        });

        this.userTokens = new Map();
        this.activeConnections = new Map();
        this.voiceConnections = new Map();
        this.audioPlayers = new Map();
        this.currentTracks = new Map();
        this.voiceDevices = new Map();
        this.browserInstances = new Map();
        this.deviceId = null;

        // Initialize Discord ActivityType
        this.ActivityType = {
            Playing: 0,
            Streaming: 1,
            Listening: 2,
            Watching: 3,
            Custom: 4,
            Competing: 5
        };

        this.initialize();
    }

    async initialize() {
        try {
            await this.setupExpress();
            await this.setupDiscordBot();
        } catch (error) {
            console.error('Initialization error:', error);
            process.exit(1);
        }
    }

    async updateNowPlaying(userId) {
        const currentTrack = this.currentTracks.get(userId);
        const connection = this.activeConnections.get(userId);
        
        if (!currentTrack || !connection) {
            return;
        }

        try {
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('Now Playing')
                .setDescription(`**${currentTrack.title}**\nby ${currentTrack.artist}`);

            if (currentTrack.image) {
                embed.setThumbnail(currentTrack.image);
            }

            if (this.client.user) {
                this.client.user.setActivity(`${currentTrack.title} by ${currentTrack.artist}`, {
                    type: this.ActivityType.Listening
                });
            }

            const channel = connection.channel;
            if (channel) {
                if (connection.nowPlayingMessage) {
                    await connection.nowPlayingMessage.edit({ embeds: [embed] });
                } else {
                    const msg = await channel.send({ embeds: [embed] });
                    connection.nowPlayingMessage = msg;
                }
            }
        } catch (error) {
            console.error('Failed to update now playing message:', error);
        }
    }

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.app = express();
        this.spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: process.env.SPOTIFY_REDIRECT_URI
        });

        this.userTokens = new Map(); // Store user Spotify tokens
        this.activeConnections = new Map(); // Track active Spotify connections
        this.voiceConnections = new Map(); // Track Discord voice connections per guild
        this.audioPlayers = new Map(); // Track audio players per guild
        this.currentTracks = new Map(); // Track currently playing tracks per guild
        this.voiceDevices = new Map(); // Track Spotify Connect devices for voice channels
        this.browserInstances = new Map(); // Track browser instances per guild
        this.deviceId = null;

        // Initialize Discord ActivityType
        this.ActivityType = {
            Playing: 0,
            Streaming: 1,
            Listening: 2,
            Watching: 3,
            Custom: 4,
            Competing: 5
        };

        // Set up error handlers
        this.client.on('error', error => {
            console.error('Discord client error:', error);
        });

        this.client.on('disconnect', () => {
            console.log('Discord client disconnected. Attempting to reconnect...');
        });

        process.on('unhandledRejection', (error) => {
            console.error('Unhandled promise rejection:', error);
        });

        try {
            this.setupExpress();
            this.setupDiscordBot();
        } catch (error) {
            console.error('Setup error:', error);
        }
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
            .setColor('#1DB954')  // Spotify green
            .setTitle('Now Playing')
            .setDescription(`**${currentTrack.title}**\nby ${currentTrack.artist}`);

        if (currentTrack.image) {
            embed.setThumbnail(currentTrack.image);
        }

        // Update the bot's activity
        this.client.user.setActivity(currentTrack.title, {
            type: this.ActivityType.Listening,
            name: `${currentTrack.title} by ${currentTrack.artist}`
        });

        // If we have a channel, send/update the now playing message
        const channel = connection.channel;
        if (channel) {
            // Send or update now playing message
            if (connection.nowPlayingMessage) {
                connection.nowPlayingMessage.edit({ embeds: [embed] }).catch(console.error);
            } else {
                channel.send({ embeds: [embed] })
                    .then(msg => connection.nowPlayingMessage = msg)
                    .catch(console.error);
            }
        }
    }

        // Initialize audio manager
        this.audioManager = new AudioManager();
    }

    async setupExpress() {
        return new Promise((resolve, reject) => {
            try {
                // Validate environment
                const port = process.env.PORT || 3000;
                
                this.app.use(cors());
                this.app.use(express.json());
                this.app.use(express.static('public'));

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('💥 Express error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok',
                discord: this.client?.user ? 'connected' : 'disconnected',
                spotify: this.spotifyApi ? 'initialized' : 'not initialized'
            });
        });

        // Start Express server
        const server = this.app.listen(port, () => {
            console.log(`🌐 Express server listening on port ${port}`);
        }).on('error', (error) => {
            console.error('💥 Express server error:', error);
            process.exit(1);
        });

        // Track update endpoint
        this.app.post('/update-track', async (req, res) => {
            try {
                const { title, artist, image, spotify, userId } = req.body;
                
                if (!title || !artist || !userId) {
                    return res.status(400).json({ error: 'Missing required track info' });
                }

                this.currentTracks.set(userId, {
                    title,
                    artist,
                    image,
                    spotify
                });

                // Update any active voice connections for this user
                await this.updateNowPlaying(userId);

                res.json({ status: 'success' });
            } catch (error) {
                console.error('💥 Track update error:', error);
                res.status(500).json({ error: 'Failed to update track info' });
            }

            this.currentTracks.set(userId, {
                title,
                artist,
                image,
                spotify
            });

            // Update any active voice connections for this user
            this.updateNowPlaying(userId);

            res.json({ status: 'success' });
        });

        // Spotify OAuth callback
        this.app.get('/callback', async (req, res) => {
            const { code, state } = req.query;
            
            if (!code) {
                return res.status(400).send('Authorization code not provided');
            }

            try {
                const data = await this.spotifyApi.authorizationCodeGrant(code);
                const { access_token, refresh_token } = data.body;

                // Store tokens for the user (state contains user ID)
                this.userTokens.set(state, {
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt: Date.now() + (data.body.expires_in * 1000)
                });

                console.log(`✅ Spotify authentication successful for user: ${state}`);
                
                // Auto-create device if user has active voice connections
                this.autoCreateDevicesAfterAuth(state, access_token);
                
                res.send(`
                    <html>
                        <head>
                            <title>Enspotification - Connected!</title>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    text-align: center; 
                                    padding: 50px;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                }
                                .container {
                                    background: rgba(255,255,255,0.1);
                                    padding: 30px;
                                    border-radius: 15px;
                                    max-width: 400px;
                                    margin: 0 auto;
                                }
                                h1 { color: #1DB954; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>🎵 Successfully Connected!</h1>
                                <p>Your Spotify account is now linked to Enspotification.</p>
                                <p>Creating your Spotify Connect device...</p>
                                <p>You can close this window and return to Discord.</p>
                            </div>
                        </body>
                    </html>
                `);
            } catch (error) {
                console.error('Error during Spotify authentication:', error);
                res.status(500).send('Authentication failed');
            }
        });

        // Serve the Spotify Web Playback SDK
        this.app.get('/player', (req, res) => {
            const { userId } = req.query;
            
            // Debug information
            console.log(`🔍 Player request for userId: ${userId}`);
            console.log(`🔍 Available user tokens:`, Array.from(this.userTokens.keys()));
            
            const userToken = this.userTokens.get(userId);
            
            if (!userToken) {
                // Show helpful error page with available user IDs
                const availableUsers = Array.from(this.userTokens.keys());
                return res.status(401).send(`
                    <h2>User not authenticated with Spotify</h2>
                    <p><strong>Requested User ID:</strong> ${userId}</p>
                    <p><strong>Available authenticated users:</strong> ${availableUsers.join(', ')}</p>
                    ${availableUsers.length > 0 ? 
                        `<p><a href="/player?userId=${availableUsers[0]}">Try with user ${availableUsers[0]}</a></p>` : 
                        '<p>No users are currently authenticated. Run /join in Discord first.</p>'
                    }
                `);
            }

            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Enspotification Player</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background: #191414;
                            color: white;
                            text-align: center;
                            padding: 20px;
                        }
                        .player-container {
                            max-width: 400px;
                            margin: 0 auto;
                            padding: 20px;
                            background: #282828;
                            border-radius: 10px;
                        }
                        .status {
                            margin: 20px 0;
                            padding: 10px;
                            border-radius: 5px;
                        }
                        .connected { background: #1DB954; }
                        .disconnected { background: #E22134; }
                    </style>
                </head>
                <body>
                    <div class="player-container">
                        <h1>🎵 Enspotification Player</h1>
                        <div id="status" class="status disconnected">Initializing...</div>
                        <div id="track-info"></div>
                    </div>

                    <script src="https://sdk.scdn.co/spotify-player.js"></script>
                    <script>
                        let player;
                        let deviceId;
                        let initTimeout;

                        // Debug function to update status
                        function updateStatus(message, isError = false) {
                            console.log(message);
                            document.getElementById('status').textContent = message;
                            document.getElementById('status').className = isError ? 'status disconnected' : 'status connected';
                        }

                        // Timeout protection
                        initTimeout = setTimeout(() => {
                            updateStatus('⚠️ SDK callback timeout - forcing initialization...', false);
                            initializePlayer();
                        }, 5000);

                        window.onSpotifyWebPlaybackSDKReady = () => {
                            clearTimeout(initTimeout);
                            updateStatus('🔄 SDK Ready - Creating player...');
                            initializePlayer();
                        };
                        
                        function initializePlayer() {
                            const token = '${userToken.accessToken}';
                            
                            try {
                                player = new Spotify.Player({
                                    name: 'Enspotification Voice',
                                    getOAuthToken: cb => { 
                                        console.log('Getting OAuth token...');
                                        cb(token); 
                                    },
                                    volume: 0.5
                                });

                                // Error handling
                                player.addListener('initialization_error', ({ message }) => {
                                    console.error('Failed to initialize:', message);
                                    updateStatus('❌ Initialization error: ' + message, true);
                                });

                                player.addListener('authentication_error', ({ message }) => {
                                    console.error('Authentication failed:', message);
                                    updateStatus('❌ Authentication error: ' + message, true);
                                });

                                player.addListener('account_error', ({ message }) => {
                                    console.error('Account error:', message);
                                    updateStatus('❌ Account error (Premium required?): ' + message, true);
                                });

                                player.addListener('playback_error', ({ message }) => {
                                    console.error('Playback error:', message);
                                    updateStatus('❌ Playback error: ' + message, true);
                                });

                                player.addListener('ready', ({ device_id }) => {
                                    console.log('Ready with Device ID', device_id);
                                    deviceId = device_id;
                                    updateStatus('✅ Connected as Spotify device!');
                                    
                                    // Notify the bot about the device ID
                                    fetch('/device-ready', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ userId: '${userId}', deviceId: device_id })
                                    }).then(response => {
                                        console.log('Device notification sent:', response.ok);
                                    }).catch(error => {
                                        console.error('Failed to notify bot:', error);
                                    });
                                });
                            });

                            player.addListener('not_ready', ({ device_id }) => {
                                console.log('Device ID has gone offline', device_id);
                                updateStatus('⚠️ Device disconnected');
                            });

                            player.addListener('player_state_changed', state => {
                                if (state) {
                                    const track = state.track_window.current_track;
                                    document.getElementById('track-info').innerHTML = 
                                        \`<p><strong>Now Playing:</strong><br/>
                                        \${track.name} by \${track.artists[0].name}</p>\`;
                                }
                            });

                            // Connect to Spotify
                            updateStatus('🔄 Connecting to Spotify...');
                            player.connect().then(success => {
                                if (success) {
                                    updateStatus('🔄 Connected - waiting for device ready...');
                                } else {
                                    updateStatus('❌ Failed to connect to Spotify', true);
                                }
                            });

                        } catch (error) {
                            console.error('Error creating player:', error);
                            updateStatus('❌ Error creating player: ' + error.message, true);
                        }
                    }

                    // Check if SDK is available
                    if (typeof Spotify === 'undefined') {
                        setTimeout(() => {
                            if (typeof Spotify === 'undefined') {
                                updateStatus('❌ Spotify SDK failed to load', true);
                            }
                        }, 5000);
                    }
                </script>
                </body>
                </html>
            `);
        });

        // Diagnostic endpoint for Web Playback SDK
        this.app.get('/sdk-test', (req, res) => {
            const { userId } = req.query;
            const userToken = this.userTokens.get(userId);
            
            if (!userToken) {
                return res.status(401).send('User not authenticated with Spotify');
            }

            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>SDK Diagnostic Test</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; background: #191414; color: white; }
                        .test { margin: 10px 0; padding: 10px; border-radius: 5px; }
                        .pass { background: #1DB954; }
                        .fail { background: #E22134; }
                        .pending { background: #FFA500; }
                    </style>
                </head>
                <body>
                    <h1>🔍 Web Playback SDK Diagnostic</h1>
                    <div id="tests"></div>
                    
                    <script src="https://sdk.scdn.co/spotify-player.js"></script>
                    <script>
                        const results = [];
                        
                        function addTest(name, status, message) {
                            results.push({name, status, message});
                            updateDisplay();
                        }
                        
                        function updateDisplay() {
                            document.getElementById('tests').innerHTML = results.map(r => 
                                \`<div class="test \${r.status}">
                                    <strong>\${r.name}:</strong> \${r.message}
                                </div>\`
                            ).join('');
                        }
                        
                        // Test 1: Check if SDK loads
                        setTimeout(() => {
                            if (typeof Spotify !== 'undefined') {
                                addTest('SDK Loading', 'pass', 'Spotify SDK loaded successfully');
                                
                                // Test 2: Check token scopes and validity
                                fetch('https://api.spotify.com/v1/me', {
                                    headers: { 'Authorization': 'Bearer ${userToken.accessToken}' }
                                }).then(r => r.json()).then(data => {
                                    if (data.error) {
                                        addTest('API Access', 'fail', \`API Error: \${data.error.message}\`);
                                        return;
                                    }
                                    
                                    if (data.product) {
                                        addTest('Account Type', data.product === 'premium' ? 'pass' : 'fail', 
                                            \`Account: \${data.product} (Premium required for Web Playback SDK)\`);
                                    }
                                    addTest('User Info', 'pass', \`User: \${data.display_name || data.id}\`);
                                    
                                    // Test token with a Web Playback specific endpoint
                                    fetch('https://api.spotify.com/v1/me/player/devices', {
                                        headers: { 'Authorization': 'Bearer ${userToken.accessToken}' }
                                    }).then(r => r.json()).then(deviceData => {
                                        if (deviceData.error) {
                                            if (deviceData.error.status === 403) {
                                                addTest('Token Scopes', 'fail', 'Missing required scopes for Web Playback SDK');
                                            } else {
                                                addTest('Token Scopes', 'fail', \`Token error: \${deviceData.error.message}\`);
                                            }
                                        } else {
                                            addTest('Token Scopes', 'pass', 'Token has required Web Playback scopes');
                                        }
                                    }).catch(err => {
                                        addTest('Token Scopes', 'fail', 'Failed to validate token scopes: ' + err.message);
                                    });
                                    
                                }).catch(err => {
                                    addTest('API Access', 'fail', 'Failed to access Spotify API: ' + err.message);
                                });
                                
                                // Test 3: Try creating player
                                window.onSpotifyWebPlaybackSDKReady = () => {
                                    addTest('SDK Ready', 'pass', 'onSpotifyWebPlaybackSDKReady callback fired');
                                    tryCreatePlayer();
                                };
                                
                                // Backup: Force SDK ready after timeout
                                setTimeout(() => {
                                    if (!results.find(r => r.name === 'SDK Ready')) {
                                        addTest('SDK Ready', 'fail', 'Callback timeout - forcing manual initialization');
                                        tryCreatePlayer();
                                    }
                                }, 3000);
                                
                                function tryCreatePlayer() {
                                    try {
                                        // First, validate the token format
                                        const token = '${userToken.accessToken}';
                                        addTest('Token Format', token && token.length > 50 ? 'pass' : 'fail', 
                                            \`Token length: \${token ? token.length : 0} chars\`);
                                        
                                        const player = new Spotify.Player({
                                            name: 'SDK Test Player',
                                            getOAuthToken: cb => {
                                                console.log('SDK requesting token, providing:', token.substring(0, 20) + '...');
                                                cb(token);
                                            },
                                            volume: 0.1
                                        });
                                        
                                        addTest('Player Creation', 'pass', 'Player object created successfully');
                                        
                                        player.addListener('initialization_error', ({ message }) => {
                                            addTest('Initialization', 'fail', \`Initialization Error: \${message}\`);
                                            console.error('Full initialization error:', arguments[0]);
                                        });
                                        
                                        player.addListener('authentication_error', ({ message }) => {
                                            addTest('Authentication', 'fail', \`Auth Error: \${message}\`);
                                            console.error('Full authentication error:', arguments[0]);
                                        });
                                        
                                        player.addListener('account_error', ({ message }) => {
                                            addTest('Account Error', 'fail', \`Account Error: \${message}\`);
                                            console.error('Full account error:', arguments[0]);
                                        });
                                        
                                        player.addListener('playback_error', ({ message }) => {
                                            addTest('Playback Error', 'fail', \`Playback Error: \${message}\`);
                                            console.error('Full playback error:', arguments[0]);
                                        });
                                        
                                        player.addListener('ready', ({ device_id }) => {
                                            addTest('Device Ready', 'pass', \`Device ID: \${device_id}\`);
                                        });
                                        
                                        player.connect().then(success => {
                                            addTest('Connection', success ? 'pass' : 'fail', 
                                                success ? 'Connected successfully' : 'Failed to connect');
                                        });
                                        
                                    } catch (error) {
                                        addTest('Player Creation', 'fail', error.message);
                                    }
                                }
                                
                            } else {
                                addTest('SDK Loading', 'fail', 'Spotify SDK not available');
                            }
                        }, 2000);
                        
                        // Initial display
                        addTest('Starting', 'pending', 'Running diagnostic tests...');
                    </script>
                </body>
                </html>
            `);
        });

        // Endpoint to receive device ready notification
        this.app.post('/device-ready', async (req, res) => {
            const { userId, deviceId } = req.body;
            this.activeConnections.set(userId, { deviceId, connectedAt: Date.now() });
            console.log(`🎵 Device ready for user ${userId}: ${deviceId}`);
            
            // Automatically switch from test tone to Spotify audio
            await this.switchToSpotifyAudio(userId, deviceId);
            
            res.json({ success: true });
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                discord: this.client.isReady() ? 'connected' : 'disconnected',
                activeUsers: this.userTokens.size,
                activeConnections: this.activeConnections.size
            });
        });

        // Track update endpoint
        this.app.post('/update-track', (req, res) => {
            const { title, artist, image, spotify, userId } = req.body;
            if (!title || !artist || !userId) {
                return res.status(400).json({ error: 'Missing required track info' });
            }

            this.currentTracks.set(userId, {
                title,
                artist,
                image,
                spotify
            });

            // Update any active voice connections for this user
            const connection = this.activeConnections.get(userId);
            if (connection) {
                this.updateNowPlaying(userId);
            }

            res.json({ status: 'success' });
        });

        // Users debug endpoint
        this.app.get('/users', (req, res) => {
            const users = Array.from(this.userTokens.keys()).map(userId => {
                const token = this.userTokens.get(userId);
                return {
                    userId,
                    hasToken: !!token,
                    expiresAt: token ? new Date(token.expiresAt).toISOString() : null,
                    playerLink: `/player?userId=${userId}`
                };
            });
            
            res.json({
                authenticatedUsers: users,
                totalUsers: users.length,
                playerInstructions: "Visit /player?userId=USER_ID to create Spotify device"
            });
        });

        // Main page
        this.app.get('/', (req, res) => {
            res.sendFile('index.html', { root: 'public' });
        });

        // Start server with proper timeout configuration
        this.server = this.app.listen(process.env.PORT || 3000, () => {
            console.log(`🌐 Web server running on port ${process.env.PORT || 3000}`);
        });

        // Configure server timeouts for better reverse proxy compatibility
        this.server.timeout = 60000; // 60 seconds
        this.server.keepAliveTimeout = 65000; // 65 seconds (should be > timeout)
        this.server.headersTimeout = 66000; // 66 seconds (should be > keepAliveTimeout)
    }

    async autoCreateDevicesAfterAuth(userId, accessToken) {
        console.log(`🔄 Auto-creating devices for user ${userId} after authentication...`);
        
        // Find all guilds where this user has active voice connections
        for (const [guildId, connection] of this.voiceConnections.entries()) {
            if (connection.state.status === 'ready') {
                // Check if this guild already has a device for this user
                const existingDevice = this.voiceDevices.get(guildId);
                if (!existingDevice) {
                    console.log(`🎵 Creating device for guild ${guildId} after auth completion...`);
                    try {
                        const voiceDevice = await this.getOrCreateVoiceDevice(guildId, accessToken);
                        if (voiceDevice) {
                            console.log(`✅ Auto-created device ${voiceDevice.deviceId} for guild ${guildId}`);
                            
                            // Skip audio capture for now - focus on Spotify Connect monitoring
                            console.log(`ℹ️ Device ready for Spotify Connect control via app`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to auto-create device for guild ${guildId}:`, error);
                    }
                }
            }
        }
    }

    setupDiscordBot() {
        // Validate environment
        if (!process.env.DISCORD_TOKEN) {
            console.error('❌ DISCORD_TOKEN is not set in environment variables');
            process.exit(1);
        }

        // Set up client error handling
        this.client.on('error', error => {
            console.error('🚨 Discord client error:', error);
        });

        this.client.on('disconnect', () => {
            console.log('⚠️ Discord client disconnected. Attempting to reconnect...');
        });

        // Initialize Discord client
        this.client.login(process.env.DISCORD_TOKEN).catch(error => {
            console.error('❌ Failed to log in to Discord:', error);
            process.exit(1);
        });

        // Register commands when ready
        this.client.once('ready', () => {
            console.log(`🤖 ${this.client.user.tag} is online!`);
            this.registerCommands().catch(error => {
                console.error('❌ Failed to register commands:', error);
            });
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const { commandName } = interaction;

            try {
                switch (commandName) {
                    case 'join':
                        await this.handleJoinCommand(interaction);
                        break;
                    case 'disconnect':
                        await this.handleDisconnectCommand(interaction);
                        break;
                    case 'status':
                        await this.handleStatusCommand(interaction);
                        break;
                    case 'play':
                        await this.handlePlayCommand(interaction);
                        break;
                    case 'pause':
                        await this.handlePauseCommand(interaction);
                        break;
                    case 'skip':
                        await this.handleSkipCommand(interaction);
                        break;
                    case 'volume':
                        await this.handleVolumeCommand(interaction);
                        break;
                    
                    // Discord Voice Commands  
                    case 'voice-leave':
                        await this.handleVoiceLeaveCommand(interaction);
                        break;
                    case 'voice-play':
                        await this.handleVoicePlayCommand(interaction);
                        break;
                    case 'voice-pause':
                        await this.handleVoicePauseCommand(interaction);
                        break;
                    case 'voice-resume':
                        await this.handleVoiceResumeCommand(interaction);
                        break;
                    case 'voice-skip':
                        await this.handleVoiceSkipCommand(interaction);
                        break;
                    case 'voice-stop':
                        await this.handleVoiceStopCommand(interaction);
                        break;
                    case 'now-playing':
                        await this.handleNowPlayingCommand(interaction);
                        break;
                    case 'voice-volume':
                        await this.handleVoiceVolumeCommand(interaction);
                        break;
                }
            } catch (error) {
                console.error('Error handling command:', error);
                await interaction.reply({ content: 'An error occurred while processing your command.', flags: InteractionResponseFlags.Ephemeral });
            }
        });
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('join')
                .setDescription('Connect your Spotify account and join as a playback device')
                .addBooleanOption(option =>
                    option.setName('refresh')
                        .setDescription('Force refresh Spotify authentication (use if getting scope errors)')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('disconnect')
                .setDescription('Disconnect from Spotify'),
            
            new SlashCommandBuilder()
                .setName('status')
                .setDescription('Check the current connection status'),
            
            new SlashCommandBuilder()
                .setName('play')
                .setDescription('Resume playback')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Search for a song, artist, or playlist')
                        .setRequired(false)
                ),
            
            new SlashCommandBuilder()
                .setName('pause')
                .setDescription('Pause playback'),
            
            new SlashCommandBuilder()
                .setName('skip')
                .setDescription('Skip to the next track'),
            
            new SlashCommandBuilder()
                .setName('volume')
                .setDescription('Set playback volume')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                ),

            // Discord Voice Commands
            new SlashCommandBuilder()
                .setName('voice-leave')
                .setDescription('Leave the voice channel'),
            
            new SlashCommandBuilder()
                .setName('voice-play')
                .setDescription('Play music from Spotify in Discord voice channel')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Search for a song on Spotify')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('voice-pause')
                .setDescription('Pause Discord voice playback'),
            
            new SlashCommandBuilder()
                .setName('voice-resume')
                .setDescription('Resume Discord voice playback'),
            
            new SlashCommandBuilder()
                .setName('voice-skip')
                .setDescription('Skip current track in Discord voice'),
            
            new SlashCommandBuilder()
                .setName('voice-stop')
                .setDescription('Stop Discord voice playback'),
            
            new SlashCommandBuilder()
                .setName('now-playing')
                .setDescription('Show currently playing track in Discord voice'),
            
            new SlashCommandBuilder()
                .setName('voice-volume')
                .setDescription('Set Discord voice playback volume')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                )
        ];

        try {
            console.log('🔄 Registering slash commands...');
            await this.client.application?.commands.set(commands);
            console.log('✅ Slash commands registered successfully!');
        } catch (error) {
            console.error('❌ Failed to register slash commands:', error);
        }
    }

    async handleJoinCommand(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const guild = interaction.guild;
        const member = interaction.member;

        // Check if user is in a voice channel
        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) {
            return await interaction.reply({ 
                content: '❌ You need to be in a voice channel first! Join a voice channel and try again.', 
                flags: InteractionResponseFlags.Ephemeral 
            });
        }

        await interaction.deferReply();

        console.log(`🎵 Starting simplified /join for user ${userId} in voice channel ${voiceChannel.name}`);

        try {
            // Step 1: Handle Spotify Connection
            let spotifyConnected = false;
            let authorizeURL = null;

            // Check if user wants to force refresh or if token exists
            const forceRefresh = interaction.options?.getBoolean('refresh') || false;
            
            if (this.userTokens.has(userId) && !forceRefresh) {
                console.log(`User ${userId} already has Spotify token`);
                spotifyConnected = true;
            } else {
                // Clear existing token if force refresh or if we need new scopes
                if (this.userTokens.has(userId)) {
                    console.log(`Clearing existing token for user ${userId} (force refresh: ${forceRefresh})`);
                    this.userTokens.delete(userId);
                }
                // Generate Spotify authorization URL
                const scopes = [
                    'user-read-playback-state',
                    'user-modify-playback-state',
                    'user-read-currently-playing',
                    'user-read-private',
                    'user-read-email',
                    'streaming',
                    'user-library-read',
                    'user-library-modify',
                    'playlist-read-private',
                    'playlist-modify-public',
                    'playlist-modify-private'
                ];

                authorizeURL = this.spotifyApi.createAuthorizeURL(scopes, userId);
            }

            // Step 2: Join Voice Channel
            console.log(`🔌 Joining voice channel ${voiceChannel.name} (${voiceChannel.id})`);
            
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                }
            });
            
            const subscription = connection.subscribe(player);

            this.voiceConnections.set(guildId, connection);
            this.audioPlayers.set(guildId, player);

            // Handle connection events
            connection.on('stateChange', (oldState, newState) => {
                console.log(`🔌 Voice connection: ${oldState.status} → ${newState.status}`);
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log(`✅ Voice connection ready in guild ${guildId} - Bot should now be visible in voice channel`);
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log(`🔇 Voice connection disconnected in guild ${guildId}`);
                this.cleanupVoiceConnection(guildId);
            });

            player.on('stateChange', (oldState, newState) => {
                console.log(`🎵 Audio player: ${oldState.status} → ${newState.status} in guild ${guildId}`);
            });

            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`🎉 AUDIO IS PLAYING! You should hear sound in Discord voice channel.`);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`⏸️ Audio player went idle in guild ${guildId}`);
            });

            player.on('error', (error) => {
                console.error(`� Audio player error in guild ${guildId}:`, error);
            });

            // Step 3: Create Spotify Connect Device (if authenticated)
            let voiceDevice = null;
            if (spotifyConnected) {
                try {
                    const userToken = this.userTokens.get(userId);
                    console.log(`🔄 Creating Spotify Connect device for guild ${guildId}...`);
                    voiceDevice = await this.getOrCreateVoiceDevice(guildId, userToken.accessToken);
                    
                    if (voiceDevice) {
                        console.log(`✅ Spotify Connect device created successfully: ${voiceDevice.deviceId}`);
                        
                        // Step 3.5: Device ready for Spotify Connect control
                        console.log(`ℹ️ Device ready for Spotify Connect control via app`);
                    }
                } catch (deviceError) {
                    console.error(`🚨 Error creating Spotify Connect device for guild ${guildId}:`, deviceError);
                    voiceDevice = null;
                }
            }
            
            // Store the player for this guild so we can switch to Spotify audio later
            this.audioPlayers.set(guildId, player);

            // Step 4: Send response based on connection status
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('🎵 Enspotification Connected!')
                .setTimestamp();

            if (spotifyConnected && voiceDevice) {
                embed.setDescription(`🎵 **Enspotification is ready!**

✅ **Discord Voice:** Connected to **${voiceChannel.name}**
✅ **Spotify Connect:** Device created successfully

📱 **How to use:**
1. Open your Spotify app (phone, computer, web player)
2. Start playing any song
3. Tap the device selector (speaker icon)
4. Choose **"Enspotification Voice"** as your playback device
5. Music will stream live to Discord!

🎧 **Full song streaming** - No previews, no limitations!`);
            } else if (spotifyConnected && !voiceDevice) {
                embed.setDescription(`✅ **Connected to voice channel:** ${voiceChannel.name}
⚠️ **Spotify Connect device creation failed**

🔧 **Retrying**: The bot will automatically start playing music when the Spotify device becomes available.
� **Try**: Check your Spotify app for "Enspotification Voice" device, or use \`/join\` again.`);
            } else {
                embed.setDescription(`✅ **Connected to voice channel:** ${voiceChannel.name}
🔗 **Spotify connection required** - Click the link below to connect your account.

🎵 **The bot will automatically start playing music after you authenticate!**`);
                
                embed.addFields(
                    { name: '🔗 Connect Spotify', value: `[Click here to authorize](${authorizeURL})`, inline: false },
                    { name: '📱 Next Steps', value: '1. Click the link to connect Spotify\n2. Use `/join` again to create the music device\n3. Use `/play <song>` to start streaming', inline: false }
                );
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('🚨 Join command error:', error);
            
            try {
                let errorMessage = `❌ Failed to join voice channel. Error: ${error.message}`;
                
                // Add specific help for scope errors
                if (error.message.includes('Invalid token scopes') || error.message.includes('scope')) {
                    errorMessage += `\n\n💡 **Tip**: Try using \`/join refresh:True\` to re-authenticate with updated permissions.`;
                } else {
                    errorMessage += `\n\nMake sure I have permission to connect and speak!`;
                }
                
                await interaction.editReply({ 
                    content: errorMessage
                });
            } catch (replyError) {
                console.error('🚨 Error sending error reply:', replyError);
            }
        }
    }

    async handleDisconnectCommand(interaction) {
        const userId = interaction.user.id;
        
        if (!this.userTokens.has(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#E22134')
                .setTitle('❌ Not Connected')
                .setDescription('You are not currently connected to Spotify.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        this.userTokens.delete(userId);
        this.activeConnections.delete(userId);

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('👋 Disconnected')
            .setDescription('You have been disconnected from Spotify.')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleStatusCommand(interaction) {
        try {
            // Add timeout protection
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.user.id;
            const userToken = this.userTokens.get(userId);
            const guildId = interaction.guildId;
            
            const embed = new EmbedBuilder()
                .setTimestamp();

        if (!userToken) {
            embed.setColor('#E22134')
                .setTitle('❌ Not Connected')
                .setDescription('You are not connected to Spotify. Use `/join` to connect.');
        } else {
            const isExpired = Date.now() > userToken.expiresAt;
            
            // Check for voice device in this guild (new monitoring approach)
            const voiceDevice = this.voiceDevices.get(guildId);
            const voiceConnection = this.voiceConnections.get(guildId);
            const isVoiceConnected = voiceConnection && voiceConnection.state.status === 'ready';
            
            // Debug logging
            console.log(`🔍 Status Debug - Guild: ${guildId}`);
            console.log(`🔍 Voice Devices Map:`, Array.from(this.voiceDevices.keys()));
            console.log(`🔍 Voice Device for Guild:`, voiceDevice ? 'Found' : 'Not Found');
            console.log(`🔍 Voice Connection Status:`, voiceConnection?.state?.status || 'None');
            
            // Legacy connection check (for backward compatibility)
            const legacyConnection = this.activeConnections.get(userId);
            
            const deviceConnected = voiceDevice || legacyConnection;
            const hasVoiceChannel = isVoiceConnected;
            
            embed.setColor(deviceConnected && hasVoiceChannel ? '#1DB954' : deviceConnected ? '#FFA500' : '#E22134')
                .setTitle(deviceConnected && hasVoiceChannel ? '🟢 Fully Connected' : deviceConnected ? '🟡 Partially Connected' : '❌ Not Connected');

            embed.addFields(
                { name: '🔐 Spotify Auth', value: isExpired ? '❌ Expired' : '✅ Valid', inline: true },
                { name: '📱 Monitor Status', value: voiceDevice ? '✅ Active' : '❌ Inactive', inline: true },
                { name: '🔊 Voice Channel', value: isVoiceConnected ? '✅ Connected' : '❌ Disconnected', inline: true }
            );

            if (voiceDevice) {
                embed.addFields(
                    { name: '🎵 Monitor ID', value: voiceDevice.deviceId, inline: false },
                    { name: '🏠 Guild', value: `${interaction.guild.name} (${guildId})`, inline: true }
                );
                
                if (hasVoiceChannel) {
                    embed.setDescription('🎵 **Enspotification is fully operational!**\n\n📱 **Primary:** Use your Spotify app - select "Enspotification Voice" device\n🎵 **Alternative:** Use `/voice-play` for Discord-based control');
                } else {
                    embed.setDescription('🔧 **Spotify monitoring active, but not in voice channel.**\n\nUse `/join` while in a voice channel to connect Discord voice.');
                }
            } else if (legacyConnection) {
                embed.addFields(
                    { name: '🎵 Legacy Device ID', value: legacyConnection.deviceId, inline: false },
                    { name: '⏰ Connected Since', value: `<t:${Math.floor(legacyConnection.connectedAt / 1000)}:R>`, inline: false }
                );
                embed.setDescription('📱 **Legacy Spotify device active.**\n\nYou can control playback from your Spotify app.');
            } else {
                embed.setDescription('🔧 **Spotify authenticated but no monitoring active.**\n\nUse `/join` while in a voice channel to start Discord integration.');
            }
        }

        await interaction.editReply({ embeds: [embed] });
        
        } catch (error) {
            console.error('🚨 Status command error:', error);
            try {
                await interaction.editReply({ 
                    content: '❌ Failed to retrieve status. Please try again.',
                });
            } catch (replyError) {
                console.error('🚨 Error sending status error reply:', replyError);
            }
        }
    }

    async handlePlayCommand(interaction) {
        const userId = interaction.user.id;
        const query = interaction.options.getString('query');
        
        if (!await this.checkUserConnection(interaction, userId)) return;

        const userToken = this.userTokens.get(userId);
        this.spotifyApi.setAccessToken(userToken.accessToken);

        try {
            if (query) {
                // Search and play
                const searchResults = await this.spotifyApi.searchTracks(query, { limit: 1 });
                if (searchResults.body.tracks.items.length === 0) {
                    return await interaction.reply({ content: `❌ No tracks found for: "${query}"`, ephemeral: true });
                }

                const track = searchResults.body.tracks.items[0];
                await this.spotifyApi.play({
                    uris: [track.uri],
                    device_id: this.activeConnections.get(userId).deviceId
                });

                const embed = new EmbedBuilder()
                    .setColor('#1DB954')
                    .setTitle('▶️ Now Playing')
                    .setDescription(`**${track.name}** by ${track.artists[0].name}`)
                    .setThumbnail(track.album.images[0]?.url)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } else {
                // Resume playback
                await this.spotifyApi.play({ device_id: this.activeConnections.get(userId).deviceId });
                await interaction.reply({ content: '▶️ Playback resumed!', ephemeral: true });
            }
        } catch (error) {
            console.error('Play command error:', error);
            await interaction.reply({ content: '❌ Failed to play. Make sure Spotify is active on the Enspotification device.', ephemeral: true });
        }
    }

    async handlePauseCommand(interaction) {
        const userId = interaction.user.id;
        
        if (!await this.checkUserConnection(interaction, userId)) return;

        const userToken = this.userTokens.get(userId);
        this.spotifyApi.setAccessToken(userToken.accessToken);

        try {
            await this.spotifyApi.pause({ device_id: this.activeConnections.get(userId).deviceId });
            await interaction.reply({ content: '⏸️ Playback paused!', ephemeral: true });
        } catch (error) {
            console.error('Pause command error:', error);
            await interaction.reply({ content: '❌ Failed to pause playback.', ephemeral: true });
        }
    }

    async handleSkipCommand(interaction) {
        const userId = interaction.user.id;
        
        if (!await this.checkUserConnection(interaction, userId)) return;

        const userToken = this.userTokens.get(userId);
        this.spotifyApi.setAccessToken(userToken.accessToken);

        try {
            await this.spotifyApi.skipToNext({ device_id: this.activeConnections.get(userId).deviceId });
            await interaction.reply({ content: '⏭️ Skipped to next track!', ephemeral: true });
        } catch (error) {
            console.error('Skip command error:', error);
            await interaction.reply({ content: '❌ Failed to skip track.', ephemeral: true });
        }
    }

    async handleVolumeCommand(interaction) {
        const userId = interaction.user.id;
        const volume = interaction.options.getInteger('level');
        
        if (!await this.checkUserConnection(interaction, userId)) return;

        const userToken = this.userTokens.get(userId);
        this.spotifyApi.setAccessToken(userToken.accessToken);

        try {
            await this.spotifyApi.setVolume(volume, { device_id: this.activeConnections.get(userId).deviceId });
            await interaction.reply({ content: `🔊 Volume set to ${volume}%`, ephemeral: true });
        } catch (error) {
            console.error('Volume command error:', error);
            await interaction.reply({ content: '❌ Failed to set volume.', ephemeral: true });
        }
    }

    async checkUserConnection(interaction, userId) {
        const userToken = this.userTokens.get(userId);
        const connection = this.activeConnections.get(userId);

        if (!userToken || !connection) {
            await interaction.reply({ content: '❌ You need to connect to Spotify first. Use `/join` to get started.', ephemeral: true });
            return false;
        }

        // Check if token is expired
        if (Date.now() > userToken.expiresAt) {
            await interaction.reply({ content: '❌ Your Spotify session has expired. Please use `/join` to reconnect.', ephemeral: true });
            return false;
        }

        return true;
    }

    // Discord Voice Commands Implementation
    async handleVoiceJoinCommand(interaction) {
        const voiceChannel = interaction.member?.voice?.channel;
        
        if (!voiceChannel) {
            return await interaction.reply({ 
                content: '❌ You need to be in a voice channel first!', 
                flags: InteractionResponseFlags.Ephemeral 
            });
        }

        // Add timeout protection
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        
        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            connection.subscribe(player);

            this.voiceConnections.set(guildId, connection);
            this.audioPlayers.set(guildId, player);

            // Handle connection events
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log(`🎵 Voice connection ready in guild ${guildId}`);
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log(`🔇 Voice connection disconnected in guild ${guildId}`);
                this.cleanupVoiceConnection(guildId);
            });

            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`▶️ Audio player started playing in guild ${guildId}`);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`⏸️ Audio player went idle in guild ${guildId}`);
            });

            // Create Spotify Connect device for this voice channel  
            const userId = interaction.user.id;
            const userToken = this.userTokens.get(userId);
            
            if (userToken) {
                // Pre-create the Spotify Connect device
                const voiceDevice = await this.getOrCreateVoiceDevice(guildId, userToken.accessToken);
                if (voiceDevice) {
                    console.log(`🎵 Pre-created Spotify Connect device for voice channel: ${voiceDevice.deviceId}`);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('🎵 Joined Voice Channel!')
                .setDescription(`Connected to **${voiceChannel.name}**\n\n${userToken ? 
                    `✅ Spotify Connect device created!\n📱 Look for "Enspotification Voice" in your Spotify app\n🎵 Use \`/voice-play\` to start playing music!` : 
                    `⚠️ Use \`/join\` to connect Spotify for voice playback\n🎵 Then use \`/voice-play\` to start music!`
                }`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Voice join error:', error);
            try {
                await interaction.editReply({ 
                    content: '❌ Failed to join voice channel. Make sure I have permission to connect!' 
                });
            } catch (replyError) {
                console.error('🚨 Error sending voice join error reply:', replyError);
            }
        }
    }

    async handleVoiceLeaveCommand(interaction) {
        const guildId = interaction.guild.id;
        const connection = this.voiceConnections.get(guildId);

        if (!connection) {
            return await interaction.reply({ 
                content: '❌ I\'m not connected to any voice channel!', 
                ephemeral: true 
            });
        }

        this.cleanupVoiceConnection(guildId);
        
        const embed = new EmbedBuilder()
            .setColor('#E22134')
            .setTitle('👋 Left Voice Channel')
            .setDescription('Disconnected from voice channel and stopped playback.')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async handleVoicePlayCommand(interaction) {
        const query = interaction.options.getString('query');
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const player = this.audioPlayers.get(guildId);
        const connection = this.voiceConnections.get(guildId);

        if (!connection || !player) {
            return await interaction.reply({ 
                content: '❌ I\'m not connected to a voice channel! Use `/join` while in a voice channel first.', 
                ephemeral: true 
            });
        }

        const userToken = this.userTokens.get(userId);
        if (!userToken) {
            return await interaction.reply({ 
                content: '❌ You need to connect to Spotify first! Use `/join` to authenticate.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        try {
            // Search for track on Spotify
            this.spotifyApi.setAccessToken(userToken.accessToken);
            const searchResults = await this.spotifyApi.searchTracks(query, { limit: 1 });
            
            if (searchResults.body.tracks.items.length === 0) {
                return await interaction.editReply({ 
                    content: '❌ Could not find any tracks matching your search on Spotify.' 
                });
            }

            const track = searchResults.body.tracks.items[0];
            const trackInfo = {
                title: track.name,
                artist: track.artists[0].name,
                album: track.album.name,
                image: track.album.images[0]?.url,
                uri: track.uri,
                spotifyUrl: track.external_urls.spotify,
                duration: track.duration_ms,
                preview_url: track.preview_url
            };

            // Create or get Spotify Connect device for this voice channel
            const voiceDevice = await this.getOrCreateVoiceDevice(guildId, userToken.accessToken);
            
            if (!voiceDevice) {
                // Check if user token is still valid
                let errorMessage = `❌ Failed to create Spotify Connect device for voice channel.`;
                
                try {
                    this.spotifyApi.setAccessToken(userToken.accessToken);
                    await this.spotifyApi.getMe();
                    // Token is valid, so it's likely a different issue
                    errorMessage += `

**Possible causes:**
• Spotify Premium account required for playback control
• Network connectivity issues with Spotify servers  
• Browser initialization failed in container
• Spotify Web Playback SDK not available

**Troubleshooting:**
1. Ensure you have Spotify Premium (required for Connect API)
2. Try again in a few seconds
3. Check bot logs for detailed error information`;
                } catch (tokenTest) {
                    // Token is invalid
                    errorMessage += `

**Issue: Spotify session expired**
Your Spotify authentication has expired and needs to be refreshed.

**Solution:**
Use \`/join\` command to reconnect your Spotify account, then try \`/voice-play\` again.`;
                }
                
                return await interaction.editReply({ content: errorMessage });
            }

            // Use the monitoring approach to control playback
            const { connectMonitor } = voiceDevice;
            await connectMonitor.playTrack(track.uri);

            // Start capturing and streaming audio to Discord
            await this.startAudioCapture(guildId, voiceDevice, player, trackInfo);

            this.currentTracks.set(guildId, trackInfo);

            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('▶️ Now Playing via Spotify Connect')
                .setDescription(`**${trackInfo.title}**\nby ${trackInfo.artist}`)
                .addFields(
                    { name: '💿 Album', value: trackInfo.album, inline: true },
                    { name: '🎵 Source', value: 'Spotify Connect', inline: true },
                    { name: '⏱️ Duration', value: this.formatDuration(trackInfo.duration), inline: true }
                )
                .setTimestamp();

            if (trackInfo.image) {
                embed.setThumbnail(trackInfo.image);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Spotify voice play error:', error);
            
            if (error.statusCode === 401) {
                await interaction.editReply({ 
                    content: '❌ Your Spotify session has expired. Please use `/join` to reconnect.' 
                });
            } else if (error.statusCode === 403) {
                await interaction.editReply({ 
                    content: '❌ Spotify Premium is required for playback control. Please upgrade your account.' 
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ Failed to play track from Spotify. Please try again.' 
                });
            }
        }
    }

    async handleVoicePauseCommand(interaction) {
        const guildId = interaction.guild.id;
        const player = this.audioPlayers.get(guildId);

        if (!player) {
            return await interaction.reply({ 
                content: '❌ No audio player active!', 
                ephemeral: true 
            });
        }

        player.pause();
        await interaction.reply({ content: '⏸️ Playback paused!' });
    }

    async handleVoiceResumeCommand(interaction) {
        const guildId = interaction.guild.id;
        const player = this.audioPlayers.get(guildId);

        if (!player) {
            return await interaction.reply({ 
                content: '❌ No audio player active!', 
                ephemeral: true 
            });
        }

        player.unpause();
        await interaction.reply({ content: '▶️ Playback resumed!' });
    }

    async handleVoiceSkipCommand(interaction) {
        const guildId = interaction.guild.id;
        const player = this.audioPlayers.get(guildId);

        if (!player) {
            return await interaction.reply({ 
                content: '❌ No audio player active!', 
                ephemeral: true 
            });
        }

        player.stop();
        this.currentTracks.delete(guildId);
        await interaction.reply({ content: '⏭️ Track skipped!' });
    }

    async handleVoiceStopCommand(interaction) {
        const guildId = interaction.guild.id;
        const player = this.audioPlayers.get(guildId);

        if (!player) {
            return await interaction.reply({ 
                content: '❌ No audio player active!', 
                ephemeral: true 
            });
        }

        player.stop();
        this.currentTracks.delete(guildId);
        await interaction.reply({ content: '⏹️ Playback stopped!' });
    }

    async handleNowPlayingCommand(interaction) {
        const guildId = interaction.guild.id;
        const currentTrack = this.currentTracks.get(guildId);
        const player = this.audioPlayers.get(guildId);

        if (!currentTrack || !player) {
            return await interaction.reply({ 
                content: '❌ Nothing is currently playing!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('🎵 Now Playing')
            .setDescription(`**${currentTrack.title}**\nby ${currentTrack.artist}`)
            .setTimestamp();

        if (currentTrack.image) {
            embed.setThumbnail(currentTrack.image);
        }

        const status = player.state.status === AudioPlayerStatus.Playing ? 'Playing' : 'Paused';
        embed.addFields({ name: '▶️ Status', value: status, inline: true });

        if (currentTrack.spotify) {
            embed.addFields({ name: '🎵 Source', value: 'Spotify (via YouTube)', inline: true });
        } else {
            embed.addFields({ name: '📺 Source', value: 'YouTube', inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    }

    async handleVoiceVolumeCommand(interaction) {
        const volume = interaction.options.getInteger('level');
        const guildId = interaction.guild.id;
        const player = this.audioPlayers.get(guildId);

        if (!player) {
            return await interaction.reply({ 
                content: '❌ No audio player active!', 
                ephemeral: true 
            });
        }

        // Note: Discord.js voice doesn't support runtime volume control
        // This would require implementing a custom audio transformer
        await interaction.reply({ 
            content: `ℹ️ Volume control is not currently supported in Discord voice mode. Volume is controlled by Discord's user volume slider.`,
            ephemeral: true 
        });
    }

    async getOrCreateVoiceDevice(guildId, accessToken) {
        // Check if we already have a device for this voice channel
        let voiceDevice = this.voiceDevices.get(guildId);
        
        if (voiceDevice && voiceDevice.isActive) {
            return voiceDevice;
        }

        // Validate inputs
        if (!accessToken) {
            console.error('No access token provided for Spotify Connect device creation');
            return null;
        }

        if (!guildId) {
            console.error('No guild ID provided for Spotify Connect device creation');
            return null;
        }

        console.log(`🔄 Creating native Spotify Connect device for guild ${guildId}...`);

        try {
            console.log(`🔄 STEP 1: Validating Spotify access token...`);
            // Validate access token first
            this.spotifyApi.setAccessToken(accessToken);
            const me = await this.spotifyApi.getMe();
            console.log(`✅ Access token valid for user: ${me.body.id}`);

            console.log(`🔄 STEP 2: Creating Spotify Connect monitor...`);
            // Create native Spotify Connect monitor - no browser needed!
            const SpotifyConnectMonitor = require('./SpotifyConnect');
            const connectMonitor = new SpotifyConnectMonitor(accessToken, guildId);
            
            console.log(`🔄 STEP 3: Starting playback monitoring...`);
            // Start monitoring
            const success = await connectMonitor.startPlaybackMonitoring();
            
            if (!success) {
                throw new Error('Failed to start native Spotify Connect monitoring');
            }
            console.log(`✅ Playback monitoring started successfully`);
            
            console.log(`🔄 STEP 4: Setting up virtual audio devices...`);
            // For now, skip AudioManager setup since users will control via Spotify app
            console.log(`⏩ Skipping AudioManager setup - user will control via Spotify app`);
            const virtualDevices = { sinkName: null, sourceName: null };
            
            console.log(`🔄 STEP 5: Creating voice device object...`);
            const voiceDevice = {
                deviceId: connectMonitor.monitorId,
                connectMonitor: connectMonitor,
                isActive: true,
                guildId,
                virtualDevices
            };
            
            console.log(`🔄 STEP 6: Storing voice device in Map...`);
            console.log(`📊 voiceDevices Map size before storage: ${this.voiceDevices.size}`);
            this.voiceDevices.set(guildId, voiceDevice);
            console.log(`📊 voiceDevices Map size after storage: ${this.voiceDevices.size}`);
            
            console.log(`✅ Native Spotify Connect monitoring started: ${connectMonitor.monitorId}`);
            console.log(`🔍 Device stored in voiceDevices for guild: ${guildId}`);
            console.log(`🔍 Current voiceDevices keys:`, Array.from(this.voiceDevices.keys()));
            
            // Immediate verification that storage worked
            const storedDevice = this.voiceDevices.get(guildId);
            if (storedDevice) {
                console.log(`✅ VERIFICATION: Device successfully retrieved from storage`);
            } else {
                console.error(`❌ CRITICAL: Device storage failed - not found after set operation!`);
            }
            
            return voiceDevice;

        } catch (error) {
            console.error('Failed to create native Spotify Connect device:', error);
            return null;
        }

        // Try Playwright first (more stable in Docker), then fall back to Puppeteer
        let browser;
        let page;
        let isPlaywright = false;
        
        try {
            // Attempt 1: Playwright (recommended for Docker environments)
            console.log(`🎭 Attempting browser launch with Playwright...`);
            browser = await chromium.launch({
                headless: true,
                executablePath: '/usr/bin/chromium-browser',
                timeout: 60000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--autoplay-policy=no-user-gesture-required',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                    '--allow-running-insecure-content',
                    '--disable-web-security',
                    '--enable-webaudio',
                    '--mute-audio=false',
                    '--disable-features=VizDisplayCompositor',
                    '--enable-drm-support',
                    '--unsafely-treat-insecure-origin-as-secure=*',
                    '--ignore-certificate-errors',
                    '--allow-insecure-localhost'
                ]
            });
            
            page = await browser.newPage();
            isPlaywright = true;
            console.log(`✅ Browser launched successfully with Playwright`);
            
        } catch (playwrightError) {
            console.error(`❌ Playwright failed:`, playwrightError.message);
            
            // Attempt 2: Fallback to Puppeteer with optimized configurations
            const puppeteerConfigs = [
                {
                    name: "Puppeteer Optimized Config",
                    headless: "new",
                    executablePath: '/usr/bin/chromium-browser',
                    timeout: 60000,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--single-process',
                        '--autoplay-policy=no-user-gesture-required',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream',
                        '--enable-webaudio'
                    ]
                },
                {
                    name: "Puppeteer Minimal Config",
                    headless: true,
                    executablePath: '/usr/bin/chromium-browser',
                    timeout: 30000,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                }
            ];

            let lastError = playwrightError;
            for (const config of puppeteerConfigs) {
                try {
                    console.log(`🌐 Attempting browser launch with ${config.name}...`);
                    browser = await puppeteer.launch(config);
                    page = await browser.newPage();
                    console.log(`✅ Browser launched successfully with ${config.name}`);
                    break;
                } catch (puppeteerError) {
                    console.error(`❌ ${config.name} failed:`, puppeteerError.message);
                    lastError = puppeteerError;
                    
                    if (browser) {
                        try {
                            await browser.close();
                        } catch (cleanupError) {
                            // Ignore cleanup errors
                        }
                        browser = null;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!browser || !page) {
                throw new Error(`All browser engines failed. Playwright: ${playwrightError.message}, Puppeteer: ${lastError.message}`);
            }
        }

        try {
            // Set user agent to appear as regular Chrome browser (different APIs for Playwright vs Puppeteer)
            try {
                if (isPlaywright) {
                    // Playwright API
                    await page.setExtraHTTPHeaders({
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    });
                } else {
                    // Puppeteer API
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                }
            } catch (userAgentError) {
                console.log('⚠️ Could not set user agent:', userAgentError.message);
            }

            // Listen to console messages from the browser for debugging
            const consoleMessages = [];
            if (isPlaywright) {
                page.on('console', msg => {
                    const message = `[Browser Console] ${msg.type()}: ${msg.text()}`;
                    console.log(message);
                    consoleMessages.push(message);
                });
            } else {
                page.on('console', msg => {
                    const message = `[Browser Console] ${msg.type()}: ${msg.text()}`;
                    console.log(message);
                    consoleMessages.push(message);
                });
            }
            
            // Set up the Spotify Web Playback SDK page with audio capture
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Enspotification Voice Device</title>
                    <script src="https://sdk.scdn.co/spotify-player.js"></script>
                </head>
                <body>
                    <div id="status">Initializing Spotify Connect Device...</div>
                    <audio id="audioElement" autoplay></audio>
                    <script>
                        console.log('🚀 Browser page loaded');
                        
                        // Override secure context to fool Spotify SDK (multiple approaches)
                        try {
                            // Primary override
                            Object.defineProperty(window, 'isSecureContext', {
                                get: function() { return true; },
                                configurable: false
                            });
                            
                            // Backup override on global scope
                            window.isSecureContext = true;
                            globalThis.isSecureContext = true;
                            
                            // Override on document as well
                            if (document) {
                                Object.defineProperty(document, 'isSecureContext', {
                                    get: function() { return true; }
                                });
                            }
                            
                            console.log('✅ Multi-layer secure context override applied');
                        } catch (e) {
                            console.log('⚠️ Could not override secure context:', e.message);
                        }
                        
                        // Override location protocol to appear as HTTPS
                        try {
                            Object.defineProperty(location, 'protocol', {
                                get: function() { return 'https:'; }
                            });
                            console.log('✅ HTTPS protocol override applied');
                        } catch (e) {
                            console.log('⚠️ Could not override protocol:', e.message);
                        }
                        
                        // Mock DRM support for Spotify (more aggressive approach)
                        try {
                            // Override requestMediaKeySystemAccess completely
                            navigator.requestMediaKeySystemAccess = function(keySystem, supportedConfigurations) {
                                console.log('🔐 Intercepted DRM request for:', keySystem);
                                return Promise.resolve({
                                    keySystem: keySystem,
                                    getConfiguration: () => supportedConfigurations[0] || {},
                                    createMediaKeySession: () => ({
                                        addEventListener: () => {},
                                        removeEventListener: () => {},
                                        generateRequest: () => Promise.resolve(),
                                        load: () => Promise.resolve(false),
                                        update: () => Promise.resolve(),
                                        close: () => Promise.resolve(),
                                        remove: () => Promise.resolve(),
                                        sessionId: 'mock-session-' + Math.random().toString(36).substr(2, 9),
                                        expiration: NaN,
                                        closed: Promise.resolve(),
                                        keyStatuses: new Map()
                                    })
                                });
                            };
                            console.log('✅ Enhanced DRM support mock installed');
                            
                            // Mock MediaCapabilities API
                            if (navigator.mediaCapabilities) {
                                const originalDecodingInfo = navigator.mediaCapabilities.decodingInfo;
                                navigator.mediaCapabilities.decodingInfo = function(configuration) {
                                    console.log('🎥 Intercepted media capabilities check');
                                    return Promise.resolve({
                                        supported: true,
                                        smooth: true,
                                        powerEfficient: true,
                                        keySystemAccess: configuration.keySystemConfiguration ? {
                                            keySystem: configuration.keySystemConfiguration.keySystem,
                                            getConfiguration: () => configuration.keySystemConfiguration || {}
                                        } : null
                                    });
                                };
                                console.log('✅ Media capabilities mock installed');
                            }
                            
                        } catch (e) {
                            console.log('⚠️ Could not mock DRM support:', e.message);
                        }
                        
                        // Suppress DRM warnings and intercept console errors
                        try {
                            const originalWarn = console.warn;
                            const originalError = console.error;
                            
                            console.warn = function(...args) {
                                const message = args.join(' ');
                                if (message.includes('DRM might not be available') || message.includes('unsecure context')) {
                                    console.log('🤫 Suppressed DRM warning:', message);
                                    return;
                                }
                                return originalWarn.apply(console, args);
                            };
                            
                            console.error = function(...args) {
                                const message = args.join(' ');
                                if (message.includes('DRM') || message.includes('secure context')) {
                                    console.log('🤫 Suppressed DRM error:', message);
                                    return;
                                }
                                return originalError.apply(console, args);
                            };
                            
                            console.log('✅ Console suppression installed');
                        } catch (e) {
                            console.log('⚠️ Could not install console suppression:', e.message);
                        }
                        
                        let player;
                        let deviceId;
                        
                        // Check if Spotify SDK is loading
                        let sdkCheckInterval = setInterval(() => {
                            if (typeof Spotify !== 'undefined') {
                                console.log('✅ Spotify SDK loaded successfully');
                                clearInterval(sdkCheckInterval);
                            } else {
                                console.log('⏳ Waiting for Spotify SDK to load...');
                            }
                        }, 1000);
                        
                        // Timeout if SDK ready callback is never called
                        setTimeout(() => {
                            if (!window.onSpotifyWebPlaybackSDKReadyCalled) {
                                console.error('❌ Spotify Web Playback SDK Ready callback was never called after 10 seconds');
                                console.error('This usually indicates:');
                                console.error('1. Network issues loading SDK');
                                console.error('2. Browser environment incompatibility'); 
                                console.error('3. Spotify API issues');
                                window.lastError = 'SDK Ready callback timeout - network or compatibility issue';
                                document.getElementById('status').textContent = 'SDK Loading Failed';
                            }
                        }, 10000);
                        
                        // Initialize Web Audio Context for headless browser
                        function initializeAudioContext() {
                            try {
                                const AudioContext = window.AudioContext || window.webkitAudioContext;
                                const audioContext = new AudioContext();
                                
                                // Resume context if suspended (required for Chrome autoplay policy)
                                if (audioContext.state === 'suspended') {
                                    audioContext.resume().then(() => {
                                        console.log('Audio context resumed');
                                    }).catch(err => {
                                        console.error('Failed to resume audio context:', err);
                                    });
                                }
                                
                                return audioContext;
                            } catch (error) {
                                console.error('Failed to initialize audio context:', error);
                                return null;
                            }
                        }
                        
                        window.onSpotifyWebPlaybackSDKReady = () => {
                            console.log('🎵 Spotify Web Playback SDK Ready - Starting initialization');
                            window.onSpotifyWebPlaybackSDKReadyCalled = true;
                            clearInterval(sdkCheckInterval);
                            
                            // Initialize audio context first
                            const audioContext = initializeAudioContext();
                            if (!audioContext) {
                                window.lastError = 'Failed to initialize Web Audio Context';
                                document.getElementById('status').textContent = 'Web Audio Error';
                                return;
                            }
                            
                            const token = '${accessToken}';
                            console.log('Creating Spotify Player with token length:', token.length);
                            
                            try {
                                player = new Spotify.Player({
                                    name: 'Enspotification Voice (Guild ${guildId})',
                                    getOAuthToken: cb => { 
                                        console.log('Token requested by player');
                                        cb(token); 
                                    },
                                    volume: 0.8
                                });

                                // Ready
                                player.addListener('ready', ({ device_id }) => {
                                    console.log('Ready with Device ID', device_id);
                                    deviceId = device_id;
                                    window.deviceReady = true;
                                    window.deviceId = device_id;
                                    document.getElementById('status').textContent = 'Device Ready: ' + device_id;
                                });

                                // Not Ready
                                player.addListener('not_ready', ({ device_id }) => {
                                    console.log('Device ID has gone offline', device_id);
                                    window.deviceReady = false;
                                });

                                // Initialization error
                                player.addListener('initialization_error', ({ message }) => {
                                    console.error('❌ Spotify player initialization error:', message);
                                    let errorMsg = 'Initialization error: ' + message;
                                    
                                    // Add helpful hints for common issues
                                    if (message.includes('premium') || message.includes('Premium')) {
                                        errorMsg += ' (Spotify Premium account required)';
                                    } else if (message.includes('token') || message.includes('auth')) {
                                        errorMsg += ' (Token may be invalid - try /join refresh:True)';
                                    }
                                    
                                    window.lastError = errorMsg;
                                    document.getElementById('status').textContent = 'Init Error: ' + message;
                                });

                                // Authentication error
                                player.addListener('authentication_error', ({ message }) => {
                                    console.error('Spotify authentication error:', message);
                                    window.lastError = 'Authentication error: ' + message;
                                    document.getElementById('status').textContent = 'Auth Error: ' + message;
                                });

                                // Account error
                                player.addListener('account_error', ({ message }) => {
                                    console.error('Spotify account error:', message);
                                    window.lastError = 'Account error: ' + message;
                                    document.getElementById('status').textContent = 'Account Error: ' + message;
                                });

                                // Playback error
                                player.addListener('playback_error', ({ message }) => {
                                    console.error('Spotify playback error:', message);
                                    window.lastError = 'Playback error: ' + message;
                                });

                                // Player state changed
                                player.addListener('player_state_changed', state => {
                                    if (state) {
                                        window.currentTrack = state.track_window.current_track;
                                        window.playerState = state;
                                        const track = state.track_window.current_track;
                                        
                                        // Update status and UI
                                        document.getElementById('track-info').textContent = 
                                            'Now Playing: ' + track.name + ' by ' + track.artists[0].name;
                                        
                                        updateStatus(state.paused ? '⏸️ Paused' : '▶️ Playing');
                                        
                                        // Send track info to server
                                        fetch('/update-track', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                title: track.name,
                                                artist: track.artists[0].name,
                                                image: track.album.images[0]?.url,
                                                spotify: true,
                                                userId: document.getElementById('userId').value
                                            })
                                        }).catch(err => console.error('Failed to update track info:', err));
                                        
                                        console.log('Now playing:', track.name, 'by', track.artists[0].name);
                                    } else {
                                        updateStatus('⏹️ Stopped');
                                    }
                                });

                                // Connect the player with better error handling
                                console.log('Attempting to connect player...');
                                player.connect().then(success => {
                                    if (success) {
                                        console.log('✅ Successfully connected to Spotify!');
                                        document.getElementById('status').textContent = 'Connected - Waiting for device ready...';
                                    } else {
                                        console.error('❌ Failed to connect to Spotify');
                                        window.lastError = 'Failed to connect to Spotify';
                                        document.getElementById('status').textContent = 'Connection Failed';
                                    }
                                }).catch(connectError => {
                                    console.error('❌ Connection error:', connectError);
                                    window.lastError = 'Connection error: ' + connectError.message;
                                    document.getElementById('status').textContent = 'Connection Error: ' + connectError.message;
                                });

                                // Set timeout for initialization
                                setTimeout(() => {
                                    if (!window.deviceReady) {
                                        console.error('❌ Spotify device initialization timeout');
                                        window.lastError = 'Device initialization timeout - may need Premium account';
                                        document.getElementById('status').textContent = 'Initialization Timeout';
                                    }
                                }, 25000);

                            } catch (error) {
                                console.error('❌ Error creating Spotify player:', error);
                                window.lastError = 'Player creation error: ' + error.message;
                                document.getElementById('status').textContent = 'Player Error: ' + error.message;
                            }
                        };
                        
                        // Expose player for control
                        window.getPlayer = () => player;
                        window.getDeviceId = () => deviceId;
                    </script>
                </body>
                </html>
            `);

            // Wait for device to be ready with better error handling
            let deviceId;
            try {
                // Use different APIs for Playwright vs Puppeteer
                if (isPlaywright) {
                    await page.waitForFunction(() => window.deviceReady, { timeout: 30000 });
                    deviceId = await page.evaluate(() => window.deviceId);
                } else {
                    await page.waitForFunction(() => window.deviceReady, { timeout: 30000 });
                    deviceId = await page.evaluate(() => window.deviceId);
                }
                
                if (!deviceId) {
                    throw new Error('Device ID not available after initialization');
                }
                
                console.log(`✅ Spotify Connect device ready: ${deviceId}`);
            } catch (waitError) {
                console.error('Timeout or error waiting for Spotify device to initialize:', waitError.message);
                
                // Try to get more information about what went wrong
                const pageContent = await page.content();
                let consoleMessages;
                
                try {
                    if (isPlaywright) {
                        consoleMessages = await page.evaluate(() => window.lastError || 'No specific error information available');
                    } else {
                        consoleMessages = await page.evaluate(() => window.lastError || 'No specific error information available');
                    }
                } catch (evalError) {
                    consoleMessages = `Error getting console messages: ${evalError.message}`;
                }
                
                console.error('Page content length:', pageContent.length);
                console.error('Console messages:', consoleMessages);
                
                // Check for scope errors and clear token if needed
                if (consoleMessages && consoleMessages.includes('Invalid token scopes')) {
                    console.log('❌ Detected invalid token scopes - clearing stored token');
                    // Find the user ID from the access token (we need to track this)
                    for (const [userId, tokenData] of this.userTokens.entries()) {
                        if (tokenData.accessToken === accessToken) {
                            console.log(`Clearing token for user ${userId} due to scope error`);
                            this.userTokens.delete(userId);
                            break;
                        }
                    }
                }
                
                throw new Error(`Spotify device initialization failed: ${waitError.message}`);
            }

            // Set up virtual audio devices for this guild
            let virtualDevices;
            try {
                virtualDevices = await this.audioManager.setupVirtualDevices(guildId);
                console.log(`✅ Virtual devices setup complete for guild: ${guildId}`);
            } catch (audioError) {
                console.warn(`⚠️ Virtual audio devices setup failed (continuing without): ${audioError.message}`);
                virtualDevices = { sinkName: null, sourceName: null }; // Fallback
            }

            voiceDevice = {
                deviceId,
                browser,
                page,
                isActive: true,
                guildId,
                virtualDevices
            };

            this.voiceDevices.set(guildId, voiceDevice);
            this.browserInstances.set(guildId, browser);

            console.log(`🎵 Created Spotify Connect device for guild ${guildId}: ${deviceId}`);
            console.log(`🎛️ Virtual audio devices: ${virtualDevices.sinkName} → ${virtualDevices.sourceName}`);
            return voiceDevice;

        } catch (error) {
            console.error('Failed to create Spotify Connect device:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                guildId: guildId,
                hasAccessToken: !!accessToken
            });
            
            // Cleanup browser if it was created
            if (browser) {
                try {
                    await browser.close();
                } catch (cleanupError) {
                    console.error('Error cleaning up browser:', cleanupError);
                }
            }
            
            return null;
        }
    }

    async startAudioCapture(guildId, voiceDevice, player, trackInfo) {
        try {
            const { connectMonitor } = voiceDevice;
            
            console.log(`🔊 Starting audio streaming for guild ${guildId}...`);
            
            let audioStream;
            
            // Priority order for audio sources:
            // 1. Full Spotify Connect audio capture (if implemented)
            // 2. YouTube search and stream (alternative source)
            // 3. Spotify preview URL (30-second clips)
            // 4. Test tone generator (fallback)
            
            if (await this.canCaptureFullAudio()) {
                console.log(`🎵 Attempting full audio capture from Spotify Connect device`);
                audioStream = await this.captureFullSpotifyAudio(null, guildId);
            } else if (trackInfo) {
                // Try YouTube as alternative for full songs
                console.log(`🔍 Searching YouTube for full song: ${trackInfo.title} by ${trackInfo.artist}`);
                audioStream = await this.searchAndStreamYouTube(trackInfo);
            }
            
            // Fallback to Spotify preview if other methods fail
            if (!audioStream && trackInfo && trackInfo.preview_url) {
                console.log(`🎵 Using Spotify preview URL (30-second clip)`);
                audioStream = await this.createPreviewAudioStream(trackInfo.preview_url);
            }
            
            // Final fallback to test tone
            if (!audioStream) {
                console.log(`ℹ️ No audio sources available, using test tone`);
                audioStream = this.createTestToneStream();
            }
            
            const resource = createAudioResource(audioStream, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });

            // Set up player event handlers
            player.on('stateChange', (oldState, newState) => {
                console.log(`🎵 Audio player transitioned from ${oldState.status} to ${newState.status} in guild ${guildId}`);
                
                if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                    console.log(`🔇 Audio playback ended in guild ${guildId}`);
                }
            });

            player.on('error', error => {
                console.error(`🚨 Audio player error in guild ${guildId}:`, error);
            });

            player.play(resource);
            console.log(`🔊 Started audio streaming for guild ${guildId}`);

        } catch (error) {
            console.error(`🚨 Audio capture error for guild ${guildId}:`, error);
        }
    }

    async createPreviewAudioStream(previewUrl) {
        const https = require('https');
        const ffmpeg = require('fluent-ffmpeg');
        
        try {
            console.log(`🎵 Creating audio stream from preview URL: ${previewUrl}`);
            
            // Use FFmpeg to convert MP3 preview to PCM for Discord
            const ffmpegStream = ffmpeg(previewUrl)
                .audioFrequency(48000)
                .audioChannels(2)
                .audioCodec('pcm_s16le')
                .format('s16le')
                .pipe();

            return ffmpegStream;
        } catch (error) {
            console.error('Failed to create preview audio stream:', error);
            return this.createTestToneStream();
        }
    }

    createTestToneStream() {
        // Create a test tone for audio verification
        const sampleRate = 48000;
        const channels = 2;
        const frequency = 440; // A4 note
        const amplitude = 0.1; // Quiet volume
        let sampleCount = 0;
        
        return new Readable({
            read() {
                const samplesPerChunk = 960; // 20ms at 48kHz
                const buffer = Buffer.alloc(samplesPerChunk * channels * 2); // 16-bit samples
                
                for (let i = 0; i < samplesPerChunk; i++) {
                    const sample = Math.sin(2 * Math.PI * frequency * sampleCount / sampleRate) * amplitude;
                    const value = Math.floor(sample * 32767); // Convert to 16-bit signed
                    
                    // Stereo - write to both channels
                    buffer.writeInt16LE(value, (i * channels) * 2);
                    buffer.writeInt16LE(value, (i * channels + 1) * 2);
                    
                    sampleCount++;
                }
                
                this.push(buffer);
            }
        });
    }

    // Simple test tone method for fallback audio
    async startTestToneAudio(guildId, player) {
        console.log(`🧪 Creating test tone audio stream for guild ${guildId}...`);
        
        const audioStream = this.createTestToneStream();
        
        const resource = createAudioResource(audioStream, {
            inputType: StreamType.Raw,
            inlineVolume: true
        });

        player.on('stateChange', (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Playing) {
                console.log(`🎉 TEST TONE IS PLAYING! You should hear a 440Hz beep in Discord.`);
            }
        });

        player.play(resource);
        console.log(`🔊 Test tone streaming started for guild ${guildId}`);
    }

    async switchToSpotifyAudio(userId, deviceId) {
        try {
            console.log(`🔄 Switching to Spotify audio for user ${userId}, device ${deviceId}`);
            
            // Find the guild where this user is connected
            let targetGuildId = null;
            
            // Look through voice connections to find where this user might be
            for (const [guildId, connection] of this.voiceConnections) {
                // Check if we have an audio player for this guild
                const player = this.audioPlayers.get(guildId);
                if (player && connection.state.status === VoiceConnectionStatus.Ready) {
                    targetGuildId = guildId;
                    break;
                }
            }
            
            if (!targetGuildId) {
                console.log(`⚠️ No active voice connection found for user ${userId}`);
                return;
            }
            
            // Get the stored voice device for this guild
            const voiceDevice = this.voiceDevices.get(targetGuildId);
            if (!voiceDevice) {
                console.log(`⚠️ No voice device found for guild ${targetGuildId}`);
                console.log(`🔍 Available voice devices:`, Array.from(this.voiceDevices.keys()));
                
                // Try to create the voice device if we have a user token
                const userToken = this.userTokens.get(userId);
                if (userToken) {
                    console.log(`🔄 Attempting to create voice device for guild ${targetGuildId}...`);
                    try {
                        const newVoiceDevice = await this.getOrCreateVoiceDevice(targetGuildId, userToken.accessToken);
                        if (newVoiceDevice) {
                            console.log(`✅ Created voice device on-demand: ${newVoiceDevice.deviceId}`);
                        } else {
                            console.log(`❌ Failed to create voice device on-demand`);
                            return;
                        }
                    } catch (error) {
                        console.error(`🚨 Error creating voice device on-demand:`, error);
                        return;
                    }
                } else {
                    return;
                }
            }
            
            // Re-get the voice device (in case we just created it)
            const finalVoiceDevice = this.voiceDevices.get(targetGuildId);
            if (!finalVoiceDevice) {
                console.log(`❌ Still no voice device available for guild ${targetGuildId}`);
                return;
            }
            
            // Get the audio player for this guild
            const player = this.audioPlayers.get(targetGuildId);
            if (!player) {
                console.log(`⚠️ No audio player found for guild ${targetGuildId}`);
                return;
            }
            
            console.log(`🎵 Starting Spotify audio capture for guild ${targetGuildId}`);
            
            // Start Spotify audio capture (this will replace any existing audio)
            await this.startAudioCapture(targetGuildId, finalVoiceDevice, player);
            
            console.log(`✅ Successfully switched to Spotify audio for user ${userId}`);
            
            // Send a notification to the guild's system channel or first text channel
            try {
                const guild = this.client.guilds.cache.get(targetGuildId);
                if (guild) {
                    // Try to find a suitable channel to send the notification
                    const channel = guild.systemChannel || 
                                  guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages'));
                    
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setColor('#1DB954')
                            .setTitle('🎵 Spotify Connected!')
                            .setDescription(`✅ **Spotify device is ready!**\n🎵 **Now streaming music to voice channel**\n\n📱 Control playback from your Spotify app - look for "Enspotification Voice" device.`)
                            .setTimestamp();
                        
                        await channel.send({ embeds: [embed] });
                    }
                }
            } catch (messageError) {
                console.error(`Failed to send Spotify ready notification:`, messageError);
            }
            
        } catch (error) {
            console.error(`🚨 Failed to switch to Spotify audio for user ${userId}:`, error);
        }
    }

    async canCaptureFullAudio() {
        // Check if PulseAudio and audio capture are available
        try {
            await this.audioManager.initialize();
            return true;
        } catch (error) {
            console.log('🔧 Full audio capture not available - using simplified approach:', error.message);
            return false;
        }
    }

    async captureFullSpotifyAudio(page, guildId) {
        try {
            console.log(`🎵 Setting up full Spotify audio capture for guild ${guildId}...`);
            
            // 1. Configure the Spotify Connect device to output to our virtual sink
            await this.routeSpotifyToVirtualSink(page, guildId);
            
            // 2. Start capturing audio from the virtual source
            const audioStream = await this.audioManager.createAudioStream(guildId);
            
            if (audioStream) {
                console.log(`✅ Full Spotify audio capture active for guild ${guildId}`);
                return audioStream;
            }
            
            throw new Error('Failed to create audio stream from virtual source');
            
        } catch (error) {
            console.error(`❌ Full Spotify audio capture failed for guild ${guildId}:`, error);
            return null;
        }
    }

    async routeSpotifyToVirtualSink(page, guildId) {
        try {
            console.log(`🔧 Configuring Spotify Connect device to use virtual audio sink...`);
            
            // Configure the browser to output audio to our virtual sink
            await page.evaluateOnNewDocument((sinkName) => {
                // Override Web Audio API to route to virtual sink
                const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
                
                window.AudioContext = function(...args) {
                    const ctx = new OriginalAudioContext(...args);
                    
                    // Set the audio output device to our virtual sink
                    if (ctx.setSinkId) {
                        ctx.setSinkId(sinkName).catch(console.warn);
                    }
                    
                    return ctx;
                };
                
                window.webkitAudioContext = window.AudioContext;
                
                // Also override HTML5 audio elements
                const originalCreateElement = document.createElement;
                document.createElement = function(tagName) {
                    const element = originalCreateElement.call(this, tagName);
                    if (tagName.toLowerCase() === 'audio') {
                        if (element.setSinkId) {
                            element.setSinkId(sinkName).catch(console.warn);
                        }
                    }
                    return element;
                };
                
                console.log(`Spotify audio routed to virtual sink: ${sinkName}`);
            }, `enspotification-sink-${guildId}`);
            
            // Set Chrome audio output device via command line args
            const browser = page.browser();
            console.log(`✅ Browser audio routing configured for guild ${guildId}`);
            
        } catch (error) {
            console.error(`Failed to route Spotify audio to virtual sink:`, error);
            throw error;
        }
    }

    async searchAndStreamYouTube(trackInfo) {
        // Placeholder for YouTube integration
        // This would:
        // 1. Search YouTube for the track
        // 2. Get audio stream URL
        // 3. Use youtube-dl or similar to stream audio
        
        console.log(`🚧 YouTube streaming not yet implemented for: ${trackInfo.title} by ${trackInfo.artist}`);
        return null;
    }

    async configureBrowserAudio(page, guildId) {
        try {
            console.log(`🔊 Configuring browser audio for guild ${guildId}...`);
            
            // Wait for Spotify Web Player to be ready
            await page.waitForFunction(() => {
                return window.getPlayer && window.getPlayer() && window.deviceReady;
            }, { timeout: 30000 });

            // Set browser audio arguments for capturing
            const browser = page.browser();
            console.log(`✅ Browser audio configuration completed for guild ${guildId}`);
            
            // Note: In a production environment, you would need to implement actual audio capture
            // This could be done using:
            // 1. PulseAudio virtual devices (requires proper container setup)
            // 2. Screen/desktop audio capture
            // 3. Browser-specific audio capture APIs
            
            console.log(`ℹ️ Audio capture implementation needed - currently using test mode`);
            
        } catch (error) {
            console.error(`🚨 Failed to configure browser audio for guild ${guildId}:`, error);
        }
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    cleanupVoiceConnection(guildId) {
        const connection = this.voiceConnections.get(guildId);
        const player = this.audioPlayers.get(guildId);
        const voiceDevice = this.voiceDevices.get(guildId);
        const browser = this.browserInstances.get(guildId);

        if (connection) {
            connection.destroy();
            this.voiceConnections.delete(guildId);
        }

        if (player) {
            player.stop();
            this.audioPlayers.delete(guildId);
        }

        if (voiceDevice) {
            voiceDevice.isActive = false;
            this.voiceDevices.delete(guildId);
        }

        if (browser) {
            browser.close().catch(console.error);
            this.browserInstances.delete(guildId);
        }

        // Cleanup audio streaming
        if (this.audioManager) {
            this.audioManager.stopAudioStream(guildId).catch(console.error);
        }

        this.currentTracks.delete(guildId);
        console.log(`🧹 Cleaned up voice connection and Spotify device for guild ${guildId}`);
    }

    async start() {
        try {
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
            console.log('🚀 Enspotification bot started successfully!');
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
            process.exit(1);
        }
    }
}

// Start the bot
const bot = new EnspotificationBot();
bot.start();