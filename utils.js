/* ============================================================
   Cyrias Buddy — Utils (Audio, Modals, Toasts, Security)
   ============================================================ */
// --- CONFIGURATION ALERTES ---
// 1. Initialisation unique de l'AudioContext
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 2. Fonction de base pour un Bip percutant
function playBip(frequency = 440, duration = 0.2, volume = 0.5) {
    // Force la reprise de l'audio (nécessaire pour Chrome)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Type 'square' (carré) = son beaucoup plus fort et "informatique" que 'sine'
    oscillator.type = 'square'; 
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Réglage du volume (0.5 est déjà bien fort)
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

// 3. Fonction d'alarme (série de 3 bips rapides)
function playAlarmSequence() {
    playBip(880, 0.15, 1); // Bip 1
    setTimeout(() => playBip(880, 0.15, 1), 250); // Bip 2
    setTimeout(() => playBip(880, 0.15, 1), 500); // Bip 3
}

// 4. Demande de permission unique au chargement
window.addEventListener('load', () => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
});

// 3. UTILITAIRES MODALES
function openCraModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    if (!el.classList.contains('flex')) el.classList.add('flex');
}
function closeCraModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
}
function showCustomAlert(t, m) {
    const el = document.getElementById('alert-modal');
    if (el) {
        document.getElementById('alert-title').innerText = t;
        document.getElementById('alert-message').innerHTML = m;
        openCraModal('alert-modal');
    } else { alert(`${t}\n\n${m}`); }
}
function showError(msg, t="Erreur") {
    const pb = document.getElementById('upload-progress-container');
    if(pb) pb.classList.add('hidden');
    showCustomAlert(t, msg);
}

// ============================================================
// HELPERS SÉCURITÉ v13 — appelés partout dans le portail
// ============================================================

/**
 * Sanitize une URL : refuse les protocoles dangereux (javascript:, data:, vbscript:)
 * Retourne '#' pour les URL malveillantes, l'URL telle quelle sinon.
 */
function safeUrl(url) {
  if (!url) return '#';
  const s = String(url).trim();
  // Vérifier le protocole : autoriser http(s):, mailto:, tel:, ftp:, et URLs relatives
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || 
      lower.startsWith('vbscript:') || lower.startsWith('file:')) {
    return '#';
  }
  return s;
}
window.safeUrl = safeUrl;

/**
 * Wrapper pour localStorage.setItem qui gère les erreurs de quota
 * Renvoie true en cas de succès, false sinon.
 */
function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Toast non-bloquant si dispo, sinon log
      if (typeof toastErr === 'function') {
        toastErr("Quota de stockage navigateur dépassé. Exportez et nettoyez d'anciennes données depuis ⚙️ Configuration.", 
                 { title: 'Stockage saturé', duration: 8000 });
      } else {
        console.error('localStorage quota exceeded for key', key);
      }
    } else {
      console.warn('localStorage.setItem failed', e);
    }
    return false;
  }
}
window.safeLocalSet = safeLocalSet;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateOrgStats() {
  const total = orgTasks.length;
  const done = orgTasks.filter(t => t.done).length;
  const pending = total - done;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  
  const statTotal = document.getElementById('stat-total');
  const statDone = document.getElementById('stat-done');
  const statPending = document.getElementById('stat-pending');
  const statPercent = document.getElementById('stat-percent');
  
  if(statTotal) statTotal.textContent = total;
  if(statDone) statDone.textContent = done;
  if(statPending) statPending.textContent = pending;
  if(statPercent) statPercent.textContent = percent + '%';
}


/* ============================================================
   v9 — Toasts, Nav collapsible, Sprint UX
   ============================================================ */

// ----- Système de toasts -----
function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

/**
 * Affiche un toast non-bloquant.
 * @param {string} message - Texte principal
 * @param {string} type - 'ok' | 'warn' | 'err' | 'info' (défaut: 'info')
 * @param {object} opts - { title, duration (ms, défaut 4000), persistent (bool) }
 */
function toast(message, type = 'info', opts = {}) {
  const container = ensureToastContainer();
  const icons = { ok: '✅', warn: '⚠️', err: '❌', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const title = opts.title || '';
  t.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Fermer">×</button>
  `;
  container.appendChild(t);
  const close = () => {
    if (t.classList.contains('toast-out')) return;
    t.classList.add('toast-out');
    setTimeout(() => t.remove(), 220);
  };
  t.querySelector('.toast-close').addEventListener('click', close);
  if (!opts.persistent) {
    setTimeout(close, opts.duration || 4000);
  }
  return { close };
}

// Helpers thématiques
window.toast = toast;
window.toastOk   = (m, opts) => toast(m, 'ok', opts);
window.toastWarn = (m, opts) => toast(m, 'warn', opts);
window.toastErr  = (m, opts) => toast(m, 'err', opts);
window.toastInfo = (m, opts) => toast(m, 'info', opts);


// ----- Wrapper compatibilité : remplacer alert() par des toasts pour les nouveaux appels -----
// (Les alert() existants continuent de marcher, mais on peut migrer progressivement)
window.notify = function(message, type = 'info', opts = {}) {
  return toast(message, type, opts);
};

// Migration : surcharger les messages de backup pour utiliser les toasts
const _origShowBackupMessage = window.showBackupMessage;
window.showBackupMessage = function(msg, type) {
  const map = { ok: 'ok', warn: 'warn', err: 'err' };
  toast(msg, map[type] || 'info');
  // Garder aussi la version inline pour rétrocompatibilité
  if (typeof _origShowBackupMessage === 'function') {
    try { _origShowBackupMessage(msg, type); } catch(e) {}
  }
};

// Initialisation au chargement
window.addEventListener('load', () => {
  restoreNavSectionsState();
  // Déplier la section contenant la page active au démarrage
  const activeBtn = document.querySelector('.nav-item.active');
  if (activeBtn) {
    const section = activeBtn.closest('.nav-section');
    if (section) section.classList.remove('nav-collapsed');
  }
  // Initialiser le bandeau d'accueil personnalisé
  initHomeWelcomeBanner();
});

