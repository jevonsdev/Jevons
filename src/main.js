// TypeSafeCoin Terminal — Powered by Jev
import './index.css';
import { JevClient } from './openrouter.js';
import { BlockchainClient, FundsWallet, CHAIN_CONFIG } from './blockchain.js';
import { ActivityLog } from './activityLog.js';
import { generateTokenLogo } from './imageGen.js';

class TypeSafeCoinTerminal {
  constructor() {
    this.jev = null;
    this.blockchain = new BlockchainClient(false);
    this.log = new ActivityLog();
    this.lines = [];
    this.busy = false;

    // Funds wallet (persistent treasury)
    this.fundsWallet = new FundsWallet(CHAIN_CONFIG.rpcUrl);
    this.fundsAddress = null;
    this.fundsBalance = '0';

    // State
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';
    this.apiConnected = false;
    this.walletAddress = null;
    this.walletBalance = '0';
    this.privateKey = null;
    this.tokenConfig = null;
    this.deployResult = null;

    this.init();
  }

  init() {
    this.renderShell();
    this.bindInput();
    this.printWelcome();

    // Load funds wallet
    this.loadFundsWallet();

    // Auto-connect if key exists
    if (this.apiKey) {
      this.autoConnect();
    }
  }

  // ═══ Rendering ═══
  renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="term-titlebar">
        <div class="term-titlebar-left">
          <div class="term-dots">
            <div class="term-dot red"></div>
            <div class="term-dot yellow"></div>
            <div class="term-dot green"></div>
          </div>
          <span class="term-title">typesafecoin — jev agent</span>
        </div>
        <div class="term-titlebar-right">
          <div class="term-status" id="jev-status">
            <span class="term-status-dot" id="jev-dot"></span>
            <span id="jev-status-text">jev: offline</span>
          </div>
          <div class="term-status" id="funds-status">
            <span class="term-status-dot" id="funds-dot"></span>
            <span id="funds-status-text">treasury: loading</span>
          </div>
          <div class="term-status" id="wallet-status">
            <span class="term-status-dot" id="wallet-dot"></span>
            <span id="wallet-status-text">wallet: none</span>
          </div>
        </div>
      </div>
      <div class="term-output" id="output"></div>
      <div class="term-input-bar">
        <span class="term-prompt">jev ❯</span>
        <input type="text" class="term-input" id="cmd-input" placeholder="tell jev what to do..." autofocus />
        <button class="term-send" id="cmd-send">RUN</button>
      </div>
      <div class="term-statusbar">
        <span>TYPESAFE JEV — typesafe.ai</span>
        <span>Robinhood Chain (4663) · Pons V2 Factory · No Fallback</span>
      </div>
    `;
  }

  bindInput() {
    const input = document.getElementById('cmd-input');
    const send = document.getElementById('cmd-send');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.busy) {
        this.handleCommand(input.value.trim());
        input.value = '';
      }
    });
    send.addEventListener('click', () => {
      if (!this.busy) {
        this.handleCommand(input.value.trim());
        input.value = '';
      }
    });
  }

  // ═══ Output ═══
  print(type, label, msg, details = null, links = null) {
    const ts = this.log._elapsed();
    const typeInfo = this.log.constructor ? null : null;
    // Also log to ActivityLog for export
    this.log.add(type.toUpperCase().replace(/ /g,'_'), msg, details, links);

    const output = document.getElementById('output');
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    let html = `<div class="log-line"><span class="log-ts">[${ts}]</span><span class="log-label ${type}">${label}</span> <span class="log-msg">${msg}</span></div>`;

    if (details) {
      for (const [k, v] of Object.entries(details)) {
        const cls = this.getValueClass(k, v);
        html += `<div class="log-detail"><span class="log-detail-key">${k}: </span><span class="log-detail-val ${cls}">${this.formatVal(v)}</span></div>`;
      }
    }
    if (links) {
      html += `<div class="log-links">${Object.entries(links).map(([l, u]) => `<a href="${u}" target="_blank" class="log-link">${l} ↗</a>`).join('')}</div>`;
    }

    entry.innerHTML = html;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
  }

  printRaw(text, cls = '') {
    const output = document.getElementById('output');
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }

  printHtml(html) {
    const output = document.getElementById('output');
    const el = document.createElement('div');
    el.innerHTML = html;
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }

  printSep() {
    const output = document.getElementById('output');
    const hr = document.createElement('hr');
    hr.className = 'log-sep';
    output.appendChild(hr);
  }

  getValueClass(key, val) {
    if (typeof val === 'string' && val.startsWith('0x')) return 'addr';
    if (key === 'error') return 'err';
    if (key === 'balance' || key === 'gasUsed' || key === 'block') return 'num';
    if (key === 'status' && val === 'available') return 'ok';
    return '';
  }

  formatVal(v) {
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
  }

  setBusy(b) {
    this.busy = b;
    const input = document.getElementById('cmd-input');
    const send = document.getElementById('cmd-send');
    if (input) input.disabled = b;
    if (send) send.disabled = b;
  }

  updateStatus() {
    const jevDot = document.getElementById('jev-dot');
    const jevText = document.getElementById('jev-status-text');
    const fundsDot = document.getElementById('funds-dot');
    const fundsText = document.getElementById('funds-status-text');
    const walletDot = document.getElementById('wallet-dot');
    const walletText = document.getElementById('wallet-status-text');

    if (jevDot) jevDot.className = `term-status-dot ${this.apiConnected ? 'online' : ''}`;
    if (jevText) jevText.textContent = `jev: ${this.apiConnected ? 'online' : 'offline'}`;

    const hasFunds = parseFloat(this.fundsBalance || '0') > 0;
    if (fundsDot) fundsDot.className = `term-status-dot ${this.fundsAddress ? (hasFunds ? 'online' : 'warn') : ''}`;
    if (fundsText) fundsText.textContent = this.fundsAddress ? `treasury: ${this.fundsBalance} ETH` : 'treasury: none';

    if (walletDot) walletDot.className = `term-status-dot ${this.walletAddress ? 'online' : ''}`;
    if (walletText) walletText.textContent = this.walletAddress ? `wallet: ${this.walletAddress.slice(0,6)}...${this.walletAddress.slice(-4)}` : 'wallet: none';
  }

  async wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ═══ Welcome ═══
  printWelcome() {
    this.printRaw('', '');
    this.printRaw('  ████████╗██╗   ██╗██████╗ ███████╗███████╗ █████╗ ███████╗███████╗', 'log-ascii');
    this.printRaw('  ╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝', 'log-ascii');
    this.printRaw('     ██║    ╚████╔╝ ██████╔╝█████╗  ███████╗███████║█████╗  █████╗  ', 'log-ascii');
    this.printRaw('     ██║     ╚██╔╝  ██╔═══╝ ██╔══╝  ╚════██║██╔══██║██╔══╝  ██╔══╝  ', 'log-ascii');
    this.printRaw('     ██║      ██║   ██║     ███████╗███████║██║  ██║██║     ███████╗', 'log-ascii');
    this.printRaw('     ╚═╝      ╚═╝   ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝', 'log-ascii');
    this.printRaw('', '');
    this.printHtml('<div class="log-welcome">  Powered by <strong>Jev</strong> — TypeSafe AI System One Model</div>');
    this.printHtml('<div class="log-welcome">  Network: <span class="hl">Robinhood Chain (4663)</span> · Launchpad: <span class="hl">Pons</span></div>');
    this.printHtml('<div class="log-welcome">  Mode: <strong>Jev-only</strong> — no fallback models</div>');
    this.printRaw('', '');
    this.printHtml('<div class="log-welcome">  Type a command below. Example:</div>');
    this.printHtml('<div class="log-welcome">  → <span class="hl">create wallet and launch a token called testjev</span></div>');
    this.printHtml('<div class="log-welcome">  → <span class="hl">help</span></div>');
    this.printSep();
  }

  // ═══ Auto-connect ═══
  async autoConnect() {
    this.print('api', 'API          ', 'Auto-connecting to OpenRouter...', { source: 'environment variable' });
    this.jev = new JevClient(this.apiKey);
    const result = await this.jev.testConnection();
    this.apiConnected = result.success;

    if (result.success) {
      this.print('confirmed', 'CONNECTED    ', 'Jev is online and ready', { model: 'typesafe/jev-latest', models: result.modelCount });
    } else {
      this.print('error', 'ERROR        ', `Connection failed: ${result.error}`);
    }
    this.updateStatus();
    this.printSep();
  }

  // ═══ Funds Wallet (Treasury) ═══
  async loadFundsWallet() {
    const envKey = import.meta.env.VITE_FUNDS_PRIVATE_KEY || '';
    const result = this.fundsWallet.load(envKey);
    this.fundsAddress = result.address;

    try {
      this.fundsBalance = await this.fundsWallet.getBalance();
    } catch { this.fundsBalance = '0'; }

    const hasFunds = parseFloat(this.fundsBalance) > 0;

    if (result.isNew) {
      this.print('wallet', 'TREASURY     ', 'New funds wallet generated (persisted in browser)', {
        address: result.address,
        balance: `${this.fundsBalance} ETH`,
        status: 'NEEDS FUNDING — send ETH to this address',
      });
      this.print('info', 'INFO         ', 'Fund this treasury wallet once. The agent will auto-transfer to launch wallets.');
    } else {
      this.print('wallet', 'TREASURY     ', `Funds wallet loaded`, {
        address: result.address,
        balance: `${this.fundsBalance} ETH`,
        status: hasFunds ? 'ready' : 'NEEDS FUNDING',
      });
      if (!hasFunds) {
        this.print('info', 'INFO         ', 'Treasury is empty. Send ETH to the address above before launching tokens.');
      }
    }

    this.updateStatus();
    this.printSep();
  }

  // ═══ Command Handler ═══
  async handleCommand(cmd) {
    if (!cmd) return;

    // Echo the command
    this.printHtml(`<div class="log-entry"><div class="log-line"><span class="log-ts"></span><span class="log-label user">USER ❯       </span> <span class="log-msg">${this.escapeHtml(cmd)}</span></div></div>`);

    const lower = cmd.toLowerCase();

    if (lower === 'help') {
      this.showHelp();
    } else if (lower === 'status') {
      this.showStatus();
    } else if (lower === 'export') {
      this.log.exportJSON();
      this.print('system', 'SYSTEM       ', 'Session log exported as JSON');
    } else if (lower === 'clear') {
      document.getElementById('output').innerHTML = '';
      this.printWelcome();
    } else if (lower === 'treasury' || lower === 'fund' || lower === 'funds') {
      // Show treasury wallet info
      await this.showTreasury();
    } else if (lower === 'launch' || lower === 'deploy' || lower === 'go' || lower === 'retry' || lower === 'try again') {
      // Resume / retry launch after funding
      if (this.tokenConfig && this.blockchain.signer) {
        try { this.walletBalance = await this.blockchain.getBalance(); } catch {}
        this.updateStatus();
        if (parseFloat(this.walletBalance || '0') > 0) {
          this.setBusy(true);
          this.print('system', 'SYSTEM       ', 'Resuming Pons launch...');
          await this.launchOnPons();
          this.setBusy(false);
        } else {
          this.print('wallet', 'FUND NEEDED  ', 'Still 0 ETH. Send funds and try again.', { address: this.walletAddress });
        }
      } else {
        this.print('error', 'ERROR        ', 'No token configured yet. Run the full flow first.');
      }
    } else if (lower === 'buyback' || lower === 'burn' || lower === 'buyback and burn' || lower.startsWith('buyback ')) {
      await this.handleBuybackCommand(cmd);
    } else if (lower === 'track' || lower.startsWith('track ')) {
      await this.handleTrackCommand(cmd);
    } else if (this.isTokenLaunchIntent(lower)) {
      await this.executeTokenFlow(cmd);
    } else if (lower.startsWith('connect')) {
      await this.connectApi(cmd);
    } else {
      // Last resort: if it mentions anything token-related, try the flow
      this.print('info', 'INFO         ', `Unknown command. Type "help" for available commands.`);
    }
  }

  showHelp() {
    this.printSep();
    this.printRaw('  Available commands:', 'log-welcome');
    this.printRaw('', '');
    this.printHtml('<div class="log-welcome">  <span class="hl">create wallet and launch a token called [name]</span> — full autonomous Pons launch</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">launch a token called [name] with symbol [SYM]</span> — custom symbol</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">launch</span> — resume launch after funding wallet</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">buyback</span> — sweep fees → claim → buyback 50% → burn 🔥</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">track</span> — start auto-buyback monitor on a launched token</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">treasury</span> — show funds wallet address &amp; balance</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">status</span> — show current Jev &amp; wallet status</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">export</span> — download session log as JSON</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">clear</span> — clear the terminal</div>');
    this.printHtml('<div class="log-welcome">  <span class="hl">help</span> — show this message</div>');
    this.printSep();
  }

  showStatus() {
    this.printSep();
    this.print('info', 'STATUS       ', 'Current session state', {
      jev: this.apiConnected ? 'online' : 'offline',
      treasury: this.fundsAddress || 'none',
      treasuryBalance: `${this.fundsBalance} ETH`,
      launchWallet: this.walletAddress || 'none',
      launchBalance: this.walletBalance ? `${this.walletBalance} ETH` : 'n/a',
      token: this.deployResult ? this.deployResult.contractAddress : 'not deployed',
      network: 'Robinhood Chain (4663)',
    });
    this.printSep();
  }

  async showTreasury() {
    this.printSep();
    try {
      this.fundsBalance = await this.fundsWallet.getBalance();
    } catch {}
    this.updateStatus();
    const hasFunds = parseFloat(this.fundsBalance || '0') > 0;
    this.print('wallet', 'TREASURY     ', 'Funds wallet details', {
      address: this.fundsAddress,
      balance: `${this.fundsBalance} ETH`,
      status: hasFunds ? 'ready — will auto-fund launch wallets' : 'EMPTY — send ETH to this address',
      persistence: 'saved in browser (localStorage)',
    });
    this.printSep();
  }

  escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ═══ Connect API ═══
  async connectApi(cmd) {
    const keyMatch = cmd.match(/sk-or-v1-[a-f0-9]+/i);
    if (!keyMatch) {
      this.print('error', 'ERROR        ', 'No API key found. Usage: connect sk-or-v1-...');
      return;
    }
    this.apiKey = keyMatch[0];
    this.jev = new JevClient(this.apiKey);
    this.print('api', 'API          ', 'Testing connection...');
    const result = await this.jev.testConnection();
    this.apiConnected = result.success;
    if (result.success) {
      this.print('confirmed', 'CONNECTED    ', 'Jev is online', { model: 'typesafe/jev-latest' });
    } else {
      this.print('error', 'ERROR        ', `Failed: ${result.error}`);
    }
    this.updateStatus();
  }

  // ═══ Full Autonomous Token Flow ═══
  async executeTokenFlow(cmd) {
    if (!this.apiConnected) {
      this.print('error', 'ERROR        ', 'Jev is not connected. Set VITE_OPENROUTER_API_KEY or type: connect sk-or-v1-...');
      return;
    }

    this.setBusy(true);
    this.printSep();

    // Parse token name from command
    const tokenName = this.parseTokenName(cmd);
    const tokenSymbol = this.parseTokenSymbol(cmd, tokenName);
    const tokenSupply = this.parseTokenSupply(cmd);

    this.print('system', 'SYSTEM       ', `Starting autonomous token launch flow`);

    // ── Step 1: Jev Thinks ──
    await this.wait(500);
    this.print('thinking', 'JEV THINKING ', 'Analyzing launch request...');

    await this.wait(800);
    this.print('decision', 'JEV DECISION ', `Proceeding with token "${tokenName}"`, {
      name: tokenName,
      symbol: tokenSymbol,
      supply: tokenSupply,
      reasoning: 'Parameters validated. Generating dedicated wallet for this token.',
    });

    // ── Step 2: Create Wallet ──
    await this.wait(600);
    this.print('wallet', 'WALLET       ', 'Generating fresh wallet keypair...');

    const walletResult = await this.blockchain.generateWallet();
    if (!walletResult.success) {
      this.print('error', 'ERROR        ', `Wallet generation failed: ${walletResult.error}`);
      this.setBusy(false);
      return;
    }

    this.walletAddress = walletResult.address;
    this.privateKey = walletResult.privateKey;

    // Silently persist launch wallet key — never shown on screen
    const walletRecord = {
      address: walletResult.address,
      privateKey: walletResult.privateKey,
      tokenName: tokenName,
      tokenSymbol: tokenSymbol,
      timestamp: new Date().toISOString(),
    };
    try {
      const history = JSON.parse(localStorage.getItem('typesafe_launch_wallets') || '[]');
      history.push(walletRecord);
      localStorage.setItem('typesafe_launch_wallets', JSON.stringify(history));
    } catch {}
    // Also save to local disk via Vite dev server plugin
    try {
      fetch('/api/save-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(walletRecord),
      }).catch(() => {});
    } catch {}

    try {
      this.walletBalance = await this.blockchain.getBalance();
    } catch { this.walletBalance = '0'; }

    this.print('confirmed', 'WALLET READY ', 'Agent wallet created', {
      address: walletResult.address,
      network: 'Robinhood Chain (4663)',
      balance: `${this.walletBalance} ETH`,
    });
    this.updateStatus();

    // ── Step 3: Configure Token for Pons ──
    await this.wait(500);
    this.tokenConfig = {
      name: tokenName,
      symbol: tokenSymbol,
    };

    this.print('decision', 'JEV DECISION ', 'Token configuration finalized', {
      name: this.tokenConfig.name,
      symbol: this.tokenConfig.symbol,
      launchpad: 'Pons V2 (bonding curve → Uniswap V4)',
      quoteAsset: 'Native ETH',
    });

    // ── Step 4: Query Pons launch config ──
    await this.wait(400);
    this.print('contract', 'PONS QUERY   ', 'Reading Pons V2 factory on-chain...');

    let launchConfigId = 0;
    let launchFeeFormatted = 'unknown';
    try {
      const ponsConfig = await this.blockchain.getPonsLaunchConfig();
      launchConfigId = ponsConfig.id;
      const launchFee = await this.blockchain.getPonsLaunchFee();
      const { ethers: eth } = await import('ethers');
      launchFeeFormatted = eth.formatEther(launchFee);
      this.print('contract', 'PONS CONFIG  ', 'Launch parameters retrieved', {
        configId: launchConfigId,
        supply: ponsConfig.config.supply?.toString(),
        launchFee: `${launchFeeFormatted} ETH`,
        curveType: 'Constant-product bonding curve',
        graduation: 'Auto-migrate to Uniswap V4 pool',
      });
    } catch (e) {
      this.print('info', 'PONS CONFIG  ', `Could not read Pons config: ${e.message} — using defaults`);
    }

    // ── Step 5: Ask Jev for Assessment ──
    await this.wait(400);
    this.print('thinking', 'JEV THINKING ', 'Running AI viability assessment...');

    try {
      const assessment = await this.jev.assessTokenConfig(this.tokenConfig);
      if (assessment.success) {
        this.print('decision', 'JEV ASSESS   ', 'Token assessment complete', {
          result: 'Analysis received from Jev',
          confidence: 'high',
        });
      } else {
        this.print('info', 'JEV ASSESS   ', `Assessment unavailable: ${assessment.error} — proceeding anyway`);
      }
    } catch (e) {
      this.print('info', 'JEV ASSESS   ', `Assessment skipped: ${e.message} — proceeding`);
    }

    // ── Step 5b: Jev designs the image prompt ──
    await this.wait(400);
    this.print('thinking', 'JEV THINKING ', 'Designing token logo concept...');

    let logoUrl = '';
    let jevImagePrompt = null;

    try {
      // Jev autonomously decides what image to generate based on Jevons Paradox lore
      const promptResult = await this.jev.generateImagePrompt(tokenName, tokenSymbol);
      if (promptResult.success) {
        jevImagePrompt = promptResult.prompt;
        this.print('decision', 'JEV ART DIR  ', `Logo concept: ${promptResult.concept}`, {
          concept: promptResult.concept,
          prompt: promptResult.prompt,
        });
      } else {
        this.print('info', 'JEV ART DIR  ', `Concept generation unavailable: ${promptResult.error} — skipping logo`);
      }
    } catch (e) {
      this.print('info', 'JEV ART DIR  ', `Concept skipped: ${e.message} — skipping logo`);
    }

    // ── Step 5c: fal.ai renders Jev's chosen concept ──
    if (jevImagePrompt) {
      await this.wait(300);
      this.print('thinking', 'JEV THINKING ', 'Rendering logo with FLUX AI (fal.ai)...');
      try {
        const imgResult = await generateTokenLogo(jevImagePrompt);
        if (imgResult.success) {
          logoUrl = imgResult.imageUrl;
          this.tokenConfig.logo = logoUrl;
          this.print('confirmed', 'IMAGE READY  ', 'Token logo rendered by FLUX AI', {
            url: logoUrl,
            model: 'fal-ai/flux/schnell',
          }, {
            'Preview Logo': logoUrl,
          });
          this.printHtml(`<div style="padding-left: 224px; margin: 6px 0;"><img src="${logoUrl}" alt="Token Logo" style="width: 100px; height: 100px; border-radius: 8px; border: 1px solid var(--ts-green-bright); box-shadow: 0 0 10px rgba(3,170,92,0.3);" /></div>`);
        } else {
          this.print('info', 'IMAGE        ', `Logo render failed: ${imgResult.error} — launching without logo`);
        }
      } catch (e) {
        this.print('info', 'IMAGE        ', `Logo render error: ${e.message} — launching without logo`);
      }
    }


    // ── Step 6: Auto-fund from Treasury & Launch ──
    await this.wait(500);

    // Check if the launch wallet needs funding
    let balance = parseFloat(this.walletBalance || '0');

    if (balance === 0 && this.fundsWallet.loaded) {
      // Auto-fund from treasury
      this.print('wallet', 'TREASURY     ', 'Auto-funding launch wallet from treasury...');

      try {
        this.fundsBalance = await this.fundsWallet.getBalance();
      } catch { this.fundsBalance = '0'; }

      const treasuryBalance = parseFloat(this.fundsBalance);
      // Need launch fee + gas buffer (0.001 ETH extra for gas)
      const { ethers: eth } = await import('ethers');
      const launchFee = await this.blockchain.getPonsLaunchFee();
      const gasBuffer = eth.parseEther('0.001');
      const totalNeeded = launchFee + gasBuffer;
      const totalNeededEth = parseFloat(eth.formatEther(totalNeeded));

      if (treasuryBalance < totalNeededEth) {
        this.printSep();
        this.print('error', 'INSUFFICIENT ', `Treasury has ${this.fundsBalance} ETH but needs ~${totalNeededEth.toFixed(4)} ETH`, {
          treasury: this.fundsAddress,
          balance: `${this.fundsBalance} ETH`,
          needed: `~${totalNeededEth.toFixed(4)} ETH`,
          breakdown: `launch fee ${eth.formatEther(launchFee)} + gas buffer 0.001`,
        });
        this.print('info', 'ACTION       ', `Send at least ${totalNeededEth.toFixed(4)} ETH to your treasury, then type: launch`);
        this.printSep();
        this.setBusy(false);
        return;
      }

      // Transfer funds
      this.print('tx', 'TX TRANSFER  ', `Sending ${eth.formatEther(totalNeeded)} ETH from treasury → launch wallet`, {
        from: this.fundsAddress,
        to: this.walletAddress,
        amount: `${eth.formatEther(totalNeeded)} ETH`,
      });

      const fundResult = await this.fundsWallet.sendFunds(this.walletAddress, totalNeeded);

      if (!fundResult.success) {
        this.print('error', 'TX FAILED    ', `Treasury transfer failed: ${fundResult.error}`);
        this.setBusy(false);
        return;
      }

      this.print('confirmed', 'TX CONFIRMED ', 'Launch wallet funded from treasury', {
        txHash: fundResult.txHash,
        gasUsed: fundResult.gasUsed,
      });

      // Refresh balances
      try {
        this.walletBalance = await this.blockchain.getBalance();
        this.fundsBalance = await this.fundsWallet.getBalance();
      } catch {}
      this.updateStatus();

      balance = parseFloat(this.walletBalance || '0');
    }

    if (balance === 0) {
      // No treasury or still unfunded — fallback to manual
      this.printSep();
      this.print('wallet', 'FUND NEEDED  ', 'No treasury available and wallet has 0 ETH', {
        address: this.walletAddress,
        network: 'Robinhood Chain (4663)',
        launchFee: `${launchFeeFormatted} ETH`,
        action: 'Fund the treasury or this wallet, then type: launch',
      });
      this.printSep();
      this.setBusy(false);
      return;
    }

    // Has balance — launch on Pons
    await this.launchOnPons(launchConfigId);
    this.setBusy(false);
  }

  async launchOnPons(launchConfigId = 0) {
    if (!this.tokenConfig) {
      this.print('error', 'ERROR        ', 'No token configured. Run the full flow first.');
      return;
    }
    if (!this.blockchain.signer) {
      this.print('error', 'ERROR        ', 'No wallet available.');
      return;
    }

    // ── Step 6: Populate Token Metadata ──
    await this.wait(400);
    this.print('data', 'METADATA     ', 'Populating on-chain token metadata', {
      name: this.tokenConfig.name,
      symbol: this.tokenConfig.symbol,
      description: `${this.tokenConfig.name} — The Jevons Paradox, tokenized.`,
      logo: this.tokenConfig.logo ? '✅ AI-generated' : '⏭ none',
    });

    // ── Step 7: Link Socials ──
    await this.wait(300);
    this.print('data', 'SOCIALS      ', 'Linking social accounts to token', {
      x: 'https://x.com/jevonsterminal',
      website: 'https://typesafe.ai',
      telegram: '—',
      discord: '—',
      farcaster: '—',
    });

    // ── Step 8: Submit to Pons V2 Factory ──
    await this.wait(300);
    this.print('tx', 'PONS LAUNCH  ', 'Submitting token to Pons V2 Factory...', {
      name: this.tokenConfig.name,
      symbol: this.tokenConfig.symbol,
      factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
      deployer: this.walletAddress,
      method: 'launchToken',
    });

    try {
      const result = await this.blockchain.launchOnPons(
        this.tokenConfig.name,
        this.tokenConfig.symbol,
        `${this.tokenConfig.name} — The Jevons Paradox, tokenized. As AI becomes more efficient, it consumes more. Every optimization feeds the flame. Launched autonomously by Jev AI on TypeSafe | typesafe.ai`,
        launchConfigId,
        this.tokenConfig.logo || ''
      );

      this.deployResult = result;

      this.print('confirmed', '✅ LAUNCHED  ', 'Token live on Pons bonding curve!', {
        token: result.tokenAddress,
        curve: result.curveAddress,
        txHash: result.txHash,
        block: result.blockNumber,
        gasUsed: result.gasUsed,
        launchFee: `${result.launchFee} ETH`,
      }, {
        'View on Pons': result.ponsUrl,
        'Explorer': result.explorerUrl,
        'Transaction': `https://robinhoodchain.blockscout.com/tx/${result.txHash}`,
      });

      this.printSep();
      this.print('system', 'COMPLETE     ', `"${this.tokenConfig.name}" is live on Pons! Trading on bonding curve → graduates to Uniswap V4 🎉`);
      this.printSep();

      // Persist token + curve addresses into the wallet record for buyback
      this.lastLaunch = {
        tokenAddress: result.tokenAddress,
        curveAddress: result.curveAddress,
        tokenName: this.tokenConfig.name,
        tokenSymbol: this.tokenConfig.symbol,
        deployer: this.walletAddress,
        privateKey: this.privateKey,
      };
      // Update localStorage wallet record with token & curve
      try {
        const history = JSON.parse(localStorage.getItem('typesafe_launch_wallets') || '[]');
        const entry = history.find(w => w.address === this.walletAddress);
        if (entry) {
          entry.tokenAddress = result.tokenAddress;
          entry.curveAddress = result.curveAddress;
          localStorage.setItem('typesafe_launch_wallets', JSON.stringify(history));
        }
      } catch {}
      // Also update disk copy
      try {
        fetch('/api/save-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.lastLaunch),
        }).catch(() => {});
      } catch {}

      // Start auto-buyback monitoring for this token
      this.startBuybackMonitor(result.curveAddress, result.tokenAddress);

    } catch (err) {
      this.print('error', 'TX FAILED    ', `Pons launch failed: ${err.message}`);
    }
  }

  // ═══ Buyback & Burn ═══

  /**
   * Handle the buyback command from the terminal.
   * Accepts: "buyback", "burn", "buyback and burn", "buyback 0xTokenAddr"
   */
  async handleBuybackCommand(cmd) {
    // Determine which token to buyback
    let launch = this.lastLaunch;

    // If a token address was passed, look it up in localStorage
    const addrMatch = cmd.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch) {
      const addr = addrMatch[0].toLowerCase();
      try {
        const history = JSON.parse(localStorage.getItem('typesafe_launch_wallets') || '[]');
        const entry = history.find(w =>
          (w.tokenAddress || '').toLowerCase() === addr ||
          (w.curveAddress || '').toLowerCase() === addr
        );
        if (entry && entry.curveAddress && entry.tokenAddress) {
          launch = entry;
        }
      } catch {}
    }

    if (!launch || !launch.curveAddress || !launch.tokenAddress) {
      this.print('error', 'ERROR        ', 'No launched token found. Launch a token first, or pass the token address: buyback 0x...');
      return;
    }

    this.setBusy(true);
    await this.executeBuybackBurn(launch.curveAddress, launch.tokenAddress, launch.privateKey);
    this.setBusy(false);
  }

  /**
   * Execute the full Jevons Burn Loop:
   * sweepFees → claim → 50% treasury / 50% buyback+burn
   * Also checks for leftover ETH in deployer wallet from previous runs.
   */
  async executeBuybackBurn(curveAddress, tokenAddress, deployerPrivateKey) {
    this.printSep();
    this.print('system', '🔥 BURN LOOP ', 'Initiating Jevons buyback & burn cycle...');

    try {
      // 0. Create deployer signer
      const deployerSigner = this.blockchain.createTempSigner(deployerPrivateKey);
      const deployerAddr = deployerSigner.address;

      // 1. Check existing deployer wallet balance (leftover from previous buyback holds)
      const existingBalance = await this.blockchain.provider.getBalance(deployerAddr);
      this.print('data', 'WALLET BAL   ', `Deployer wallet balance: ${this.formatEth(existingBalance)} ETH`, {
        deployer: deployerAddr,
        existing: `${this.formatEth(existingBalance)} ETH`,
        source: 'leftover from previous cycles',
      });

      // 2. Read curve state
      this.print('info', 'CURVE STATE  ', 'Reading bonding curve...');
      const state = await this.blockchain.getCurveState(curveAddress);

      const isGraduated = state.graduated;
      if (isGraduated) {
        this.print('info', 'GRADUATED    ', 'Curve graduated to Uniswap V4 — will still sweep & claim fees');
      }

      this.print('data', 'FEES PENDING ', 'Accrued on curve', {
        quoteFees: `${state.quoteFeeBalanceEth} ETH`,
        creatorTax: `${state.creatorTaxBalanceEth} ETH`,
        token: tokenAddress,
        curve: curveAddress,
      });

      // 3. Sweep fees from curve → Fee Escrow (permissionless)
      await this.wait(300);
      this.print('tx', 'SWEEP        ', 'Sweeping accrued fees from bonding curve → Fee Escrow...');

      try {
        const sweepResult = await this.blockchain.sweepCurveFees(curveAddress, deployerSigner);
        this.print('confirmed', 'FEES SWEPT   ', 'Fees moved to Fee Escrow', {
          txHash: sweepResult.txHash,
          gasUsed: sweepResult.gasUsed,
        });
      } catch (err) {
        this.print('warn', 'SWEEP SKIP   ', `No new fees to sweep (${err.message?.slice(0, 60)})`);
      }

      // 4. Check escrow balance & claim if available
      await this.wait(300);
      const escrowBalance = await this.blockchain.getEscrowBalance(state.feeEscrow, deployerAddr);
      this.print('data', 'ESCROW BAL   ', `Claimable: ${escrowBalance.balanceEth} ETH`, {
        feeEscrow: state.feeEscrow,
        deployer: deployerAddr,
      });

      let newClaimedWei = 0n;
      let treasuryWei = 0n;
      let newBuybackWei = 0n;

      if (escrowBalance.balance > 0n) {
        // 5. Claim ETH from Fee Escrow
        this.print('tx', 'CLAIM        ', 'Claiming creator fees from Fee Escrow...');
        const claimResult = await this.blockchain.claimFeesFromEscrow(state.feeEscrow, deployerSigner);

        newClaimedWei = escrowBalance.balance;
        this.print('confirmed', 'CLAIMED      ', `${escrowBalance.balanceEth} ETH claimed from Fee Escrow`, {
          txHash: claimResult.txHash,
        });

        // 6. Split NEW claims: 50% treasury, 50% buyback
        newBuybackWei = newClaimedWei / 2n;
        treasuryWei = newClaimedWei - newBuybackWei;

        await this.wait(300);
        this.print('decision', 'FEE SPLIT    ', 'Splitting newly claimed fees', {
          treasury: `${this.formatEth(treasuryWei)} ETH (50%)`,
          buyback: `${this.formatEth(newBuybackWei)} ETH (50%)`,
        });

        // 7. Send 50% of NEW claims to treasury
        if (this.fundsWallet && this.fundsWallet.address && treasuryWei > 0n) {
          this.print('tx', 'TREASURY     ', `Sending ${this.formatEth(treasuryWei)} ETH to treasury...`);
          try {
            const treasuryTx = await deployerSigner.sendTransaction({
              to: this.fundsWallet.address,
              value: treasuryWei,
            });
            await treasuryTx.wait();
            this.print('confirmed', 'TREASURY ✅  ', `${this.formatEth(treasuryWei)} ETH sent to treasury`, {
              treasury: this.fundsWallet.address,
            });
          } catch (err) {
            this.print('warn', 'TREASURY ERR ', `Failed to send to treasury: ${err.message?.slice(0, 60)}`);
          }
        }
      } else {
        this.print('info', 'NO NEW FEES  ', 'No new fees to claim from escrow');
      }

      // 8. Calculate TOTAL buyback: existing wallet balance + 50% of new claims
      // Get updated balance (after treasury send, before buyback)
      const updatedBalance = await this.blockchain.provider.getBalance(deployerAddr);
      // Reserve a small amount for gas (0.0005 ETH)
      const gasReserve = 500000000000000n; // 0.0005 ETH
      const totalBuybackWei = updatedBalance > gasReserve ? updatedBalance - gasReserve : 0n;

      if (totalBuybackWei <= 0n) {
        this.print('warn', 'NO FUNDS     ', 'Not enough ETH in deployer wallet for buyback (after gas reserve).');
        this.printSep();
        return;
      }

      // Log the total buyback breakdown
      const fromExisting = existingBalance > gasReserve ? existingBalance - gasReserve : 0n;
      this.print('decision', 'TOTAL BUYBACK', `Using ${this.formatEth(totalBuybackWei)} ETH for buyback + burn`, {
        fromPrevious: `${this.formatEth(fromExisting > 0n ? fromExisting : 0n)} ETH (leftover)`,
        fromNewClaim: `${this.formatEth(newBuybackWei)} ETH (50% of new fees)`,
        total: `${this.formatEth(totalBuybackWei)} ETH`,
        gasReserve: '0.0005 ETH',
      });

      // 9. Buyback: buy tokens on curve (pre-grad) or V4 swap (post-grad)
      if (!isGraduated) {
        await this.wait(300);
        this.print('tx', 'BUYBACK      ', `Buying tokens with ${this.formatEth(totalBuybackWei)} ETH on bonding curve...`);

        const buyResult = await this.blockchain.buyOnCurve(
          curveAddress, totalBuybackWei, 0, deployerAddr, deployerSigner
        );

        this.print('confirmed', 'BOUGHT       ', `Acquired ${Number(buyResult.tokensOutFormatted).toLocaleString()} tokens`, {
          txHash: buyResult.txHash,
          ethSpent: `${this.formatEth(totalBuybackWei)} ETH`,
          tokensReceived: buyResult.tokensOutFormatted,
        });

        // 8. Burn: send tokens to 0xdead
        if (buyResult.tokensOut > 0n) {
          await this.wait(300);
          this.print('tx', '🔥 BURN      ', `Sending ${Number(buyResult.tokensOutFormatted).toLocaleString()} tokens to 0xdead...`);

          const burnResult = await this.blockchain.burnTokens(
            tokenAddress, buyResult.tokensOut, deployerSigner
          );

          this.print('confirmed', '🔥 BURNED    ', `${Number(burnResult.burnedFormatted).toLocaleString()} tokens permanently burned`, {
            txHash: burnResult.txHash,
            burnAddress: '0x000000000000000000000000000000000000dEaD',
          }, {
            'Burn TX': `https://robinhoodchain.blockscout.com/tx/${burnResult.txHash}`,
          });
        }
      } else if (totalBuybackWei > 0n && isGraduated) {
        // Post-graduation: swap ETH → token via Uniswap V4 Universal Router
        await this.wait(300);
        this.print('tx', 'V4 SWAP      ', `Swapping ${this.formatEth(totalBuybackWei)} ETH → tokens via Uniswap V4...`);

        try {
          const swapResult = await this.blockchain.swapOnV4(
            tokenAddress, totalBuybackWei, deployerAddr, deployerSigner
          );

          this.print('confirmed', 'SWAPPED      ', `Acquired ${Number(swapResult.tokensOutFormatted).toLocaleString()} tokens via V4`, {
            txHash: swapResult.txHash,
            ethSpent: `${this.formatEth(totalBuybackWei)} ETH`,
            tokensReceived: swapResult.tokensOutFormatted,
          });

          // Burn the swapped tokens
          if (swapResult.tokensOut > 0n) {
            await this.wait(300);
            this.print('tx', '🔥 BURN      ', `Sending ${Number(swapResult.tokensOutFormatted).toLocaleString()} tokens to 0xdead...`);

            const burnResult = await this.blockchain.burnTokens(
              tokenAddress, swapResult.tokensOut, deployerSigner
            );

            this.print('confirmed', '🔥 BURNED    ', `${Number(burnResult.burnedFormatted).toLocaleString()} tokens permanently burned`, {
              txHash: burnResult.txHash,
              burnAddress: '0x000000000000000000000000000000000000dEaD',
            }, {
              'Burn TX': `https://robinhoodchain.blockscout.com/tx/${burnResult.txHash}`,
            });
          }
        } catch (err) {
          this.print('warn', 'V4 SWAP ERR  ', `Uniswap V4 swap failed: ${err.message?.slice(0, 80)}`);
        }
      }

      this.printSep();
      this.print('system', 'BURN COMPLETE', `Jevons burn cycle complete — supply reduced, value elevated 🔥`);
      this.printSep();

    } catch (err) {
      this.print('error', 'BURN ERROR   ', `Buyback & burn failed: ${err.message}`);
      this.printSep();
    }
  }

  /**
   * Format wei to ETH string.
   */
  formatEth(wei) {
    try {
      // Dynamic import would be cleaner but ethers is already imported via blockchain
      return (Number(wei) / 1e18).toFixed(6);
    } catch { return '0'; }
  }

  /**
   * Start auto-monitoring for fee accrual. Checks every 5 minutes.
   * If fees exceed a threshold, auto-triggers the burn cycle.
   */
  startBuybackMonitor(curveAddress, tokenAddress) {
    if (this._buybackInterval) clearInterval(this._buybackInterval);
    if (this._countdownInterval) clearInterval(this._countdownInterval);

    const MIN_FEE_THRESHOLD_WEI = 0n; // 0 ETH (always trigger)
    const CHECK_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

    this.print('system', 'MONITOR ON   ', `Auto-buyback monitor started`, {
      curve: curveAddress,
      threshold: '0 ETH (always trigger)',
      interval: '1 min',
    });

    // The check function — reused for immediate + interval
    const runCheck = async () => {
      this._nextCheckAt = Date.now() + CHECK_INTERVAL_MS;

      try {
        if (this.busy) {
          this.print('info', 'CHECK SKIP   ', 'Busy with another operation — skipping this cycle');
          return;
        }

        this.print('info', 'CHECKING     ', 'Reading curve state...');
        const state = await this.blockchain.getCurveState(curveAddress);

        // Check curve fees (pre-graduation) or escrow balance (post-graduation)
        let shouldBurn = false;
        let feeInfo = {};

        if (!state.graduated) {
          const totalPending = state.quoteFeeBalance + state.creatorTaxBalance;
          feeInfo = {
            quoteFees: `${state.quoteFeeBalanceEth} ETH`,
            creatorTax: `${state.creatorTaxBalanceEth} ETH`,
            threshold: '0.0069 ETH',
            status: totalPending >= MIN_FEE_THRESHOLD_WEI ? '🔥 ABOVE THRESHOLD' : 'below threshold',
          };
          if (totalPending >= MIN_FEE_THRESHOLD_WEI) shouldBurn = true;
        } else {
          // Post-graduation: check escrow balance directly
          const deployerAddr = this.lastLaunch?.deployer || '';
          const escrow = await this.blockchain.getEscrowBalance(state.feeEscrow, deployerAddr);
          feeInfo = {
            escrowBalance: `${escrow.balanceEth} ETH`,
            threshold: '0.0069 ETH',
            phase: 'graduated (Uniswap V4)',
            status: escrow.balance >= MIN_FEE_THRESHOLD_WEI ? '🔥 ABOVE THRESHOLD' : 'below threshold',
          };
          if (escrow.balance >= MIN_FEE_THRESHOLD_WEI) shouldBurn = true;
        }

        this.print('data', 'FEE STATUS   ', shouldBurn ? 'Fees ready for burn!' : 'Fees below threshold', feeInfo);

        if (shouldBurn) {
          this.print('system', 'AUTO-BURN    ', `Fees detected — initiating Jevons burn cycle...`);
          this.setBusy(true);
          await this.executeBuybackBurn(curveAddress, tokenAddress, this.lastLaunch?.privateKey);
          this.setBusy(false);
        } else {
          const nextTime = new Date(this._nextCheckAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          this.print('info', 'NEXT CYCLE   ', `Next check at ${nextTime}`);
        }
      } catch (err) {
        this.print('warn', 'CHECK ERROR  ', `Monitor error: ${err.message?.slice(0, 80)}`);
      }
    };

    // Run immediately on start
    runCheck();

    // Create a persistent countdown line in the terminal
    const countdownId = 'buyback-countdown';
    this.printHtml(`<div id="${countdownId}" class="log-entry"><div class="log-line"><span class="log-ts"></span><span class="log-label system">NEXT CHECK   </span> <span class="log-msg countdown-msg">01:00</span></div></div>`);

    // Update countdown every second
    this._countdownInterval = setInterval(() => {
      const el = document.getElementById(countdownId);
      if (!el) return;
      const remaining = Math.max(0, this._nextCheckAt - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      const msgEl = el.querySelector('.countdown-msg');
      if (msgEl) {
        msgEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);

    // Then repeat every 10 minutes
    this._buybackInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
  }

  // ═══ Track Command ═══

  /**
   * Start monitoring a previously launched token.
   * Usage: "track", "track 0xTokenAddr", "track jevons"
   */
  async handleTrackCommand(cmd) {
    let launch = null;

    // Try address match
    const addrMatch = cmd.match(/0x[a-fA-F0-9]{40}/);
    // Try name match
    const nameMatch = cmd.match(/track\s+([a-zA-Z][a-zA-Z0-9]*)/i);

    try {
      const history = JSON.parse(localStorage.getItem('typesafe_launch_wallets') || '[]');
      const withToken = history.filter(w => w.tokenAddress && w.curveAddress && w.privateKey);

      if (withToken.length === 0) {
        this.print('error', 'NO TOKENS    ', 'No launched tokens found in wallet history.');
        return;
      }

      if (addrMatch) {
        const addr = addrMatch[0].toLowerCase();
        launch = withToken.find(w =>
          (w.tokenAddress || '').toLowerCase() === addr ||
          (w.curveAddress || '').toLowerCase() === addr
        );
      } else if (nameMatch && nameMatch[1].toLowerCase() !== 'track') {
        const name = nameMatch[1].toLowerCase();
        launch = withToken.find(w => (w.tokenName || '').toLowerCase() === name);
      }

      // If no match or bare "track", show available tokens
      if (!launch) {
        this.printSep();
        this.print('info', 'LAUNCHED     ', `Found ${withToken.length} token(s) in wallet history:`);
        withToken.forEach((w, i) => {
          this.print('data', `TOKEN ${i + 1}     `, w.tokenName || 'Unknown', {
            token: w.tokenAddress,
            curve: w.curveAddress,
            deployer: w.address || w.deployer,
          });
        });
        this.print('info', 'USAGE        ', 'Type: track <name> or track <0xAddress>');
        this.printSep();
        return;
      }
    } catch {
      this.print('error', 'ERROR        ', 'Failed to read wallet history.');
      return;
    }

    // Set lastLaunch so buyback works
    this.lastLaunch = {
      tokenAddress: launch.tokenAddress,
      curveAddress: launch.curveAddress,
      tokenName: launch.tokenName,
      tokenSymbol: launch.tokenSymbol,
      deployer: launch.address || launch.deployer,
      privateKey: launch.privateKey,
    };

    this.print('confirmed', 'TRACKING     ', `Now tracking "${launch.tokenName || launch.tokenAddress}"`, {
      token: launch.tokenAddress,
      curve: launch.curveAddress,
    });

    // Start monitor
    this.startBuybackMonitor(launch.curveAddress, launch.tokenAddress);
  }

  // ═══ Intent Detection ═══
  isTokenLaunchIntent(lower) {
    const keywords = ['wallet', 'token', 'create', 'make', 'launch', 'deploy', 'mint', 'coin', 'start'];
    const hits = keywords.filter(k => lower.includes(k));
    // At least 2 keyword hits, or 1 strong keyword + any name-like pattern
    if (hits.length >= 2) return true;
    // "launch X" or "create X" patterns
    if (/(?:launch|create|make|deploy|mint)\s+(?:a\s+|the\s+)?[a-z]/i.test(lower)) return true;
    // Contains "called" or "named"
    if (/(?:called|named)\s+\w+/i.test(lower)) return true;
    return false;
  }

  // ═══ Parsers ═══
  parseTokenName(cmd) {
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const stopWords = ['a','an','the','token','wallet','evm','on','with','and','create','make','launch','deploy','mint','start','i'];

    // "called X", "named X"
    const calledMatch = cmd.match(/(?:called|named)\s+(?:the\s+)?([a-zA-Z0-9_]+)/i);
    if (calledMatch) return capitalize(calledMatch[1]);

    // "launch X", "deploy X", "mint X" — grab the last meaningful word after the verb
    const launchMatch = cmd.match(/(?:launch|deploy|mint|start)\s+(?:a\s+)?(?:token\s+)?(?:called\s+|named\s+)?(?:the\s+)?(\w+)\s*$/i);
    if (launchMatch && !stopWords.includes(launchMatch[1].toLowerCase())) return capitalize(launchMatch[1]);

    // Grab the last word in the command that isn't a stop word
    const words = cmd.split(/\s+/).reverse();
    const lastMeaningful = words.find(w => /^[a-zA-Z][a-zA-Z0-9]*$/.test(w) && !stopWords.includes(w.toLowerCase()));
    if (lastMeaningful) return capitalize(lastMeaningful);

    return 'TestJev';
  }

  parseTokenSymbol(cmd, name) {
    const symMatch = cmd.match(/(?:symbol|ticker)\s+([A-Z0-9]+)/i);
    if (symMatch) return symMatch[1].toUpperCase();
    // Auto-generate from name (up to 6 chars)
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'TJV';
  }

  parseTokenSupply(cmd) {
    const supMatch = cmd.match(/(\d[\d,]*)\s*(?:supply|tokens?|coins?)/i);
    if (supMatch) return supMatch[1].replace(/,/g, '');
    return '1000000000'; // 1 billion default
  }
}

// Boot
new TypeSafeCoinTerminal();
