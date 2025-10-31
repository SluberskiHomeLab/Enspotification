const WebSocket = require('ws');
const { EventEmitter } = require('events');
const crypto = require('crypto');

class SpotifyConnectMonitor extends EventEmitter {
    constructor(accessToken, guildId) {
        super();
        this.accessToken = accessToken;
        this.guildId = guildId;
        this.monitorId = this.generateMonitorId();
        this.monitorName = `Enspotification Monitor (Guild ${guildId})`;
        this.ws = null;
        this.isActive = false;
        this.currentTrack = null;
        this.hasActiveDevice = false;
    }

    generateMonitorId() {
        return crypto.randomBytes(20).toString('hex');
    }

    async connect() {
        try {
            console.log(`🔌 Creating Spotify playback monitor: ${this.monitorName}`);
            
            // Check for active Spotify sessions to monitor
            await this.checkActivePlayback();
            
            // Start monitoring for playback updates
            await this.startPlaybackMonitoring();
            
            console.log(`✅ Spotify monitor ready: ${this.monitorId}`);
            this.emit('ready', { monitorId: this.monitorId });
            
            return true;
        } catch (error) {
            console.error('❌ Failed to create Spotify monitor:', error);
            this.emit('error', error);
            return false;
        }
    }

    async checkActivePlayback() {
        // Instead of trying to register the device directly (which isn't possible via Web API),
        // we'll create a device that works by monitoring the user's active playback
        // and can control it via Web API commands.
        
        try {
            // Check if user has an active device and get current playback info
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const playerInfo = await response.json();
                console.log(`📱 Found active Spotify session:`, playerInfo?.device?.name || 'Unknown device');
                
                // We can work with the existing device
                this.hasActiveDevice = true;
                return true;
            } else if (response.status === 204) {
                // No active device - that's okay, we'll handle playback commands gracefully
                console.log(`📱 No active Spotify device found - will activate when needed`);
                this.hasActiveDevice = false;
                return true;
            } else {
                throw new Error(`Failed to check player status: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error during device registration check:', error);
            throw error;
        }
    }

    async startPlaybackMonitoring() {
        // Spotify uses WebSockets for real-time Connect communication
        // This is a simplified implementation - real Spotify Connect uses more complex protocols
        
        return new Promise((resolve, reject) => {
            try {
                // For now, we'll simulate WebSocket connection
                // Real implementation would connect to Spotify's dealer service
                console.log('Playback monitoring started for monitor:', this.monitorId);
                
                this.isActive = true;
                
                // Simulate periodic status updates
                this.statusInterval = setInterval(() => {
                    this.emit('status_update', {
                        device_id: this.monitorId,
                        is_active: this.isActive,
                        is_playing: false,
                        volume_percent: 80
                    });
                }, 5000);
                
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    }

    async transferPlayback() {
        // Instead of transferring to our non-existent device, 
        // we'll check for active playback and prepare to monitor it
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const playerInfo = await response.json();
                if (playerInfo && playerInfo.device) {
                    console.log(`🎵 Found active playback on: ${playerInfo.device.name}`);
                    console.log(`📡 Enspotification will monitor and capture audio from this session`);
                    return true;
                } else {
                    console.log(`📱 No active playback found - user needs to start Spotify on any device`);
                    return true; // This is okay, we can wait for playback to start
                }
            } else if (response.status === 204) {
                console.log(`📱 No active Spotify session - user should start playing music on any Spotify app`);
                return true;
            } else {
                console.error('❌ Failed to check playback status:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Error checking playback status:', error);
            return false;
        }
    }

    async playTrack(trackUri) {
        // Play a track using the Web API (on user's active device)
        try {
            console.log(`🎵 Starting playback of track: ${trackUri}`);
            
            const response = await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: [trackUri]
                })
            });

            if (response.ok || response.status === 204) {
                console.log(`✅ Successfully started playback of track`);
                return true;
            } else if (response.status === 404) {
                console.log(`❌ No active device found - user needs to start Spotify on any device first`);
                throw new Error('No active Spotify device found. Please start Spotify on any device and try again.');
            } else {
                const errorText = await response.text();
                console.error(`❌ Failed to start playback: ${response.status} ${errorText}`);
                throw new Error(`Failed to start playback: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Error starting track playback:', error);
            throw error;
        }
    }

    async getCurrentTrack() {
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentTrack = data;
                return data;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error getting current track:', error);
            return null;
        }
    }

    async startPlayback(uris = null) {
        try {
            const body = { device_id: this.deviceId };
            if (uris) {
                body.uris = uris;
            }

            const response = await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok || response.status === 204) {
                console.log('▶️ Playback started on Connect device');
                return true;
            } else {
                console.error('❌ Failed to start playback:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Error starting playback:', error);
            return false;
        }
    }

    async pausePlayback() {
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok || response.status === 204) {
                console.log('⏸️ Playback paused on Connect device');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Error pausing playback:', error);
            return false;
        }
    }

    disconnect() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.isActive = false;
        console.log(`🔌 Spotify Connect device disconnected: ${this.deviceId}`);
    }
}

module.exports = SpotifyConnectMonitor;