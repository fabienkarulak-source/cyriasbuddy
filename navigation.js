/* ============================================================
   Cyrias Buddy — Navigation, Search, Sidebar, Shortcuts
   ============================================================ */
// 4. NAVIGATION GÉNÉRALE
function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[onclick*="${page}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.page').forEach(p => {
        if (p.id === 'page-' + page) {
            p.style.display = 'block';
            p.style.position = 'relative';
            p.style.left = '0';
            p.style.height = 'auto';
            p.style.visibility = 'visible';
            p.style.opacity = '1';
            p.style.pointerEvents = 'auto';
        } else {
            if (p.id === 'page-craminator' || p.id === 'page-facturator') {
                p.style.position = 'absolute';
                p.style.left = '-99999px';
                p.style.height = '0';
                p.style.visibility = 'hidden';
                p.style.pointerEvents = 'none';
            } else {
                p.style.display = 'none';
            }
        }
    });

    if (page === 'facturator') setTimeout(() => { if(typeof factUpdateAll === 'function') factUpdateAll(); }, 50);
    if (page === 'craminator') setTimeout(() => { if(typeof updateDashboard === 'function') updateDashboard(); }, 50);
    if (page === 'organisator') setTimeout(() => { 
        renderOrgTasks(); 
        updateOrgStats();
        if(!orgChart) initOrgChart(); else updateOrgChart();
    }, 50);
}

// ----- Recherche globale (Ctrl/Cmd + K) -----
const CYRIAS_PAGES = [
  { id: 'dashboard', label: 'Accueil', icon: '🏠', kw: 'home tableau de bord' },
  { id: 'links', label: 'Tous les liens', icon: '🔗', kw: 'liens raccourcis url' },
  { id: 'organisator', label: 'Organisator', icon: '📅', kw: 'taches calendrier todo planning' },
  { id: 'communicator', label: 'Communicator', icon: '✉️', kw: 'mail email modele template' },
  { id: 'direction', label: 'Board Direction', icon: '📈', kw: 'health score capacity nps' },
  { id: 'kanban', label: 'Kanban & MEP', icon: '📋', kw: 'tickets sla mep mise en production deploiement' },
  { id: 'craminator', label: 'CRAminator', icon: '📊', kw: 'cra reporting analyse client tjm budget rac' },
  { id: 'facturator', label: 'Facturator', icon: '💶', kw: 'facture facturation enveloppe' },
  { id: 'agregator', label: 'Stafiz Agregator', icon: '🏗️', kw: 'stafiz agregation temps' },
  { id: 'snippets', label: 'Snippetator', icon: '💻', kw: 'code snippet ivalua sql regex referentiel' },
  { id: 'bible', label: 'TMA formator', icon: '🧬', kw: 'bible tma formation documentation' },
  { id: 'loganalyzer', label: 'LOG Analyzor', icon: '🐛', kw: 'log erreur stack trace bug analyse' },
  { id: 'sql', label: 'SQL Generator', icon: '⚡', kw: 'sql requete select update delete insert' },
  { id: 'xml-viewer', label: 'Ivalua Context Translator', icon: '🧩', kw: 'xml ivalua traduction contexte' },
  { id: 'config', label: 'Configuration', icon: '⚙️', kw: 'parametres reglages api cle backup sauvegarde stockage' }
];

