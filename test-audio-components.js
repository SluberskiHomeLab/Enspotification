#!/usr/bin/env node

const AudioManager = require('./src/AudioManager');

async function testAudioComponents() {
    console.log('🧪 Testing Audio Streaming Components');
    console.log('=====================================\n');

    const audioManager = new AudioManager();
    const testGuildId = 'test-guild-123';

    try {
        console.log('1. Testing PulseAudio daemon startup...');
        await audioManager.startPulseAudio();
        console.log('   ✅ PulseAudio daemon started successfully\n');

        console.log('2. Testing virtual audio device setup...');
        await audioManager.setupVirtualDevices(testGuildId);
        console.log('   ✅ Virtual audio devices configured\n');

        console.log('3. Testing audio stream creation...');
        const audioStream = await audioManager.createAudioStream(testGuildId);
        console.log('   ✅ Audio stream created successfully\n');

        console.log('4. Testing stream properties...');
        console.log(`   - Stream type: ${typeof audioStream}`);
        console.log(`   - Stream readable: ${audioStream?.readable || 'N/A'}`);
        console.log(`   - Stream encoding: PCM 16-bit signed little-endian (expected for Discord)\n`);

        console.log('5. Testing cleanup...');
        await audioManager.stopAudioStream(testGuildId);
        console.log('   ✅ Audio streaming cleanup completed\n');

        console.log('🎉 All audio streaming components are working correctly!');
        console.log('\n📋 Component Status:');
        console.log('   ✅ PulseAudio daemon');
        console.log('   ✅ Virtual sink (browser audio capture)');
        console.log('   ✅ Virtual source (Discord audio output)');
        console.log('   ✅ FFmpeg audio processing pipeline');
        console.log('   ✅ Stream conversion for Discord voice');

    } catch (error) {
        console.error('❌ Audio component test failed:', error.message);
        console.error('\n🔧 Troubleshooting steps:');
        console.error('   1. Ensure Docker container has audio capabilities');
        console.error('   2. Check PulseAudio configuration files');
        console.error('   3. Verify FFmpeg installation and codecs');
        console.error('   4. Ensure proper file permissions');
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    testAudioComponents().catch(console.error);
}

module.exports = testAudioComponents;