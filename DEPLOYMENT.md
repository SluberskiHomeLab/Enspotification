# Enspotification Debug Deployment Guide

## 🐳 **Updated Debug Image Available on DockerHub:**
- `sluberskihomelab/enspotification:debug` (latest debug)
- `sluberskihomelab/enspotification:0.4.3-debug` (latest versioned debug with null safety fixes)

## 🚀 **Quick Deploy on Any Machine:**

### 1. **Create Environment File**
Create a `.env` file with your credentials:
```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Spotify App Credentials  
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=https://your-domain.com/callback

# Server Configuration
PORT=3000
NODE_ENV=production

# Bot Configuration
BOT_NAME=Enspotification
DEFAULT_VOLUME=50
```

### 2. **Run the Debug Container**
```bash
# Pull and run the debug image
docker pull sluberskihomelab/enspotification:debug

# Run with environment file
docker run -d \
  --name enspotification-debug \
  -p 3000:3000 \
  --env-file .env \
  sluberskihomelab/enspotification:debug

# Follow logs for debugging
docker logs -f enspotification-debug
```

### 3. **Alternative: Using Docker Compose**
Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  enspotification:
    image: sluberskihomelab/enspotification:debug
    container_name: enspotification-debug
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
docker-compose logs -f
```

## 🔧 **Debug Features in This Version:**

### Enhanced Error Handling:
- ✅ Improved Discord interaction handling
- ✅ Safer deferReply with error catching  
- ✅ Better Spotify Connect device creation error handling
- ✅ Detailed error logging with stack traces
- ✅ **NEW**: Puppeteer/Chrome crash detection and fallback
- ✅ **NEW**: Audio streaming even when Spotify Connect fails

### Audio Pipeline Debugging:
- 🧪 **Test Tone Priority**: Uses 440Hz test tone for initial testing
- 🔊 **Detailed Voice Logging**: Shows each step of voice connection
- 📊 **Audio Player States**: Logs all player state changes
- 🎵 **Success Indicators**: Clear messages when audio should be playing

### Connection Monitoring:
- 🔌 Voice connection state transitions
- 🎛️ Audio player subscription status
- 🎵 Playback status and error tracking

## 🧪 **Testing Steps:**

1. **Start the container** and verify it connects to Discord
2. **Join a voice channel** in your Discord server
3. **Use `/join` command** and watch the logs
4. **Look for success message**: `🎉 AUDIO IS PLAYING! You should hear sound in Discord voice channel.`

## 📊 **Expected Log Sequence:**

When `/join` works correctly, you should see:
```
🔌 Joining voice channel General (123456789)
🎵 Creating audio player with proper configuration...
✅ Audio player successfully subscribed to voice connection
🔌 Voice connection: signalling → connecting → ready
✅ Voice connection ready in guild 123456 - Bot should now be visible in voice channel
🔄 Creating Spotify Connect device for guild 123456...
✅ Spotify Connect device created successfully for guild 123456
🧪 DEBUG: Starting with test tone to verify audio pipeline
🔧 Creating Discord audio resource...
✅ Audio resource created successfully
🎵 Audio player: Idle → Playing in guild 123456
🎉 AUDIO IS PLAYING! You should hear sound in Discord voice channel.
```

## 🚨 **Troubleshooting:**

- **No Audio**: Check if you see "AUDIO IS PLAYING" message - if yes, it's a Discord permissions issue
- **Connection Fails**: Verify Discord bot token and permissions
- **Spotify Errors**: Check Spotify client credentials and redirect URI
- **Container Crashes**: Check Docker logs for detailed error messages

## 🔄 **Next Steps:**

Once the test tone works (you hear the 440Hz beep), we can enable full Spotify audio streaming by uncommenting the audio capture code in the source.