function openGlobalSearch() {
  let panel = document.getElementById('global-search-panel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('div');
  panel.id = 'global-search-panel';
  panel.innerHTML = `
    <div class="gs-backdrop" onclick="closeGlobalSearch()"></div>
    <div class="gs-modal">
      <div class="gs-input-wrap">
        <span style="font-size:18px;">🔍</span>
        <input type="text" id="gs-input" placeholder="Rechercher un module, un lien, une fonction…" autocomplete="off">
        <span style="font-size:11px;color:var(--ink-muted);">Esc</span>
      </div>
      <div id="gs-results"></div>
    </div>`;
  document.body.appendChild(panel);
  const input = document.getElementById('gs-input');
  input.focus();
  input.addEventListener('input', renderGlobalSearchResults);
  input.addEventListener('keydown', handleGlobalSearchKeys);
  renderGlobalSearchResults();
}

function closeGlobalSearch() {
  const p = document.getElementById('global-search-panel');
  if (p) p.remove();
}

function renderGlobalSearchResults() {
  const q = (document.getElementById('gs-input').value || '').trim().toLowerCase();
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const qn = norm(q);

  // Résultats : pages
  const pageResults = CYRIAS_PAGES.filter(p => {
    if (!qn) return true;
    return norm(p.label).includes(qn) || norm(p.kw).includes(qn);
  }).map(p => ({ kind: 'page', id: p.id, label: p.label, icon: p.icon, sub: 'Module' }));

  // Résultats : liens enregistrés
  let linkResults = [];
  try {
    const links = JSON.parse(localStorage.getItem('compagnon_links') || '[]');
    linkResults = links.filter(l => {
      if (!qn) return false;
      return norm(l.name || '').includes(qn) || norm(l.url || '').includes(qn);
    }).slice(0, 8).map(l => ({ kind: 'link', url: l.url, label: l.name, icon: '🔗', sub: l.url }));
  } catch(e) {}

  // Résultats : tâches Organisator
  let taskResults = [];
  try {
    const tasks = JSON.parse(localStorage.getItem('cyrias_tasks') || '[]');
    taskResults = tasks.filter(t => {
      if (!qn) return false;
      return norm(t.title || '').includes(qn) || norm(t.description || '').includes(qn);
    }).slice(0, 5).map(t => ({ kind: 'task', label: t.title, icon: '📅', sub: 'Tâche Organisator' }));
  } catch(e) {}

  const all = [...pageResults, ...linkResults, ...taskResults];
  const container = document.getElementById('gs-results');
  if (all.length === 0) {
    container.innerHTML = '<div class="gs-empty">Aucun résultat</div>';
    return;
  }
  container.innerHTML = all.map((r, i) => `
    <div class="gs-item ${i===0?'gs-active':''}" data-idx="${i}" onclick="executeGlobalSearchResult(${i})">
      <span class="gs-icon">${r.icon}</span>
      <div class="gs-text">
        <div class="gs-label">${escapeHtml(r.label)}</div>
        <div class="gs-sub">${escapeHtml(r.sub || '')}</div>
      </div>
      <span class="gs-kind">${r.kind}</span>
    </div>
  `).join('');
  window._gsResults = all;
}

function executeGlobalSearchResult(idx) {
  const r = (window._gsResults || [])[idx];
  if (!r) return;
  closeGlobalSearch();
  if (r.kind === 'page') navigateTo(r.id);
  else if (r.kind === 'link') window.open(r.url, '_blank');
  else if (r.kind === 'task') navigateTo('organisator');
}

function handleGlobalSearchKeys(e) {
  const items = document.querySelectorAll('.gs-item');
  let active = document.querySelector('.gs-item.gs-active');
  let idx = active ? parseInt(active.dataset.idx) : 0;
  if (e.key === 'Escape') { e.preventDefault(); closeGlobalSearch(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length-1, idx+1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx-1); }
  else if (e.key === 'Enter') { e.preventDefault(); executeGlobalSearchResult(idx); return; }
  else return;
  items.forEach(it => it.classList.remove('gs-active'));
  if (items[idx]) { items[idx].classList.add('gs-active'); items[idx].scrollIntoView({block:'nearest'}); }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// Raccourci clavier global
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openGlobalSearch();
  }
});

// Initialisations au chargement
window.addEventListener('load', () => {
  refreshLastBackupDate();
  refreshStorageQuota();
  refreshGeminiKeyUI();
  checkBackupReminder();
});

// Si l'utilisateur arrive sur la page Configuration, on rafraîchit les indicateurs
const _origNavigateTo = window.navigateTo;
if (typeof _origNavigateTo === 'function') {
  window.navigateTo = function(p) {
    _origNavigateTo(p);
    if (p === 'config') {
      setTimeout(() => {
        refreshLastBackupDate();
        refreshStorageQuota();
        refreshGeminiKeyUI();
      }, 50);
    }
  };
}


