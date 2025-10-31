const { Readable } = require('stream');
const fs = require('fs');

// Test our audio stream generation
function createTestToneStream() {
    console.log('🧪 Creating test tone stream...');
    
    const sampleRate = 48000;
    const channels = 2;
    const frequency = 440; // A4 note
    const amplitude = 0.1; // Quiet volume
    let sampleCount = 0;
    const duration = 5; // 5 seconds
    const totalSamples = sampleRate * duration;
    
    return new Readable({
        read() {
            if (sampleCount >= totalSamples) {
                this.push(null); // End of stream
                return;
            }
            
            const samplesPerChunk = 960; // 20ms at 48kHz
            const buffer = Buffer.alloc(samplesPerChunk * channels * 2); // 16-bit samples
            
            for (let i = 0; i < samplesPerChunk && sampleCount < totalSamples; i++) {
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

console.log('🎵 Testing audio stream generation...');

const audioStream = createTestToneStream();
const outputFile = './test-output.raw';

console.log(`💾 Writing audio stream to ${outputFile}`);

const writeStream = fs.createWriteStream(outputFile);
audioStream.pipe(writeStream);

audioStream.on('end', () => {
    console.log('✅ Audio stream generation completed');
    console.log(`📊 File size: ${fs.statSync(outputFile).size} bytes`);
    console.log(`🎵 You can play this with: ffplay -f s16le -ar 48000 -ac 2 ${outputFile}`);
});

audioStream.on('error', (error) => {
    console.error('❌ Audio stream error:', error);
});