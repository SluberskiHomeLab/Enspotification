# Enspotification - Spotify Discord Bot

A Discord bot that connects to Spotify and acts as a Spotify Connect device, allowing users to control their music playback directly from Discord.

## Features

- 🎵 **Spotify Connect Device**: Acts as a virtual Spotify speaker that appears in your Spotify app
- 🎙️ **Discord Voice Integration**: Join voice channels and play music directly through Discord
- 🤖 **Discord Integration**: Full Discord slash command support
- 🔐 **Secure Authentication**: Individual user Spotify OAuth authentication
- 🐳 **Docker Ready**: Easy deployment with Docker and Docker Compose
- 🎮 **Dual Playback Modes**: Control via Spotify Connect OR Discord voice channels
- 📱 **Web Interface**: Built-in web player for Spotify Web Playbook SDK
- 🔍 **Smart Search**: Searches Spotify first, falls back to YouTube for playback

## Getting Started

Please See the Wiki for installation information, development information, Configuration, Reverse Proxy setup, and more.

## Usage

### Discord Commands

The bot supports two modes of operation:

#### Spotify Connect
- `/join` - Connect your Spotify account and activate the bot as a playback device
- `/status` - Check your connection status  
- `/disconnect` - Disconnect from Spotify

#### Discord Voice Mode (Spotify Connect in Voice Channels)  
- `/voice-join` - Join voice channel and create dedicated Spotify Connect device
- `/voice-leave` - Leave voice channel and cleanup Spotify device
- `/voice-play <query>` - Play Spotify music via voice channel Connect device
- `/voice-pause` - Pause voice channel Spotify playback  
- `/voice-resume` - Resume voice channel Spotify playback  
- `/voice-skip` - Skip current Spotify track in voice channel
- `/voice-stop` - Stop voice channel Spotify playback  
- `/now-playing` - Show current Spotify track info
- `/voice-volume <0-100>` - Adjust Spotify Connect device volume

### How It Works

1. **Connect**: Use `/join` to get a personalized Spotify authorization link
2. **Authenticate**: Click the link to connect your Spotify account
3. **Activate**: The bot will appear as "Enspotification (Discord Bot)" in your Spotify Connect devices
4. **Control**: Use Discord commands or select the device in your Spotify app for playback

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the GLP-3.0 License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This bot is for educational and personal use. Make sure to comply with Spotify's Terms of Service and API guidelines. The bot requires Spotify Premium for full functionality due to Web Playback SDK limitations.

A portion of this was also vibe coded.  This is a learning project for myself so it is not perfect, but I do my best to verify code and use 3rd party code review to make sure everything is safe.

## Version History

- **v0.1.0** - Initial release
  - Discord slash commands integration
  - Spotify Web Playback SDK support
  - Reverse proxy compatibility
  - Docker deployment ready

## Security Notes

- Container runs as non-root user (`enspotify`)
- Includes security headers and CORS configuration  
- Health checks for container monitoring
- Proper timeout configurations for reverse proxy compatibility

## Support

- **Repository**: https://github.com/SluberskiHomeLab/Enspotification
- **Docker Hub**: https://hub.docker.com/r/sluberskihomelab/enspotification
- **Issues**: Create an issue on the GitHub repository

**Made with ❤️ for the Discord and Spotify communities**
