export function renderManageView(app) {
  const state = app.state;
  const config = state.tokenConfig;
  const result = state.deployResult;
  const tokenInfo = state.tokenInfo;
  return `
    <div class="view">
      <div class="container">
        <div class="mb-lg">
          <h1>Manage <span class="text-gradient">${config.symbol || 'Token'}</span></h1>
          <p class="text-secondary mt-md">Monitor and manage your deployed token.</p>
        </div>
        ${result ? `
          <div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: var(--space-lg);">
            <div class="stat-card"><div class="stat-label">Token</div><div class="stat-value" style="font-size: 1.2rem;">${config.name}</div></div>
            <div class="stat-card"><div class="stat-label">Symbol</div><div class="stat-value">${config.symbol}</div></div>
            <div class="stat-card"><div class="stat-label">Total Supply</div><div class="stat-value" style="font-size: 1rem;">${formatSupply(config.totalSupply)}</div></div>
            <div class="stat-card"><div class="stat-label">Your Balance</div><div class="stat-value positive" style="font-size: 1rem;">${tokenInfo ? formatSupply(tokenInfo.balance) : '—'}</div></div>
          </div>
          <div class="dashboard-grid">
            <div class="card">
              <div class="card-header"><h3><span class="icon">📋</span> Contract Details</h3></div>
              <div class="flex flex-col gap-md">
                <div><div class="stat-label">Contract Address</div><div class="font-mono text-sm" style="color: var(--color-primary); word-break: break-all;">${result.contractAddress}</div></div>
                <div class="form-row">
                  <div><div class="stat-label">Deploy Block</div><div class="font-mono">${result.blockNumber}</div></div>
                  <div><div class="stat-label">Gas Used</div><div class="font-mono">${result.gasUsed}</div></div>
                </div>
                <div><div class="stat-label">Transaction Hash</div><div class="font-mono text-xs" style="word-break: break-all; color: var(--color-text-secondary);">${result.txHash}</div></div>
                <div class="flex gap-sm mt-md"><a href="${result.explorerUrl}" target="_blank" class="btn btn-secondary btn-sm">🔍 Block Explorer</a><button class="btn btn-ghost btn-sm" id="btn-refresh-info">🔄 Refresh</button></div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3><span class="icon">🤖</span> AI Advisor</h3></div>
              <button class="btn btn-primary w-full mb-lg" id="btn-ai-post-launch">⚡ Get AI Recommendations</button>
              ${state.postLaunchAssessment ? renderPostLaunch(state.postLaunchAssessment) : '<div class="empty-state" style="padding: var(--space-lg) 0;"><div class="empty-state-icon">💡</div><h3 style="font-size: 0.9rem;">Get AI Guidance</h3><p class="text-sm">Ask Jev for next-step recommendations for your token.</p></div>'}
            </div>
          </div>
        ` : `
          <div class="card" style="max-width: 600px; margin: 0 auto;"><div class="empty-state"><div class="empty-state-icon">📋</div><h3>No Token Deployed Yet</h3><p class="text-sm mb-lg">Deploy your token first, then come back here to manage it.</p><button class="btn btn-primary" id="btn-go-launch-from-manage">Go to Launch →</button></div></div>
        `}
        <div class="flex justify-between items-center mt-xl"><button class="btn btn-ghost" id="btn-back-launch">← Back to Launch</button></div>
      </div>
    </div>`;
}

function renderPostLaunch(assessment) {
  const decisions = assessment.data?.decisions || [];
  return `<div class="ai-decisions">${decisions.map(d => {
    const isScore = d.question_id.includes('score');
    let display = '', answerClass = 'neutral';
    if (isScore) { const s = d.answer || d.score || 0; answerClass = s >= 70 ? 'positive' : s >= 40 ? 'neutral' : 'negative'; display = s + '/100'; }
    else { const c = d.answer || d.choice || '—'; display = { create_liquidity_pool: '💧 Create Liquidity Pool', verify_contract: '✅ Verify Contract', distribute_tokens: '📤 Distribute Tokens', marketing_campaign: '📢 Marketing Campaign' }[c] || c; answerClass = 'positive'; }
    const cp = Math.round((d.confidence || 0) * 100);
    return `<div class="ai-decision"><div class="ai-decision-question">${d.question_id === 'next_steps' ? 'Recommended Next Step' : 'Token Health Score'}</div><div class="ai-decision-answer ${answerClass}">${display}</div><div class="confidence-bar"><div class="confidence-bar-fill" style="width: ${cp}%;"></div></div><div class="confidence-label">Confidence: ${cp}%</div>${d.reasoning ? '<div class="text-xs text-secondary mt-md">' + d.reasoning + '</div>' : ''}</div>`;
  }).join('')}</div>`;
}

function formatSupply(supply) {
  const num = Number(supply); if (isNaN(num)) return supply || '—';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'; if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'; if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toLocaleString();
}

export function bindManageEvents(app) {
  document.getElementById('btn-refresh-info')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-info'); btn.disabled = true; btn.textContent = '⏳ Loading...';
    await app.refreshTokenInfo(); btn.disabled = false; btn.textContent = '🔄 Refresh';
  });
  document.getElementById('btn-ai-post-launch')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-ai-post-launch'); btn.disabled = true; btn.textContent = '⏳ Analyzing...';
    await app.assessPostLaunch(); btn.disabled = false; btn.textContent = '⚡ Get AI Recommendations';
  });
  document.getElementById('btn-back-launch')?.addEventListener('click', () => app.navigate('launch'));
  document.getElementById('btn-go-launch-from-manage')?.addEventListener('click', () => app.navigate('launch'));
}
