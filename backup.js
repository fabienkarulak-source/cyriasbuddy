/* ============================================================
   Cyrias Buddy — Backup, Restore, Quota, API, Flush
   ============================================================ */
/* ===========================================================================
   AUTONOMIE v8 — Backup/Restore, Quota stockage, Clé API Gemini, Recherche
   =========================================================================== */

// ----- Backup / Restore global -----
const CYRIAS_STORAGE_PREFIXES = ['cyrias_', 'compagnon_', 'cra_', 'snippet', 'tma_', 'kanban_', 'org_'];

function collectAllStorageData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (CYRIAS_STORAGE_PREFIXES.some(p => key.startsWith(p)) || key === 'compagnon_links' || key === 'compagnon_cats') {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

function exportFullBackup() {
  try {
    const data = collectAllStorageData();
    const keyCount = Object.keys(data).length;
    if (keyCount === 0) {
      showBackupMessage("Aucune donnée à exporter pour le moment.", "warn");
      return;
    }
    const payload = {
      _meta: {
        app: 'Cyrias Buddy',
        version: 'v8',
        exportedAt: new Date().toISOString(),
        keyCount: keyCount
      },
      data: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyrias-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    safeLocalSet('cyrias_last_backup', new Date().toISOString());
    showBackupMessage(`✅ Sauvegarde exportée : ${keyCount} entrée(s).`, "ok");
    refreshLastBackupDate();
  } catch(e) {
    showBackupMessage(`❌ Erreur lors de l'export : ${e.message}`, "err");
  }
}

function importFullBackup(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload.data || !payload._meta) throw new Error("Format de fichier invalide.");
      const keyCount = Object.keys(payload.data).length;
      const meta = payload._meta;
      const ok = confirm(
        `Sauvegarde du ${new Date(meta.exportedAt).toLocaleString('fr-FR')}\n` +
        `Application : ${meta.app} ${meta.version || ''}\n` +
        `${keyCount} entrée(s) à restaurer.\n\n` +
        `⚠️ Cette opération va ÉCRASER les données existantes correspondantes. Continuer ?`
      );
      if (!ok) { input.value = ''; return; }
      let imported = 0;
      Object.keys(payload.data).forEach(k => {
        try { localStorage.setItem(k, payload.data[k]); imported++; } catch(err) {}
      });
      showBackupMessage(`✅ ${imported} entrée(s) restaurée(s). Rechargez la page pour appliquer.`, "ok");
      if (confirm("Voulez-vous recharger la page maintenant pour appliquer la restauration ?")) {
        location.reload();
      }
    } catch(err) {
      showBackupMessage(`❌ Fichier invalide : ${err.message}`, "err");
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function showBackupContents() {
  const data = collectAllStorageData();
  const keys = Object.keys(data);
  if (keys.length === 0) {
    showBackupMessage("Aucune donnée stockée pour le moment.", "warn");
    return;
  }
  const summary = keys.map(k => {
    const size = new Blob([data[k]]).size;
    const sizeStr = size > 1024 ? `${(size/1024).toFixed(1)} Ko` : `${size} o`;
    return `• ${k} (${sizeStr})`;
  }).join('\n');
  alert(`📋 Contenu de votre stockage Cyrias Buddy (${keys.length} entrées) :\n\n${summary}`);
}

function showBackupMessage(msg, type) {
  const el = document.getElementById('backup-message');
  if (!el) return;
  const colors = { ok: 'var(--secondary-dark)', warn: '#D97706', err: 'var(--danger)' };
  el.style.color = colors[type] || 'var(--ink)';
  el.textContent = msg;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; }, 5000);
}

function refreshLastBackupDate() {
  const el = document.getElementById('last-backup-date');
  if (!el) return;
  const last = localStorage.getItem('cyrias_last_backup');
  if (last) {
    const d = new Date(last);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    let label = `Dernière sauvegarde : ${d.toLocaleDateString('fr-FR')}`;
    if (days > 7) label += ` ⚠️ (il y a ${days} jours)`;
    el.textContent = label;
    el.style.color = days > 7 ? '#D97706' : 'var(--ink-muted)';
  } else {
    el.textContent = '⚠️ Aucune sauvegarde effectuée';
    el.style.color = '#D97706';
  }
}

