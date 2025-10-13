const { spawn } = require('child_process');
const { createReadStream, createWriteStream } = require('fs');
const { Readable, Transform } = require('stream');
const prism = require('prism-media');

class AudioManager {
    constructor() {
        this.pulseProcess = null;
        this.audioStreams = new Map(); // Track active audio streams per guild
        this.ffmpegProcesses = new Map(); // Track FFmpeg processes per guild
    }

    async initialize() {
        console.log('🔊 Initializing PulseAudio system...');
        
        try {
            // Start PulseAudio daemon
            await this.startPulseAudio();
            
            // Wait for PulseAudio to be ready
            await this.waitForPulseAudio();
            
            // Set up base virtual devices for audio capture
            await this.setupBaseVirtualDevices();
            
            console.log('✅ PulseAudio initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize PulseAudio:', error);
            return false;
        }
    }

    async setupBaseVirtualDevices() {
        console.log('🎛️ Setting up base virtual audio devices...');
        
        try {
            // Create a null sink for capturing Spotify audio
            await this.runPactlCommand([
                'load-module', 'module-null-sink',
                'sink_name=spotify_capture',
                'sink_properties=device.description="Spotify Audio Capture"'
            ]);

            // Create virtual source from the null sink's monitor
            await this.runPactlCommand([
                'load-module', 'module-virtual-source',
                'source_name=discord_input',
                'master=spotify_capture.monitor'
            ]);

            console.log('✅ Base virtual audio devices created');
        } catch (error) {
            console.error('❌ Failed to setup base virtual devices:', error);
            throw error;
        }
    }

    async setupVirtualDevices(guildId) {
        console.log(`🎛️ Setting up virtual audio devices for guild ${guildId}...`);
        
        try {
            const sinkName = `enspotification-sink-${guildId}`;
            const sourceName = `enspotification-source-${guildId}`;

            // Create guild-specific null sink
            await this.runPactlCommand([
                'load-module', 'module-null-sink',
                `sink_name=${sinkName}`,
                `sink_properties=device.description="Enspotification Guild ${guildId}"`
            ]);

            // Create virtual source from the sink's monitor
            await this.runPactlCommand([
                'load-module', 'module-virtual-source',
                `source_name=${sourceName}`,
                `master=${sinkName}.monitor`
            ]);

            console.log(`✅ Virtual devices created for guild ${guildId}`);
            return { sinkName, sourceName };
            
        } catch (error) {
            console.error(`❌ Failed to setup virtual devices for guild ${guildId}:`, error);
            throw error;
        }
    }

