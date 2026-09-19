export function renderTokenConfigView(app) {
  const state = app.state;
  const config = state.tokenConfig;
  return `
    <div class="view">
      <div class="container">
        <div class="mb-lg">
          <h1>Configure Your <span class="text-gradient">Token</span></h1>
          <p class="text-secondary mt-md">Set your token parameters and get AI-powered assessment from Jev.</p>
        </div>
        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header"><h3><span class="icon">🪙</span> Token Parameters</h3></div>
            <div class="flex flex-col gap-lg">
              <div class="form-group">
                <label class="form-label" for="token-name">Token Name</label>
                <input type="text" id="token-name" class="form-input" placeholder="e.g. TypeSafeCoin" value="${config.name}" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="token-symbol">Symbol</label>
                  <input type="text" id="token-symbol" class="form-input" placeholder="e.g. TSC" value="${config.symbol}" maxlength="10" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="token-decimals">Decimals</label>
                  <input type="number" id="token-decimals" class="form-input" value="${config.decimals}" min="0" max="18" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="token-supply">Total Supply</label>
                <input type="text" id="token-supply" class="form-input" placeholder="e.g. 1000000000" value="${config.totalSupply}" />
                <span class="form-hint">${formatSupply(config.totalSupply)} tokens will be minted to your wallet</span>
              </div>
              <div class="flex gap-sm">
                <button class="btn btn-primary" id="btn-save-config">Save Configuration</button>
                <button class="btn btn-secondary" id="btn-assess-ai">🤖 Ask Jev AI</button>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-lg">
            <div class="card">
              <div class="card-header"><h3><span class="icon">👁</span> Token Preview</h3></div>
              <div class="stat-card mb-md" style="background: linear-gradient(135deg, rgba(3,170,92,0.08), rgba(9,174,161,0.05)); border-color: rgba(3,170,92,0.2);">
                <div class="flex items-center gap-md mb-md">
                  <div style="width:48px;height:48px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;color:var(--color-text-inverse);">${config.symbol ? config.symbol.charAt(0) : '?'}</div>
                  <div><div class="font-bold" style="font-size:1.1rem;">${config.name || 'Token Name'}</div><div class="font-mono text-secondary">${config.symbol || 'SYM'}</div></div>
                </div>
                <div class="form-row">
                  <div><div class="stat-label">Supply</div><div class="font-mono font-bold">${formatSupply(config.totalSupply)}</div></div>
                  <div><div class="stat-label">Decimals</div><div class="font-mono font-bold">${config.decimals}</div></div>
                </div>
                <div class="mt-md"><div class="stat-label">Network</div><div class="font-mono text-sm" style="color: var(--color-accent-cyan);">Robinhood Chain (ID: 4663)</div></div>
              </div>
            </div>
            ${state.aiAssessment ? renderAiAssessment(state.aiAssessment) : `
              <div class="ai-panel">
                <div class="ai-panel-header"><div class="ai-icon">⚡</div><h4>Jev AI Assessment</h4><span class="model-tag">typesafe/jev-latest</span></div>
                <div class="empty-state" style="padding: var(--space-lg) 0;"><div class="empty-state-icon">🤖</div><h3 style="font-size: 0.9rem;">No Assessment Yet</h3><p class="text-sm">Click "Ask Jev AI" to get an AI-powered analysis of your token configuration.</p></div>
              </div>`}
          </div>
        </div>
        <div class="flex justify-between items-center mt-xl">
          <button class="btn btn-ghost" id="btn-back-setup">← Back to Setup</button>
          <button class="btn btn-primary btn-lg" id="btn-go-launch">Proceed to Launch →</button>
        </div>
      </div>
    </div>`;
}

