import { defineConfig } from 'vite';
import walletSaverPlugin from './vite-wallet-plugin.js';

export default defineConfig({
  plugins: [walletSaverPlugin()],
});
