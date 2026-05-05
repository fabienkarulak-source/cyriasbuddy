/* ============================================================
   Cyrias Buddy — Initialization & Boot
   ============================================================ */
// ===========================================================
// Initialisation Sprint B
// ===========================================================
window.addEventListener('load', () => {
  // Init des raccourcis clavier
  KeyShortcuts.init();
  // Enrichir le dashboard et la config
  setTimeout(() => {
    enhanceDashboardWithSprintB();
    enhanceConfigWithSprintB();
    attachUnsavedIndicator();
    dailyEngagementsCheck();
  }, 600);
});




window.addEventListener('load', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const icon = document.getElementById('theme-icon');
  if (icon) icon.innerHTML = Icons.get(current === 'dark' ? 'sun' : 'moon', 16);
});

/* ============================================================
   v14 — DASHBOARD STATS
   ============================================================ */
function refreshDashboardStats() {
  // Tickets ouverts (Kanban + demandes CRA)
  try {
    const kanbanTickets = (typeof Kanban === 'object' ? Kanban.load() : []).filter(t => t.statut !== 'closed');
    const demandes = CyriasData.getDemandes().filter(d => d && d.statut !== 'Clôturé' && d.statut !== 'Fermé');
    const total = kanbanTickets.length + demandes.length;
    const breaches = kanbanTickets.filter(t => Kanban.computeSLA(t).status === 'breach').length;
    const el = document.getElementById('stat-open-tickets');
    const meta = document.getElementById('stat-open-tickets-meta');
    if (el) el.textContent = total;
    if (meta) {
      meta.innerHTML = breaches > 0 
        ? `<span style="color:var(--danger-fg);font-weight:600;">⚠️ ${breaches} SLA dépassé${breaches>1?'s':''}</span>`
        : (total > 0 ? `<span style="color:var(--ok-fg);">✓ Tout sous contrôle</span>` : 'Aucun ticket actif');
    }
  } catch(e) {}

  // CRA jours mois en cours
  try {
    const cra = CyriasData.getCRA();
    const now = new Date();
    const monthData = cra.filter(d => {
      const dt = new Date(d.date || d.dateSaisie || 0);
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    });
    const totalJours = monthData.reduce((s, d) => s + (parseFloat(d.jours) || 0), 0);
    const collabs = new Set(monthData.map(d => d.collaborateur).filter(Boolean));
    const el = document.getElementById('stat-cra-month');
    const meta = document.getElementById('stat-cra-month-meta');
    if (el) el.textContent = totalJours.toFixed(1);
    if (meta) {
      const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long' });
      meta.textContent = collabs.size > 0 
        ? `${collabs.size} collab. en ${monthLabel}` 
        : `Aucune saisie en ${monthLabel}`;
    }
  } catch(e) {}

  // Engagements actifs
  try {
    const list = typeof Engagements === 'object' ? Engagements.getAll() : [];
    const active = list.filter(e => e.statut === 'en_cours');
    const today = new Date(); today.setHours(0,0,0,0);
    const upcoming = active.filter(e => {
      if (!e.echeance) return false;
      const d = (new Date(e.echeance) - today) / 86400000;
      return d >= 0 && d <= 7;
    });
    const overdue = active.filter(e => {
      if (!e.echeance) return false;
      return new Date(e.echeance) < today;
    });
    const el = document.getElementById('stat-engagements');
    const meta = document.getElementById('stat-engagements-meta');
    if (el) el.textContent = active.length;
    if (meta) {
      if (overdue.length > 0) meta.innerHTML = `<span style="color:var(--danger-fg);font-weight:600;">${overdue.length} en retard</span>`;
      else if (upcoming.length > 0) meta.innerHTML = `<span style="color:var(--warn-fg);">${upcoming.length} cette semaine</span>`;
      else if (active.length > 0) meta.innerHTML = `<span style="color:var(--ok-fg);">✓ Tous OK</span>`;
      else meta.textContent = 'Aucun engagement';
    }
  } catch(e) {}

  // Tâches du jour
  try {
    const tasks = CyriasData.getTasks();
    const today = new Date();
    const todayStr = today.toDateString();
    const todayTasks = tasks.filter(t => {
      if (!t || t.completed || t.done || t.status === 'done') return false;
      if (t.dueDate || t.echeance) {
        const due = new Date(t.dueDate || t.echeance);
        return !isNaN(due.getTime()) && due.toDateString() === todayStr;
      }
      return false;
    });
    const overdue = tasks.filter(t => {
      if (!t || t.completed || t.done || t.status === 'done') return false;
      if (!t.dueDate && !t.echeance) return false;
      const due = new Date(t.dueDate || t.echeance);
      return !isNaN(due.getTime()) && due < today && due.toDateString() !== todayStr;
    });
    const el = document.getElementById('stat-tasks-today');
    const meta = document.getElementById('stat-tasks-today-meta');
    if (el) el.textContent = todayTasks.length;
    if (meta) {
      if (overdue.length > 0) meta.innerHTML = `<span style="color:var(--danger-fg);font-weight:600;">${overdue.length} en retard</span>`;
      else if (todayTasks.length > 0) meta.textContent = 'Pour aujourd\'hui';
      else meta.innerHTML = `<span style="color:var(--ok-fg);">✓ Journée libre</span>`;
    }
  } catch(e) {}
}
window.refreshDashboardStats = refreshDashboardStats;

// Refresh à chaque retour sur dashboard
const _origNavStats = window.navigateTo;
if (typeof _origNavStats === 'function') {
  window.navigateTo = function(p) {
    _origNavStats(p);
    if (p === 'dashboard') setTimeout(refreshDashboardStats, 200);
  };
}


/* ============================================================
   v18 — MODE DEBUG (panneau overlay complet)
   ============================================================ */