// Auto-rappel hebdo à l'ouverture
function checkBackupReminder() {
  const last = localStorage.getItem('cyrias_last_backup');
  if (!last) return; // pas de pop-up dès le 1er chargement
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  const dismissed = localStorage.getItem('cyrias_backup_reminder_dismissed');
  if (days > 7 && dismissed !== new Date().toDateString()) {
    setTimeout(() => {
      if (confirm(`💾 Votre dernière sauvegarde Cyrias Buddy date d'il y a ${days} jours.\n\nSouhaitez-vous exporter une nouvelle sauvegarde maintenant ?`)) {
        navigateTo('config');
        setTimeout(exportFullBackup, 500);
      }
      localStorage.setItem('cyrias_backup_reminder_dismissed', new Date().toDateString());
    }, 2000);
  }
}

// ----- Quota de stockage -----
function refreshStorageQuota() {
  const label = document.getElementById('storage-used-label');
  const percent = document.getElementById('storage-percent');
  const bar = document.getElementById('storage-bar');
  const detail = document.getElementById('storage-detail');
  if (!label) return;

  let totalBytes = 0;
  let cyriasBytes = 0;
  let cyriasKeys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k);
    const size = new Blob([k + v]).size;
    totalBytes += size;
    if (CYRIAS_STORAGE_PREFIXES.some(p => k.startsWith(p)) || k === 'compagnon_links' || k === 'compagnon_cats') {
      cyriasBytes += size;
      cyriasKeys++;
    }
  }
  const QUOTA_MB = 5; // estimation prudente : la plupart des navigateurs tolèrent 5–10 Mo
  const usedMB = totalBytes / (1024 * 1024);
  const pct = Math.min(100, (usedMB / QUOTA_MB) * 100);

  label.textContent = `${usedMB.toFixed(2)} Mo utilisés (estimation sur ${QUOTA_MB} Mo)`;
  percent.textContent = `${pct.toFixed(0)}%`;
  bar.style.width = pct + '%';
  bar.style.background = pct > 80 ? 'var(--danger)' : (pct > 60 ? '#D97706' : 'var(--secondary)');
  percent.style.color = pct > 80 ? 'var(--danger)' : (pct > 60 ? '#D97706' : 'var(--secondary-dark)');
  detail.innerHTML = `Cyrias Buddy : <strong>${(cyriasBytes/1024).toFixed(1)} Ko</strong> sur ${cyriasKeys} entrée(s). ${pct > 80 ? '<br>⚠️ Stockage proche de la limite — exportez puis nettoyez d\'anciennes sources.' : ''}`;
}

// ----- Clé API Gemini -----
function getGeminiApiKey() {
  return localStorage.getItem('cyrias_gemini_key') || '';
}

function refreshGeminiKeyUI() {
  const input = document.getElementById('gemini-api-input');
  const status = document.getElementById('gemini-key-status');
  if (!input || !status) return;
  const k = getGeminiApiKey();
  input.value = k;
  if (k) {
    status.textContent = `✅ Clé configurée (${k.length} car.)`;
    status.style.color = 'var(--secondary-dark)';
  } else {
    status.textContent = '⚠️ Aucune clé configurée';
    status.style.color = '#D97706';
  }
}

function saveGeminiKey() {
  const input = document.getElementById('gemini-api-input');
  const msg = document.getElementById('gemini-key-message');
  const v = (input.value || '').trim();
  if (!v) { msg.textContent = '❌ Saisissez une clé valide.'; msg.style.color = 'var(--danger)'; return; }
  if (!v.startsWith('AIza') || v.length < 30) {
    if (!confirm("Cette clé ne ressemble pas au format Gemini classique (AIza...). L'enregistrer quand même ?")) return;
  }
  safeLocalSet('cyrias_gemini_key', v);
  msg.textContent = '✅ Clé enregistrée localement.';
  msg.style.color = 'var(--secondary-dark)';
  refreshGeminiKeyUI();
  setTimeout(() => { msg.textContent = ''; }, 4000);
}

function clearGeminiKey() {
  if (!confirm("Effacer la clé API Gemini stockée ?")) return;
  localStorage.removeItem('cyrias_gemini_key');
  document.getElementById('gemini-api-input').value = '';
  document.getElementById('gemini-key-message').textContent = '🗑️ Clé supprimée.';
  document.getElementById('gemini-key-message').style.color = 'var(--ink-muted)';
  refreshGeminiKeyUI();
}

function toggleGeminiKeyVisibility() {
  const input = document.getElementById('gemini-api-input');
  const btn = document.getElementById('gemini-toggle-vis');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
}


