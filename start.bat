@echo off
echo 🎵 Setting up Enspotification Discord Bot...

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your Discord and Spotify credentials before starting!
    echo.
    echo You need to configure:
    echo - DISCORD_BOT_TOKEN (from Discord Developer Portal^)
    echo - DISCORD_CLIENT_ID (from Discord Developer Portal^) 
    echo - SPOTIFY_CLIENT_ID (from Spotify Developer Dashboard^)
    echo - SPOTIFY_CLIENT_SECRET (from Spotify Developer Dashboard^)
    echo.
    echo After configuration, run: docker-compose up -d
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

echo 🐳 Starting Enspotification with Docker Compose...
docker-compose up -d

echo.
echo ✅ Enspotification is starting up!
echo 🌐 Web interface will be available at: http://localhost:3000
echo 📊 Check logs with: docker-compose logs -f enspotification
echo 🛑 Stop with: docker-compose down
echo.
echo Add the bot to your Discord server and use /join to get started!
pause