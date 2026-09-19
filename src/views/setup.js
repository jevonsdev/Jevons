export function renderSetupView(app) {
  const state = app.state;
  const jevReady = state.apiConnected;

  return `
    <div class="view">
      <div class="container">
        <div class="mb-lg" style="max-width: 640px;">
          <h1>Let <span class="text-gradient-pink">Jev</span> Launch Your Token</h1>
          <p class="text-secondary mt-md" style="font-family: var(--font-mono); font-size: 0.85rem; letter-spacing: -0.01em;">
            Jev autonomously creates a wallet, configures your token, and deploys it on Pons (Robinhood Chain). You just watch.
          </p>
        </div>

        <div class="dashboard-grid">
          <!-- Jev Connection Card -->
          <div class="card">
            <div class="card-header">
              <h3><span class="icon">🤖</span> Jev AI Connection</h3>
              ${state.apiConnected
                ? '<span class="status-badge connected"><span class="status-dot"></span>Online</span>'
                : '<span class="status-badge"><span class="status-dot"></span>Offline</span>'}
            </div>
            ${state.apiConnected ? `
              <div class="ai-decision">
                <div class="ai-decision-question">Status</div>
                <div class="ai-decision-answer positive">
                  ✓ Jev is connected and ready
                </div>
              </div>
              <div class="flex gap-sm mt-md">
                <button class="btn btn-secondary btn-sm" id="btn-disconnect-api">Disconnect</button>
                <button class="btn btn-ghost btn-sm" id="btn-test-api">Re-test</button>
              </div>
            ` : `
              <div class="form-group mb-lg">
                <label class="form-label" for="api-key-input">OpenRouter API Key</label>
                <input type="password" id="api-key-input" class="form-input" placeholder="sk-or-v1-..." value="${state.apiKey ? '••••••••' + state.apiKey.slice(-8) : ''}" />
                <span class="form-hint">Your key stays local. Only used to call Jev via OpenRouter.</span>
              </div>
              <button class="btn btn-primary" id="btn-connect-api">Connect to Jev</button>
            `}
            ${state.apiTestResult && !state.apiConnected ? `
              <div class="mt-md">
                <div class="ai-decision">
                  <div class="ai-decision-question">Connection Error</div>
                  <div class="ai-decision-answer negative">✗ ${state.apiTestResult.error}</div>
                </div>
              </div>` : ''}
          </div>

          <!-- Agent Wallet Card -->
          <div class="card">
            <div class="card-header">
              <h3><span class="icon">👛</span> Agent Wallet</h3>
              ${state.walletConnected
                ? '<span class="status-badge connected"><span class="status-dot"></span>Created</span>'
                : '<span class="status-badge"><span class="status-dot"></span>Pending</span>'}
            </div>
            ${state.walletConnected ? `
              <div class="stat-card mb-md">
                <div class="stat-label">Jev's Wallet Address</div>
                <div class="text-mono text-sm truncate" style="color: var(--ts-green);">${state.walletAddress}</div>
              </div>
              <div class="form-row mb-md">
                <div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value">${parseFloat(state.walletBalance || '0').toFixed(6)} ETH</div></div>
                <div class="stat-card"><div class="stat-label">Network</div><div class="stat-value text-sm">${state.chainConfig?.name || 'Robinhood Chain'}</div></div>
              </div>
              ${parseFloat(state.walletBalance || '0') === 0 ? `
                <div class="ai-decision" style="border-color: var(--color-warning); margin-top: var(--space-md);">
                  <div class="ai-decision-question">Action Required</div>
                  <div class="ai-decision-answer neutral">⚠ Fund this wallet with ETH on Robinhood Chain to deploy</div>
                </div>
              ` : ''}
            ` : `
              <div style="padding: var(--space-xl) var(--space-md); text-align: center;">
                <div style="font-size: 2rem; margin-bottom: var(--space-md);">🔐</div>
                <p class="text-secondary text-sm">Jev will generate a fresh wallet when you start the launch flow.</p>
                <p class="text-muted text-xs mt-md" style="font-family: var(--font-mono);">No MetaMask needed. Jev manages its own keys.</p>
              </div>
            `}
          </div>
        </div>

        <!-- Launch CTA -->
        <div class="text-center mt-xl">
          ${jevReady ? `
            ${state.walletConnected ? `
              <button class="btn btn-primary btn-lg" id="btn-go-configure">Continue to Token Configuration →</button>
            ` : `
              <button class="btn btn-pink btn-lg" id="btn-start-agent" style="min-width: 320px;">
                🚀 Let Jev Create a Wallet & Start
              </button>
              <p class="text-muted text-xs mt-md" style="font-family: var(--font-mono);">
                Jev will generate a new wallet, then guide you through token configuration.
              </p>
            `}
          ` : `
            <p class="text-muted text-sm" style="font-family: var(--font-mono);">Connect Jev to begin.</p>
          `}
        </div>
      </div>
    </div>`;
}

export function bindSetupEvents(app) {
  document.getElementById('btn-connect-api')?.addEventListener('click', async () => {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    if (!key) { app.toast('Enter your OpenRouter API key', 'warning'); return; }
    const btn = document.getElementById('btn-connect-api');
    btn.disabled = true; btn.textContent = 'Connecting to Jev...';
    await app.connectApi(key);
  });
  document.getElementById('btn-disconnect-api')?.addEventListener('click', () => app.disconnectApi());
  document.getElementById('btn-test-api')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-test-api');
    btn.disabled = true; btn.textContent = 'Testing...';
    await app.testApi();
  });

  // Agent creates its own wallet
  document.getElementById('btn-start-agent')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-agent');
    btn.disabled = true; btn.textContent = '🤖 Jev is generating wallet...';
    await app.agentCreateWallet();
  });

  document.getElementById('btn-go-configure')?.addEventListener('click', () => app.navigate('configure'));
}