function renderAiAssessment(assessment) {
  const decisions = assessment.data?.decisions || [];
  const fallbackNote = assessment.fallback ? '<span class="text-xs text-muted">(via fallback model)</span>' : '';
  return `
    <div class="ai-panel">
      <div class="ai-panel-header"><div class="ai-icon">⚡</div><h4>Jev AI Assessment</h4><span class="model-tag">typesafe/jev-latest ${fallbackNote}</span></div>
      <div class="ai-decisions">
        ${decisions.map(d => {
          let answerHtml = '', answerClass = 'neutral';
          if (d.question_id === 'overall_score') {
            const score = typeof d.answer === 'number' ? d.answer : (d.score || 0);
            answerClass = score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'negative';
            const strokeColor = answerClass === 'positive' ? 'success' : answerClass === 'neutral' ? 'warning' : 'error';
            answerHtml = `<div class="score-meter"><div class="score-meter-ring"><svg viewBox="0 0 56 56"><circle class="ring-bg" cx="28" cy="28" r="25"></circle><circle class="ring-fill" cx="28" cy="28" r="25" style="stroke-dashoffset: ${157 - (157 * score / 100)}; stroke: var(--color-${strokeColor});"></circle></svg><span class="score-meter-value">${score}</span></div><div><div class="ai-decision-answer ${answerClass}">${score}/100</div><div class="text-xs text-muted">${d.reasoning || ''}</div></div></div>`;
          } else if (d.question_id === 'launch_recommendation') {
            const choice = d.answer || d.choice || 'unknown';
            const labels = { proceed_with_launch: '🚀 Proceed with Launch', modify_parameters: '⚙️ Modify Parameters', reconsider_approach: '🔄 Reconsider Approach' };
            answerClass = choice === 'proceed_with_launch' ? 'positive' : choice === 'modify_parameters' ? 'neutral' : 'negative';
            answerHtml = `<div class="ai-decision-answer ${answerClass}">${labels[choice] || choice}</div>`;
          } else {
            const isYes = d.answer === true || d.answer === 'true' || d.answer === 'yes';
            answerClass = isYes ? 'positive' : 'negative';
            answerHtml = `<div class="ai-decision-answer ${answerClass}">${isYes ? '✓ Yes' : '✗ No'}</div>`;
          }
          const confPercent = Math.round((typeof d.confidence === 'number' ? d.confidence : 0) * 100);
          return `<div class="ai-decision"><div class="ai-decision-question">${getQuestionLabel(d.question_id)}</div>${answerHtml}<div class="confidence-bar"><div class="confidence-bar-fill" style="width: ${confPercent}%;"></div></div><div class="confidence-label">Confidence: ${confPercent}%</div>${d.reasoning ? '<div class="text-xs text-secondary mt-md">' + d.reasoning + '</div>' : ''}</div>`;
        }).join('')}
      </div>
    </div>`;
}

function getQuestionLabel(id) {
  return { name_viable: 'Is the token name & symbol viable?', supply_appropriate: 'Is the total supply appropriate?', overall_score: 'Overall Configuration Score', launch_recommendation: 'Launch Recommendation' }[id] || id;
}

function formatSupply(supply) {
  const num = Number(supply);
  if (isNaN(num)) return supply;
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toLocaleString();
}

export function bindTokenConfigEvents(app) {
  document.getElementById('btn-save-config')?.addEventListener('click', () => {
    const name = document.getElementById('token-name').value.trim();
    const symbol = document.getElementById('token-symbol').value.trim().toUpperCase();
    const totalSupply = document.getElementById('token-supply').value.trim();
    const decimals = parseInt(document.getElementById('token-decimals').value);
    if (!name || !symbol || !totalSupply) { app.toast('Please fill in all fields', 'warning'); return; }
    app.updateTokenConfig({ name, symbol, totalSupply, decimals });
    app.toast('Token configuration saved!', 'success');
  });
  document.getElementById('btn-assess-ai')?.addEventListener('click', async () => {
    const name = document.getElementById('token-name').value.trim();
    const symbol = document.getElementById('token-symbol').value.trim().toUpperCase();
    const totalSupply = document.getElementById('token-supply').value.trim();
    const decimals = parseInt(document.getElementById('token-decimals').value);
    if (!name || !symbol || !totalSupply) { app.toast('Save your configuration first', 'warning'); return; }
    app.updateTokenConfig({ name, symbol, totalSupply, decimals });
    const btn = document.getElementById('btn-assess-ai');
    btn.disabled = true; btn.textContent = '⏳ Analyzing...';
    await app.assessTokenConfig();
  });
  document.getElementById('btn-back-setup')?.addEventListener('click', () => app.navigate('setup'));
  document.getElementById('btn-go-launch')?.addEventListener('click', () => {
    const name = document.getElementById('token-name')?.value.trim();
    const symbol = document.getElementById('token-symbol')?.value.trim().toUpperCase();
    const totalSupply = document.getElementById('token-supply')?.value.trim();
    const decimals = parseInt(document.getElementById('token-decimals')?.value);
    if (name && symbol && totalSupply) app.updateTokenConfig({ name, symbol, totalSupply, decimals });
    app.navigate('launch');
  });
}
