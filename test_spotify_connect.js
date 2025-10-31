// Test file to validate our Spotify Connect monitoring implementation
const SpotifyConnectMonitor = require('./src/SpotifyConnect');

async function testSpotifyConnect() {
    console.log('🧪 Testing Spotify Connect Monitor Implementation');
    
    // Test with mock access token and guild ID
    const mockToken = 'mock-access-token';
    const mockGuildId = 'test-guild-123';
    
    try {
        console.log('\n1. Creating Spotify Connect Monitor...');
        const monitor = new SpotifyConnectMonitor(mockToken, mockGuildId);
        
        console.log(`✅ Monitor created with ID: ${monitor.monitorId}`);
        console.log(`📡 Monitor name: ${monitor.name}`);
        
        console.log('\n2. Testing playback monitoring startup...');
        const success = await monitor.startPlaybackMonitoring();
        
        if (success) {
            console.log('✅ Playback monitoring started successfully');
        } else {
            console.log('❌ Failed to start playback monitoring');
        }
        
        console.log('\n3. Testing playTrack method (will fail without real token)...');
        try {
            await monitor.playTrack('spotify:track:4iV5W9uYEdYUVa79Axb7Rh');
        } catch (error) {
            console.log(`⚠️ Expected error (no valid token): ${error.message}`);
        }
        
        console.log('\n✅ All tests completed - implementation is syntactically correct');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    testSpotifyConnect();
}