/* ============================================================================
   v13 — SELF-TESTS : suite de tests fonctionnels automatiques
   Lance : SelfTests.run() depuis la console, ou bouton dans Configuration
   ============================================================================ */
/* ============================================================================
   v13 — Flush memory : actions destructives sécurisées
   ============================================================================ */

/**
 * Liste tous les modules de données qui peuvent être effacés individuellement
 */
const FLUSHABLE_MODULES = [
  { key: 'cra_data_sources', label: 'Sources CRA importées', module: 'CRAminator' },
  { key: 'cra_budgets', label: 'Budgets par mission', module: 'CRAminator' },
  { key: 'cra_tjm', label: 'TJM par client', module: 'CRAminator' },
  { key: 'cra_demandes', label: 'Demandes / tickets CRAminator', module: 'CRAminator' },
  { key: 'cra_demandes_statuts', label: 'Statuts de demandes personnalisés', module: 'CRAminator' },
  { key: 'cyrias_kanban_tickets', label: 'Tickets du Kanban', module: 'Kanban' },
  { key: 'cyrias_decisions', label: 'Mémoire des décisions', module: 'Decisions' },
  { key: 'cyrias_engagements', label: 'Engagements clients', module: 'Engagements' },
  { key: 'cyrias_tasks', label: 'Tâches Organisator', module: 'Organisator' },
  { key: 'cyrias_snippets', label: 'Snippets de code', module: 'Snippetator' },
  { key: 'compagnon_links', label: 'Liens enregistrés', module: 'Liens' },
  { key: 'compagnon_cats', label: 'Catégories de liens', module: 'Liens' },
  { key: 'cyrias_scratchpad', label: 'Bloc-notes rapide', module: 'Scratchpad' },
  { key: 'cyrias_sql_templates_custom', label: 'Templates SQL personnalisés', module: 'SQL Generator' },
];

/**
 * Effacement de l'audit log — moins critique car pas de données métier
 */
function flushAuditLog() {
  const entries = AuditLog.getAll();
  const count = entries.length;
  if (count === 0) {
    toastInfo("L'historique d'audit est déjà vide");
    return;
  }
  showDangerModal({
    title: "Effacer l'historique d'audit",
    icon: '🗑️',
    severity: 'medium',
    intro: `Vous allez supprimer <strong>${count} entrée(s)</strong> du journal d'audit.`,
    impact: 'Cette action efface uniquement la trace des actions passées. Vos données métier (CRA, tickets, etc.) ne sont <strong>pas affectées</strong>.',
    confirmWord: null,  // simple confirmation
    onConfirm: () => {
      localStorage.removeItem('cyrias_audit_log');
      toastOk(`Historique d'audit effacé (${count} entrées)`);
      AuditLog.log('audit_log_flushed', `${count} entries removed`);
    }
  });
}
window.flushAuditLog = flushAuditLog;

/**
 * Effacement d'un module spécifique (avec sélection)
 */
function flushModuleData() {
  // Compter les données présentes par module
  const presence = FLUSHABLE_MODULES.map(m => {
    const raw = localStorage.getItem(m.key);
    let count = 0;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) count = parsed.length;
        else if (typeof parsed === 'object' && parsed !== null) count = Object.keys(parsed).length;
        else count = 1;
      } catch(e) { count = raw.length > 0 ? 1 : 0; }
    }
    return { ...m, count, size: raw ? new Blob([raw]).size : 0 };
  }).filter(m => m.count > 0);

  if (presence.length === 0) {
    toastInfo("Aucune donnée à effacer dans les modules");
    return;
  }

  let modal = document.getElementById('flush-module-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'flush-module-modal';
  modal.className = 'danger-modal-backdrop';
  modal.innerHTML = `
    <div class="danger-modal" style="width:min(640px,94vw);">
      <div class="danger-modal-header">
        <span style="font-size:24px;">🧹</span>
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;">Effacer un module</h3>
          <p style="margin:0;font-size:11px;opacity:0.9;">Sélectionnez les données à supprimer</p>
        </div>
      </div>
      <div class="danger-modal-body">
        <p style="font-size:13px;color:var(--ink-secondary);margin-bottom:14px;">
          Cochez les modules dont vous souhaitez effacer les données. Une sauvegarde sera proposée avant la suppression.
        </p>
        <div style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);">
          ${presence.map(m => `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-light);cursor:pointer;">
              <input type="checkbox" class="flush-mod-chk" value="${escapeHtml(m.key)}">
              <div style="flex:1;">
                <div style="font-weight:600;font-size:13px;color:var(--ink);">${escapeHtml(m.label)}</div>
                <div style="font-size:11px;color:var(--ink-muted);">${escapeHtml(m.module)} — ${m.count} entrée(s) • ${(m.size/1024).toFixed(1)} Ko</div>
              </div>
            </label>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" id="flush-mod-backup" checked>
            <span>Exporter une sauvegarde JSON avant</span>
          </label>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline" onclick="document.getElementById('flush-module-modal').remove()" style="font-size:12px;">Annuler</button>
            <button class="btn" style="background:var(--danger);color:white;font-size:12px;" onclick="confirmFlushModules()">Effacer la sélection</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.flushModuleData = flushModuleData;

