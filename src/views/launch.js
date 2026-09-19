export function renderLaunchView(app) {
  const state = app.state;
  const config = state.tokenConfig;
  if (state.deployResult) return renderDeploySuccess(app);
  if (state.deploying) return renderDeploying(app);
  return `
    <div class="view">
      <div class="container">
        <div class="mb-lg">
          <h1>Launch <span class="text-gradient">${config.symbol || 'Token'}</span></h1>
          <p class="text-secondary mt-md">Final checks before deploying to Robinhood Chain.</p>
        </div>
        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header"><h3><span class="icon">✅</span> Pre-Launch Checklist</h3></div>
            <div class="checklist">
              <div class="checklist-item ${state.apiConnected ? 'passed' : 'failed'}"><div class="checklist-icon">${state.apiConnected ? '✓' : '✗'}</div><div class="checklist-text">Jev AI Connected</div><div class="checklist-status">${state.apiConnected ? 'Ready' : 'Required'}</div></div>
              <div class="checklist-item ${state.walletConnected ? 'passed' : 'failed'}"><div class="checklist-icon">${state.walletConnected ? '✓' : '✗'}</div><div class="checklist-text">Wallet Connected</div><div class="checklist-status">${state.walletConnected ? state.walletAddress?.slice(0,6) + '...' + state.walletAddress?.slice(-4) : 'Required'}</div></div>
              <div class="checklist-item ${config.name && config.symbol ? 'passed' : 'failed'}"><div class="checklist-icon">${config.name && config.symbol ? '✓' : '✗'}</div><div class="checklist-text">Token Configured</div><div class="checklist-status">${config.name ? config.name + ' (' + config.symbol + ')' : 'Required'}</div></div>
              <div class="checklist-item ${parseFloat(state.walletBalance) > 0 ? 'passed' : 'failed'}"><div class="checklist-icon">${parseFloat(state.walletBalance) > 0 ? '✓' : '✗'}</div><div class="checklist-text">Sufficient Gas (ETH)</div><div class="checklist-status">${state.walletBalance ? parseFloat(state.walletBalance).toFixed(6) + ' ETH' : '0 ETH'}</div></div>
            </div>
            <div class="mt-lg"><button class="btn btn-secondary w-full" id="btn-ai-readiness">🤖 AI Readiness Check</button></div>
            ${state.readinessAssessment ? renderReadiness(state.readinessAssessment) : ''}
          </div>
          <div class="card">
            <div class="card-header"><h3><span class="icon">🚀</span> Deploy Contract</h3></div>
            <div class="stat-card mb-lg" style="background: linear-gradient(135deg, rgba(3,170,92,0.05), rgba(243,134,161,0.03));">
              <div class="form-row">
                <div><div class="stat-label">Token</div><div class="font-bold">${config.name}</div><div class="font-mono text-secondary text-sm">${config.symbol}</div></div>
                <div class="text-right"><div class="stat-label">Supply</div><div class="font-mono font-bold">${formatNumber(config.totalSupply)}</div></div>
              </div>
            </div>
            <div class="stat-card mb-lg">
              <div class="stat-label">Estimated Deployment Cost</div>
              ${state.gasEstimate ? `
                <div class="form-row mt-md">
                  <div><div class="text-xs text-muted">Gas Units</div><div class="font-mono text-sm">${state.gasEstimate.gasUnits}</div></div>
                  <div><div class="text-xs text-muted">Gas Price</div><div class="font-mono text-sm">${parseFloat(state.gasEstimate.gasPriceGwei).toFixed(4)} gwei</div></div>
                </div>
                <div class="mt-md"><div class="text-xs text-muted">Total Cost</div><div class="font-mono font-bold" style="color: var(--color-warning);">${parseFloat(state.gasEstimate.totalCostEth).toFixed(8)} ETH</div></div>
              ` : '<div class="skeleton" style="height: 40px; margin-top: 8px;"></div><button class="btn btn-ghost btn-sm mt-md" id="btn-estimate-gas">Estimate Gas</button>'}
            </div>
            <button class="btn btn-primary btn-lg w-full" id="btn-deploy" ${!state.walletConnected || !config.name ? 'disabled' : ''}>🚀 Deploy ${config.symbol || 'Token'} to Robinhood Chain</button>
            ${!state.walletConnected ? '<p class="text-center text-muted text-xs mt-md">Connect your wallet first to deploy.</p>' : ''}
          </div>
        </div>
        <div class="flex justify-between items-center mt-xl"><button class="btn btn-ghost" id="btn-back-config">← Back to Configuration</button></div>
      </div>
    </div>`;
}