const Debug = {
  enabled: false,
  logs: [],          // logs interceptés (console.log/warn/error)
  errors: [],        // erreurs JS capturées
  perfMarks: {},     // marques de performance
  
  // Capacité max pour ne pas saturer la mémoire
  MAX_LOGS: 500,
  MAX_ERRORS: 100,
  
  init() {
    // Capture des erreurs JS
    window.addEventListener('error', (e) => {
      this.errors.push({
        ts: Date.now(),
        message: e.message,
        source: e.filename ? `${e.filename.split('/').pop()}:${e.lineno}:${e.colno}` : 'unknown',
        stack: e.error?.stack || null
      });
      if (this.errors.length > this.MAX_ERRORS) this.errors.shift();
      if (this.enabled) this.refreshPanel();
    });
    
    // Capture des promesses rejetées
    window.addEventListener('unhandledrejection', (e) => {
      this.errors.push({
        ts: Date.now(),
        message: 'Unhandled Promise: ' + (e.reason?.message || String(e.reason)),
        source: 'promise',
        stack: e.reason?.stack || null
      });
      if (this.errors.length > this.MAX_ERRORS) this.errors.shift();
      if (this.enabled) this.refreshPanel();
    });
    
    // Intercepter console.* (sans casser le comportement original)
    ['log', 'warn', 'error', 'info'].forEach(level => {
      const orig = console[level].bind(console);
      console[level] = (...args) => {
        try {
          this.logs.push({
            ts: Date.now(),
            level,
            message: args.map(a => {
              if (a === null) return 'null';
              if (a === undefined) return 'undefined';
              if (typeof a === 'object') {
                try { return JSON.stringify(a, null, 2).slice(0, 500); }
                catch(e) { return String(a); }
              }
              return String(a);
            }).join(' ')
          });
          if (this.logs.length > this.MAX_LOGS) this.logs.shift();
          if (this.enabled && this._panel) this.refreshTab('console');
        } catch(e) { /* swallow */ }
        return orig(...args);
      };
    });
    
    // Activation par URL ?debug=1
    if (location.search.includes('debug=1') || location.hash.includes('debug')) {
      setTimeout(() => this.toggle(), 500);
    }
    
    // Raccourci Ctrl+Shift+D
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        this.toggle();
      }
    });
  },
  
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.show();
    else this.hide();
    if (typeof AuditLog === 'object' && AuditLog.log) {
      AuditLog.log('debug_toggled', this.enabled ? 'on' : 'off');
    }
  },
  
  show() {
    if (this._panel) {
      this._panel.style.display = 'flex';
      this.refreshPanel();
      return;
    }
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'dbg-panel';
    panel.innerHTML = `
      <div class="dbg-header">
        <div class="dbg-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
          Debug Panel
          <span class="dbg-badge" id="dbg-status">●</span>
        </div>
        <div class="dbg-actions">
          <button class="dbg-btn" onclick="Debug.copyReport()" title="Copier le rapport complet">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Rapport
          </button>
          <button class="dbg-btn" onclick="Debug.clearLogs()" title="Vider les logs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            Vider
          </button>
          <button class="dbg-btn dbg-btn-close" onclick="Debug.toggle()" title="Fermer (Ctrl+Shift+D)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="dbg-tabs">
        <button class="dbg-tab dbg-tab-active" data-tab="health">🩺 Santé</button>
        <button class="dbg-tab" data-tab="storage">💾 Stockage</button>
        <button class="dbg-tab" data-tab="console">🐛 Console <span class="dbg-tab-count" id="dbg-tab-console-count"></span></button>
        <button class="dbg-tab" data-tab="errors">⚠️ Erreurs <span class="dbg-tab-count" id="dbg-tab-errors-count"></span></button>
        <button class="dbg-tab" data-tab="perf">⚡ Perf</button>
        <button class="dbg-tab" data-tab="modules">📦 Modules</button>
        <button class="dbg-tab" data-tab="env">🌐 Env</button>
        <button class="dbg-tab" data-tab="actions">🧪 Actions</button>
      </div>
      <div class="dbg-body" id="dbg-body"></div>
      <div class="dbg-footer">
        <span class="dbg-hint">💡 <kbd>Ctrl+Shift+D</kbd> pour fermer • Drag header pour déplacer • Drag bord pour resize</span>
        <span class="dbg-version">Cyrias Buddy v18 • Debug 1.0</span>
      </div>
      <div class="dbg-resize-handle"></div>
    `;
    document.body.appendChild(panel);
    this._panel = panel;
    
    // Tabs handlers
    panel.querySelectorAll('.dbg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.dbg-tab').forEach(t => t.classList.remove('dbg-tab-active'));
        tab.classList.add('dbg-tab-active');
        this.refreshTab(tab.dataset.tab);
      });
    });
    
    // Drag handlers
    this._setupDrag(panel);
    this._setupResize(panel);
    
    // Restaurer position si sauvegardée
    try {
      const saved = JSON.parse(localStorage.getItem('cyrias_debug_pos') || '{}');
      if (saved.left) panel.style.left = saved.left;
      if (saved.top) panel.style.top = saved.top;
      if (saved.width) panel.style.width = saved.width;
      if (saved.height) panel.style.height = saved.height;
    } catch(e) {}
    
    this.refreshPanel();
  },
  
  hide() {
    if (this._panel) this._panel.style.display = 'none';
  },
  
  refreshPanel() {
    if (!this._panel || !this.enabled) return;
    const activeTab = this._panel.querySelector('.dbg-tab-active')?.dataset.tab || 'health';
    this.refreshTab(activeTab);
    
    // Compteurs
    const consoleCount = document.getElementById('dbg-tab-console-count');
    if (consoleCount) consoleCount.textContent = this.logs.length > 0 ? this.logs.length : '';
    const errCount = document.getElementById('dbg-tab-errors-count');
    if (errCount) {
      errCount.textContent = this.errors.length > 0 ? this.errors.length : '';
      errCount.style.background = this.errors.length > 0 ? 'var(--danger)' : '';
      errCount.style.color = this.errors.length > 0 ? 'white' : '';
    }
    
    // Status global
    const status = document.getElementById('dbg-status');
    if (status) {
      if (this.errors.length > 0) {
        status.style.color = 'var(--danger)';
        status.title = `${this.errors.length} erreur(s)`;
      } else {
        status.style.color = 'var(--ok)';
        status.title = 'Tout fonctionne';
      }
    }
  },
  
  refreshTab(tab) {
    const body = document.getElementById('dbg-body');
    if (!body) return;
    const renderers = {
      health: () => this._renderHealth(),
      storage: () => this._renderStorage(),
      console: () => this._renderConsole(),
      errors: () => this._renderErrors(),
      perf: () => this._renderPerf(),
      modules: () => this._renderModules(),
      env: () => this._renderEnv(),
      actions: () => this._renderActions()
    };
    body.innerHTML = (renderers[tab] || renderers.health)();
  },
  
  _renderHealth() {
    const checks = [];
    
    // Modules essentiels
    const requiredModules = ['Icons', 'Kanban', 'AnomalyDetector', 'Decisions', 'Engagements', 'Pomodoro', 'AuditLog', 'Onboarding', 'SqlTemplates', 'MailTemplates'];
    requiredModules.forEach(m => {
      checks.push({
        ok: typeof window[m] !== 'undefined',
        label: `Module ${m} chargé`,
        detail: typeof window[m] !== 'undefined' ? 'OK' : 'NON CHARGÉ'
      });
    });
    
    // Helpers de sécurité
    checks.push({
      ok: typeof safeUrl === 'function',
      label: 'safeUrl() disponible',
      detail: typeof safeUrl === 'function' ? 'OK' : 'MANQUANT'
    });
    checks.push({
      ok: typeof escapeHtml === 'function',
      label: 'escapeHtml() disponible',
      detail: typeof escapeHtml === 'function' ? 'OK' : 'MANQUANT'
    });
    checks.push({
      ok: typeof safeLocalSet === 'function',
      label: 'safeLocalSet() disponible',
      detail: typeof safeLocalSet === 'function' ? 'OK' : 'MANQUANT'
    });
    
    // CDN
    checks.push({
      ok: typeof Chart !== 'undefined',
      label: 'Chart.js chargé',
      detail: typeof Chart !== 'undefined' ? 'OK' : 'CDN inaccessible'
    });
    checks.push({
      ok: typeof XLSX !== 'undefined',
      label: 'XLSX (SheetJS) chargé',
      detail: typeof XLSX !== 'undefined' ? 'OK' : 'CDN inaccessible'
    });
    
    // IDs dupliqués
    const allIds = [...document.querySelectorAll('[id]')].map(e => e.id);
    const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
    checks.push({
      ok: dupes.length === 0,
      label: 'IDs HTML uniques',
      detail: dupes.length === 0 ? 'OK' : `${dupes.length} doublon(s) : ${[...new Set(dupes)].slice(0, 3).join(', ')}`
    });
    
    // localStorage accessible
    let lsOk = true;
    try { localStorage.setItem('__test', 'x'); localStorage.removeItem('__test'); }
    catch(e) { lsOk = false; }
    checks.push({
      ok: lsOk,
      label: 'localStorage accessible',
      detail: lsOk ? 'OK' : 'BLOQUÉ (mode privé ?)'
    });
    
    // Erreurs JS
    checks.push({
      ok: this.errors.length === 0,
      label: 'Aucune erreur JS',
      detail: this.errors.length === 0 ? 'OK' : `${this.errors.length} erreur(s)`
    });
    
    const okCount = checks.filter(c => c.ok).length;
    const total = checks.length;
    const allOk = okCount === total;
    
    return `
      <div class="dbg-section">
        <div class="dbg-summary ${allOk ? 'dbg-summary-ok' : 'dbg-summary-warn'}">
          <div class="dbg-summary-big">${okCount} / ${total}</div>
          <div class="dbg-summary-label">checks ${allOk ? 'passés ✓' : 'avec problème(s)'}</div>
        </div>
        <div class="dbg-checks">
          ${checks.map(c => `
            <div class="dbg-check ${c.ok ? 'dbg-check-ok' : 'dbg-check-err'}">
              <span class="dbg-check-icon">${c.ok ? '✓' : '✗'}</span>
              <span class="dbg-check-label">${escapeHtml(c.label)}</span>
              <span class="dbg-check-detail">${escapeHtml(c.detail)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  },
  
  _renderStorage() {
    const items = [];
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key) || '';
      const size = new Blob([value]).size;
      totalSize += size;
      items.push({ key, value, size });
    }
    items.sort((a, b) => b.size - a.size);
    
    // Quota estimation (5MB typique)
    const quotaEstimate = 5 * 1024 * 1024;
    const pct = (totalSize / quotaEstimate * 100).toFixed(1);
    
    return `
      <div class="dbg-section">
        <div class="dbg-summary">
          <div class="dbg-summary-big">${(totalSize / 1024).toFixed(1)} <span style="font-size:14px;">Ko</span></div>
          <div class="dbg-summary-label">${items.length} clés • ~${pct}% du quota navigateur</div>
        </div>
        <div class="dbg-storage-list">
          ${items.map(item => `
            <div class="dbg-storage-row">
              <span class="dbg-storage-key" title="${escapeHtml(item.key)}">${escapeHtml(item.key)}</span>
              <span class="dbg-storage-size">${item.size < 1024 ? item.size + ' o' : (item.size / 1024).toFixed(1) + ' Ko'}</span>
              <button class="dbg-mini-btn" onclick="Debug.viewStorage('${escapeHtml(item.key)}')" title="Voir le contenu">👁</button>
              <button class="dbg-mini-btn dbg-mini-btn-danger" onclick="Debug.deleteStorage('${escapeHtml(item.key)}')" title="Supprimer cette clé">×</button>
            </div>
          `).join('')}
        </div>
      </div>`;
  },
  
  _renderConsole() {
    if (this.logs.length === 0) {
      return '<div class="dbg-empty">Aucun log capturé pour le moment.<br>Les <code>console.log()</code>, <code>console.warn()</code>, <code>console.error()</code> seront listés ici dès qu\'ils seront émis.</div>';
    }
    return `
      <div class="dbg-logs">
        ${this.logs.slice().reverse().map(l => `
          <div class="dbg-log dbg-log-${l.level}">
            <span class="dbg-log-time">${new Date(l.ts).toLocaleTimeString('fr-FR')}</span>
            <span class="dbg-log-level">${l.level.toUpperCase()}</span>
            <span class="dbg-log-msg">${escapeHtml(l.message.slice(0, 800))}</span>
          </div>
        `).join('')}
      </div>`;
  },
  
  _renderErrors() {
    if (this.errors.length === 0) {
      return '<div class="dbg-empty" style="color:var(--ok-fg);">✓ Aucune erreur détectée.</div>';
    }
    return `
      <div class="dbg-errors">
        ${this.errors.slice().reverse().map(e => `
          <div class="dbg-error">
            <div class="dbg-error-head">
              <span class="dbg-error-source">${escapeHtml(e.source)}</span>
              <span class="dbg-error-time">${new Date(e.ts).toLocaleTimeString('fr-FR')}</span>
            </div>
            <div class="dbg-error-msg">${escapeHtml(e.message)}</div>
            ${e.stack ? `<details class="dbg-error-stack"><summary>Stack trace</summary><pre>${escapeHtml(e.stack.slice(0, 1500))}</pre></details>` : ''}
          </div>
        `).join('')}
      </div>`;
  },
  
  _renderPerf() {
    const perf = window.performance;
    if (!perf || !perf.timing) {
      return '<div class="dbg-empty">API Performance non disponible.</div>';
    }
    
    const t = perf.timing;
    const navStart = t.navigationStart;
    const metrics = [
      { label: 'DNS lookup', value: t.domainLookupEnd - t.domainLookupStart },
      { label: 'TCP connect', value: t.connectEnd - t.connectStart },
      { label: 'Request', value: t.responseStart - t.requestStart },
      { label: 'Response', value: t.responseEnd - t.responseStart },
      { label: 'DOM Loading', value: t.domLoading - navStart },
      { label: 'DOM Interactive', value: t.domInteractive - navStart },
      { label: 'DOM Complete', value: t.domComplete - navStart },
      { label: 'Load Event', value: t.loadEventEnd - navStart }
    ];
    
    // DOM size
    const domSize = document.querySelectorAll('*').length;
    const totalSize = document.documentElement.outerHTML.length;
    
    // Memory si disponible
    const mem = perf.memory;
    
    return `
      <div class="dbg-section">
        <h4 class="dbg-section-title">⏱️ Timing (ms depuis navigation)</h4>
        <div class="dbg-perf-grid">
          ${metrics.map(m => `
            <div class="dbg-perf-row">
              <span class="dbg-perf-label">${m.label}</span>
              <span class="dbg-perf-value">${m.value > 0 ? m.value : '—'} <small>ms</small></span>
            </div>
          `).join('')}
        </div>
        
        <h4 class="dbg-section-title" style="margin-top:16px;">📐 Taille du DOM</h4>
        <div class="dbg-perf-grid">
          <div class="dbg-perf-row">
            <span class="dbg-perf-label">Éléments DOM</span>
            <span class="dbg-perf-value">${domSize.toLocaleString('fr-FR')}</span>
          </div>
          <div class="dbg-perf-row">
            <span class="dbg-perf-label">Taille HTML</span>
            <span class="dbg-perf-value">${(totalSize / 1024).toFixed(1)} <small>Ko</small></span>
          </div>
          <div class="dbg-perf-row">
            <span class="dbg-perf-label">Listeners attachés</span>
            <span class="dbg-perf-value">~${this._estimateListeners()}</span>
          </div>
        </div>
        
        ${mem ? `
          <h4 class="dbg-section-title" style="margin-top:16px;">🧠 Mémoire JS (Chrome only)</h4>
          <div class="dbg-perf-grid">
            <div class="dbg-perf-row">
              <span class="dbg-perf-label">Heap utilisée</span>
              <span class="dbg-perf-value">${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} <small>Mo</small></span>
            </div>
            <div class="dbg-perf-row">
              <span class="dbg-perf-label">Heap totale</span>
              <span class="dbg-perf-value">${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)} <small>Mo</small></span>
            </div>
            <div class="dbg-perf-row">
              <span class="dbg-perf-label">Limite heap</span>
              <span class="dbg-perf-value">${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} <small>Mo</small></span>
            </div>
          </div>
        ` : ''}
      </div>`;
  },
  
  _estimateListeners() {
    // Compter les attributs onclick comme proxy
    return document.querySelectorAll('[onclick], [onchange], [oninput]').length;
  },
  
  _renderModules() {
    const modules = [
      { name: 'Kanban', getter: () => Kanban?.load()?.length || 0, label: 'tickets' },
      { name: 'Decisions', getter: () => Decisions?.getAll()?.length || 0, label: 'décisions' },
      { name: 'Engagements', getter: () => Engagements?.getAll()?.length || 0, label: 'engagements' },
      { name: 'CRA (sources)', getter: () => Object.keys(JSON.parse(localStorage.getItem('cra_data_sources') || '{}')).length, label: 'sources' },
      { name: 'CRA (lignes)', getter: () => CyriasData?.getCRA()?.length || 0, label: 'lignes' },
      { name: 'Tâches', getter: () => CyriasData?.getTasks()?.length || 0, label: 'tâches' },
      { name: 'Snippets', getter: () => JSON.parse(localStorage.getItem('cyrias_snippets') || '[]').length, label: 'snippets' },
      { name: 'Liens', getter: () => CyriasData?.getLinks()?.length || 0, label: 'liens' },
      { name: 'AuditLog', getter: () => AuditLog?.getAll()?.length || 0, label: 'entrées' },
      { name: 'AnomalyDetector (rules)', getter: () => AnomalyDetector?.rules?.length || 0, label: 'règles' },
      { name: 'AnomalyDetector (alerts)', getter: () => AnomalyDetector?.scan()?.length || 0, label: 'alertes' },
      { name: 'SqlTemplates', getter: () => SqlTemplates?.templates?.length || 0, label: 'templates' },
      { name: 'MailTemplates', getter: () => MailTemplates?.templates?.length || 0, label: 'modèles' },
      { name: 'Facturator (lignes)', getter: () => (typeof factData !== 'undefined' ? factData.length : 0), label: 'lignes' },
      { name: 'Facturator (clients)', getter: () => (typeof factData !== 'undefined' ? new Set(factData.map(d => d.client)).size : 0), label: 'distincts' },
      { name: 'Facturator (sources)', getter: () => (typeof factDataSources !== 'undefined' ? Object.keys(factDataSources).length : 0), label: 'sources' }
    ];
    
    // Diagnostic Facturator : si 1 seul client distinct + lignes > 0, c'est suspect
    let factDiag = '';
    try {
      if (typeof factData !== 'undefined' && factData.length > 0) {
        const clients = [...new Set(factData.map(d => d.client))];
        const naCount = factData.filter(d => d.client === 'N/A').length;
        if (clients.length === 1 || naCount > 0) {
          // Récupérer les noms de colonnes du premier source
          let colNames = [];
          try {
            const firstSrc = Object.values(factDataSources)[0];
            if (firstSrc?.data?.[0]) {
              colNames = Object.keys(firstSrc.data[0]);
            }
          } catch(e) {}
          factDiag = `
            <div style="margin-top:14px;padding:12px;background:var(--warn-soft);border:1px solid var(--warn-border);border-radius:6px;">
              <div style="font-weight:700;font-size:12px;color:var(--warn-fg);margin-bottom:6px;">⚠️ Facturator : ${clients.length} client(s) distinct(s), ${naCount} ligne(s) "N/A"</div>
              <div style="font-size:11px;color:var(--ink-secondary);line-height:1.5;">
                Si vous attendez plusieurs clients, c'est sûrement un problème de mapping de colonnes. Le parser cherche : <code>client, project, projet, affaire, customer, compte, account, société</code>.<br>
                <strong>Clients distincts trouvés :</strong> ${clients.slice(0,5).map(c=>`<code>${c}</code>`).join(', ')}<br>
                <strong>Champs présents dans le fichier (échantillon) :</strong> ${colNames.length ? colNames.slice(0,15).map(k=>`<code>${k}</code>`).join(', ') : '—'}
              </div>
            </div>`;
        }
      }
    } catch(e) {}
    
    return `
      <div class="dbg-section">
        <h4 class="dbg-section-title">📦 État des modules</h4>
        <div class="dbg-perf-grid">
          ${modules.map(m => {
            let val = '?';
            try { val = m.getter(); } catch(e) { val = 'ERR'; }
            return `
              <div class="dbg-perf-row">
                <span class="dbg-perf-label">${m.name}</span>
                <span class="dbg-perf-value">${val} <small>${m.label}</small></span>
              </div>`;
          }).join('')}
        </div>
        ${factDiag}
      </div>`;
  },
  
  _renderEnv() {
    const ua = navigator.userAgent;
    let browser = 'Inconnu';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/')) browser = 'Safari';
    
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const sbState = localStorage.getItem('cyrias_sidebar_state') || 'expanded';
    const username = localStorage.getItem('cyrias_username') || '(non défini)';
    const role = localStorage.getItem('cyrias_user_role') || '(non défini)';
    const onboardingDone = localStorage.getItem('cyrias_onboarding_done') ? 'fait' : 'pas encore';
    
    const env = [
      { label: 'Navigateur', value: browser },
      { label: 'User-Agent', value: ua.slice(0, 80) + (ua.length > 80 ? '...' : '') },
      { label: 'Plateforme', value: navigator.platform },
      { label: 'Langue', value: navigator.language },
      { label: 'En ligne', value: navigator.onLine ? 'OUI' : 'NON' },
      { label: 'Viewport', value: `${window.innerWidth} × ${window.innerHeight}px` },
      { label: 'DPR', value: window.devicePixelRatio + 'x' },
      { label: 'Couleurs préférées', value: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair' },
      { label: 'Réduit le mouvement', value: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'oui' : 'non' },
      { label: 'Thème actif', value: theme },
      { label: 'Sidebar state', value: sbState },
      { label: 'Utilisateur', value: username },
      { label: 'Rôle', value: role },
      { label: 'Onboarding', value: onboardingDone },
      { label: 'URL', value: location.pathname + location.search },
      { label: 'Date', value: new Date().toLocaleString('fr-FR') }
    ];
    
    return `
      <div class="dbg-section">
        <h4 class="dbg-section-title">🌐 Environnement</h4>
        <div class="dbg-perf-grid">
          ${env.map(e => `
            <div class="dbg-perf-row">
              <span class="dbg-perf-label">${e.label}</span>
              <span class="dbg-perf-value" style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(String(e.value))}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  },
  
  _renderActions() {
    return `
      <div class="dbg-section">
        <h4 class="dbg-section-title">🧪 Outils de test</h4>
        <p style="font-size:12px;color:var(--ink-muted);margin-bottom:14px;">
          Actions destinées aux tests et au support. <strong>Attention</strong> : certaines modifient les données.
        </p>
        
        <div class="dbg-action-grid">
          <button class="dbg-action-btn" onclick="Debug.runSelfTests()">
            <strong>🧪 Lancer les self-tests</strong>
            <span>Suite de tests d'intégrité</span>
          </button>
          <button class="dbg-action-btn" onclick="Debug.fakeKanban()">
            <strong>📋 Générer 5 tickets de démo</strong>
            <span>Ajoute des tickets fictifs au Kanban</span>
          </button>
          <button class="dbg-action-btn" onclick="Debug.fakeError()">
            <strong>💥 Déclencher une erreur</strong>
            <span>Test du capteur d'erreurs</span>
          </button>
          <button class="dbg-action-btn" onclick="Debug.testToasts()">
            <strong>🔔 Tester tous les toasts</strong>
            <span>OK, warn, err, info</span>
          </button>
          <button class="dbg-action-btn" onclick="Debug.exportFullState()">
            <strong>💾 Export état complet</strong>
            <span>JSON avec tout le localStorage</span>
          </button>
          <button class="dbg-action-btn" onclick="Debug.scanAnomalies()">
            <strong>🔍 Re-scanner anomalies</strong>
            <span>Force un nouveau scan</span>
          </button>
          <button class="dbg-action-btn dbg-action-btn-warn" onclick="Debug.simulateQuotaError()">
            <strong>⚠️ Simuler quota plein</strong>
            <span>Test gestion erreur localStorage</span>
          </button>
          <button class="dbg-action-btn dbg-action-btn-warn" onclick="Debug.resetUserPrefs()">
            <strong>🔄 Reset préférences</strong>
            <span>Sidebar, thème, onboarding</span>
          </button>
        </div>
      </div>`;
  },
  
  // === ACTIONS ===
  
  copyReport() {
    const report = this.generateReport();
    navigator.clipboard.writeText(report).then(() => {
      if (typeof toastOk === 'function') toastOk('Rapport copié dans le presse-papier');
    }).catch(() => {
      if (typeof toastErr === 'function') toastErr('Impossible de copier');
    });
  },
  
  generateReport() {
    const lines = [];
    lines.push('=== CYRIAS BUDDY DEBUG REPORT ===');
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push(`URL: ${location.href}`);
    lines.push(`UA: ${navigator.userAgent}`);
    lines.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
    lines.push('');
    
    // Modules
    lines.push('--- MODULES ---');
    ['Kanban', 'Decisions', 'Engagements', 'AnomalyDetector', 'Pomodoro'].forEach(m => {
      lines.push(`${m}: ${typeof window[m]}`);
    });
    lines.push('');
    
    // Storage
    lines.push('--- LOCALSTORAGE ---');
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const size = new Blob([localStorage.getItem(key) || '']).size;
      totalSize += size;
      lines.push(`${key}: ${size} bytes`);
    }
    lines.push(`TOTAL: ${(totalSize/1024).toFixed(1)} Ko`);
    lines.push('');
    
    // Errors
    if (this.errors.length > 0) {
      lines.push(`--- ERREURS (${this.errors.length}) ---`);
      this.errors.slice(-10).forEach(e => {
        lines.push(`[${new Date(e.ts).toLocaleTimeString('fr-FR')}] ${e.source}: ${e.message}`);
      });
      lines.push('');
    }
    
    // Recent logs
    if (this.logs.length > 0) {
      lines.push(`--- LOGS RÉCENTS (${Math.min(this.logs.length, 20)}) ---`);
      this.logs.slice(-20).forEach(l => {
        lines.push(`[${l.level}] ${l.message.slice(0, 200)}`);
      });
    }
    
    return lines.join('\n');
  },
  
  clearLogs() {
    this.logs = [];
    this.errors = [];
    this.refreshPanel();
    if (typeof toastInfo === 'function') toastInfo('Logs vidés', { duration: 1500 });
  },
  
  viewStorage(key) {
    const value = localStorage.getItem(key);
    if (!value) return;
    let display = value;
    try { display = JSON.stringify(JSON.parse(value), null, 2); } catch(e) {}
    
    let modal = document.getElementById('dbg-storage-view');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'dbg-storage-view';
    modal.className = 'dyn-modal-overlay';
    modal.innerHTML = `
      <div class="dyn-modal" style="width:min(720px,94vw);">
        <div class="dyn-modal-header">
          <div>
            <h3>🔍 ${escapeHtml(key)}</h3>
            <p>${(new Blob([value]).size / 1024).toFixed(2)} Ko • ${value.length} caractères</p>
          </div>
          <button class="dyn-modal-close" onclick="document.getElementById('dbg-storage-view').remove()">×</button>
        </div>
        <div class="dyn-modal-body">
          <pre style="background:var(--bg-subtle);padding:14px;border-radius:6px;font-family:var(--font-mono);font-size:11.5px;line-height:1.5;overflow-x:auto;max-height:60vh;overflow-y:auto;">${escapeHtml(display.slice(0, 50000))}</pre>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },
  
  deleteStorage(key) {
    if (!confirm(`Supprimer la clé "${key}" du localStorage ?\n\nCette action est irréversible.`)) return;
    localStorage.removeItem(key);
    if (typeof toastOk === 'function') toastOk(`Clé "${key}" supprimée`);
    this.refreshPanel();
  },
  
  runSelfTests() {
    if (typeof SelfTests !== 'undefined') {
      SelfTests.showReport();
    } else {
      alert('SelfTests non disponible');
    }
  },
  
  fakeKanban() {
    if (typeof Kanban === 'undefined') return;
    const fakeData = [
      { numero: 'DEMO-001', titre: 'Bug critique en prod BPCE', client: 'BPCE', criticite: 'bloquant', statut: 'qualif', assignee: 'Démo' },
      { numero: 'DEMO-002', titre: 'Refonte écran fournisseurs', client: 'VINCI', criticite: 'majeur', statut: 'dev', assignee: 'Démo', chargeEstimee: 5 },
      { numero: 'DEMO-003', titre: 'Ajout colonne dans le rapport', client: 'BPCE', criticite: 'mineur', statut: 'uat', assignee: 'Démo' },
      { numero: 'DEMO-004', titre: 'MEP module workflow v2', client: 'VINCI', criticite: 'majeur', statut: 'mep', assignee: 'Démo' },
      { numero: 'DEMO-005', titre: 'Correction typo footer', client: 'BPCE', criticite: 'cosmetique', statut: 'closed', assignee: 'Démo' }
    ];
    fakeData.forEach(d => Kanban.add(d));
    if (typeof toastOk === 'function') toastOk('5 tickets de démo ajoutés au Kanban');
    this.refreshPanel();
  },
  
  fakeError() {
    setTimeout(() => {
      // Erreur lancée hors du try-catch global
      throw new Error('Erreur de test délibérée — ' + new Date().toLocaleTimeString('fr-FR'));
    }, 50);
    if (typeof toastInfo === 'function') toastInfo('Erreur déclenchée — voir onglet Erreurs');
  },
  
  testToasts() {
    if (typeof toastOk !== 'function') return;
    toastOk('Toast OK', { title: 'Succès' });
    setTimeout(() => toastInfo('Toast info', { title: 'Info' }), 400);
    setTimeout(() => toastWarn('Toast warning', { title: 'Avertissement' }), 800);
    setTimeout(() => toastErr('Toast erreur', { title: 'Erreur' }), 1200);
  },
  
  exportFullState() {
    const state = { 
      meta: { exported: new Date().toISOString(), version: 'debug' },
      storage: {}
    };
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      state.storage[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyrias-debug-state-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    if (typeof toastOk === 'function') toastOk('État complet exporté');
  },
  
  scanAnomalies() {
    if (typeof AnomalyDetector === 'undefined') return;
    const result = AnomalyDetector.scan();
    if (typeof toastInfo === 'function') {
      toastInfo(`${result.length} anomalie(s) détectée(s)`, { title: 'Scan terminé' });
    }
    if (typeof renderAnomaliesPanel === 'function') renderAnomaliesPanel();
  },
  
  simulateQuotaError() {
    // Tenter de remplir localStorage
    if (!confirm('Cela va tenter de remplir le localStorage pour simuler une erreur de quota.\n\nContinuer ?')) return;
    try {
      const big = 'x'.repeat(1000000);
      for (let i = 0; i < 100; i++) {
        localStorage.setItem(`__test_quota_${i}`, big);
      }
    } catch(e) {
      // On nettoie
      for (let i = 0; i < 100; i++) {
        try { localStorage.removeItem(`__test_quota_${i}`); } catch(_) {}
      }
      if (typeof toastErr === 'function') {
        toastErr(`Quota atteint : ${e.message}`, { title: 'Test réussi' });
      }
    }
    this.refreshPanel();
  },
  
  resetUserPrefs() {
    if (!confirm('Réinitialiser les préférences UI (sidebar, thème, onboarding) ?\n\nLes données métier ne seront PAS touchées.')) return;
    ['cyrias_sidebar_state', 'cyrias_theme', 'cyrias_onboarding_done', 'cyrias_pomodoro_visible', 'cyrias_nav_collapsed'].forEach(k => localStorage.removeItem(k));
    if (typeof toastOk === 'function') toastOk('Préférences réinitialisées — rechargez la page', { duration: 4000 });
  },
  
  // === DRAG & RESIZE ===
  
  _setupDrag(panel) {
    const header = panel.querySelector('.dbg-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.dbg-btn')) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 100, startLeft + e.clientX - startX));
      const newTop = Math.max(0, Math.min(window.innerHeight - 50, startTop + e.clientY - startY));
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = '';
        this._savePosition(panel);
      }
    });
  },
  
  _setupResize(panel) {
    const handle = panel.querySelector('.dbg-resize-handle');
    let isResizing = false;
    let startW, startH, startX, startY;
    
    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startW = rect.width; startH = rect.height;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newW = Math.max(360, startW + e.clientX - startX);
      const newH = Math.max(280, startH + e.clientY - startY);
      panel.style.width = newW + 'px';
      panel.style.height = newH + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        this._savePosition(panel);
      }
    });
  },
  
  _savePosition(panel) {
    try {
      const rect = panel.getBoundingClientRect();
      localStorage.setItem('cyrias_debug_pos', JSON.stringify({
        left: rect.left + 'px',
        top: rect.top + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px'
      }));
    } catch(e) {}
  }
};
window.Debug = Debug;
Debug.init();


const SelfTests = {
  results: [],
  
  assert(name, condition, details = '') {
    const ok = !!condition;
    this.results.push({ name, ok, details });
    return ok;
  },

  async run() {
    this.results = [];
    console.group('🧪 Cyrias Buddy — Self-tests');
    
    // ─── Helpers de sécurité ───
    this.assert('safeUrl bloque javascript:', safeUrl('javascript:alert(1)') === '#');
    this.assert('safeUrl bloque data:', safeUrl('data:text/html,<scr' + 'ipt>x') === '#');
    this.assert('safeUrl bloque vbscript:', safeUrl('vbscript:msgbox') === '#');
    this.assert('safeUrl autorise https://', safeUrl('https://example.com') === 'https://example.com');
    this.assert('safeUrl autorise mailto:', safeUrl('mailto:test@x.com') === 'mailto:test@x.com');
    this.assert('safeUrl gère null', safeUrl(null) === '#');
    
    this.assert('escapeHtml encode <', escapeHtml('<scr' + 'ipt>') === '&lt;script&gt;');
    this.assert('escapeHtml encode &', escapeHtml('A & B').includes('&amp;'));
    this.assert('escapeHtml gère undefined', escapeHtml(undefined).length >= 0);
    
    // ─── localStorage helpers ───
    this.assert('safeLocalSet retourne true en succès', 
                safeLocalSet('cyrias_test_key', 'test') === true);
    localStorage.removeItem('cyrias_test_key');
    
    // ─── Modules globaux exposés ───
    this.assert('AnomalyDetector exposé', typeof window.AnomalyDetector === 'object');
    this.assert('AnomalyDetector.scan() fonctionne', Array.isArray(AnomalyDetector.scan()));
    this.assert('Pomodoro exposé', typeof window.Pomodoro === 'object');
    this.assert('Flush memory disponibles', 
                typeof flushAllMemory === 'function' && 
                typeof flushModuleData === 'function' && 
                typeof flushAuditLog === 'function' &&
                typeof showDangerModal === 'function');
    this.assert('FLUSHABLE_MODULES configuré', Array.isArray(FLUSHABLE_MODULES) && FLUSHABLE_MODULES.length >= 10);
    this.assert('SqlTemplates a >= 6 templates', SqlTemplates.templates.length >= 6);
    this.assert('MailTemplates a >= 6 modèles', MailTemplates.templates.length >= 6);
    this.assert('Decisions exposé', typeof window.Decisions === 'object');
    this.assert('Engagements exposé', typeof window.Engagements === 'object');
    this.assert('Kanban exposé', typeof window.Kanban === 'object');
    this.assert('Kanban.STATUSES défini', Kanban.STATUSES.length === 5);
    this.assert('AuditLog exposé', typeof window.AuditLog === 'object');
    this.assert('CheatSheets a >= 4 sheets', CheatSheets.sheets.length >= 4);
    this.assert('Onboarding a 7 étapes', Onboarding.steps.length === 7);
    this.assert('KeyShortcuts a >= 10 bindings', Object.keys(KeyShortcuts.bindings).length >= 10);
    this.assert('CyriasData helper exposé', typeof window.CyriasData === 'object' || typeof CyriasData === 'object');
    
    // ─── Fonctions d'UI ───
    this.assert('toast() est une fonction', typeof toast === 'function');
    this.assert('toastOk/Warn/Err/Info disponibles', 
                typeof toastOk === 'function' && typeof toastWarn === 'function' && 
                typeof toastErr === 'function' && typeof toastInfo === 'function');
    this.assert('navigateTo défini', typeof navigateTo === 'function');
    this.assert('openGlobalSearch défini', typeof openGlobalSearch === 'function');
    
    // ─── Intégrité du DOM ───
    this.assert('Sidebar nav présente', !!document.querySelector('.sidebar-nav'));
    this.assert('Page dashboard présente', !!document.getElementById('page-dashboard'));
    this.assert('Page kanban présente', !!document.getElementById('page-kanban'));
    this.assert('Page config présente', !!document.getElementById('page-config'));
    this.assert('Bandeau accueil présent', !!document.getElementById('home-welcome-banner'));
    
    // ─── Calcul SLA ───
    const testTicket = { 
      criticite: 'bloquant', 
      statut: 'qualif', 
      createdAt: new Date(Date.now() - 5*86400000).toISOString(),
      statusChangedAt: new Date(Date.now() - 5*86400000).toISOString()
    };
    const sla = Kanban.computeSLA(testTicket);
    this.assert('Kanban SLA détecte dépassement', sla.status === 'breach');
    
    // ─── CDN externes accessibles (test léger) ───
    this.assert('XLSX (SheetJS) chargé', typeof XLSX !== 'undefined');
    this.assert('Chart.js chargé', typeof Chart !== 'undefined');
    this.assert('PptxGenJS chargé', typeof PptxGenJS !== 'undefined' || typeof window.PptxGenJS !== 'undefined');
    
    // ─── IDs uniques (vérification dynamique) ───
    const allIds = [...document.querySelectorAll('[id]')].map(e => e.id);
    const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
    this.assert('Aucun ID HTML dupliqué', dupes.length === 0, dupes.join(','));
    
    // ─── Affichage ───
    const passed = this.results.filter(r => r.ok).length;
    const failed = this.results.filter(r => !r.ok);
    console.log(`✅ ${passed}/${this.results.length} tests passés`);
    if (failed.length > 0) {
      console.warn(`❌ ${failed.length} tests échoués :`);
      failed.forEach(r => console.warn(`   • ${r.name} ${r.details ? '(' + r.details + ')' : ''}`));
    }
    console.groupEnd();
    return { passed, total: this.results.length, failed };
  },

  showReport() {
    this.run().then(({ passed, total, failed }) => {
      let modal = document.getElementById('selftests-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'selftests-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
      const allOk = passed === total;
      modal.innerHTML = `
        <div style="background:var(--surface);width:min(680px,94vw);max-height:88vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
          <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">🧪 Tests d'intégrité</h3>
              <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Vérification automatique du portail</p>
            </div>
            <button onclick="document.getElementById('selftests-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
          </div>
          <div style="padding:20px 24px;background:${allOk ? 'var(--ok-bg)' : 'var(--danger-bg)'};text-align:center;border-bottom:1px solid var(--border);">
            <div style="font-size:36px;margin-bottom:6px;">${allOk ? '✅' : '⚠️'}</div>
            <div style="font-size:18px;font-weight:700;color:${allOk ? 'var(--ok)' : 'var(--danger)'};">${passed} / ${total} tests OK</div>
            ${failed.length > 0 ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:4px;">${failed.length} test(s) en échec</div>` : '<div style="font-size:12px;color:var(--ink-muted);margin-top:4px;">Tout fonctionne correctement</div>'}
          </div>
          <div style="overflow-y:auto;flex:1;padding:16px 24px;font-size:12px;">
            ${this.results.map(r => `
              <div style="padding:6px 10px;border-radius:4px;margin-bottom:3px;display:flex;justify-content:space-between;${r.ok ? '' : 'background:var(--danger-bg);'}">
                <span>${r.ok ? '✅' : '❌'} ${escapeHtml(r.name)}</span>
                ${r.details ? `<span style="font-size:10px;color:var(--ink-muted);">${escapeHtml(r.details)}</span>` : ''}
              </div>
            `).join('')}
          </div>
          <div style="padding:12px 24px;border-top:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--ink-muted);text-align:center;">
            💡 Lancez aussi <code style="background:white;padding:2px 6px;border-radius:3px;font-family:'JetBrains Mono',monospace;">SelfTests.run()</code> dans la console pour le détail.
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    });
  }
};
window.SelfTests = SelfTests;

