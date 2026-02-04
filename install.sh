#!/bin/bash

# Web Proxy Browser - Quick Install Script
# Run with: bash install.sh

echo "════════════════════════════════════════════════════════"
echo "     🌐 Web Proxy Browser - Quick Install Script"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "📦 Installing Node.js..."
    
    # Detect OS
    if [ -f /etc/debian_version ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo "❌ Unable to detect OS. Please install Node.js manually."
        exit 1
    fi
else
    echo "✅ Node.js is already installed: $(node --version)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js properly."
    exit 1
else
    echo "✅ npm is installed: $(npm --version)"
fi

echo ""
echo "📁 Creating project directory..."
mkdir -p ~/web-proxy
cd ~/web-proxy

echo "📥 Installing dependencies..."
npm install express cors axios cheerio

echo ""
echo "🔧 Setting up firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 3000
    echo "✅ Firewall configured (port 3000 opened)"
else
    echo "⚠️  UFW not found. Make sure port 3000 is open manually."
fi

echo ""
echo "🚀 Installing PM2 for process management..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "✅ PM2 installed"
else
    echo "✅ PM2 already installed"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "     ✅ Installation Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Upload your files to ~/web-proxy/"
echo "   - proxy-server.js"
echo "   - package.json"
echo "   - public/index.html"
echo ""
echo "2. Start the server:"
echo "   cd ~/web-proxy"
echo "   pm2 start proxy-server.js --name web-proxy"
echo "   pm2 save"
echo ""
echo "3. Access your proxy at:"
echo "   http://$(curl -s ifconfig.me):3000"
echo ""
echo "📚 For detailed instructions, see COMPLETE-SETUP.md"
echo ""
echo "🎉 Happy browsing!"
echo ""
