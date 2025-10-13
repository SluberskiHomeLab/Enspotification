#!/bin/bash

# Enspotification Setup Script
echo "🎵 Setting up Enspotification Discord Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your Discord and Spotify credentials before starting!"
    echo ""
    echo "You need to configure:"
    echo "- DISCORD_BOT_TOKEN (from Discord Developer Portal)"
    echo "- DISCORD_CLIENT_ID (from Discord Developer Portal)" 
    echo "- SPOTIFY_CLIENT_ID (from Spotify Developer Dashboard)"
    echo "- SPOTIFY_CLIENT_SECRET (from Spotify Developer Dashboard)"
    echo ""
    echo "After configuration, run: docker-compose up -d"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "🐳 Starting Enspotification with Docker Compose..."
docker-compose up -d

echo ""
echo "✅ Enspotification is starting up!"
echo "🌐 Web interface will be available at: http://localhost:3000"
echo "📊 Check logs with: docker-compose logs -f enspotification"
echo "🛑 Stop with: docker-compose down"
echo ""
echo "Add the bot to your Discord server and use /join to get started!"