function confirmFlushModules() {
  const selected = [...document.querySelectorAll('.flush-mod-chk:checked')].map(c => c.value);
  if (selected.length === 0) {
    toastWarn("Aucun module sélectionné");
    return;
  }
  const doBackup = document.getElementById('flush-mod-backup').checked;
  const labels = selected.map(k => FLUSHABLE_MODULES.find(m => m.key === k)?.label || k);

  showDangerModal({
    title: `Confirmer l'effacement (${selected.length} module${selected.length>1?'s':''})`,
    icon: '⚠️',
    severity: 'high',
    intro: `Vous allez supprimer définitivement les données suivantes :`,
    list: labels,
    impact: doBackup
      ? 'Une sauvegarde JSON sera téléchargée juste avant la suppression — vous pourrez la réimporter en cas de regret.'
      : '<strong>⚠️ Aucune sauvegarde ne sera effectuée.</strong> Les données seront perdues définitivement.',
    confirmWord: 'EFFACER',
    onConfirm: () => {
      // Fermer le modal de sélection
      document.getElementById('flush-module-modal')?.remove();
      // Backup avant suppression si demandé
      if (doBackup) {
        try { exportFullBackup(); } catch(e) { console.warn('Backup avant flush a échoué', e); }
      }
      // Suppression
      selected.forEach(key => localStorage.removeItem(key));
      toastOk(`${selected.length} module(s) effacé(s)`, { title: 'Mémoire nettoyée' });
      AuditLog.log('module_data_flushed', selected.join(', '));
      // Rafraîchir les indicateurs
      if (typeof refreshStorageQuota === 'function') refreshStorageQuota();
      // Proposer de recharger
      setTimeout(() => {
        if (confirm("Recharger la page pour appliquer le nettoyage ?")) location.reload();
      }, 800);
    }
  });
}
window.confirmFlushModules = confirmFlushModules;

/**
 * Flush total — efface absolument tout
 */
function flushAllMemory() {
  // Compter ce qui va disparaître
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (CYRIAS_STORAGE_PREFIXES.some(p => k.startsWith(p)) ||
        k === 'compagnon_links' || k === 'compagnon_cats') {
      allKeys.push(k);
    }
  }
  if (allKeys.length === 0) {
    toastInfo("La mémoire du portail est déjà vide");
    return;
  }
  let totalSize = 0;
  allKeys.forEach(k => totalSize += new Blob([localStorage.getItem(k) || '']).size);

  showDangerModal({
    title: 'Effacer toute la mémoire — Flush memory',
    icon: '💥',
    severity: 'critical',
    intro: `Vous allez supprimer <strong>l'intégralité des données</strong> du portail Cyrias Buddy.`,
    list: [
      `${allKeys.length} clés de stockage`,
      `${(totalSize/1024).toFixed(1)} Ko de données`,
      'Sources CRA, tickets, snippets, décisions, engagements, liens, préférences…',
      'L\'historique d\'audit, les sauvegardes auto et le marqueur d\'onboarding'
    ],
    impact: '<strong>Action IRRÉVERSIBLE.</strong> Une sauvegarde JSON complète sera téléchargée automatiquement avant la suppression. Conservez-la précieusement si vous voulez pouvoir restaurer.',
    confirmWord: 'FLUSH MEMORY',
    onConfirm: () => {
      // Backup automatique forcé
      try { exportFullBackup(); }
      catch(e) {
        if (!confirm("La sauvegarde automatique a échoué. Continuer quand même ?\n\n(Vos données seront DÉFINITIVEMENT perdues)")) return;
      }
      // Petite pause pour laisser le téléchargement se déclencher
      setTimeout(() => {
        // Suppression complète
        allKeys.forEach(k => localStorage.removeItem(k));
        // Marqueur de flush pour redéclencher l'onboarding
        toastOk("Mémoire du portail effacée — bienvenue dans une page blanche !", { title: 'Flush memory ✓', duration: 6000 });
        // Auto-reload après 1.5s
        setTimeout(() => location.reload(), 1800);
      }, 600);
    }
  });
}
window.flushAllMemory = flushAllMemory;

