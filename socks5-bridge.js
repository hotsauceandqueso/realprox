const express = require('express');
const cors = require('cors');
const { SocksClient } = require('socks');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Free SOCKS5 proxy list (from spys.one)
const freeProxies = [
    { host: '213.35.110.67', port: 10800, country: 'Singapore', uptime: '67%' },
    { host: '192.252.214.17', port: 4145, country: 'United States', uptime: '69%' },
    { host: '192.252.211.193', port: 4145, country: 'United States', uptime: '98%' },
    { host: '192.252.210.233', port: 4145, country: 'United States', uptime: '100%' },
    { host: '98.175.31.195', port: 4145, country: 'United States', uptime: '91%' },
    { host: '98.188.47.132', port: 4145, country: 'United States', uptime: '80%' },
    { host: '72.195.101.99', port: 4145, country: 'United States', uptime: '99%' },
    { host: '178.62.116.7', port: 1080, country: 'United Kingdom', uptime: '25%' },
    { host: '128.199.37.92', port: 1080, country: 'Netherlands', uptime: '29%' },
    { host: '95.163.153.116', port: 20184, country: 'Austria', uptime: '50%' },
];

// Store current proxy per session
const sessions = new Map();

// Get list of available proxies
app.get('/api/proxies', (req, res) => {
    res.json({ 
        success: true, 
        proxies: freeProxies.map((p, index) => ({
            id: index,
            host: p.host,
            port: p.port,
            country: p.country,
            uptime: p.uptime,
            address: `${p.host}:${p.port}`
        }))
    });
});

// Test proxy connection
app.post('/api/proxy/test', async (req, res) => {
    const { proxyId } = req.body;
    const proxy = freeProxies[proxyId];

    if (!proxy) {
        return res.status(400).json({ error: 'Invalid proxy ID' });
    }

    try {
        const options = {
            proxy: {
                host: proxy.host,
                port: proxy.port,
                type: 5
            },
            command: 'connect',
            destination: {
                host: 'google.com',
                port: 80
            },
            timeout: 10000
        };

        const info = await SocksClient.createConnection(options);
        info.socket.destroy();

        res.json({ 
            success: true, 
            message: `Proxy ${proxy.host}:${proxy.port} is working!`,
            proxy: `${proxy.host}:${proxy.port}`
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: 'Proxy connection failed',
            details: error.message,
            suggestion: 'Try a different proxy from the list'
        });
    }
});

// Fetch URL through SOCKS5 proxy
app.post('/api/fetch', async (req, res) => {
    const { url, proxyId, sessionId } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const proxy = freeProxies[proxyId];
    if (!proxy) {
        return res.status(400).json({ error: 'Please select a proxy first' });
    }

    try {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const port = parsedUrl.port || (isHttps ? 443 : 80);

        console.log(`Fetching ${url} through ${proxy.host}:${proxy.port}`);

        // Create SOCKS connection
        const options = {
            proxy: {
                host: proxy.host,
                port: proxy.port,
                type: 5
            },
            command: 'connect',
            destination: {
                host: parsedUrl.hostname,
                port: parseInt(port)
            },
            timeout: 30000
        };

        const info = await SocksClient.createConnection(options);
        const socket = info.socket;

        // Build HTTP request
        const path = parsedUrl.pathname + parsedUrl.search;
        const httpRequest = [
            `GET ${path} HTTP/1.1`,
            `Host: ${parsedUrl.hostname}`,
            `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`,
            `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`,
            `Accept-Language: en-US,en;q=0.5`,
            `Connection: close`,
            '',
            ''
        ].join('\r\n');

        socket.write(httpRequest);

        let data = '';
        let headerReceived = false;
        let headers = '';
        let body = '';

        socket.on('data', (chunk) => {
            data += chunk.toString();
            
            if (!headerReceived && data.includes('\r\n\r\n')) {
                headerReceived = true;
                const parts = data.split('\r\n\r\n');
                headers = parts[0];
                body = parts.slice(1).join('\r\n\r\n');
            } else if (headerReceived) {
                body += chunk.toString();
            }
        });

        socket.on('end', () => {
            const statusMatch = headers.match(/HTTP\/[\d.]+\s+(\d+)/);
            const statusCode = statusMatch ? parseInt(statusMatch[1]) : 200;

            res.json({
                success: true,
                statusCode,
                body: body,
                url: url,
                proxy: `${proxy.host}:${proxy.port}`
            });
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error.message);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch through proxy',
                details: error.message,
                suggestion: 'This proxy may be slow or offline. Try another one.'
            });
        });

        // Timeout handler
        setTimeout(() => {
            if (!res.headersSent) {
                socket.destroy();
                res.status(504).json({
                    success: false,
                    error: 'Request timeout',
                    suggestion: 'This proxy is too slow. Try a different one with better uptime.'
                });
            }
        }, 30000);

    } catch (error) {
        console.error('Fetch error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch URL',
            details: error.message,
            suggestion: 'Try selecting a different proxy with higher uptime'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Free SOCKS5 Proxy Bridge is running' });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║     🌐  Free SOCKS5 Proxy Bridge Server                       ║
║                                                                ║
║  📡 Server:     http://localhost:${PORT}                          ║
║  🔧 Health:     http://localhost:${PORT}/health                   ║
║  🌍 Proxies:    ${freeProxies.length} free SOCKS5 proxies available           ║
║                                                                ║
║  Browse the web using free public SOCKS5 proxies!             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
});
