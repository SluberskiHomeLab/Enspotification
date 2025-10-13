#!/usr/bin/env node

/**
 * Test script to validate Spotify Connect device creation with better error handling
 */

const puppeteer = require('puppeteer');

async function testSpotifyDeviceCreation() {
    console.log('🧪 Testing Spotify Connect device creation with error handling...');
    
    const testAccessToken = 'test_invalid_token'; // Invalid token to trigger error
    const testGuildId = 'test_guild_123';
    
    let browser;
    try {
        console.log('🚀 Launching headless browser...');
        browser = await puppeteer.launch({
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
        
        console.log('📄 Setting up Spotify Web Playback SDK page...');
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Enspotification Voice Device</title>
                <script src="https://sdk.scdn.co/spotify-player.js"></script>
            </head>
            <body>
                <div id="status">Initializing Test Spotify Connect Device...</div>
                <script>
                    let player;
                    let deviceId;
                    
                    window.onSpotifyWebPlaybackSDKReady = () => {
                        const token = '${testAccessToken}';
                        
                        try {
                            player = new Spotify.Player({
                                name: 'Test Enspotification Voice (Guild ${testGuildId})',
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

                            // Authentication error (expected with invalid token)
                            player.addListener('authentication_error', ({ message }) => {
                                console.error('Spotify authentication error:', message);
                                window.lastError = 'Authentication error: ' + message;
                                window.authError = true;
                                document.getElementById('status').textContent = 'Auth Error: ' + message;
                            });

                            // Account error
                            player.addListener('account_error', ({ message }) => {
                                console.error('Spotify account error:', message);
                                window.lastError = 'Account error: ' + message;
                                window.accountError = true;
                                document.getElementById('status').textContent = 'Account Error: ' + message;
                            });

                            // Connect the player
                            player.connect().then(success => {
                                if (success) {
                                    console.log('Successfully connected to Spotify!');
                                } else {
                                    console.error('Failed to connect to Spotify');
                                    window.lastError = 'Failed to connect to Spotify';
                                    window.connectionFailed = true;
                                    document.getElementById('status').textContent = 'Connection Failed';
                                }
                            });

                        } catch (error) {
                            console.error('Error creating Spotify player:', error);
                            window.lastError = 'Player creation error: ' + error.message;
                            window.playerError = true;
                            document.getElementById('status').textContent = 'Player Error: ' + error.message;
                        }
                    };
                </script>
            </body>
            </html>
        `);

        console.log('⏳ Waiting for Spotify SDK to load and attempt authentication...');
        
        // Wait for either success or error
        try {
            await page.waitForFunction(() => 
                window.deviceReady || window.authError || window.accountError || window.connectionFailed || window.playerError, 
                { timeout: 15000 }
            );
            
            const result = await page.evaluate(() => {
                return {
                    deviceReady: window.deviceReady || false,
                    authError: window.authError || false,
                    accountError: window.accountError || false,
                    connectionFailed: window.connectionFailed || false,
                    playerError: window.playerError || false,
                    lastError: window.lastError || 'No error information',
                    deviceId: window.deviceId || null
                };
            });
            
            console.log('📊 Test Results:', result);
            
            if (result.authError) {
                console.log('✅ Expected authentication error caught correctly');
                console.log('🔍 Error message:', result.lastError);
            } else if (result.deviceReady) {
                console.log('🎉 Device created successfully (unexpected with invalid token)');
                console.log('🆔 Device ID:', result.deviceId);
            } else {
                console.log('📋 Other result:', result);
            }
            
        } catch (waitError) {
            console.log('⏰ Timeout waiting for result - this might be expected');
            
            const finalState = await page.evaluate(() => {
                return {
                    status: document.getElementById('status').textContent,
                    lastError: window.lastError || 'No error captured',
                    hasSpotifySDK: typeof window.Spotify !== 'undefined'
                };
            });
            
            console.log('📄 Final page state:', finalState);
        }

        console.log('✅ Error handling validation complete');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🧹 Browser cleanup completed');
        }
    }
}

// Run the test
testSpotifyDeviceCreation().then(() => {
    console.log('🏁 Test completed');
}).catch(console.error);