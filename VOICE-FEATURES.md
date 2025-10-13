# Enspotification v0.2.0 - Discord Voice Integration

## 🎵 New Features in v0.2.0

### Discord Voice Channel Integration
The bot can now join Discord voice channels and play music directly through Discord audio, in addition to the existing Spotify Connect functionality.

### Dual Mode Operation
1. **Spotify Connect Mode**: Bot appears as a device in your Spotify app
2. **Discord Voice Mode**: Bot joins voice channels and streams audio directly

### Smart Music Search
- Searches Spotify first (if user is authenticated)
- Falls back to YouTube for actual audio playback
- Seamless integration between both platforms

## 📋 Prerequisites Update

### Discord Bot Permissions
Your Discord bot now needs additional permissions:
- `Connect` - To join voice channels
- `Speak` - To play audio in voice channels  
- `Use Voice Activity` - For voice channel functionality

Update your bot invite URL to include these permissions.

### System Requirements
The bot now requires:
- FFmpeg for audio processing
- Additional system libraries for voice functionality
- More CPU/memory for audio streaming

## 🎮 New Commands

### Voice Channel Commands
```
/voice-join        - Join your current voice channel
/voice-leave       - Leave the voice channel
/voice-play <song> - Play music in voice channel
/voice-pause       - Pause voice playback
/voice-resume      - Resume voice playback
/voice-skip        - Skip current track
/voice-stop        - Stop playback completely
/now-playing       - Show current track info
/voice-volume <#>  - Volume control (limited by Discord)
```

### Existing Spotify Connect Commands
```
/join              - Connect Spotify account
/status            - Check connection status
/play <song>       - Spotify Connect playback
/pause             - Pause Spotify Connect
/skip              - Skip Spotify Connect track
/volume <#>        - Spotify Connect volume
/disconnect        - Disconnect Spotify
```

## 🚀 Usage Examples

### Getting Started with Voice Mode
1. Join a Discord voice channel
2. Use `/voice-join` to make the bot join your channel
3. Use `/voice-play never gonna give you up` to play music
4. Control playback with `/voice-pause`, `/voice-resume`, etc.

### Getting Started with Spotify Connect Mode
1. Use `/join` to get your Spotify authentication link
2. Complete the OAuth flow
3. Bot appears as "Enspotification" in your Spotify app
4. Control via Discord commands or Spotify app directly

### Hybrid Usage
- You can use both modes simultaneously!
- Different users can use different modes
- Each Discord server gets its own voice connection
- Each user gets their own Spotify connection

## 🔧 Technical Details

### Audio Quality
- **Discord Voice**: Compressed Discord audio (96kbps Opus)
- **Spotify Connect**: Full quality Spotify streaming

### Performance Impact
- Voice mode uses more server resources
- Requires stable internet for YouTube streaming
- May have slight delay for voice channel audio

### Limitations
- Discord voice volume control is limited by Discord's API
- YouTube audio quality varies by source video
- Some Spotify tracks may not have YouTube equivalents

## 🐳 Docker Hub Images

### Available Tags
- `sluberskihomelab/enspotification:v0.2.0` - Voice integration release
- `sluberskihomelab/enspotification:latest` - Always latest version
- `sluberskihomelab/enspotification:v0.1.0` - Original Spotify Connect only

### Docker Compose Update
```yaml
services:
  enspotification:
    image: sluberskihomelab/enspotification:v0.2.0
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: unless-stopped
```

## 🔍 Troubleshooting Voice Features

### Bot Won't Join Voice Channel
- Check bot has `Connect` and `Speak` permissions
- Verify you're in a voice channel when using `/voice-join`
- Check bot isn't already connected to another channel

### No Audio in Voice Channel
- Ensure FFmpeg is installed (handled by Docker)
- Check YouTube video is available in your region
- Try a different search query

### Audio Quality Issues
- YouTube source quality varies
- Discord compresses all voice audio
- For best quality, use Spotify Connect mode instead

### Performance Issues
- Voice mode uses more CPU/memory
- Consider limiting concurrent voice connections
- Monitor server resources during playback

## 🎯 Migration from v0.1.0

1. **No breaking changes** - All existing functionality preserved
2. **New commands added** - Old commands still work exactly the same
3. **Additional dependencies** - Docker image includes required libraries
4. **Same configuration** - No .env changes needed

### Updating Your Deployment
```bash
# Pull new version
docker pull sluberskihomelab/enspotification:v0.2.0

# Update and restart
docker-compose down
docker-compose up -d
```

## 📊 Feature Comparison

| Feature | Spotify Connect Mode | Discord Voice Mode |
|---------|---------------------|-------------------|
| Audio Quality | Full Spotify quality | Discord compressed |
| User Control | Spotify app + Discord | Discord only |
| Authentication | Required | Optional* |
| Resource Usage | Low | Medium |
| Latency | Very low | Low |
| Track Availability | Spotify catalog | YouTube catalog |
| Multiple Users | Per-user auth | Server-wide |

*Authentication recommended for better search results

## 🎉 Future Enhancements

Planned features for future releases:
- Playlist support for voice mode
- Queue management
- Auto-skip on voice channel empty
- Better audio quality options
- Integration with more music services

---

**Enjoy your enhanced Enspotification experience! 🎵**