/* ============================================================
   Cyrias Buddy — Storage
   ============================================================ */
// 1. DÉFINITION DU STOCKAGE (Indispensable en premier)
const SafeStorage = {
    get: function(key) { try { const i = localStorage.getItem(key); return i ? JSON.parse(i) : null; } catch(e) { return null; } },
    set: function(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {} },
    remove: function(key) { try { localStorage.removeItem(key); } catch(e) {} }
};

// 2. INITIALISATION DES VARIABLES GLOBALES
let userLinks = SafeStorage.get('user_links') || {};
let currentUserLabel = "Compagnon";
let linksData = SafeStorage.get('compagnon_links') || [];
let catsData = SafeStorage.get('compagnon_cats') || [];
let editingLinkId = null, editingCatId = null;

// ===== Helper d'accès safe aux données du portail =====
const CyriasData = {
  getCRA() {
    try {
      const sources = JSON.parse(localStorage.getItem('cra_data_sources') || '{}');
      let all = [];
      Object.values(sources).forEach(s => { if (s && Array.isArray(s.data)) all = all.concat(s.data); });
      return all;
    } catch(e) { return []; }
  },
  getBudgets() {
    try { return JSON.parse(localStorage.getItem('cra_budgets') || '{}'); }
    catch(e) { return {}; }
  },
  getTjm() {
    try { return JSON.parse(localStorage.getItem('cra_tjm') || '{}'); }
    catch(e) { return {}; }
  },
  getDemandes() {
    try { return JSON.parse(localStorage.getItem('cra_demandes') || '[]'); }
    catch(e) { return []; }
  },
  getTasks() {
    try { return JSON.parse(localStorage.getItem('cyrias_tasks') || '[]'); }
    catch(e) { return []; }
  },
  getLinks() {
    try { return JSON.parse(localStorage.getItem('compagnon_links') || '[]'); }
    catch(e) { return []; }
  }
};

// ===== Audit log local (#26) =====
const AuditLog = {
  log(action, details = '') {
    try {
      const entries = JSON.parse(localStorage.getItem('cyrias_audit_log') || '[]');
      entries.unshift({
        ts: Date.now(),
        date: new Date().toISOString(),
        user: localStorage.getItem('cyrias_username') || 'Anonyme',
        action,
        details
      });
      // Garder seulement les 500 derniers
      const trimmed = entries.slice(0, 500);
      safeLocalSet('cyrias_audit_log', JSON.stringify(trimmed));
    } catch(e) {}
  },
  getAll() {
    try { return JSON.parse(localStorage.getItem('cyrias_audit_log') || '[]'); }
    catch(e) { return []; }
  },
  clear() {
    if (confirm("Effacer tout l'historique d'audit ? Cette action est irréversible.")) {
      localStorage.removeItem('cyrias_audit_log');
      toastOk("Historique d'audit effacé");
      return true;
    }
    return false;
  }
};
window.AuditLog = AuditLog;

