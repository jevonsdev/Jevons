// ═══ TypeSafeCoin Activity Log ═══
// Structured, exportable timeline of every Jev decision and on-chain action.

export const LOG_TYPES = {
  JEV_DECISION: { icon: '🤖', label: 'JEV DECISION', color: 'var(--ts-pink)' },
  JEV_THINKING: { icon: '💭', label: 'JEV THINKING', color: 'var(--ts-purple)' },
  WALLET_ACTION: { icon: '👛', label: 'WALLET', color: 'var(--ts-teal)' },
  TX_SUBMITTED: { icon: '📡', label: 'TX SUBMITTED', color: 'var(--ts-warning)' },
  TX_CONFIRMED: { icon: '✅', label: 'TX CONFIRMED', color: 'var(--ts-green)' },
  CONTRACT:     { icon: '📜', label: 'CONTRACT', color: 'var(--ts-green)' },
  API:          { icon: '🔗', label: 'API', color: 'var(--ts-teal)' },
  SYSTEM:       { icon: '⚙️', label: 'SYSTEM', color: 'var(--color-text-muted)' },
  ERROR:        { icon: '❌', label: 'ERROR', color: 'var(--color-error)' },
  INFO:         { icon: 'ℹ️', label: 'INFO', color: 'var(--ts-gray-muted)' },
};

export class ActivityLog {
  constructor() {
    this.entries = [];
    this.listeners = [];
    this.startTime = Date.now();
  }

  add(type, summary, details = null, links = null) {
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      typeInfo: LOG_TYPES[type] || LOG_TYPES.INFO,
      summary,
      details,
      links,
      timestamp: Date.now(),
      elapsed: this._elapsed(),
    };
    this.entries.push(entry);
    this._notify(entry);
    return entry;
  }

  decision(summary, details) { return this.add('JEV_DECISION', summary, details); }
  thinking(summary)          { return this.add('JEV_THINKING', summary); }
  wallet(summary, details)   { return this.add('WALLET_ACTION', summary, details); }
  tx(summary, details, links){ return this.add('TX_SUBMITTED', summary, details, links); }
  confirmed(summary, details, links) { return this.add('TX_CONFIRMED', summary, details, links); }
  contract(summary, details, links)  { return this.add('CONTRACT', summary, details, links); }
  api(summary, details)      { return this.add('API', summary, details); }
  system(summary, details)   { return this.add('SYSTEM', summary, details); }
  error(summary, details)    { return this.add('ERROR', summary, details); }
  info(summary, details)     { return this.add('INFO', summary, details); }

  onChange(fn) { this.listeners.push(fn); }

  _notify(entry) {
    this.listeners.forEach(fn => { try { fn(entry); } catch (e) { console.error('Log listener error:', e); } });
  }

  _elapsed() {
    const ms = Date.now() - this.startTime;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  toJSON() {
    return {
      session: {
        startTime: new Date(this.startTime).toISOString(),
        totalEntries: this.entries.length,
        exportedAt: new Date().toISOString(),
      },
      entries: this.entries.map(e => ({
        elapsed: e.elapsed,
        type: e.type,
        summary: e.summary,
        details: e.details,
        links: e.links,
        timestamp: new Date(e.timestamp).toISOString(),
      }))
    };
  }

  exportJSON() {
    const data = JSON.stringify(this.toJSON(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `typesafecoin-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ═══ Activity Log UI Renderer ═══

export function renderActivityPanel(log, isExpanded) {
  const entries = log.entries;
  const count = entries.length;

  return `
    <div class="activity-panel ${isExpanded ? 'expanded' : 'collapsed'}" id="activity-panel">
      <div class="activity-header" id="activity-toggle">
        <div class="activity-header-left">
          <span class="activity-pulse ${count > 0 ? 'active' : ''}"></span>
          <span class="activity-title">Agent Activity Log</span>
          <span class="activity-count">${count}</span>
        </div>
        <div class="activity-header-right">
          ${count > 0 ? '<button class="btn btn-ghost btn-sm" id="btn-export-log">↓ Export</button>' : ''}
          <button class="btn btn-ghost btn-sm" id="btn-toggle-log">${isExpanded ? '▼ Collapse' : '▲ Expand'}</button>
        </div>
      </div>
      ${isExpanded ? `
        <div class="activity-body" id="activity-body">
          ${count === 0
            ? '<div class="activity-empty"><span class="activity-empty-icon">📋</span>No activity yet. Jev is standing by.</div>'
            : `<div class="activity-timeline">${entries.slice().reverse().map(e => renderLogEntry(e)).join('')}</div>`
          }
        </div>
      ` : ''}
    </div>
  `;
}

function renderLogEntry(entry) {
  const t = entry.typeInfo;
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;
  const hasLinks = entry.links && Object.keys(entry.links).length > 0;

  return `
    <div class="activity-entry" data-type="${entry.type}">
      <div class="activity-entry-gutter">
        <span class="activity-elapsed">[${entry.elapsed}]</span>
        <div class="activity-line"></div>
      </div>
      <div class="activity-entry-content">
        <div class="activity-entry-header">
          <span class="activity-icon">${t.icon}</span>
          <span class="activity-label" style="color: ${t.color};">${t.label}</span>
          <span class="activity-dash">—</span>
          <span class="activity-summary">${entry.summary}</span>
        </div>
        ${hasDetails ? `
          <div class="activity-details">
            ${Object.entries(entry.details).map(([k, v]) => `
              <div class="activity-detail-row">
                <span class="activity-detail-key">${k}:</span>
                <span class="activity-detail-value">${formatDetailValue(v)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${hasLinks ? `
          <div class="activity-links">
            ${Object.entries(entry.links).map(([label, url]) => `
              <a href="${url}" target="_blank" class="activity-link">${label} ↗</a>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function formatDetailValue(val) {
  if (typeof val === 'object') return `<code>${JSON.stringify(val)}</code>`;
  if (typeof val === 'number') return `<strong>${val.toLocaleString()}</strong>`;
  if (typeof val === 'boolean') return val ? '<span style="color:var(--ts-green);">✓ Yes</span>' : '<span style="color:var(--color-error);">✗ No</span>';
  // Detect addresses/hashes
  if (typeof val === 'string' && val.startsWith('0x') && val.length > 20) {
    return `<code class="activity-hash">${val.slice(0, 10)}...${val.slice(-8)}</code>`;
  }
  return String(val);
}

export function bindActivityEvents(app) {
  document.getElementById('activity-toggle')?.addEventListener('click', (e) => {
    // Don't toggle if clicking a button inside the header
    if (e.target.closest('button')) return;
    app.toggleLog();
  });
  document.getElementById('btn-toggle-log')?.addEventListener('click', () => app.toggleLog());
  document.getElementById('btn-export-log')?.addEventListener('click', () => app.log.exportJSON());

  // Auto-scroll to top (newest entry) when expanded
  const body = document.getElementById('activity-body');
  if (body) body.scrollTop = 0;
}