/**
 * Modal générique de confirmation destructive
 * @param {Object} opts
 *   - title: string
 *   - icon: string emoji
 *   - severity: 'medium' | 'high' | 'critical'
 *   - intro: HTML
 *   - list?: Array<string> — éléments à lister
 *   - impact: HTML
 *   - confirmWord?: string — mot à taper pour confirmer (null = simple bouton)
 *   - onConfirm: function
 */
function showDangerModal(opts) {
  let modal = document.getElementById('danger-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'danger-modal';
  modal.className = 'danger-modal-backdrop';

  const colors = { medium: '#D97706', high: 'var(--danger)', critical: '#991B1B' };
  const headerColor = colors[opts.severity] || 'var(--danger)';

  const listHtml = opts.list && opts.list.length > 0
    ? `<ul style="background:var(--bg);padding:10px 14px 10px 28px;border-radius:var(--radius-sm);border-left:3px solid ${headerColor};margin:12px 0;font-size:12.5px;color:var(--ink-secondary);">
         ${opts.list.map(item => `<li style="margin:3px 0;">${escapeHtml(item)}</li>`).join('')}
       </ul>`
    : '';

  const confirmInputHtml = opts.confirmWord
    ? `<div style="margin-top:14px;padding:12px;background:#FEF3C7;border-radius:var(--radius-sm);border-left:3px solid var(--warn);">
         <p style="font-size:12px;color:var(--ink);margin:0 0 6px 0;">
           Pour confirmer, tapez exactement <code style="background:white;padding:2px 6px;border-radius:3px;font-family:'JetBrains Mono',monospace;color:var(--danger);font-weight:700;">${escapeHtml(opts.confirmWord)}</code> ci-dessous :
         </p>
         <input type="text" id="danger-confirm-input" class="danger-confirm-input" placeholder="${escapeHtml(opts.confirmWord)}" autocomplete="off">
       </div>`
    : '';

  modal.innerHTML = `
    <div class="danger-modal" style="border-color:${headerColor};">
      <div class="danger-modal-header" style="background:${headerColor};">
        <span style="font-size:26px;">${opts.icon || '⚠️'}</span>
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;">${escapeHtml(opts.title)}</h3>
          <p style="margin:0;font-size:11px;opacity:0.9;text-transform:uppercase;letter-spacing:0.5px;">Action destructive</p>
        </div>
      </div>
      <div class="danger-modal-body">
        <p style="font-size:13.5px;color:var(--ink);margin:0 0 8px 0;line-height:1.5;">${opts.intro || ''}</p>
        ${listHtml}
        <p style="font-size:12.5px;color:var(--ink-secondary);margin:12px 0 0 0;line-height:1.5;">${opts.impact || ''}</p>
        ${confirmInputHtml}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
          <button class="btn btn-outline" onclick="document.getElementById('danger-modal').remove()" style="font-size:13px;">Annuler</button>
          <button id="danger-confirm-btn" class="btn" style="background:${headerColor};color:white;font-size:13px;${opts.confirmWord ? 'opacity:0.4;pointer-events:none;' : ''}">
            ${opts.confirmWord ? '🔓 Confirmer la suppression' : '✓ Confirmer'}
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Activation du bouton uniquement si le mot est correctement tapé
  if (opts.confirmWord) {
    const input = document.getElementById('danger-confirm-input');
    const btn = document.getElementById('danger-confirm-btn');
    input.focus();
    input.addEventListener('input', () => {
      if (input.value === opts.confirmWord) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.textContent = '🔥 Confirmer la suppression';
      } else {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
        btn.textContent = '🔓 Confirmer la suppression';
      }
    });
  }

  document.getElementById('danger-confirm-btn').onclick = () => {
    if (opts.confirmWord) {
      const input = document.getElementById('danger-confirm-input');
      if (input.value !== opts.confirmWord) return;
    }
    modal.remove();
    try { opts.onConfirm(); }
    catch(e) {
      console.error('Flush onConfirm failed', e);
      toastErr("Une erreur est survenue : " + e.message);
    }
  };

  // Esc pour annuler
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
window.showDangerModal = showDangerModal;
