const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const cors = require('cors');
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
            redirectUri: process.env.SPOTIFY_REDIRECT_URI
        });

        this.userTokens = new Map(); // Store user Spotify tokens
        this.activeConnections = new Map(); // Track active Spotify connections
        this.deviceId = null;

        this.setupExpress();
        this.setupDiscordBot();
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));

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
            const userToken = this.userTokens.get(userId);
            
            if (!userToken) {
                return res.status(401).send('User not authenticated with Spotify');
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

                        window.onSpotifyWebPlaybackSDKReady = () => {
                            const token = '${userToken.accessToken}';
                            
                            player = new Spotify.Player({
                                name: 'Enspotification (Discord Bot)',
                                getOAuthToken: cb => { cb(token); },
                                volume: 0.5
                            });

                            player.addListener('ready', ({ device_id }) => {
                                console.log('Ready with Device ID', device_id);
                                deviceId = device_id;
                                document.getElementById('status').textContent = 'Connected as Spotify device!';
                                document.getElementById('status').className = 'status connected';
                                
                                // Notify the bot about the device ID
                                fetch('/device-ready', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: '${userId}', deviceId: device_id })
                                });
                            });

                            player.addListener('not_ready', ({ device_id }) => {
                                console.log('Device ID has gone offline', device_id);
                                document.getElementById('status').textContent = 'Disconnected';
                                document.getElementById('status').className = 'status disconnected';
                            });

                            player.addListener('player_state_changed', state => {
                                if (state) {
                                    const track = state.track_window.current_track;
                                    document.getElementById('track-info').innerHTML = 
                                        \`<p><strong>Now Playing:</strong><br/>
                                        \${track.name} by \${track.artists[0].name}</p>\`;
                                }
                            });

                            player.connect();
                        };
                    </script>
                </body>
                </html>
            `);
        });

        // Endpoint to receive device ready notification
        this.app.post('/device-ready', (req, res) => {
            const { userId, deviceId } = req.body;
            this.activeConnections.set(userId, { deviceId, connectedAt: Date.now() });
            console.log(`🎵 Device ready for user ${userId}: ${deviceId}`);
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

        // Main page
        this.app.get('/', (req, res) => {
            res.sendFile('index.html', { root: 'public' });
        });

        this.app.listen(process.env.PORT || 3000, () => {
            console.log(`🌐 Web server running on port ${process.env.PORT || 3000}`);
        });
    }

    setupDiscordBot() {
        this.client.once('ready', () => {
            console.log(`🤖 ${this.client.user.tag} is online!`);
            this.registerCommands();
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
                }
            } catch (error) {
                console.error('Error handling command:', error);
                await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
            }
        });
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('join')
                .setDescription('Connect your Spotify account and join as a playback device'),
            
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
        
        // Check if user is already connected
        if (this.userTokens.has(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('🎵 Already Connected!')
                .setDescription('You are already connected to Spotify. Use `/status` to check your connection.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Generate Spotify authorization URL
        const scopes = [
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing',
            'streaming',
            'user-library-read',
            'user-library-modify',
            'playlist-read-private',
            'playlist-modify-public',
            'playlist-modify-private'
        ];

        const authorizeURL = this.spotifyApi.createAuthorizeURL(scopes, userId);

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('🎵 Connect to Spotify')
            .setDescription('Click the link below to connect your Spotify account and enable Enspotification as a playback device.')
            .addFields(
                { name: '🔗 Authorization Link', value: `[Click here to connect](${authorizeURL})`, inline: false },
                { name: '📱 How it works', value: 'After connecting, Enspotification will appear as a device in your Spotify app for playback control.', inline: false }
            )
            .setFooter({ text: 'This link is unique to you and expires in 10 minutes' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
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
        const userId = interaction.user.id;
        const userToken = this.userTokens.get(userId);
        const connection = this.activeConnections.get(userId);
        
        const embed = new EmbedBuilder()
            .setTimestamp();

        if (!userToken) {
            embed.setColor('#E22134')
                .setTitle('❌ Not Connected')
                .setDescription('You are not connected to Spotify. Use `/join` to connect.');
        } else {
            const isExpired = Date.now() > userToken.expiresAt;
            const deviceConnected = connection && connection.deviceId;
            
            embed.setColor(deviceConnected ? '#1DB954' : '#FFA500')
                .setTitle(deviceConnected ? '🟢 Connected' : '🟡 Partially Connected')
                .addFields(
                    { name: '🔐 Spotify Auth', value: isExpired ? '❌ Expired' : '✅ Valid', inline: true },
                    { name: '📱 Device Status', value: deviceConnected ? '✅ Connected' : '❌ Disconnected', inline: true }
                );

            if (deviceConnected) {
                embed.addFields(
                    { name: '🎵 Device ID', value: connection.deviceId, inline: false },
                    { name: '⏰ Connected Since', value: `<t:${Math.floor(connection.connectedAt / 1000)}:R>`, inline: false }
                );
                embed.setDescription('Enspotification is active and ready for playback! You can select it as a device in your Spotify app.');
            } else if (userToken) {
                embed.setDescription(`[Click here to activate the player](${process.env.SPOTIFY_REDIRECT_URI.replace('/callback', '/player')}?userId=${userId})`);
            }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
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