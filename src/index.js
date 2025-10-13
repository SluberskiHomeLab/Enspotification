const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection, StreamType } = require('@discordjs/voice');
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { Readable } = require('stream');
const AudioManager = require('./AudioManager');
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
        this.voiceConnections = new Map(); // Track Discord voice connections per guild
        this.audioPlayers = new Map(); // Track audio players per guild
        this.currentTracks = new Map(); // Track currently playing tracks per guild
        this.voiceDevices = new Map(); // Track Spotify Connect devices for voice channels
        this.browserInstances = new Map(); // Track browser instances per guild
        this.deviceId = null;

        // Initialize audio manager
        this.audioManager = new AudioManager();

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

        // Start server with proper timeout configuration
        this.server = this.app.listen(process.env.PORT || 3000, () => {
            console.log(`🌐 Web server running on port ${process.env.PORT || 3000}`);
        });

        // Configure server timeouts for better reverse proxy compatibility
        this.server.timeout = 60000; // 60 seconds
        this.server.keepAliveTimeout = 65000; // 65 seconds (should be > timeout)
        this.server.headersTimeout = 66000; // 66 seconds (should be > keepAliveTimeout)
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
                    
                    // Discord Voice Commands
                    case 'voice-join':
                        await this.handleVoiceJoinCommand(interaction);
                        break;
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
                ),

            // New Discord Voice Commands
            new SlashCommandBuilder()
                .setName('voice-join')
                .setDescription('Join your voice channel and start playing music through Discord'),
            
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

    // Discord Voice Commands Implementation
    async handleVoiceJoinCommand(interaction) {
        const voiceChannel = interaction.member?.voice?.channel;
        
        if (!voiceChannel) {
            return await interaction.reply({ 
                content: '❌ You need to be in a voice channel first!', 
                ephemeral: true 
            });
        }

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

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Voice join error:', error);
            await interaction.reply({ 
                content: '❌ Failed to join voice channel. Make sure I have permission to connect!', 
                ephemeral: true 
            });
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
                content: '❌ I\'m not connected to a voice channel! Use `/voice-join` first.', 
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
                duration: track.duration_ms
            };

            // Create or get Spotify Connect device for this voice channel
            const voiceDevice = await this.getOrCreateVoiceDevice(guildId, userToken.accessToken);
            
            if (!voiceDevice) {
                return await interaction.editReply({ 
                    content: '❌ Failed to create Spotify Connect device for voice channel.' 
                });
            }

            // Start playback on the voice channel device
            await this.spotifyApi.play({
                uris: [track.uri],
                device_id: voiceDevice.deviceId
            });

            // Start capturing and streaming audio to Discord
            await this.startAudioCapture(guildId, voiceDevice, player);

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

        try {
            // Launch a headless browser for Spotify Web Playback SDK
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--autoplay-policy=no-user-gesture-required'
                ]
            });

            const page = await browser.newPage();
            
            // Set up the Spotify Web Playback SDK page
            await page.setContent(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Enspotification Voice Device</title>
                    <script src="https://sdk.scdn.co/spotify-player.js"></script>
                </head>
                <body>
                    <div id="status">Initializing Spotify Connect Device...</div>
                    <script>
                        let player;
                        let deviceId;
                        
                        window.onSpotifyWebPlaybackSDKReady = () => {
                            const token = '${accessToken}';
                            
                            player = new Spotify.Player({
                                name: 'Enspotification Voice (Guild ${guildId})',
                                getOAuthToken: cb => { cb(token); },
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

                            // Player state changed
                            player.addListener('player_state_changed', state => {
                                if (state) {
                                    window.currentTrack = state.track_window.current_track;
                                    window.playerState = state;
                                }
                            });

                            player.connect();
                        };
                        
                        // Expose player for control
                        window.getPlayer = () => player;
                        window.getDeviceId = () => deviceId;
                    </script>
                </body>
                </html>
            `);

            // Wait for device to be ready
            await page.waitForFunction(() => window.deviceReady, { timeout: 30000 });
            const deviceId = await page.evaluate(() => window.deviceId);

            voiceDevice = {
                deviceId,
                browser,
                page,
                isActive: true,
                guildId
            };

            this.voiceDevices.set(guildId, voiceDevice);
            this.browserInstances.set(guildId, browser);

            console.log(`🎵 Created Spotify Connect device for guild ${guildId}: ${deviceId}`);
            return voiceDevice;

        } catch (error) {
            console.error('Failed to create Spotify Connect device:', error);
            return null;
        }
    }

    async startAudioCapture(guildId, voiceDevice, player) {
        try {
            const { page, deviceId } = voiceDevice;
            
            // Configure browser audio to output to our virtual sink
            await this.configureBrowserAudio(page, guildId);
            
            // Create audio stream from PulseAudio virtual source
            const audioStream = await this.audioManager.createAudioStream(guildId);
            
            if (audioStream) {
                const resource = createAudioResource(audioStream, {
                    inputType: StreamType.Opus,
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
                console.log(`🔊 Started audio streaming for guild ${guildId} from Spotify device ${deviceId}`);
            } else {
                console.error(`❌ Failed to create audio stream for guild ${guildId}`);
            }

        } catch (error) {
            console.error(`🚨 Audio capture error for guild ${guildId}:`, error);
        }
    }

    async configureBrowserAudio(page, guildId) {
        try {
            // Wait for Spotify Web Player to be ready
            await page.waitForSelector('button[data-testid="control-button-playpause"]', { timeout: 30000 });
            
            // Inject script to route audio to our virtual sink
            await page.evaluate((sinkName) => {
                // Override the Web Audio API to use our virtual sink
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const originalCreateMediaStreamDestination = AudioContext.prototype.createMediaStreamDestination;
                
                AudioContext.prototype.createMediaStreamDestination = function() {
                    const destination = originalCreateMediaStreamDestination.call(this);
                    
                    // Try to set the sink ID for audio output
                    if (navigator.mediaDevices && navigator.mediaDevices.selectAudioOutput) {
                        navigator.mediaDevices.selectAudioOutput({ deviceId: sinkName })
                            .then(() => console.log('Audio output set to virtual sink'))
                            .catch(err => console.warn('Failed to set audio output:', err));
                    }
                    
                    return destination;
                };

                // Also try to set the default audio output
                if (HTMLAudioElement.prototype.setSinkId) {
                    const originalPlay = HTMLAudioElement.prototype.play;
                    HTMLAudioElement.prototype.play = function() {
                        if (this.sinkId !== sinkName) {
                            this.setSinkId(sinkName).catch(console.warn);
                        }
                        return originalPlay.call(this);
                    };
                }

                console.log(`Audio configured for virtual sink: ${sinkName}`);
            }, `enspotification-sink-${guildId}`);

            console.log(`� Configured browser audio routing for guild ${guildId}`);
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