// Ajouter un bouton dans la Configuration
window.addEventListener('load', () => {
  setTimeout(() => {
    const card = document.getElementById('sprintb-config-card');
    if (!card || document.getElementById('btn-selftests')) return;
    const grid = card.querySelector('div[style*="grid-template-columns"]');
    if (!grid) return;
    
    const btn = document.createElement('button');
    btn.id = 'btn-selftests';
    btn.className = 'btn btn-outline';
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;';
    btn.innerHTML = `
      <span style="font-weight:700;font-size:13px;">🧪 Tests d'intégrité</span>
      <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Vérifier le bon fonctionnement</span>`;
    btn.onclick = () => SelfTests.showReport();
    grid.appendChild(btn);
    
    // Bouton Debug
    if (!document.getElementById('btn-debug')) {
      const dbgBtn = document.createElement('button');
      dbgBtn.id = 'btn-debug';
      dbgBtn.className = 'btn btn-outline';
      dbgBtn.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;';
      dbgBtn.innerHTML = `
        <span style="font-weight:700;font-size:13px;">🐛 Mode debug</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Panneau d'inspection technique <kbd style="font-family:'JetBrains Mono',monospace;background:var(--bg-subtle);padding:1px 4px;border-radius:3px;font-size:9px;">Ctrl+Shift+D</kbd></span>`;
      dbgBtn.onclick = () => Debug.toggle();
      grid.appendChild(dbgBtn);
    }
  }, 1500);
});