function renderDeploying(app) {
  return `<div class="view"><div class="container"><div class="card" style="max-width: 600px; margin: var(--space-3xl) auto;"><div class="tx-progress"><div class="tx-spinner"></div><h2>Deploying ${app.state.tokenConfig.name}...</h2><p class="text-secondary">Your token contract is being deployed to Robinhood Chain.</p><p class="text-muted text-xs">This may take 15-30 seconds. Do not close this page.</p></div></div></div></div>`;
}

function renderDeploySuccess(app) {
  const result = app.state.deployResult;
  return `<div class="view"><div class="container"><div class="card" style="max-width: 700px; margin: var(--space-2xl) auto;"><div class="deploy-success"><div class="deploy-success-icon">🎉</div><h2 class="text-gradient">Token Deployed Successfully!</h2><p class="text-secondary mt-md">${app.state.tokenConfig.name} (${app.state.tokenConfig.symbol}) is now live on Robinhood Chain.</p><div class="contract-address">${result.contractAddress}</div><div class="form-row mt-lg"><div class="stat-card"><div class="stat-label">Block</div><div class="font-mono">${result.blockNumber}</div></div><div class="stat-card"><div class="stat-label">Gas Used</div><div class="font-mono">${result.gasUsed}</div></div></div><div class="flex gap-md mt-lg" style="justify-content: center;"><a href="${result.explorerUrl}" target="_blank" class="btn btn-secondary">🔍 View on Explorer</a><button class="btn btn-primary" id="btn-go-manage">📊 Manage Token</button></div></div></div></div></div>`;
}

function renderReadiness(assessment) {
  const decisions = assessment.data?.decisions || [];
  return `<div class="ai-panel mt-lg"><div class="ai-panel-header"><div class="ai-icon">⚡</div><h4>AI Readiness</h4><span class="model-tag">jev${assessment.fallback ? ' (fallback)' : ''}</span></div><div class="ai-decisions">${decisions.map(d => {
    const isScore = d.question_id.includes('score');
    const isBool = typeof d.answer === 'boolean';
    let answerClass = 'neutral', display = '';
    if (isScore) { const s = d.answer || d.score || 0; answerClass = s >= 70 ? 'positive' : s >= 40 ? 'neutral' : 'negative'; display = s + '/100'; }
    else if (isBool) { answerClass = d.answer ? 'positive' : 'negative'; display = d.answer ? '✓ Yes' : '✗ No'; }
    else { display = String(d.answer || d.choice || '—'); }
    const cp = Math.round((d.confidence || 0) * 100);
    return `<div class="ai-decision"><div class="ai-decision-question">${getReadinessLabel(d.question_id)}</div><div class="ai-decision-answer ${answerClass}">${display}</div><div class="confidence-bar"><div class="confidence-bar-fill" style="width: ${cp}%;"></div></div><div class="confidence-label">Confidence: ${cp}%</div>${d.reasoning ? '<div class="text-xs text-secondary mt-md">' + d.reasoning + '</div>' : ''}</div>`;
  }).join('')}</div></div>`;
}

function getReadinessLabel(id) {
  return { sufficient_balance: 'Sufficient ETH Balance?', gas_favorable: 'Gas Price Favorable?', readiness_score: 'Launch Readiness Score', deploy_now: 'Deploy Now?' }[id] || id;
}

function formatNumber(num) { const n = Number(num); return isNaN(n) ? num : n.toLocaleString(); }

export function bindLaunchEvents(app) {
  document.getElementById('btn-ai-readiness')?.addEventListener('click', async () => {
    if (!app.state.apiConnected) { app.toast('Connect API first', 'warning'); return; }
    const btn = document.getElementById('btn-ai-readiness'); btn.disabled = true; btn.textContent = '⏳ Analyzing...';
    await app.assessLaunchReadiness();
  });
  document.getElementById('btn-estimate-gas')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-estimate-gas'); btn.disabled = true; btn.textContent = 'Estimating...';
    await app.estimateGas();
  });
  document.getElementById('btn-deploy')?.addEventListener('click', async () => {
    if (!app.state.walletConnected) { app.toast('Connect your wallet first', 'warning'); return; }
    if (!confirm(`Deploy ${app.state.tokenConfig.name} (${app.state.tokenConfig.symbol}) to Robinhood Chain?\n\nThis will cost gas (ETH). This action cannot be undone.`)) return;
    await app.deployToken();
  });
  document.getElementById('btn-back-config')?.addEventListener('click', () => app.navigate('configure'));
  document.getElementById('btn-go-manage')?.addEventListener('click', () => app.navigate('manage'));
}
