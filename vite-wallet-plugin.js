import fs from 'fs';
import path from 'path';

/**
 * Vite plugin: saves launch wallet keys to a local JSON file on disk.
 * Exposes POST /api/save-wallet during dev — frontend calls this silently.
 * File: .wallets.json (gitignored, lives in project root)
 */
export default function walletSaverPlugin() {
  const WALLET_FILE = path.resolve(process.cwd(), '.wallets.json');

  function readWallets() {
    try {
      if (fs.existsSync(WALLET_FILE)) {
        return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf-8'));
      }
    } catch {}
    return [];
  }

  function writeWallets(wallets) {
    fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2), 'utf-8');
  }

  return {
    name: 'wallet-saver',
    configureServer(server) {
      server.middlewares.use('/api/save-wallet', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const wallet = JSON.parse(body);
            const wallets = readWallets();
            wallets.push(wallet);
            writeWallets(wallets);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ saved: true, count: wallets.length }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}