// ----- Toggle des sections de navigation (avec mémorisation) -----
function toggleNavSection(sectionId) {
  const section = document.querySelector(`.nav-section[data-section="${sectionId}"]`);
  if (!section) return;
  section.classList.toggle('nav-collapsed');
  // Persister l'état
  const collapsed = JSON.parse(localStorage.getItem('cyrias_nav_collapsed') || '[]');
  const isCollapsed = section.classList.contains('nav-collapsed');
  const idx = collapsed.indexOf(sectionId);
  if (isCollapsed && idx === -1) collapsed.push(sectionId);
  else if (!isCollapsed && idx !== -1) collapsed.splice(idx, 1);
  localStorage.setItem('cyrias_nav_collapsed', JSON.stringify(collapsed));
}

// Restaurer l'état des sections au chargement + déplier celle qui contient la page active
function restoreNavSectionsState() {
  const collapsed = JSON.parse(localStorage.getItem('cyrias_nav_collapsed') || '["techniques"]');
  document.querySelectorAll('.nav-section').forEach(s => {
    const id = s.dataset.section;
    if (collapsed.includes(id)) s.classList.add('nav-collapsed');
    else s.classList.remove('nav-collapsed');
  });
}

// Quand on navigue vers une page, déplier automatiquement la section qui la contient
function expandSectionContaining(pageId) {
  const target = document.querySelector(`.nav-item[onclick*="${pageId}"]`);
  if (!target) return;
  const section = target.closest('.nav-section');
  if (section && section.classList.contains('nav-collapsed')) {
    section.classList.remove('nav-collapsed');
    // Mettre à jour le localStorage
    const collapsed = JSON.parse(localStorage.getItem('cyrias_nav_collapsed') || '[]');
    const idx = collapsed.indexOf(section.dataset.section);
    if (idx !== -1) { collapsed.splice(idx, 1); localStorage.setItem('cyrias_nav_collapsed', JSON.stringify(collapsed)); }
  }
}

// Hook supplémentaire sur navigateTo pour déplier la section
const _origNavV9 = window.navigateTo;
if (typeof _origNavV9 === 'function') {
  window.navigateTo = function(p) {
    _origNavV9(p);
    expandSectionContaining(p);
  };
}


