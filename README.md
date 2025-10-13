# Enspotification - Spotify Discord Bot

A Discord bot that connects to Spotify and acts as a Spotify Connect device, allowing users to control their music playback directly from Discord.

## Features

- 🎵 **Spotify Connect Device**: Acts as a virtual Spotify speaker that appears in your Spotify app
- 🤖 **Discord Integration**: Full Discord slash command support
- 🔐 **Secure Authentication**: Individual user Spotify OAuth authentication
- 🐳 **Docker Ready**: Easy deployment with Docker and Docker Compose
- 🎮 **Playback Controls**: Play, pause, skip, volume control, and search functionality
- 📱 **Web Interface**: Built-in web player for Spotify Web Playback SDK

## Getting Started

Please See the Wiki for installation information, development information, Configuration, Reverse Proxy setup, and more.

## Usage

### Discord Commands

Once the bot is running and invited to your server, use these slash commands:

- `/join` - Connect your Spotify account and activate the bot as a playback device
- `/status` - Check your connection status
- `/play [query]` - Play a song, artist, or playlist (or resume playback)
- `/pause` - Pause current playback
- `/skip` - Skip to the next track
- `/volume <0-100>` - Set playback volume
- `/disconnect` - Disconnect from Spotify

### How It Works

1. **Connect**: Use `/join` to get a personalized Spotify authorization link
2. **Authenticate**: Click the link to connect your Spotify account
3. **Activate**: The bot will appear as "Enspotification (Discord Bot)" in your Spotify Connect devices
4. **Control**: Use Discord commands or select the device in your Spotify app for playbook

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