    async runPactlCommand(args) {
        return new Promise((resolve, reject) => {
            const pactl = spawn('pactl', args, {
                env: {
                    PULSE_RUNTIME_PATH: '/tmp/pulse',
                    XDG_RUNTIME_DIR: '/tmp/pulse'
                }
            });

            let output = '';
            let error = '';

            pactl.stdout.on('data', (data) => {
                output += data.toString();
            });

            pactl.stderr.on('data', (data) => {
                error += data.toString();
            });

            pactl.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`pactl command failed: ${error}`));
                }
            });
        });
    }

    async startPulseAudio() {
        return new Promise((resolve, reject) => {
            // Create runtime directory
            const mkdirProcess = spawn('mkdir', ['-p', '/tmp/pulse'], { stdio: 'inherit' });
            
            mkdirProcess.on('close', (code) => {
                if (code === 0) {
                    // Start PulseAudio daemon
                    this.pulseProcess = spawn('pulseaudio', [
                        '--system=false',
                        '--daemonize=false',
                        '--high-priority',
                        '--realtime',
                        '--disable-shm=false',
                        '--exit-idle-time=-1',
                        '--log-target=stderr',
                        '--log-level=2'
                    ], {
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env: {
                            ...process.env,
                            PULSE_RUNTIME_PATH: '/tmp/pulse',
                            XDG_RUNTIME_DIR: '/tmp/pulse'
                        }
                    });

                    this.pulseProcess.stdout.on('data', (data) => {
                        console.log(`PulseAudio: ${data}`);
                    });

                    this.pulseProcess.stderr.on('data', (data) => {
                        console.log(`PulseAudio: ${data}`);
                    });

                    this.pulseProcess.on('spawn', () => {
                        console.log('🎵 PulseAudio daemon started');
                        resolve();
                    });

                    this.pulseProcess.on('error', (error) => {
                        console.error('PulseAudio daemon error:', error);
                        reject(error);
                    });
                } else {
                    reject(new Error(`Failed to create pulse directory, code: ${code}`));
                }
            });
        });
    }

    async waitForPulseAudio() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30;

            const checkPulse = () => {
                attempts++;
                
                const pactl = spawn('pactl', ['info'], {
                    env: {
                        PULSE_RUNTIME_PATH: '/tmp/pulse',
                        XDG_RUNTIME_DIR: '/tmp/pulse'
                    }
                });

                pactl.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ PulseAudio is ready');
                        resolve();
                    } else if (attempts < maxAttempts) {
                        console.log(`🔄 Waiting for PulseAudio... (${attempts}/${maxAttempts})`);
                        setTimeout(checkPulse, 1000);
                    } else {
                        reject(new Error('PulseAudio failed to start within timeout'));
                    }
                });
            };

            checkPulse();
        });
    }

    async createAudioStream(guildId, browserPage) {
        console.log(`🎧 Creating audio stream for guild ${guildId}`);

        try {
            // Configure browser to use our virtual audio device
            await browserPage.evaluate(() => {
                // Override audio context to use our virtual device
                const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 48000,
                    latencyHint: 'interactive'
                });

                // Create audio worklet for capturing audio
                window.audioCapture = {
                    context: audioContext,
                    isCapturing: false
                };
            });

            // Start FFmpeg to capture from PulseAudio and convert to Discord format
            const audioStream = await this.startAudioCapture(guildId);
            
            if (audioStream) {
                this.audioStreams.set(guildId, audioStream);
                console.log(`✅ Audio stream created for guild ${guildId}`);
                return audioStream;
            } else {
                throw new Error('Failed to create audio stream');
            }

        } catch (error) {
            console.error(`❌ Failed to create audio stream for guild ${guildId}:`, error);
            return null;
        }
    }

    async startAudioCapture(guildId) {
        return new Promise((resolve, reject) => {
            try {
                // Use FFmpeg to capture from guild-specific virtual source
                const sourceName = `enspotification-source-${guildId}`;
                const ffmpeg = spawn('ffmpeg', [
                    '-f', 'pulse',
                    '-i', sourceName,
                    '-acodec', 'pcm_s16le',
                    '-f', 's16le',
                    '-ar', '48000',
                    '-ac', '2',
                    '-'
                ], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: {
                        ...process.env,
                        PULSE_RUNTIME_PATH: '/tmp/pulse',
                        XDG_RUNTIME_DIR: '/tmp/pulse'
                    }
                });

                // Handle FFmpeg errors
                ffmpeg.stderr.on('data', (data) => {
                    const errorText = data.toString();
                    if (errorText.includes('Input/output error')) {
                        console.log('🔄 Audio device not ready, retrying...');
                    } else {
                        console.log(`FFmpeg: ${errorText}`);
                    }
                });

                ffmpeg.on('error', (error) => {
                    console.error(`FFmpeg error for guild ${guildId}:`, error);
                    reject(error);
                });

                // Create readable stream from FFmpeg output
                const audioStream = new Readable({
                    read() {}
                });

                ffmpeg.stdout.on('data', (chunk) => {
                    audioStream.push(chunk);
                });

                ffmpeg.stdout.on('end', () => {
                    audioStream.push(null);
                });

                ffmpeg.on('spawn', () => {
                    console.log(`🎤 FFmpeg audio capture started for guild ${guildId}`);
                    this.ffmpegProcesses.set(guildId, ffmpeg);
                    resolve(audioStream);
                });

            } catch (error) {
                console.error(`❌ Failed to start audio capture for guild ${guildId}:`, error);
                reject(error);
            }
        });
    }

    async configureBrowserAudio(browserPage, guildId) {
        console.log(`🔧 Configuring browser audio for guild ${guildId}`);

        try {
            // Set browser to use our virtual audio device
            await browserPage.evaluateOnNewDocument(() => {
                // Override the audio context constructor to use our settings
                const originalAudioContext = window.AudioContext || window.webkitAudioContext;
                
                window.AudioContext = window.webkitAudioContext = function(...args) {
                    const context = new originalAudioContext({
                        sampleRate: 48000,
                        latencyHint: 'interactive',
                        ...args[0]
                    });
                    return context;
                };

                // Override getUserMedia to capture system audio
                const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
                navigator.mediaDevices.getUserMedia = function(constraints) {
                    return originalGetUserMedia.call(this, {
                        ...constraints,
                        audio: {
                            ...constraints?.audio,
                            sampleRate: 48000,
                            channelCount: 2,
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    });
                };
            });

            // Launch the page with audio permissions
            await browserPage.goto('about:blank');

            console.log(`✅ Browser audio configured for guild ${guildId}`);
            return true;

        } catch (error) {
            console.error(`❌ Failed to configure browser audio for guild ${guildId}:`, error);
            return false;
        }
    }

    stopAudioStream(guildId) {
        console.log(`🛑 Stopping audio stream for guild ${guildId}`);

        // Stop FFmpeg process
        const ffmpegProcess = this.ffmpegProcesses.get(guildId);
        if (ffmpegProcess) {
            ffmpegProcess.kill('SIGTERM');
            this.ffmpegProcesses.delete(guildId);
        }

        // Clean up audio stream
        const audioStream = this.audioStreams.get(guildId);
        if (audioStream) {
            audioStream.destroy();
            this.audioStreams.delete(guildId);
        }

        console.log(`✅ Audio stream stopped for guild ${guildId}`);
    }

    async shutdown() {
        console.log('🛑 Shutting down AudioManager...');

        // Stop all audio streams
        for (const guildId of this.audioStreams.keys()) {
            this.stopAudioStream(guildId);
        }

        // Stop PulseAudio daemon
        if (this.pulseProcess) {
            this.pulseProcess.kill('SIGTERM');
            this.pulseProcess = null;
        }

        console.log('✅ AudioManager shutdown complete');
    }
}

module.exports = AudioManager;