import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// In AI Studio / Cloud Run, Nginx binds to port 8080 and proxies requests to port 3000.
// If process.env.PORT is 8080, it is Nginx's external port, so this Node app MUST bind to port 3000.
const PORT = (process.env.PORT && process.env.PORT !== '8080') ? parseInt(process.env.PORT, 10) : 3000;

// Health check endpoints for deployment probes
app.get(['/healthz', '/_ah/health', '/health'], (req, res) => {
  res.status(200).send('OK');
});

// Serve static assets from project root (allowing dotfiles for .well-known/assetlinks.json)
app.use(express.static(__dirname, { dotfiles: 'allow' }));

// Single Page Application fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && PORT !== 3000) {
    console.warn(`Port ${PORT} is in use, falling back to port 3000`);
    app.listen(3000, '0.0.0.0');
  } else {
    console.error('Server error:', err);
  }
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