// ===========================================================
// FEATURE — Raccourcis clavier "g + lettre" style Linear/GitHub
// ===========================================================
const KeyShortcuts = {
  bindings: {
    'g d': () => navigateTo('dashboard'),
    'g c': () => navigateTo('craminator'),
    'g s': () => navigateTo('snippets'),
    'g q': () => navigateTo('sql'),
    'g l': () => navigateTo('loganalyzer'),
    'g k': () => navigateTo('kanban'),
    'g o': () => navigateTo('organisator'),
    'g m': () => navigateTo('communicator'),
    'g f': () => navigateTo('facturator'),
    'g b': () => navigateTo('direction'),
    'g r': () => navigateTo('links'),
    'g h': () => navigateTo('config'),
  },
  buffer: '',
  lastKeyTime: 0,
  init() {
    document.addEventListener('keydown', (e) => {
      // Ne pas intercepter dans les inputs/textarea
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // ? pour la cheat sheet
      if (e.key === '?' && !this.buffer) {
        e.preventDefault();
        this.showCheatSheet();
        return;
      }
      const now = Date.now();
      if (now - this.lastKeyTime > 1500) this.buffer = '';
      this.lastKeyTime = now;
      this.buffer += e.key.toLowerCase();
      // Tester les bindings
      for (const seq in this.bindings) {
        if (this.buffer === seq.replace(/\s/g, '')) {
          e.preventDefault();
          this.bindings[seq]();
          this.buffer = '';
          toastInfo(`Raccourci : ${seq}`, { duration: 1200 });
          return;
        }
      }
      // Si le buffer ne correspond plus à aucun préfixe valide, le vider
      const validPrefixes = Object.keys(this.bindings).map(k => k.replace(/\s/g, ''));
      const stillPossible = validPrefixes.some(p => p.startsWith(this.buffer));
      if (!stillPossible) this.buffer = '';
    });
  },
  showCheatSheet() {
    let modal = document.getElementById('keyboard-cheat-modal');
    if (modal) { modal.remove(); return; }
    modal = document.createElement('div');
    modal.id = 'keyboard-cheat-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
    const allShortcuts = [
      { keys: 'Ctrl + K', desc: 'Recherche globale' },
      { keys: 'Ctrl + Shift + S', desc: 'Templates SQL Ivalua' },
      { keys: 'Esc', desc: 'Fermer le panneau actif' },
      { keys: '?', desc: 'Afficher cette aide' },
      ...Object.entries(this.bindings).map(([k, _]) => ({
        keys: k.toUpperCase(),
        desc: 'Aller à ' + this.bindingDescription(k)
      }))
    ];
    modal.innerHTML = `
      <div style="background:var(--surface);width:min(540px,92vw);max-height:80vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">⌨️ Raccourcis clavier</h3>
          <button onclick="document.getElementById('keyboard-cheat-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
        </div>
        <div style="padding:20px 24px;overflow-y:auto;">
          ${allShortcuts.map(s => `
            <div style="display:grid;grid-template-columns:140px 1fr;gap:16px;padding:8px 0;border-bottom:1px solid var(--border-light);">
              <kbd style="background:var(--bg);padding:4px 10px;border-radius:6px;border:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;text-align:center;">${s.keys}</kbd>
              <span style="font-size:13px;color:var(--ink-secondary);">${s.desc}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  bindingDescription(seq) {
    const map = {
      'g d': 'Accueil',
      'g c': 'CRAminator',
      'g s': 'Snippetator',
      'g q': 'SQL Generator',
      'g l': 'LOG Analyzor',
      'g k': 'Kanban',
      'g o': 'Organisator',
      'g m': 'Communicator',
      'g f': 'Facturator',
      'g b': 'Board Direction',
      'g r': 'Liens',
      'g h': 'Configuration'
    };
    return map[seq] || seq;
  }
};
window.KeyShortcuts = KeyShortcuts;


/* ============================================================
   v17 — SIDEBAR TOGGLE (3 états avec persistance + raccourcis)
   ============================================================ */

const SidebarState = {
  STATES: ['expanded', 'collapsed', 'hidden'],
  KEY: 'cyrias_sidebar_state',
  
  get current() {
    return localStorage.getItem(this.KEY) || 'expanded';
  },
  
  set(state) {
    if (!this.STATES.includes(state)) state = 'expanded';
    if (typeof safeLocalSet === 'function') safeLocalSet(this.KEY, state);
    else localStorage.setItem(this.KEY, state);
    this.apply(state);
  },
  
  apply(state) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('collapsed', 'hidden');
    document.body.classList.remove('sb-collapsed', 'sb-hidden');
    
    if (state === 'collapsed') {
      sidebar.classList.add('collapsed');
      document.body.classList.add('sb-collapsed');
    } else if (state === 'hidden') {
      sidebar.classList.add('hidden');
      document.body.classList.add('sb-hidden');
    }
  },
  
  next() {
    const idx = this.STATES.indexOf(this.current);
    const next = this.STATES[(idx + 1) % this.STATES.length];
    this.set(next);
    return next;
  }
};
window.SidebarState = SidebarState;

function toggleSidebar() {
  const newState = SidebarState.next();
  if (typeof toastInfo === 'function') {
    const labels = { expanded: 'Barre latérale étendue', collapsed: 'Barre latérale réduite', hidden: 'Barre latérale masquée' };
    toastInfo(labels[newState], { duration: 1200 });
  }
  if (typeof AuditLog === 'object' && AuditLog.log) {
    AuditLog.log('sidebar_toggle', newState);
  }
}
window.toggleSidebar = toggleSidebar;

// Appliquer l'état au chargement (avant tout pour éviter le FOUC)
(function() {
  const state = localStorage.getItem('cyrias_sidebar_state') || 'expanded';
  if (state === 'collapsed') document.body.classList.add('sb-collapsed');
  else if (state === 'hidden') document.body.classList.add('sb-hidden');
})();

// Appliquer après DOM ready (pour la classe sur sidebar)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SidebarState.apply(SidebarState.current));
} else {
  SidebarState.apply(SidebarState.current);
}

// Raccourci clavier Ctrl+B / Cmd+B
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
    // Ne pas intercepter si on est dans un champ de texte
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    e.preventDefault();
    toggleSidebar();
  }
});

