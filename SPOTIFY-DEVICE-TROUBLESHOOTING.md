# Spotify Connect Device Creation Troubleshooting Guide

## Error: "❌ Failed to create Spotify Connect device for voice channel"

This error occurs when the bot cannot successfully create a Spotify Connect device for Discord voice channel integration. Here's how to diagnose and fix it:

### 🔍 **Common Causes & Solutions**

#### 1. **Expired Spotify Authentication**
**Symptoms:** Error occurs after the bot has been running for a while
**Solution:** 
- Use `/join` command to reconnect your Spotify account
- Check that your Spotify session hasn't expired (tokens last ~1 hour)

#### 2. **Spotify Premium Required**
**Symptoms:** Authentication works but device creation fails
**Solution:** 
- Ensure the user has Spotify Premium (Connect API requires Premium)
- Free Spotify accounts cannot control playback via API

#### 3. **Browser/Container Issues**
**Symptoms:** Timeout errors or browser initialization failures
**Solution:**
- Check Docker container has sufficient resources
- Verify Chromium is properly installed in container
- Ensure container has network access to Spotify servers

#### 4. **Network Connectivity**
**Symptoms:** Timeout waiting for Spotify SDK to load
**Solution:**
- Check firewall/proxy settings
- Verify access to `https://sdk.scdn.co/spotify-player.js`
- Ensure Docker container can reach external URLs

### 🔧 **Improved Error Handling (v0.3.1)**

The latest version includes enhanced error detection and reporting:

#### **Detailed Error Messages**
- **Token Validation**: Checks if Spotify token is valid before device creation
- **Authentication Errors**: Captures Spotify API authentication failures  
- **Account Errors**: Detects Premium account requirement issues
- **Timeout Handling**: Better reporting when browser initialization fails

#### **Error Types Detected**
1. **Authentication Error**: Invalid or expired Spotify token
2. **Account Error**: Spotify Premium required
3. **Initialization Error**: Spotify Web Playback SDK failed to load
4. **Connection Error**: Failed to connect to Spotify services
5. **Timeout Error**: Browser took too long to initialize

### 📊 **Debugging Steps**

#### **For Users**
1. **Reconnect Spotify**: Use `/join` command to refresh authentication
2. **Check Premium Status**: Verify Spotify Premium subscription is active
3. **Try Again**: Wait 30-60 seconds and retry `/voice-play` command
4. **Check Status**: Use `/status` to verify Spotify connection

#### **For Administrators**
1. **Check Logs**: Look for detailed error messages in bot console output
2. **Test Container**: Verify Docker container has required dependencies:
   ```bash
   docker exec -it enspotification chromium-browser --version
   docker exec -it enspotification curl -I https://sdk.scdn.co/spotify-player.js
   ```
3. **Resource Check**: Ensure adequate CPU/memory for browser instances
4. **Network Test**: Verify outbound HTTPS connectivity from container

### 🛠️ **Container Requirements**

#### **System Resources**
- **Memory**: Minimum 512MB, recommended 1GB per concurrent user
- **CPU**: Each browser instance uses ~10-20% CPU during initialization  
- **Network**: Outbound HTTPS access to Spotify APIs and CDN

#### **Docker Configuration**
```yaml
version: '3.8'
services:
  enspotification:
    image: sluberskihomelab/enspotification:0.3.1
    environment:
      - DISCORD_TOKEN=your_token
      - SPOTIFY_CLIENT_ID=your_client_id  
      - SPOTIFY_CLIENT_SECRET=your_client_secret
      - SPOTIFY_REDIRECT_URI=http://your-domain:3000/callback
    ports:
      - "3000:3000"
    # For audio device access (if needed)
    devices:
      - "/dev/snd:/dev/snd"
    # Increased memory limit for browser instances
    mem_limit: 1g
    # Network access for Spotify APIs
    networks:
      - default
```

### 📝 **Error Message Examples**

#### **Token Expired**
```
❌ Failed to create Spotify Connect device for voice channel.

Issue: Spotify session expired
Your Spotify authentication has expired and needs to be refreshed.

Solution:
Use `/join` command to reconnect your Spotify account, then try `/voice-play` again.
```

#### **Premium Required**  
```
❌ Failed to create Spotify Connect device for voice channel.

Possible causes:
• Spotify Premium account required for playback control
• Network connectivity issues with Spotify servers
• Browser initialization failed in container

Troubleshooting:
1. Ensure you have Spotify Premium (required for Connect API)
2. Try again in a few seconds  
3. Check bot logs for detailed error information
```

### 🔄 **Recovery Procedures**

#### **Automatic Recovery**
- Bot automatically cleans up failed browser instances
- Retries device creation on subsequent `/voice-play` commands
- Token refresh handled automatically during `/join` process

#### **Manual Recovery**
```bash
# Restart bot container if issues persist
docker restart enspotification

# Check container logs for detailed errors
docker logs enspotification

# Test Spotify API connectivity
docker exec enspotification curl -v https://api.spotify.com/v1/
```

### 🎯 **Prevention**

#### **Best Practices**
1. **Regular Reconnection**: Encourage users to run `/join` periodically
2. **Resource Monitoring**: Monitor container memory usage
3. **Log Analysis**: Review error patterns in bot logs
4. **Network Stability**: Ensure reliable internet connection for container

#### **Monitoring**
- Track frequency of device creation failures
- Monitor browser instance lifecycle and cleanup
- Log Spotify API response times and errors
- Alert on repeated authentication failures

### 📞 **Support Information**

If issues persist after following this guide:

1. **Check Version**: Ensure using latest version (`0.3.1` or newer)
2. **Collect Logs**: Gather bot logs showing the full error trace
3. **Environment Info**: Document Docker setup and network configuration
4. **Reproduction Steps**: Note exact commands and timing of failures

The enhanced error handling in v0.3.1 should provide much clearer information about the specific cause of device creation failures, making troubleshooting more straightforward.