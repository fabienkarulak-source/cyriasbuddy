/* ============================================================
   Cyrias Buddy — Features (#3 to #30)
   ============================================================ */
// ============================================================
// FEATURE #11 — Détection automatique d'anomalies
// ============================================================
const AnomalyDetector = {
  rules: [
    // Tickets/demandes ouverts depuis trop longtemps
    {
      id: 'stale_demandes',
      label: 'Demandes sans mouvement',
      check() {
        const demandes = CyriasData.getDemandes();
        const now = Date.now();
        const threshold = 7 * 24 * 60 * 60 * 1000; // 7 jours
        const stale = demandes.filter(d => {
          if (!d || d.statut === 'Clôturé' || d.statut === 'Fermé') return false;
          const lastUpdate = d.derniere_maj || d.dateUpdate || d.dateCreation || d.date;
          if (!lastUpdate) return false;
          const ts = new Date(lastUpdate).getTime();
          return !isNaN(ts) && (now - ts > threshold);
        });
        return stale.length > 0 ? {
          severity: 'warn',
          icon: '⏰',
          title: `${stale.length} demande(s) sans mouvement depuis +7j`,
          detail: stale.slice(0, 3).map(d => `#${d.numero || d.id || '?'} ${(d.description || d.titre || '').slice(0, 50)}`).join(' • '),
          action: { label: 'Voir', cb: () => navigateTo('craminator') }
        } : null;
      }
    },
    // Budgets dépassés ou en limite
    {
      id: 'budget_critical',
      label: 'Budgets critiques',
      check() {
        const budgets = CyriasData.getBudgets();
        const cra = CyriasData.getCRA();
        if (cra.length === 0) return null;
        const consoByMission = {};
        cra.forEach(d => { if (d.mission) consoByMission[d.mission] = (consoByMission[d.mission] || 0) + (parseFloat(d.jours) || 0); });
        const alerts = [];
        Object.entries(budgets).forEach(([mission, b]) => {
          const budget = b && (b.budget || b);
          if (!budget || budget <= 0 || (b && b.closed)) return;
          const conso = consoByMission[mission] || 0;
          const pct = (conso / budget) * 100;
          if (pct >= 90) alerts.push({ mission, pct: pct.toFixed(0), conso: conso.toFixed(1), budget });
        });
        return alerts.length > 0 ? {
          severity: alerts.some(a => a.pct >= 100) ? 'err' : 'warn',
          icon: alerts.some(a => a.pct >= 100) ? '🔴' : '🟠',
          title: `${alerts.length} budget(s) en zone critique (≥90%)`,
          detail: alerts.slice(0, 3).map(a => `${a.mission} : ${a.pct}%`).join(' • '),
          action: { label: 'Voir CRAminator', cb: () => navigateTo('craminator') }
        } : null;
      }
    },
    // Tâches Organisator en retard
    {
      id: 'overdue_tasks',
      label: 'Tâches en retard',
      check() {
        const tasks = CyriasData.getTasks();
        const today = new Date(); today.setHours(0,0,0,0);
        const overdue = tasks.filter(t => {
          if (!t || t.completed || t.done || t.status === 'done') return false;
          if (!t.dueDate && !t.echeance && !t.date) return false;
          const due = new Date(t.dueDate || t.echeance || t.date);
          return !isNaN(due.getTime()) && due < today;
        });
        return overdue.length > 0 ? {
          severity: 'warn',
          icon: '📅',
          title: `${overdue.length} tâche(s) en retard dans Organisator`,
          detail: overdue.slice(0, 3).map(t => t.title || t.titre || t.label || '?').join(' • '),
          action: { label: 'Voir', cb: () => navigateTo('organisator') }
        } : null;
      }
    },
    // CRA absent ce mois
    {
      id: 'missing_cra',
      label: 'CRA récent manquant',
      check() {
        const cra = CyriasData.getCRA();
        if (cra.length === 0) {
          return {
            severity: 'info',
            icon: '📥',
            title: 'Aucune source CRA importée',
            detail: 'Importez vos exports Stafiz dans CRAminator pour activer toutes les fonctionnalités',
            action: { label: 'Importer', cb: () => navigateTo('craminator') }
          };
        }
        // Vérifier si on a des données sur le mois en cours
        const now = new Date();
        const currentYear = now.getFullYear(), currentMonth = now.getMonth();
        const hasCurrentMonth = cra.some(d => {
          const dt = new Date(d.date || d.dateSaisie || 0);
          return dt.getFullYear() === currentYear && dt.getMonth() === currentMonth;
        });
        return !hasCurrentMonth ? {
          severity: 'info',
          icon: '🗓️',
          title: 'Pas encore de saisie CRA pour le mois en cours',
          detail: `${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} — pensez à importer le dernier export Stafiz`,
          action: { label: 'CRAminator', cb: () => navigateTo('craminator') }
        } : null;
      }
    },
    // Sauvegarde ancienne
    {
      id: 'old_backup',
      label: 'Sauvegarde ancienne',
      check() {
        const last = localStorage.getItem('cyrias_last_backup');
        if (!last) return null;
        const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
        return days > 14 ? {
          severity: 'warn',
          icon: '💾',
          title: `Dernière sauvegarde il y a ${days} jours`,
          detail: 'Pensez à exporter une nouvelle sauvegarde depuis Configuration',
          action: { label: 'Configuration', cb: () => navigateTo('config') }
        } : null;
      }
    }
  ],

  scan() {
    const results = [];
    this.rules.forEach(rule => {
      try {
        const r = rule.check();
        if (r) results.push({ ...r, ruleId: rule.id });
      } catch(e) { console.warn(`Anomaly rule ${rule.id} error`, e); }
    });
    return results;
  }
};
window.AnomalyDetector = AnomalyDetector;

function renderAnomaliesPanel() {
  const container = document.getElementById('anomalies-container');
  if (!container) return;
  const anomalies = AnomalyDetector.scan();
  if (anomalies.length === 0) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--ink-muted);">
        <div style="font-size:32px;margin-bottom:8px;">✨</div>
        <div style="font-weight:600;color:var(--ok);">Tout va bien !</div>
        <div style="font-size:12px;margin-top:4px;">Aucune anomalie détectée pour le moment.</div>
      </div>`;
    return;
  }
  const sevColor = { err: 'var(--danger)', warn: 'var(--warn)', info: 'var(--info)' };
  const sevBg = { err: 'var(--danger-bg)', warn: 'var(--warn-bg)', info: 'var(--info-bg)' };
  container.innerHTML = anomalies.map((a, idx) => `
    <div class="anomaly-card" style="background:${sevBg[a.severity] || 'var(--bg)'};border-left:4px solid ${sevColor[a.severity] || 'var(--ink-muted)'};padding:12px 14px;border-radius:6px;display:flex;align-items:flex-start;gap:12px;margin-bottom:8px;">
      <div style="font-size:20px;flex-shrink:0;line-height:1.2;">${a.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:13px;color:var(--ink);">${escapeHtml(a.title)}</div>
        <div style="font-size:11.5px;color:var(--ink-secondary);margin-top:2px;line-height:1.4;">${escapeHtml(a.detail)}</div>
      </div>
      ${a.action ? `<button class="btn btn-outline" style="font-size:11px;padding:4px 10px;flex-shrink:0;" data-anomaly-idx="${idx}">${escapeHtml(a.action.label)}</button>` : ''}
    </div>
  `).join('');
  // Bind actions
  container.querySelectorAll('[data-anomaly-idx]').forEach(btn => {
    const idx = parseInt(btn.dataset.anomalyIdx);
    btn.addEventListener('click', () => anomalies[idx].action.cb());
  });
}

// ============================================================
// FEATURE #12 — Pomodoro intégré
// ============================================================
const Pomodoro = {
  state: { running: false, phase: 'work', secondsLeft: 25 * 60, completedToday: 0, currentTask: '' },
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  interval: null,

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('cyrias_pomodoro') || '{}');
      const today = new Date().toDateString();
      if (saved.dateStr === today) {
        this.state.completedToday = saved.completedToday || 0;
      }
    } catch(e) {}
  },
  save() {
    safeLocalSet('cyrias_pomodoro', JSON.stringify({
      dateStr: new Date().toDateString(),
      completedToday: this.state.completedToday
    }));
  },
  start(taskName = '') {
    if (this.state.running) return;
    this.state.running = true;
    this.state.currentTask = taskName;
    this.interval = setInterval(() => this.tick(), 1000);
    this.render();
  },
  pause() {
    this.state.running = false;
    if (this.interval) clearInterval(this.interval);
    this.render();
  },
  reset() {
    this.pause();
    this.state.phase = 'work';
    this.state.secondsLeft = this.workDuration;
    this.render();
  },
  tick() {
    this.state.secondsLeft--;
    if (this.state.secondsLeft <= 0) {
      this.pause();
      if (this.state.phase === 'work') {
        this.state.completedToday++;
        this.save();
        this.notify('🍅 Pomodoro terminé !', `Pause bien méritée. ${this.state.completedToday} pomodoro(s) aujourd'hui.`);
        this.state.phase = 'break';
        this.state.secondsLeft = this.breakDuration;
        // Demander si l'utilisateur veut noter ce qu'il a fait
        const task = this.state.currentTask || prompt("Sur quoi avez-vous travaillé pendant ce pomodoro ?", "");
        if (task && task.trim()) {
          AuditLog.log('pomodoro_completed', task.trim());
        }
      } else {
        this.notify('⏰ Pause terminée', 'Prêt pour un nouveau cycle de focus ?');
        this.state.phase = 'work';
        this.state.secondsLeft = this.workDuration;
      }
    }
    this.render();
  },
  notify(title, body) {
    toastOk(body, { title });
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: '🍅' }); } catch(e) {}
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  },
  render() {
    const widget = document.getElementById('pomodoro-widget');
    if (!widget) return;
    const m = Math.floor(this.state.secondsLeft / 60);
    const s = this.state.secondsLeft % 60;
    const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const phaseLabel = this.state.phase === 'work' ? '🎯 Focus' : '☕ Pause';
    
    // Classe sur le widget pour styling phase
    widget.classList.toggle('pomo-phase-work', this.state.phase === 'work');
    widget.classList.toggle('pomo-phase-break', this.state.phase === 'break');
    widget.classList.toggle('pomo-running', this.state.running);
    
    widget.querySelector('.pomo-time').textContent = timeStr;
    widget.querySelector('.pomo-phase').textContent = phaseLabel;
    widget.querySelector('.pomo-count').textContent = this.state.completedToday;
    
    // Progress bar
    const total = this.state.phase === 'work' ? this.workDuration : this.breakDuration;
    const progress = ((total - this.state.secondsLeft) / total) * 100;
    const bar = widget.querySelector('.pomo-progress-bar');
    if (bar) bar.style.width = progress + '%';
  },
  toggleVisible() {
    const w = document.getElementById('pomodoro-widget');
    if (!w) return;
    const isHidden = w.classList.contains('pomo-hidden');
    w.classList.toggle('pomo-hidden');
    safeLocalSet('cyrias_pomodoro_visible', isHidden ? '1' : '0');
    if (isHidden) this.render();
  }
};
window.Pomodoro = Pomodoro;

// ============================================================
// FEATURE #13 — Templates SQL Ivalua métier
// ============================================================
const SqlTemplates = {
  templates: [
    {
      id: 'fournisseur-commandes',
      label: 'Commandes d\'un fournisseur sur période',
      category: 'Fournisseurs',
      sql: `-- Récupérer toutes les commandes d'un fournisseur sur une période
SELECT 
    O.code AS code_commande,
    O.label AS libelle,
    O.creationDate AS date_creation,
    O.totalNetAmount AS montant_HT,
    S.code AS code_fournisseur,
    S.name AS nom_fournisseur,
    U.firstName + ' ' + U.lastName AS demandeur
FROM dbo.t_order O
INNER JOIN dbo.t_supplier S ON O.supplierId = S.id
INNER JOIN dbo.t_user U ON O.requesterId = U.id
WHERE S.code = '{{CODE_FOURNISSEUR}}'
  AND O.creationDate BETWEEN '{{DATE_DEBUT}}' AND '{{DATE_FIN}}'
  AND O.statusId NOT IN (90, 99) -- Exclure les annulés
ORDER BY O.creationDate DESC;`
    },
    {
      id: 'users-inactifs',
      label: 'Utilisateurs inactifs depuis X mois',
      category: 'Utilisateurs',
      sql: `-- Identifier les utilisateurs sans connexion depuis {{MOIS}} mois
SELECT 
    U.id,
    U.code,
    U.firstName + ' ' + U.lastName AS nom_complet,
    U.email,
    U.lastLoginDate AS derniere_connexion,
    DATEDIFF(DAY, U.lastLoginDate, GETDATE()) AS jours_sans_connexion,
    O.label AS organisation
FROM dbo.t_user U
LEFT JOIN dbo.t_organisation O ON U.organisationId = O.id
WHERE U.isActive = 1
  AND (U.lastLoginDate IS NULL 
       OR U.lastLoginDate < DATEADD(MONTH, -{{MOIS}}, GETDATE()))
ORDER BY U.lastLoginDate ASC;`
    },
    {
      id: 'workflows-bloques',
      label: 'Workflows bloqués (>{{JOURS}}j sans mouvement)',
      category: 'Workflow',
      sql: `-- Workflows en attente depuis plus de {{JOURS}} jours
SELECT 
    WF.id AS workflow_id,
    O.code AS objet_code,
    O.label AS objet_label,
    WS.label AS statut_actuel,
    WF.lastActionDate AS derniere_action,
    DATEDIFF(DAY, WF.lastActionDate, GETDATE()) AS jours_blocage,
    U.firstName + ' ' + U.lastName AS dernier_acteur
FROM dbo.t_workflow WF
INNER JOIN dbo.t_workflow_step WS ON WF.currentStepId = WS.id
INNER JOIN dbo.t_object O ON WF.objectId = O.id
LEFT JOIN dbo.t_user U ON WF.lastActionUserId = U.id
WHERE WF.statusId = 1 -- En cours
  AND WF.lastActionDate < DATEADD(DAY, -{{JOURS}}, GETDATE())
ORDER BY WF.lastActionDate ASC;`
    },
    {
      id: 'compare-environnements',
      label: 'Comparer paramètres entre 2 environnements',
      category: 'Configuration',
      sql: `-- Comparer une table de paramètres entre 2 bases (DEV vs PROD)
-- À exécuter sur chaque environnement et diffé les résultats
SELECT 
    P.paramKey,
    P.paramValue,
    P.scope,
    P.lastModified
FROM dbo.t_parameter P
WHERE P.paramKey LIKE '{{PREFIXE_PARAM}}%'
ORDER BY P.scope, P.paramKey;

-- Astuce : exporter les résultats DEV et PROD en CSV puis utiliser
-- l'outil "Ivalua Context Translator" pour visualiser les différences.`
    },
    {
      id: 'audit-modifs',
      label: 'Audit des modifications sur une table',
      category: 'Audit',
      sql: `-- Historique des modifications d'un objet sur les {{JOURS}} derniers jours
SELECT 
    A.actionDate,
    U.firstName + ' ' + U.lastName AS auteur,
    A.actionType, -- 1=Create, 2=Update, 3=Delete
    A.oldValue,
    A.newValue,
    A.fieldName
FROM dbo.t_audit_log A
INNER JOIN dbo.t_user U ON A.userId = U.id
WHERE A.tableName = '{{NOM_TABLE}}'
  AND A.recordId = {{ID_OBJET}}
  AND A.actionDate > DATEADD(DAY, -{{JOURS}}, GETDATE())
ORDER BY A.actionDate DESC;`
    },
    {
      id: 'workload-acheteurs',
      label: 'Charge de travail par acheteur',
      category: 'Acheteurs',
      sql: `-- Vue de la charge de travail des acheteurs
SELECT 
    U.firstName + ' ' + U.lastName AS acheteur,
    COUNT(DISTINCT O.id) AS nb_commandes_en_cours,
    SUM(O.totalNetAmount) AS volume_HT,
    AVG(DATEDIFF(DAY, O.creationDate, GETDATE())) AS anciennete_moy_jours
FROM dbo.t_order O
INNER JOIN dbo.t_user U ON O.buyerId = U.id
WHERE O.statusId IN (10, 20, 30) -- Statuts "en cours"
GROUP BY U.firstName, U.lastName
ORDER BY nb_commandes_en_cours DESC;`
    }
  ],
  loadCustom() {
    try {
      const c = JSON.parse(localStorage.getItem('cyrias_sql_templates_custom') || '[]');
      return c;
    } catch(e) { return []; }
  },
  saveCustom(t) {
    const all = this.loadCustom();
    all.push({ ...t, id: 'custom_' + Date.now(), category: 'Personnalisé' });
    safeLocalSet('cyrias_sql_templates_custom', JSON.stringify(all));
    AuditLog.log('sql_template_added', t.label);
    toastOk(`Template "${t.label}" enregistré`);
  },
  getAll() {
    return [...this.templates, ...this.loadCustom()];
  },
  insertTemplate(id) {
    const t = this.getAll().find(t => t.id === id);
    if (!t) return;
    AuditLog.log('sql_template_used', t.label);
    // Détecter les variables {{XXX}}
    const vars = [...new Set((t.sql.match(/\{\{([A-Z_]+)\}\}/g) || []).map(v => v.replace(/[{}]/g, '')))];
    let sql = t.sql;
    if (vars.length > 0) {
      vars.forEach(v => {
        const val = prompt(`Valeur pour ${v} :`, '');
        if (val !== null && val !== '') sql = sql.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val);
      });
    }
    // Copier dans le presse-papier
    navigator.clipboard.writeText(sql).then(() => {
      toastOk('Requête SQL copiée dans le presse-papier', { title: t.label });
    }).catch(() => {
      toastInfo('Requête générée — sélectionnez et copiez le contenu ci-dessous');
    });
    // Afficher dans un éventuel champ d'édition SQL si présent
    const sqlEdit = document.getElementById('sql-result') || document.getElementById('sql-output');
    if (sqlEdit) sqlEdit.value = sql;
    return sql;
  }
};
window.SqlTemplates = SqlTemplates;

function openSqlTemplateLibrary() {
  let modal = document.getElementById('sql-template-modal');
  if (modal) { modal.remove(); return; }
  const all = SqlTemplates.getAll();
  const cats = [...new Set(all.map(t => t.category))];
  modal = document.createElement('div');
  modal.id = 'sql-template-modal';
  modal.className = 'dyn-modal-overlay';
  modal.innerHTML = `
    <div class="dyn-modal" style="width:min(740px,94vw);">
      <div class="dyn-modal-header">
        <div>
          <h3>📚 Bibliothèque SQL Ivalua</h3>
          <p>Templates métier prêts à l'emploi — variables remplies à la sélection</p>
        </div>
        <button class="dyn-modal-close" onclick="document.getElementById('sql-template-modal').remove()">×</button>
      </div>
      <div class="dyn-modal-body">
        ${cats.map(cat => `
          <div style="margin-bottom:18px;">
            <div class="form-label" style="margin-bottom:8px;">${escapeHtml(cat)}</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${all.filter(t => t.category === cat).map(t => `
                <div class="sql-tpl-card" onclick="SqlTemplates.insertTemplate('${t.id}');document.getElementById('sql-template-modal').remove();">
                  <div class="sql-tpl-label">${escapeHtml(t.label)}</div>
                  <div class="sql-tpl-preview">${escapeHtml(t.sql.split('\n')[0])}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="dyn-modal-footer">
        <span style="font-size:var(--fs-xs);color:var(--ink-muted);">
          💡 Raccourci : <kbd style="font-family:var(--font-mono);background:var(--surface);padding:2px 6px;border-radius:4px;border:1px solid var(--border);font-size:10px;font-weight:600;">Ctrl+Shift+S</kbd> depuis n'importe où
        </span>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('sql-template-modal').remove()">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.openSqlTemplateLibrary = openSqlTemplateLibrary;

// Raccourci Ctrl+Shift+S
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    openSqlTemplateLibrary();
  }
});

// ============================================================
// FEATURE #9 — Templates de mails paramétrés
// ============================================================
const MailTemplates = {
  templates: [
    {
      id: 'rappel-cra',
      label: 'Rappel CRA hebdomadaire',
      subject: 'Rappel : saisie CRA semaine {{semaine}}',
      body: `Bonjour {{prenom}},

Petit rappel concernant la saisie de ton CRA pour la semaine {{semaine}}.

Merci de bien vouloir compléter Stafiz d'ici vendredi 17h afin que nous puissions consolider les données client et préparer le reporting hebdomadaire.

En cas de difficulté ou de question, n'hésite pas à me solliciter.

Belle journée,
{{user}}`
    },
    {
      id: 'alerte-budget',
      label: 'Alerte dépassement budget client',
      subject: 'Point de vigilance — consommation budgétaire {{client}}',
      body: `Bonjour,

Je me permets de revenir vers vous concernant la consommation de notre enveloppe TMA.

À ce jour, nous avons consommé {{conso}} jours sur les {{budget}} alloués pour {{mission}}, soit {{pct}}% de l'enveloppe.

Je vous propose d'échanger sur les actions à mettre en place :
• Priorisation des demandes en cours
• Évaluation d'une éventuelle rallonge budgétaire
• Décalage des sujets non critiques sur le prochain trimestre

Pouvons-nous prévoir un point cette semaine ?

Cordialement,
{{user}}`
    },
    {
      id: 'cr-hebdo',
      label: 'Compte-rendu hebdomadaire',
      subject: 'CR TMA semaine {{semaine}} — {{client}}',
      body: `Bonjour,

Voici le compte-rendu de notre activité TMA pour la semaine {{semaine}}.

📊 INDICATEURS CLÉS
• Tickets traités : {{tickets_traites}}
• Tickets en cours : {{tickets_ouverts}}
• MEP réalisées : {{mep}}
• Consommation : {{conso}} jours

✅ POINTS MARQUANTS
• [À compléter]

⚠️ POINTS D'ATTENTION
• [À compléter]

📅 SEMAINE PROCHAINE
• [À compléter]

Restant à votre disposition pour tout échange,

{{user}}`
    },
    {
      id: 'demande-uat',
      label: 'Demande de validation UAT',
      subject: 'Validation UAT requise — {{ticket}}',
      body: `Bonjour {{prenom}},

Le développement du ticket {{ticket}} ({{description}}) est terminé et déployé en environnement de recette.

Pourriez-vous procéder aux tests d'acceptation utilisateur (UAT) et nous remonter votre validation, idéalement avant {{date_limite}} afin de planifier la mise en production.

Liens utiles :
• Ticket Ivalua : {{lien_ticket}}
• Environnement UAT : {{lien_uat}}

Pour toute question, je reste disponible.

Cordialement,
{{user}}`
    },
    {
      id: 'annonce-mep',
      label: 'Annonce de mise en production',
      subject: 'Annonce MEP — {{date_mep}} — {{description}}',
      body: `Bonjour à tous,

Nous prévoyons la mise en production suivante :

📦 Objet : {{description}}
📅 Date : {{date_mep}}
⏱️ Fenêtre : {{horaire}}
⚠️ Impact : {{impact}}

Tickets concernés :
• {{tickets}}

Aucune action n'est requise de votre part en amont. En cas d'anomalie post-MEP, merci de remonter directement via Ivalua.

Cordialement,
L'équipe TMA`
    },
    {
      id: 'qualif-ticket',
      label: 'Demande de qualification ticket',
      subject: 'Précisions nécessaires — {{ticket}}',
      body: `Bonjour {{prenom}},

Nous avons bien reçu le ticket {{ticket}}. Afin de pouvoir le qualifier et le prendre en charge dans les meilleurs délais, pourriez-vous nous apporter les précisions suivantes :

❓ Contexte d'apparition (utilisateur, écran, action) :
❓ Reproductibilité (à chaque fois / aléatoire / une seule occurrence) :
❓ Impact métier (bloquant / gênant / cosmétique) :
❓ Capture d'écran ou logs si disponibles :

Ces informations nous permettront d'évaluer correctement la criticité et de prioriser le traitement.

Merci d'avance,
{{user}}`
    }
  ],
  fillVariables(template, context = {}) {
    const username = localStorage.getItem('cyrias_username') || 'L\'équipe TMA';
    const now = new Date();
    const week = getWeekNumber(now);
    const defaults = {
      user: username,
      semaine: `S${week}`,
      date: now.toLocaleDateString('fr-FR'),
      annee: now.getFullYear(),
      mois: now.toLocaleDateString('fr-FR', { month: 'long' })
    };
    const ctx = { ...defaults, ...context };
    let body = template.body;
    let subject = template.subject || '';
    Object.entries(ctx).forEach(([k, v]) => {
      const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
      body = body.replace(re, v);
      subject = subject.replace(re, v);
    });
    return { subject, body };
  }
};
window.MailTemplates = MailTemplates;

function openMailTemplatesLibrary() {
  let modal = document.getElementById('mail-template-modal');
  if (modal) { modal.remove(); return; }
  modal = document.createElement('div');
  modal.id = 'mail-template-modal';
  modal.className = 'dyn-modal-overlay';
  modal.innerHTML = `
    <div class="dyn-modal" style="width:min(860px,94vw);height:min(640px,90vh);">
      <div class="dyn-modal-header">
        <div>
          <h3>✉️ Bibliothèque de mails</h3>
          <p>Templates pré-remplis avec variables dynamiques</p>
        </div>
        <button class="dyn-modal-close" onclick="document.getElementById('mail-template-modal').remove()">×</button>
      </div>
      <div style="display:grid;grid-template-columns:260px 1fr;flex:1;overflow:hidden;">
        <div style="border-right:1px solid var(--divider);overflow-y:auto;background:var(--bg-subtle);">
          ${MailTemplates.templates.map((t, i) => `
            <div class="mtpl-item" data-idx="${i}">
              <div class="mtpl-item-label">${escapeHtml(t.label)}</div>
              <div class="mtpl-item-subject">${escapeHtml(t.subject)}</div>
            </div>
          `).join('')}
        </div>
        <div id="mtpl-preview" style="padding:20px 22px;overflow-y:auto;display:flex;flex-direction:column;background:var(--surface);">
          <div class="empty-state" style="margin-top:80px;">
            <div class="empty-state-icon">←</div>
            <div class="empty-state-title">Sélectionnez un template</div>
            <div class="empty-state-text">Choisissez un modèle dans la liste à gauche pour commencer</div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  modal.querySelectorAll('.mtpl-item').forEach(el => {
    el.addEventListener('click', () => {
      modal.querySelectorAll('.mtpl-item').forEach(x => x.classList.remove('mtpl-item-active'));
      el.classList.add('mtpl-item-active');
      const t = MailTemplates.templates[parseInt(el.dataset.idx)];
      const filled = MailTemplates.fillVariables(t);
      const preview = document.getElementById('mtpl-preview');
      preview.innerHTML = `
        <div style="margin-bottom:14px;">
          <label class="form-label">Objet</label>
          <input id="mtpl-subject" class="form-input" value="${escapeHtml(filled.subject)}">
        </div>
        <div style="margin-bottom:14px;flex:1;display:flex;flex-direction:column;">
          <label class="form-label">Corps du mail</label>
          <textarea id="mtpl-body" class="form-input" style="font-family:var(--font-mono);font-size:12px;line-height:1.5;flex:1;min-height:240px;resize:vertical;">${escapeHtml(filled.body)}</textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="copyMailTemplate('subject')">Copier objet</button>
          <button class="btn btn-outline btn-sm" onclick="copyMailTemplate('body')">Copier corps</button>
          <button class="btn btn-primary btn-sm" onclick="copyMailTemplate('both')">Copier tout</button>
          <button class="btn btn-secondary btn-sm" onclick="openMailInClient()">📧 Ouvrir dans mon client</button>
        </div>
        <div style="font-size:var(--fs-xs);color:var(--ink-muted);margin-top:10px;line-height:1.5;">
          💡 Les <kbd style="font-family:var(--font-mono);background:var(--bg-subtle);padding:1px 5px;border-radius:3px;border:1px solid var(--border);font-size:10px;">{{variables}}</kbd> non remplies peuvent être éditées directement avant copie.
        </div>`;
    });
  });
}
window.openMailTemplatesLibrary = openMailTemplatesLibrary;

function copyMailTemplate(what) {
  const subject = document.getElementById('mtpl-subject').value;
  const body = document.getElementById('mtpl-body').value;
  let toCopy = '';
  if (what === 'subject') toCopy = subject;
  else if (what === 'body') toCopy = body;
  else toCopy = `Objet : ${subject}\n\n${body}`;
  navigator.clipboard.writeText(toCopy).then(() => toastOk('Copié dans le presse-papier'));
  AuditLog.log('mail_template_copied', what);
}
window.copyMailTemplate = copyMailTemplate;

function openMailInClient() {
  const subject = document.getElementById('mtpl-subject').value;
  const body = document.getElementById('mtpl-body').value;
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  AuditLog.log('mail_template_opened_in_client');
}
window.openMailInClient = openMailInClient;

// ============================================================
// FEATURE #10 — Standup quotidien guidé
// ============================================================
function generateStandupReport() {
  const username = localStorage.getItem('cyrias_username') || 'Moi';
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  
  // Tâches Organisator terminées hier
  const tasks = CyriasData.getTasks();
  const yesterdayStart = new Date(yesterday); yesterdayStart.setHours(0,0,0,0);
  const yesterdayEnd = new Date(yesterday); yesterdayEnd.setHours(23,59,59,999);
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  
  const doneYesterday = tasks.filter(t => {
    if (!t || (!t.completed && !t.done && t.status !== 'done')) return false;
    const ts = new Date(t.completedAt || t.dateCompleted || t.dateUpdate || 0).getTime();
    return ts >= yesterdayStart.getTime() && ts <= yesterdayEnd.getTime();
  });
  
  // Tâches du jour
  const todayTasks = tasks.filter(t => {
    if (!t || t.completed || t.done || t.status === 'done') return false;
    if (t.dueDate || t.echeance) {
      const due = new Date(t.dueDate || t.echeance);
      return !isNaN(due.getTime()) && due.toDateString() === now.toDateString();
    }
    return false;
  });
  
  // Anomalies = risques
  const anomalies = AnomalyDetector.scan().filter(a => a.severity !== 'info');
  
  // Pomodoros hier
  const pomos = Pomodoro.state.completedToday;
  
  let report = `🗓️ Standup ${dateStr}\n👤 ${username}\n\n`;
  
  report += `✅ HIER\n`;
  if (doneYesterday.length > 0) {
    doneYesterday.slice(0, 5).forEach(t => {
      report += `• ${t.title || t.titre || t.label || 'Tâche'}\n`;
    });
  } else {
    report += `• [À compléter manuellement]\n`;
  }
  if (pomos > 0) report += `• ${pomos} session(s) de focus pomodoro\n`;
  
  report += `\n🎯 AUJOURD'HUI\n`;
  if (todayTasks.length > 0) {
    todayTasks.slice(0, 5).forEach(t => {
      report += `• ${t.title || t.titre || t.label || 'Tâche'}\n`;
    });
  } else {
    report += `• [À compléter manuellement]\n`;
  }
  
  if (anomalies.length > 0) {
    report += `\n⚠️ POINTS D'ATTENTION\n`;
    anomalies.slice(0, 5).forEach(a => {
      report += `• ${a.title}\n`;
    });
  }
  
  return report;
}

function showStandupModal() {
  const report = generateStandupReport();
  let modal = document.getElementById('standup-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'standup-modal';
  modal.className = 'dyn-modal-overlay';
  modal.innerHTML = `
    <div class="dyn-modal" style="width:min(620px,94vw);">
      <div class="dyn-modal-header">
        <div>
          <h3>🎤 Standup du jour</h3>
          <p>Pré-rempli depuis vos données — éditez avant de copier</p>
        </div>
        <button class="dyn-modal-close" onclick="document.getElementById('standup-modal').remove()">×</button>
      </div>
      <div class="dyn-modal-body">
        <textarea id="standup-text" class="form-input" style="min-height:300px;font-family:var(--font-mono);font-size:12.5px;line-height:1.6;resize:vertical;">${escapeHtml(report)}</textarea>
      </div>
      <div class="dyn-modal-footer">
        <span style="font-size:var(--fs-xs);color:var(--ink-muted);">💡 Prêt à coller dans Teams ou Slack</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('standup-modal').remove()">Fermer</button>
          <button class="btn btn-primary btn-sm" onclick="copyStandupReport()">📋 Copier</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.showStandupModal = showStandupModal;

function copyStandupReport() {
  const text = document.getElementById('standup-text').value;
  navigator.clipboard.writeText(text).then(() => {
    toastOk('Standup copié — prêt à coller dans Teams/Slack');
    AuditLog.log('standup_generated');
  });
}
window.copyStandupReport = copyStandupReport;

// ============================================================
// FEATURE #6 — Rappel CRA — Détection des saisies manquantes
// ============================================================
function detectMissingCRA() {
  const cra = CyriasData.getCRA();
  if (cra.length === 0) {
    toastWarn('Aucune donnée CRA importée — impossible de détecter les manques');
    return;
  }
  // Identifier les collaborateurs présents dans les données
  const collabs = [...new Set(cra.map(d => d.collaborateur).filter(Boolean))];
  // Pour chaque collaborateur, vérifier la dernière date de saisie
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
  const checks = collabs.map(c => {
    const collabData = cra.filter(d => d.collaborateur === c);
    const dates = collabData.map(d => new Date(d.date || d.dateSaisie || 0).getTime()).filter(t => !isNaN(t));
    const lastDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
    const daysSince = lastDate ? Math.floor((now - lastDate) / 86400000) : 999;
    const thisWeekJours = collabData.filter(d => new Date(d.date || 0).getTime() >= weekStart.getTime()).reduce((s, d) => s + (parseFloat(d.jours) || 0), 0);
    return { collab: c, lastDate, daysSince, thisWeekJours };
  }).sort((a, b) => b.daysSince - a.daysSince);
  
  let modal = document.getElementById('cra-missing-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'cra-missing-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(640px,92vw);max-height:85vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">📋 Suivi des saisies CRA</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${checks.length} collaborateur(s) — semaine en cours</p>
        </div>
        <button onclick="document.getElementById('cra-missing-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:16px 24px;">
        ${checks.map(c => {
          const status = c.thisWeekJours >= 4.5 ? 'ok' : c.thisWeekJours >= 2 ? 'warn' : 'err';
          const colors = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--danger)' };
          const labels = { ok: '✅ Saisie complète', warn: '🟠 Saisie partielle', err: '🔴 Saisie manquante' };
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border:1px solid var(--border);border-left:4px solid ${colors[status]};border-radius:var(--radius-sm);margin-bottom:6px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--ink);">${escapeHtml(c.collab)}</div>
              <div style="font-size:11px;color:var(--ink-muted);margin-top:2px;">${labels[status]} — ${c.thisWeekJours.toFixed(1)}j cette semaine ${c.lastDate ? '• Dernière saisie : ' + c.lastDate.toLocaleDateString('fr-FR') : ''}</div>
            </div>
            ${status !== 'ok' ? `<button class="btn btn-outline" style="font-size:11px;padding:5px 10px;" onclick="prepareReminderEmail('${escapeHtml(c.collab)}', ${c.thisWeekJours.toFixed(1)})">✉️ Rappel</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div style="padding:12px 24px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--ink-muted);">${checks.filter(c => c.thisWeekJours < 4.5).length} collaborateur(s) à relancer</span>
        <button class="btn btn-primary" onclick="generateBulkReminders()" style="font-size:12px;">📨 Générer mails de rappel groupés</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  AuditLog.log('cra_missing_check', `${checks.length} collaborateurs analysés`);
}
window.detectMissingCRA = detectMissingCRA;

function prepareReminderEmail(collab, jours) {
  const tpl = MailTemplates.templates.find(t => t.id === 'rappel-cra');
  if (!tpl) return;
  const filled = MailTemplates.fillVariables(tpl, { prenom: collab, jours_saisis: jours });
  const url = `mailto:?subject=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(filled.body)}`;
  window.location.href = url;
  AuditLog.log('cra_reminder_sent', collab);
}
window.prepareReminderEmail = prepareReminderEmail;

function generateBulkReminders() {
  toastInfo('Pour des envois groupés, copiez les noms et utilisez votre client mail. Cliquez sur chaque ligne pour générer un rappel individuel.');
}
window.generateBulkReminders = generateBulkReminders;

// ============================================================
// FEATURE #25 — Mode présentation
// ============================================================
let presentationMode = false;
function togglePresentationMode() {
  presentationMode = !presentationMode;
  document.body.classList.toggle('presentation-mode', presentationMode);
  if (presentationMode) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    toastInfo('Mode présentation activé — Échap pour quitter');
  } else {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}
window.togglePresentationMode = togglePresentationMode;
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && presentationMode) {
    presentationMode = false;
    document.body.classList.remove('presentation-mode');
  }
});

// ============================================================
// FEATURE #1 / #2 — Refonte du Dashboard avec anomalies + actions rapides
// ============================================================
function injectDashboardEnhancements() {
  const dashboard = document.getElementById('page-dashboard');
  if (!dashboard) return;
  // Vérifier si déjà injecté
  if (document.getElementById('dashboard-enhanced')) return;
  
  // Trouver le bandeau d'accueil et insérer les blocs après
  const banner = document.getElementById('home-welcome-banner');
  if (!banner) return;
  
  const enhanced = document.createElement('div');
  enhanced.id = 'dashboard-enhanced';
  enhanced.innerHTML = `
    <!-- Stats rapides en cartes -->
    <div class="dashboard-stats">
      <div class="stat-card stat-card-clickable" onclick="navigateTo('kanban')">
        <div class="stat-icon" style="background:var(--info-soft);color:var(--info-fg);" data-icon="kanban" data-icon-size="20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/><line x1="7" x2="7" y1="8" y2="13"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="17" x2="17" y1="8" y2="11"/></svg></div>
        <div class="stat-content">
          <div class="stat-label">Tickets ouverts</div>
          <div class="stat-value" id="stat-open-tickets">—</div>
          <div class="stat-meta" id="stat-open-tickets-meta"></div>
        </div>
      </div>
      <div class="stat-card stat-card-clickable" onclick="navigateTo('craminator')">
        <div class="stat-icon" style="background:var(--brand-soft);color:var(--brand-hover);" data-icon="chart" data-icon-size="20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 12v5"/><path d="M11 8v9"/><path d="M15 14v3"/><path d="M19 10v7"/></svg></div>
        <div class="stat-content">
          <div class="stat-label">Jours saisis (mois)</div>
          <div class="stat-value" id="stat-cra-month">—</div>
          <div class="stat-meta" id="stat-cra-month-meta"></div>
        </div>
      </div>
      <div class="stat-card stat-card-clickable" onclick="showEngagementsModal()">
        <div class="stat-icon" style="background:var(--warn-soft);color:var(--warn-fg);" data-icon="handshake" data-icon-size="20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg></div>
        <div class="stat-content">
          <div class="stat-label">Engagements actifs</div>
          <div class="stat-value" id="stat-engagements">—</div>
          <div class="stat-meta" id="stat-engagements-meta"></div>
        </div>
      </div>
      <div class="stat-card stat-card-clickable" onclick="navigateTo('organisator')">
        <div class="stat-icon" style="background:var(--ok-soft);color:var(--ok-fg);" data-icon="check" data-icon-size="20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="stat-content">
          <div class="stat-label">Tâches du jour</div>
          <div class="stat-value" id="stat-tasks-today">—</div>
          <div class="stat-meta" id="stat-tasks-today-meta"></div>
        </div>
      </div>
    </div>

    <!-- Actions rapides modernisées -->
    <div class="quick-actions-wrap">
      <div class="qa-header">
        <div class="qa-title">
          <span class="qa-emoji" data-icon="zap" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
          <div>
            <div class="qa-title-main">Actions rapides</div>
            <div class="qa-title-sub">Vos outils du quotidien à un clic</div>
          </div>
        </div>
      </div>
      <div class="qa-grid">
        <button class="qa-btn" onclick="showStandupModal()">
          <span class="qa-btn-icon" data-icon="mic" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></span>
          <span class="qa-btn-label">Standup du jour</span>
          <span class="qa-btn-sub">Pré-rempli</span>
        </button>
        <button class="qa-btn" onclick="openMailTemplatesLibrary()">
          <span class="qa-btn-icon" data-icon="mail" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
          <span class="qa-btn-label">Templates mails</span>
          <span class="qa-btn-sub">6 modèles</span>
        </button>
        <button class="qa-btn" onclick="detectMissingCRA()">
          <span class="qa-btn-icon" data-icon="filetext" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg></span>
          <span class="qa-btn-label">Saisies CRA</span>
          <span class="qa-btn-sub">Détection auto</span>
        </button>
        <button class="qa-btn" onclick="openSqlTemplateLibrary()">
          <span class="qa-btn-icon" data-icon="zap" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
          <span class="qa-btn-label">SQL Ivalua</span>
          <span class="qa-btn-sub">Ctrl+Shift+S</span>
        </button>
        <button class="qa-btn" onclick="exportFullBackup()">
          <span class="qa-btn-icon" data-icon="save" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span>
          <span class="qa-btn-label">Sauvegarde</span>
          <span class="qa-btn-sub">Export JSON</span>
        </button>
        <button class="qa-btn" onclick="togglePomoVisible()">
          <span class="qa-btn-icon" data-icon="clock" data-icon-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
          <span class="qa-btn-label">Pomodoro</span>
          <span class="qa-btn-sub">25/5 min</span>
        </button>
      </div>
    </div>

    <!-- Anomalies détectées -->
    <h3 class="section-title">À votre attention</h3>
    <div style="padding: 0 40px var(--space-5) 40px;">
      <div class="anomaly-panel">
        <div id="anomalies-container">
          <div class="loading-state">
            <div class="loading-pulse"></div>
            Analyse en cours...
          </div>
        </div>
        <div class="anomaly-footer">
          <span>Détection automatique • Mise à jour à l'ouverture</span>
          <button class="btn btn-ghost btn-sm" onclick="renderAnomaliesPanel(); refreshDashboardStats();"><span data-icon="refresh" data-icon-size="13"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></span> Actualiser</button>
        </div>
      </div>
    </div>
  `;
  banner.insertAdjacentElement('afterend', enhanced);
  // Hydrater les icônes injectées
  if (typeof Icons !== 'undefined') Icons.hydrate(enhanced);

  // Refresh stats
  refreshDashboardStats();

  // Injecter le widget Pomodoro flottant
  if (!document.getElementById('pomodoro-widget')) {
    const visible = localStorage.getItem('cyrias_pomodoro_visible') === '1';
    const w = document.createElement('div');
    w.id = 'pomodoro-widget';
    w.className = 'pomo-widget';
    if (!visible) w.classList.add('pomo-hidden');
    w.innerHTML = `
      <div class="pomo-header">
        <span class="pomo-phase">🎯 Focus</span>
        <button class="pomo-close" onclick="togglePomoVisible()" aria-label="Fermer">×</button>
      </div>
      <div class="pomo-time">25:00</div>
      <div class="pomo-progress"><div class="pomo-progress-bar"></div></div>
      <div class="pomo-count-row">🍅 <span class="pomo-count">0</span> aujourd'hui</div>
      <div class="pomo-controls">
        <button class="pomo-btn-start" onclick="Pomodoro.start()" aria-label="Démarrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Démarrer
        </button>
        <button class="pomo-btn-pause" onclick="Pomodoro.pause()" aria-label="Pause">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          Pause
        </button>
        <button class="pomo-btn-reset" onclick="Pomodoro.reset()" aria-label="Réinitialiser" title="Réinitialiser">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
        </button>
      </div>`;
    document.body.appendChild(w);
    Pomodoro.load();
    Pomodoro.render();
  }

  // Lancer le scan d'anomalies
  setTimeout(renderAnomaliesPanel, 200);
}

function togglePomoVisible() { Pomodoro.toggleVisible(); }
window.togglePomoVisible = togglePomoVisible;

// CSS additionnel pour les boutons d'action rapide et le mode présentation
(function injectV10Styles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ============================================================
       v14 — DASHBOARD modernisé
       ============================================================ */
    
    /* Stats cards */
    .dashboard-stats {
      padding: 0 40px var(--space-3);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-3);
      margin-top: var(--space-3);
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      transition: all var(--t-base);
      box-shadow: var(--elev-1);
    }
    .stat-card-clickable { cursor: pointer; }
    .stat-card-clickable:hover {
      border-color: var(--brand);
      transform: translateY(-2px);
      box-shadow: var(--elev-3);
    }
    .stat-icon {
      width: 44px; height: 44px;
      border-radius: var(--radius);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .stat-icon svg { display: block; }
    .stat-content { flex: 1; min-width: 0; }
    .stat-label {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      font-weight: var(--fw-medium);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: var(--fs-2xl);
      font-weight: var(--fw-extrabold);
      color: var(--ink);
      line-height: 1;
      letter-spacing: -0.7px;
      font-variant-numeric: tabular-nums;
    }
    .stat-meta {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      margin-top: 4px;
      line-height: 1.3;
    }

    /* Quick actions wrap */
    .quick-actions-wrap {
      padding: 0 40px var(--space-4);
      margin-top: var(--space-4);
    }
    .qa-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-3);
    }
    .qa-title { display: flex; align-items: center; gap: var(--space-3); }
    .qa-emoji { 
      font-size: 22px; 
      display: inline-flex; 
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%);
      color: white;
    }
    .qa-emoji svg { display: block; }
    .qa-title-main {
      font-size: var(--fs-md);
      font-weight: var(--fw-bold);
      color: var(--ink);
      letter-spacing: -0.2px;
    }
    .qa-title-sub {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      margin-top: 2px;
    }
    .qa-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--space-3);
    }
    .qa-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: var(--space-4) var(--space-3);
      cursor: pointer;
      font-family: inherit;
      transition: all var(--t-base);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      text-align: left;
      position: relative;
      overflow: hidden;
      box-shadow: var(--elev-1);
    }
    .qa-btn::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0;
      width: 0;
      height: 2px;
      background: var(--brand);
      transition: width var(--t-base);
    }
    .qa-btn:hover {
      transform: translateY(-2px);
      border-color: var(--brand);
      box-shadow: var(--elev-3);
    }
    .qa-btn:hover::after { width: 100%; }
    .qa-btn-icon { 
      font-size: 22px; 
      margin-bottom: 4px; 
      color: var(--brand);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      transition: transform var(--t-base);
    }
    .qa-btn-icon svg { display: block; }
    .qa-btn:hover .qa-btn-icon { transform: scale(1.1); }
    .qa-btn-label {
      font-size: var(--fs-base);
      font-weight: var(--fw-semibold);
      color: var(--ink);
    }
    .qa-btn-sub {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      font-weight: var(--fw-regular);
    }

    /* Panel anomalies */
    .anomaly-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--elev-1);
    }
    .anomaly-panel #anomalies-container { padding: var(--space-3); }
    .anomaly-card {
      transition: transform var(--t-fast);
    }
    .anomaly-card:hover { transform: translateX(3px); }
    .anomaly-footer {
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--divider);
      background: var(--bg-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: var(--fs-xs);
      color: var(--ink-muted);
    }
    
    /* Loading state */
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: var(--space-5);
      color: var(--ink-muted);
      font-size: var(--fs-sm);
    }
    .loading-pulse {
      width: 8px; height: 8px;
      background: var(--brand);
      border-radius: 50%;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1); }
    }
    
    /* Cards de templates (SQL, mails, etc.) */
    .sql-tpl-card, .mail-tpl-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 11px 14px;
      cursor: pointer;
      transition: all var(--t-fast);
      background: var(--surface);
      position: relative;
    }
    .sql-tpl-card:hover, .mail-tpl-card:hover {
      border-color: var(--brand);
      background: var(--brand-soft);
      transform: translateX(2px);
    }
    .sql-tpl-label, .mail-tpl-label {
      font-weight: var(--fw-semibold);
      font-size: var(--fs-base);
      color: var(--ink);
      margin-bottom: 3px;
    }
    .sql-tpl-preview, .mail-tpl-preview {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      font-family: var(--font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    /* Mail template list items */
    .mtpl-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--divider);
      transition: all var(--t-fast);
      border-left: 3px solid transparent;
    }
    .mtpl-item:hover {
      background: var(--bg);
    }
    .mtpl-item.mtpl-item-active {
      background: var(--brand-soft);
      border-left-color: var(--brand);
    }
    .mtpl-item-label {
      font-weight: var(--fw-semibold);
      font-size: var(--fs-base);
      color: var(--ink);
    }
    .mtpl-item.mtpl-item-active .mtpl-item-label {
      color: var(--brand-hover);
    }
    .mtpl-item-subject {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ============================================================
       v15 — Modals dynamiques (créés en JS)
       ============================================================ */
    .dyn-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      animation: overlayIn var(--t-base);
    }
    .dyn-modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-4);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: modalIn var(--t-base);
      max-height: 90vh;
    }
    .dyn-modal-header {
      padding: 18px 22px;
      border-bottom: 1px solid var(--divider);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .dyn-modal-header h3 {
      font-size: var(--fs-lg);
      font-weight: var(--fw-bold);
      color: var(--ink);
      margin: 0;
      letter-spacing: -0.3px;
    }
    .dyn-modal-header p {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      margin-top: 2px;
    }
    .dyn-modal-close {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--ink-muted);
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--t-fast);
      flex-shrink: 0;
    }
    .dyn-modal-close:hover {
      background: var(--bg-subtle);
      color: var(--ink);
    }
    .dyn-modal-body {
      overflow-y: auto;
      flex: 1;
      padding: 20px 22px;
    }
    .dyn-modal-footer {
      padding: 14px 22px;
      border-top: 1px solid var(--divider);
      background: var(--bg-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    
    /* Form labels génériques */
    .form-label {
      display: block;
      font-size: var(--fs-xs);
      font-weight: var(--fw-bold);
      text-transform: uppercase;
      color: var(--ink-secondary);
      letter-spacing: 0.4px;
      margin-bottom: 6px;
    }
    .form-input {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: var(--fs-md);
      background: var(--surface);
      color: var(--ink);
      outline: none;
      transition: all var(--t-fast);
    }
    .form-input:hover { border-color: var(--border-strong); }
    .form-input:focus { 
      border-color: var(--brand); 
      box-shadow: var(--elev-glow); 
    }
    
    /* Chips / badges */
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
      line-height: 1.4;
      white-space: nowrap;
    }
    .chip-ok { background: var(--ok-soft); color: var(--ok-fg); }
    .chip-warn { background: var(--warn-soft); color: var(--warn-fg); }
    .chip-err { background: var(--danger-soft); color: var(--danger-fg); }
    .chip-info { background: var(--info-soft); color: var(--info-fg); }
    .chip-neutral { background: var(--bg-subtle); color: var(--ink-secondary); border: 1px solid var(--border); }
    .chip-brand { background: var(--brand-soft); color: var(--brand-hover); }
    
    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--ink-muted);
    }
    .empty-state-icon {
      font-size: 36px;
      opacity: 0.4;
      margin-bottom: 8px;
    }
    .empty-state-title {
      font-weight: var(--fw-semibold);
      font-size: var(--fs-md);
      color: var(--ink-secondary);
      margin-bottom: 4px;
    }
    .empty-state-text {
      font-size: var(--fs-sm);
      line-height: 1.5;
    }

    /* ============================================================
       v15 — Widget Pomodoro modernisé
       ============================================================ */
    .pomo-widget {
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-3);
      padding: 14px 16px;
      z-index: 998;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 200px;
      transition: all var(--t-base);
      backdrop-filter: blur(8px);
    }
    .pomo-widget.pomo-hidden { display: none; }
    .pomo-widget:hover { box-shadow: var(--elev-4); transform: translateY(-2px); }
    .pomo-widget.pomo-running { border-color: var(--brand); }
    .pomo-widget.pomo-phase-break .pomo-time { color: var(--info); }
    .pomo-widget.pomo-phase-work .pomo-time { color: var(--brand); }
    
    .pomo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pomo-phase {
      font-size: var(--fs-xxs);
      font-weight: var(--fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--ink-secondary);
    }
    .pomo-close {
      background: none;
      border: none;
      color: var(--ink-muted);
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 0 4px;
      border-radius: 4px;
      transition: all var(--t-fast);
    }
    .pomo-close:hover {
      background: var(--bg-subtle);
      color: var(--ink);
    }
    
    .pomo-time {
      font-size: 36px;
      font-weight: var(--fw-extrabold);
      font-family: var(--font-mono);
      color: var(--brand);
      letter-spacing: -1px;
      text-align: center;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      transition: color var(--t-base);
    }
    
    .pomo-progress {
      width: 100%;
      height: 4px;
      background: var(--bg-subtle);
      border-radius: 2px;
      overflow: hidden;
    }
    .pomo-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--brand) 0%, var(--brand-hover) 100%);
      border-radius: 2px;
      width: 0%;
      transition: width 1s linear;
    }
    .pomo-widget.pomo-phase-break .pomo-progress-bar {
      background: linear-gradient(90deg, var(--info) 0%, #60A5FA 100%);
    }
    
    .pomo-count-row {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .pomo-count { 
      font-weight: var(--fw-bold); 
      color: var(--ink-secondary); 
    }
    
    .pomo-controls {
      display: flex;
      gap: 6px;
      align-items: stretch;
    }
    .pomo-btn-start, .pomo-btn-pause, .pomo-btn-reset {
      flex: 1;
      padding: 7px 10px;
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
      cursor: pointer;
      transition: all var(--t-fast);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 1px solid transparent;
      line-height: 1;
    }
    .pomo-btn-start {
      background: var(--brand);
      color: white;
      box-shadow: var(--elev-1);
    }
    .pomo-btn-start:hover { background: var(--brand-hover); }
    .pomo-btn-pause {
      background: var(--warn-soft);
      color: var(--warn-fg);
      border-color: var(--warn-border);
      display: none;
    }
    .pomo-btn-pause:hover { background: var(--warn); color: white; border-color: var(--warn); }
    .pomo-btn-reset {
      background: var(--surface);
      color: var(--ink-secondary);
      border-color: var(--border);
      flex: 0 0 36px;
      padding: 7px;
    }
    .pomo-btn-reset:hover { background: var(--bg-subtle); color: var(--ink); border-color: var(--border-strong); }
    .pomo-widget.pomo-running .pomo-btn-start { display: none; }
    .pomo-widget.pomo-running .pomo-btn-pause { display: inline-flex; }
    
    /* Mode présentation */
    body.presentation-mode .sidebar { display: none; }
    body.presentation-mode .main-content { margin-left: 0; }
    body.presentation-mode .scratchpad-btn { display: none; }
    body.presentation-mode #pomodoro-widget { display: none !important; }
    body.presentation-mode .page-header { background: white; padding: 24px 60px; }
    body.presentation-mode #page-dashboard #dashboard-enhanced { padding: 0 40px; }
  `;
  document.head.appendChild(style);
})();


// ============================================================
// FEATURE #26 — Vue Audit Log (consultation depuis Configuration)
// ============================================================
function showAuditLogModal() {
  const entries = AuditLog.getAll();
  let modal = document.getElementById('audit-log-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'audit-log-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(720px,94vw);max-height:88vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">📜 Historique des actions</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${entries.length} entrée(s) — 500 plus récentes conservées</p>
        </div>
        <button onclick="document.getElementById('audit-log-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:0;">
        ${entries.length === 0 ? `
          <div style="text-align:center;padding:40px 20px;color:var(--ink-muted);">
            <div style="font-size:32px;margin-bottom:8px;opacity:0.4;">📋</div>
            <div style="font-size:13px;">Aucune action enregistrée pour le moment</div>
          </div>
        ` : `
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead style="position:sticky;top:0;background:var(--bg);">
              <tr style="text-align:left;color:var(--ink-muted);font-size:11px;text-transform:uppercase;">
                <th style="padding:10px 16px;">Date</th>
                <th style="padding:10px 8px;">Utilisateur</th>
                <th style="padding:10px 8px;">Action</th>
                <th style="padding:10px 16px;">Détails</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => `
                <tr style="border-top:1px solid var(--border-light);">
                  <td style="padding:8px 16px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-muted);white-space:nowrap;">${new Date(e.ts).toLocaleString('fr-FR')}</td>
                  <td style="padding:8px;">${escapeHtml(e.user)}</td>
                  <td style="padding:8px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--secondary-dark);">${escapeHtml(e.action)}</td>
                  <td style="padding:8px 16px;color:var(--ink-secondary);">${escapeHtml(e.details || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
      <div style="padding:12px 24px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:space-between;align-items:center;">
        <button class="btn btn-outline" style="font-size:11px;color:var(--danger);border-color:var(--danger);" onclick="if(AuditLog.clear()){document.getElementById('audit-log-modal').remove();}">Effacer l'historique</button>
        <button class="btn btn-outline" style="font-size:11px;" onclick="exportAuditLog()">📥 Exporter (CSV)</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.showAuditLogModal = showAuditLogModal;

function exportAuditLog() {
  const entries = AuditLog.getAll();
  const csv = ['Date,Utilisateur,Action,Details', ...entries.map(e => 
    `"${new Date(e.ts).toLocaleString('fr-FR')}","${e.user}","${e.action}","${(e.details || '').replace(/"/g, '""')}"`
  )].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  toastOk('Historique exporté en CSV');
}
window.exportAuditLog = exportAuditLog;

// ============================================================
// Initialisation finale v10
// ============================================================
window.addEventListener('load', () => {
  // Injecter les enhancements du dashboard
  setTimeout(injectDashboardEnhancements, 300);
  // Logger l'ouverture
  AuditLog.log('app_opened', `${navigator.platform} ${navigator.language}`);
  // Demander la permission notification (sans forcer)
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      // On le fait après 5s pour ne pas saturer l'utilisateur dès l'ouverture
      // et seulement si ce n'est pas la 1ère ouverture
      if (localStorage.getItem('cyrias_audit_log')) {
        // pas de demande agressive : juste log
      }
    }, 5000);
  }
});

// Étendre la palette de recherche Ctrl+K avec les snippets
const _origRender = window.renderGlobalSearchResults;
if (typeof _origRender === 'function') {
  window.renderGlobalSearchResults = function() {
    _origRender();
    // Étendre les résultats avec snippets, demandes, audit log
    const q = (document.getElementById('gs-input')?.value || '').trim().toLowerCase();
    if (!q) return;
    const norm = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const qn = norm(q);
    const extra = [];
    // Snippets
    try {
      const snippets = JSON.parse(localStorage.getItem('cyrias_snippets') || localStorage.getItem('snippet_data') || '[]');
      if (Array.isArray(snippets)) {
        snippets.filter(s => norm(s.title || s.titre).includes(qn) || norm(s.code || s.content || '').includes(qn))
          .slice(0, 4)
          .forEach(s => extra.push({ kind: 'snippet', label: s.title || s.titre || 'Snippet', icon: '💻', sub: 'Code Snippetator' }));
      }
    } catch(e) {}
    // Demandes / tickets
    try {
      const demandes = JSON.parse(localStorage.getItem('cra_demandes') || '[]');
      if (Array.isArray(demandes)) {
        demandes.filter(d => norm(d.numero).includes(qn) || norm(d.description || d.titre || '').includes(qn))
          .slice(0, 4)
          .forEach(d => extra.push({ kind: 'ticket', label: `#${d.numero} ${(d.description || d.titre || '').slice(0,40)}`, icon: '🎫', sub: 'Demande CRAminator' }));
      }
    } catch(e) {}
    // Ajouter au DOM
    if (extra.length > 0) {
      const container = document.getElementById('gs-results');
      if (container && !container.querySelector('.gs-empty')) {
        const currentResults = window._gsResults || [];
        const newResults = [...currentResults, ...extra];
        window._gsResults = newResults;
        container.insertAdjacentHTML('beforeend', extra.map((r, i) => {
          const idx = currentResults.length + i;
          return `<div class="gs-item" data-idx="${idx}" onclick="executeGlobalSearchResult(${idx})">
            <span class="gs-icon">${r.icon}</span>
            <div class="gs-text"><div class="gs-label">${escapeHtml(r.label)}</div><div class="gs-sub">${escapeHtml(r.sub || '')}</div></div>
            <span class="gs-kind">${r.kind}</span>
          </div>`;
        }).join(''));
      }
    }
  };
}


/* ============================================================================
   v11 — SPRINT B : Direction, Animation projet, Outillage dev, Polish
   ============================================================================ */


// ===========================================================
// FEATURE #3 — Comparateur multi-clients
// ===========================================================
function openClientComparator() {
  const cra = CyriasData.getCRA();
  const budgets = CyriasData.getBudgets();
  const tjm = CyriasData.getTjm();
  const demandes = CyriasData.getDemandes();

  if (cra.length === 0) {
    toastWarn("Aucune donnée CRA — importez vos sources pour comparer les clients");
    return;
  }

  const clients = [...new Set(cra.map(d => d.client).filter(Boolean))].sort();
  if (clients.length < 2) {
    toastInfo("Au moins 2 clients sont nécessaires pour la comparaison");
    return;
  }

  // Calculer les KPI par client
  const computeKPI = (client) => {
    const data = cra.filter(d => d.client === client);
    const totalJours = data.reduce((s, d) => s + (parseFloat(d.jours) || 0), 0);
    const collabs = new Set(data.map(d => d.collaborateur).filter(Boolean));
    const missions = [...new Set(data.map(d => d.mission).filter(Boolean))];
    let totalBudget = 0, totalConso = 0;
    missions.forEach(m => {
      const b = budgets[m];
      if (b && (b.budget || b) && !(b.closed)) {
        totalBudget += (b.budget || b);
        totalConso += data.filter(d => d.mission === m).reduce((s, d) => s + (parseFloat(d.jours) || 0), 0);
      }
    });
    const tjmClient = tjm[client] || 0;
    const ca = totalJours * tjmClient;
    const ticketsOuverts = demandes.filter(d => d.client === client && d.statut !== 'Clôturé' && d.statut !== 'Fermé').length;
    return {
      client,
      totalJours: totalJours.toFixed(1),
      nbCollabs: collabs.size,
      nbMissions: missions.length,
      ca: ca.toFixed(0),
      tjm: tjmClient,
      budgetTotal: totalBudget,
      conso: totalConso.toFixed(1),
      pctConso: totalBudget > 0 ? ((totalConso / totalBudget) * 100).toFixed(0) : '—',
      ticketsOuverts
    };
  };

  let modal = document.getElementById('client-comparator-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'client-comparator-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(900px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">⚖️ Comparateur multi-clients</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Sélectionnez 2 à 4 clients à comparer côte-à-côte</p>
        </div>
        <button onclick="document.getElementById('client-comparator-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:16px 24px;border-bottom:1px solid var(--border-light);background:var(--bg);">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);margin-bottom:8px;">Clients à comparer</div>
        <div id="client-checkboxes" style="display:flex;flex-wrap:wrap;gap:8px;">
          ${clients.map((c, i) => `
            <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;">
              <input type="checkbox" class="cmp-client-chk" value="${escapeHtml(c)}" ${i < 2 ? 'checked' : ''} onchange="renderClientComparison()">
              ${escapeHtml(c)}
            </label>
          `).join('')}
        </div>
      </div>
      <div id="client-comparison-grid" style="overflow-y:auto;flex:1;padding:20px 24px;"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  // Stocker la fonction de calcul globalement pour le rendu
  window._cmpComputeKPI = computeKPI;
  renderClientComparison();
  AuditLog.log('client_comparator_opened');
}
window.openClientComparator = openClientComparator;

function renderClientComparison() {
  const grid = document.getElementById('client-comparison-grid');
  if (!grid) return;
  const selected = [...document.querySelectorAll('.cmp-client-chk:checked')].map(c => c.value).slice(0, 4);
  if (selected.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:32px;color:var(--ink-muted);">Sélectionnez au moins un client</div>';
    return;
  }
  const kpis = selected.map(c => window._cmpComputeKPI(c));
  // Calcul du leader pour chaque KPI (pour highlight visuel)
  const maxJours = Math.max(...kpis.map(k => parseFloat(k.totalJours)));
  const maxCA = Math.max(...kpis.map(k => parseFloat(k.ca)));
  const maxTickets = Math.max(...kpis.map(k => k.ticketsOuverts));

  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(${kpis.length},1fr);gap:12px;">
      ${kpis.map(k => {
        const pctNum = parseFloat(k.pctConso);
        const pctColor = isNaN(pctNum) ? 'var(--ink-muted)' : pctNum >= 100 ? 'var(--danger)' : pctNum >= 90 ? 'var(--warn)' : 'var(--ok)';
        return `
        <div style="border:1px solid var(--border);border-radius:var(--radius);padding:18px;background:var(--surface);">
          <div style="font-weight:700;color:var(--primary);font-size:15px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--secondary);">${escapeHtml(k.client)}</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;letter-spacing:0.5px;">Volumétrie</div>
              <div style="font-size:24px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${parseFloat(k.totalJours) === maxJours ? 'var(--secondary-dark)' : 'var(--ink)'};">${k.totalJours}<span style="font-size:13px;color:var(--ink-muted);font-weight:500;"> j</span></div>
            </div>
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;letter-spacing:0.5px;">Chiffre d'affaires</div>
              <div style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${parseFloat(k.ca) === maxCA ? 'var(--secondary-dark)' : 'var(--ink)'};">${parseInt(k.ca).toLocaleString('fr-FR')} €</div>
              <div style="font-size:10px;color:var(--ink-muted);">TJM moyen : ${k.tjm} €</div>
            </div>
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;letter-spacing:0.5px;">Consommation budget</div>
              <div style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${pctColor};">${k.pctConso}%</div>
              <div style="font-size:10px;color:var(--ink-muted);">${k.conso}j / ${k.budgetTotal}j</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:10px;border-top:1px solid var(--border-light);">
              <div>
                <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Équipe</div>
                <div style="font-size:16px;font-weight:700;color:var(--ink);">${k.nbCollabs} <span style="font-size:11px;color:var(--ink-muted);font-weight:500;">collab.</span></div>
              </div>
              <div>
                <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Missions</div>
                <div style="font-size:16px;font-weight:700;color:var(--ink);">${k.nbMissions}</div>
              </div>
            </div>
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Tickets ouverts</div>
              <div style="font-size:16px;font-weight:700;color:${k.ticketsOuverts === maxTickets && k.ticketsOuverts > 0 ? 'var(--warn)' : 'var(--ink)'};">${k.ticketsOuverts}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}
window.renderClientComparison = renderClientComparison;

// ===========================================================
// FEATURE #4 — Forecast fin de mois
// ===========================================================
function generateForecast() {
  const cra = CyriasData.getCRA();
  const budgets = CyriasData.getBudgets();
  if (cra.length === 0) return [];

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const monthStart = new Date(yyyy, mm, 1);
  const monthEnd = new Date(yyyy, mm + 1, 0);
  const today = now.getDate();
  const daysInMonth = monthEnd.getDate();
  const daysElapsed = today;

  // Jours ouvrés écoulés et restants
  const isWorkday = (d) => { const wd = d.getDay(); return wd !== 0 && wd !== 6; };
  let workdaysElapsed = 0, workdaysTotal = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(yyyy, mm, i);
    if (isWorkday(d)) {
      workdaysTotal++;
      if (i <= today) workdaysElapsed++;
    }
  }
  const workdaysRemaining = workdaysTotal - workdaysElapsed;

  // Conso par mission ce mois
  const consoMois = {};
  cra.forEach(d => {
    const dt = new Date(d.date || d.dateSaisie || 0);
    if (dt.getFullYear() === yyyy && dt.getMonth() === mm && d.mission) {
      consoMois[d.mission] = (consoMois[d.mission] || 0) + (parseFloat(d.jours) || 0);
    }
  });

  // Pour chaque mission avec budget, projeter
  const forecasts = [];
  Object.entries(budgets).forEach(([mission, b]) => {
    const budget = b && (b.budget || b);
    if (!budget || budget <= 0 || (b && b.closed)) return;
    const conso = consoMois[mission] || 0;
    if (conso === 0) return;
    const dailyRate = workdaysElapsed > 0 ? conso / workdaysElapsed : 0;
    const projectedTotal = conso + dailyRate * workdaysRemaining;
    const pctActuel = (conso / budget) * 100;
    const pctProjete = (projectedTotal / budget) * 100;
    forecasts.push({
      mission,
      budget,
      consoActuelle: conso,
      pctActuel: pctActuel.toFixed(0),
      consoProjetee: projectedTotal.toFixed(1),
      pctProjete: pctProjete.toFixed(0),
      depassement: projectedTotal > budget ? (projectedTotal - budget).toFixed(1) : 0,
      severity: pctProjete >= 100 ? 'err' : pctProjete >= 95 ? 'warn' : 'ok'
    });
  });

  return { forecasts, monthLabel: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), workdaysElapsed, workdaysTotal };
}

function showForecastModal() {
  const result = generateForecast();
  let modal = document.getElementById('forecast-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'forecast-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';

  let body = '';
  if (!result.forecasts || result.forecasts.length === 0) {
    body = `<div style="text-align:center;padding:40px;color:var(--ink-muted);">
      <div style="font-size:32px;opacity:0.4;margin-bottom:8px;">📊</div>
      <div style="font-weight:600;">Pas assez de données pour projeter</div>
      <div style="font-size:12px;margin-top:6px;">Importez vos CRA et configurez vos budgets pour activer le forecast</div>
    </div>`;
  } else {
    const sorted = result.forecasts.sort((a, b) => parseFloat(b.pctProjete) - parseFloat(a.pctProjete));
    body = `
      <div style="background:var(--info-bg);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:16px;font-size:12px;color:var(--ink-secondary);">
        📅 Mois : <strong style="text-transform:capitalize;">${result.monthLabel}</strong> — Jour ${result.workdaysElapsed} sur ${result.workdaysTotal} jours ouvrés
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--bg);text-align:left;">
            <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--ink-muted);">Mission</th>
            <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--ink-muted);">Budget</th>
            <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--ink-muted);">Aujourd'hui</th>
            <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--ink-muted);">Projeté fin de mois</th>
            <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--ink-muted);">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(f => {
            const colors = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--danger)' };
            const labels = { ok: '✅ Sous contrôle', warn: '🟠 Sous tension', err: '🔴 Dépassement projeté' };
            return `<tr style="border-top:1px solid var(--border-light);">
              <td style="padding:10px 12px;font-weight:600;">${escapeHtml(f.mission)}</td>
              <td style="padding:10px 12px;font-family:'JetBrains Mono',monospace;">${f.budget}j</td>
              <td style="padding:10px 12px;"><span style="font-family:'JetBrains Mono',monospace;">${f.consoActuelle.toFixed(1)}j</span> <span style="color:var(--ink-muted);font-size:11px;">(${f.pctActuel}%)</span></td>
              <td style="padding:10px 12px;"><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${colors[f.severity]};">${f.consoProjetee}j</span> <span style="color:${colors[f.severity]};font-size:11px;font-weight:700;">(${f.pctProjete}%)</span> ${f.depassement > 0 ? `<div style="font-size:10px;color:var(--danger);">+${f.depassement}j de dépassement</div>` : ''}</td>
              <td style="padding:10px 12px;color:${colors[f.severity]};font-size:12px;font-weight:600;">${labels[f.severity]}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="font-size:11px;color:var(--ink-muted);margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light);">
        💡 Méthode de calcul : extrapolation linéaire de la cadence observée (conso ÷ jours ouvrés écoulés) sur les jours ouvrés restants. À nuancer selon les périodes (congés, MEP, etc.).
      </div>`;
  }

  modal.innerHTML = `
    <div style="background:var(--surface);width:min(820px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">🔮 Forecast fin de mois</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Projection automatique de la consommation budgétaire</p>
        </div>
        <button onclick="document.getElementById('forecast-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:20px 24px;">${body}</div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  AuditLog.log('forecast_generated');
}
window.showForecastModal = showForecastModal;

// ===========================================================
// FEATURE #5 — Mémoire des décisions
// ===========================================================
const Decisions = {
  getAll() {
    try { return JSON.parse(localStorage.getItem('cyrias_decisions') || '[]'); }
    catch(e) { return []; }
  },
  save(list) {
    safeLocalSet('cyrias_decisions', JSON.stringify(list));
  },
  add(d) {
    const list = this.getAll();
    list.unshift({ ...d, id: 'dec_' + Date.now(), createdAt: Date.now() });
    this.save(list);
    AuditLog.log('decision_added', d.titre);
    return list[0];
  },
  remove(id) {
    const list = this.getAll().filter(d => d.id !== id);
    this.save(list);
  },
  exportCSV() {
    const list = this.getAll();
    const csv = ['Date,Client,Sujet,Decision,Validateur,Tags', ...list.map(d =>
      `"${d.date || ''}","${(d.client || '').replace(/"/g, '""')}","${(d.titre || '').replace(/"/g, '""')}","${(d.decision || '').replace(/"/g, '""')}","${(d.validateur || '').replace(/"/g, '""')}","${(d.tags || []).join(';')}"`
    )].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `decisions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toastOk('Mémo des décisions exporté');
  }
};
window.Decisions = Decisions;

function showDecisionsModal() {
  let modal = document.getElementById('decisions-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'decisions-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(880px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">🧠 Mémoire des décisions</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Trace toutes les décisions importantes prises en comité</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline" style="font-size:11px;" onclick="Decisions.exportCSV()">📥 Exporter</button>
          <button class="btn btn-primary" style="font-size:11px;" onclick="showDecisionForm()">+ Nouvelle décision</button>
          <button onclick="document.getElementById('decisions-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);margin-left:8px;">×</button>
        </div>
      </div>
      <div style="padding:12px 24px;border-bottom:1px solid var(--border-light);background:var(--bg);">
        <input type="text" id="decisions-search" placeholder="Rechercher dans les décisions (client, sujet, tag...)" oninput="renderDecisionsList()" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
      </div>
      <div id="decisions-list" style="overflow-y:auto;flex:1;padding:16px 24px;"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  renderDecisionsList();
}
window.showDecisionsModal = showDecisionsModal;

function renderDecisionsList() {
  const container = document.getElementById('decisions-list');
  if (!container) return;
  const q = (document.getElementById('decisions-search')?.value || '').toLowerCase().trim();
  let list = Decisions.getAll();
  if (q) {
    list = list.filter(d =>
      (d.titre || '').toLowerCase().includes(q) ||
      (d.client || '').toLowerCase().includes(q) ||
      (d.decision || '').toLowerCase().includes(q) ||
      (d.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink-muted);">
      <div style="font-size:32px;opacity:0.4;margin-bottom:8px;">🧠</div>
      <div style="font-weight:600;">Aucune décision enregistrée${q ? ' pour cette recherche' : ''}</div>
      <div style="font-size:12px;margin-top:6px;">Les décisions clés prises en comité ne devraient plus se perdre dans des emails</div>
    </div>`;
    return;
  }
  container.innerHTML = list.map(d => `
    <div style="border:1px solid var(--border);border-left:4px solid var(--secondary);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">${escapeHtml(d.titre)}</div>
          <div style="font-size:11px;color:var(--ink-muted);">
            📅 ${escapeHtml(d.date || '')} ${d.client ? '• 🏢 ' + escapeHtml(d.client) : ''} ${d.validateur ? '• 👤 ' + escapeHtml(d.validateur) : ''}
          </div>
          <div style="font-size:13px;color:var(--ink-secondary);margin-top:8px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(d.decision || '')}</div>
          ${(d.tags && d.tags.length > 0) ? `<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
            ${d.tags.map(t => `<span style="background:var(--secondary-light);color:var(--secondary-dark);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">${escapeHtml(t)}</span>`).join('')}
          </div>` : ''}
        </div>
        <button onclick="if(confirm('Supprimer cette décision ?')){Decisions.remove('${d.id}');renderDecisionsList();toastOk('Décision supprimée');}" style="background:none;border:none;color:var(--ink-muted);cursor:pointer;font-size:14px;padding:4px;">🗑️</button>
      </div>
    </div>
  `).join('');
}
window.renderDecisionsList = renderDecisionsList;

function showDecisionForm() {
  const cra = CyriasData.getCRA();
  const clients = [...new Set(cra.map(d => d.client).filter(Boolean))].sort();
  let modal = document.getElementById('decision-form-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'decision-form-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);';
  const today = new Date().toISOString().split('T')[0];
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(560px,92vw);border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <h3 style="font-size:15px;font-weight:700;color:var(--primary);margin:0;">+ Nouvelle décision</h3>
        <button onclick="document.getElementById('decision-form-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:20px 22px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Date</label>
            <input type="date" id="dec-date" value="${today}" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Client</label>
            <input type="text" id="dec-client" list="dec-client-list" placeholder="Client concerné..." style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
            <datalist id="dec-client-list">${clients.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Sujet *</label>
          <input type="text" id="dec-titre" placeholder="Ex : Refacturation dépassement Q2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Décision *</label>
          <textarea id="dec-decision" rows="4" placeholder="Décrivez la décision prise et son contexte..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;resize:vertical;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Validateur</label>
            <input type="text" id="dec-validateur" placeholder="Nom de la personne qui a validé" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Tags (séparés par virgules)</label>
            <input type="text" id="dec-tags" placeholder="budget, contrat, sla..." style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button class="btn btn-outline" onclick="document.getElementById('decision-form-modal').remove()" style="font-size:12px;">Annuler</button>
          <button class="btn btn-primary" onclick="saveDecisionForm()" style="font-size:12px;">Enregistrer</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
window.showDecisionForm = showDecisionForm;

function saveDecisionForm() {
  const titre = document.getElementById('dec-titre').value.trim();
  const decision = document.getElementById('dec-decision').value.trim();
  if (!titre || !decision) { toastWarn("Sujet et décision sont obligatoires"); return; }
  const tags = document.getElementById('dec-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  Decisions.add({
    date: document.getElementById('dec-date').value,
    client: document.getElementById('dec-client').value.trim(),
    titre, decision,
    validateur: document.getElementById('dec-validateur').value.trim(),
    tags
  });
  document.getElementById('decision-form-modal').remove();
  renderDecisionsList();
  toastOk('Décision enregistrée');
}
window.saveDecisionForm = saveDecisionForm;

// ===========================================================
// FEATURE #8 — Suivi des engagements clients
// ===========================================================
const Engagements = {
  getAll() {
    try { return JSON.parse(localStorage.getItem('cyrias_engagements') || '[]'); }
    catch(e) { return []; }
  },
  save(list) { safeLocalSet('cyrias_engagements', JSON.stringify(list)); },
  add(e) {
    const list = this.getAll();
    list.unshift({ ...e, id: 'eng_' + Date.now(), createdAt: Date.now(), statut: 'en_cours' });
    this.save(list);
    AuditLog.log('engagement_added', e.titre);
  },
  updateStatus(id, statut) {
    const list = this.getAll();
    const item = list.find(e => e.id === id);
    if (item) {
      item.statut = statut;
      item.updatedAt = Date.now();
      this.save(list);
      AuditLog.log('engagement_status_changed', `${item.titre} → ${statut}`);
    }
  },
  remove(id) {
    this.save(this.getAll().filter(e => e.id !== id));
  }
};
window.Engagements = Engagements;

function showEngagementsModal() {
  let modal = document.getElementById('engagements-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'engagements-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(820px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">🤝 Engagements clients</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Tracker pour ne plus oublier ce qu'on a promis</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="font-size:11px;" onclick="showEngagementForm()">+ Nouvel engagement</button>
          <button onclick="document.getElementById('engagements-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);margin-left:8px;">×</button>
        </div>
      </div>
      <div id="engagements-list" style="overflow-y:auto;flex:1;padding:16px 24px;"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  renderEngagementsList();
}
window.showEngagementsModal = showEngagementsModal;

function renderEngagementsList() {
  const container = document.getElementById('engagements-list');
  if (!container) return;
  const list = Engagements.getAll();
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink-muted);">
      <div style="font-size:32px;opacity:0.4;margin-bottom:8px;">🤝</div>
      <div style="font-weight:600;">Aucun engagement enregistré</div>
      <div style="font-size:12px;margin-top:6px;">Listez ici vos promesses orales aux clients pour ne plus rien oublier</div>
    </div>`;
    return;
  }
  // Trier : en cours d'abord, par échéance
  const sorted = list.slice().sort((a, b) => {
    if (a.statut !== b.statut) {
      const order = { en_cours: 0, glisse: 1, tenu: 2 };
      return (order[a.statut] || 3) - (order[b.statut] || 3);
    }
    return new Date(a.echeance || '9999').getTime() - new Date(b.echeance || '9999').getTime();
  });
  const today = new Date(); today.setHours(0,0,0,0);
  container.innerHTML = sorted.map(e => {
    const due = e.echeance ? new Date(e.echeance) : null;
    const daysToDue = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null;
    let urgencyColor = 'var(--ok)', urgencyLabel = '';
    if (e.statut === 'tenu') { urgencyColor = 'var(--ok)'; urgencyLabel = '✅ Tenu'; }
    else if (e.statut === 'glisse') { urgencyColor = 'var(--ink-muted)'; urgencyLabel = '↪️ Glissé'; }
    else if (daysToDue !== null) {
      if (daysToDue < 0) { urgencyColor = 'var(--danger)'; urgencyLabel = `⚠️ En retard de ${-daysToDue}j`; }
      else if (daysToDue <= 2) { urgencyColor = 'var(--warn)'; urgencyLabel = `🔥 J-${daysToDue}`; }
      else if (daysToDue <= 7) { urgencyColor = 'var(--info)'; urgencyLabel = `📅 J-${daysToDue}`; }
      else { urgencyLabel = `📅 ${due.toLocaleDateString('fr-FR')}`; }
    }
    return `<div style="border:1px solid var(--border);border-left:4px solid ${urgencyColor};border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px;${e.statut === 'tenu' ? 'opacity:0.6;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13.5px;color:var(--ink);${e.statut === 'tenu' ? 'text-decoration:line-through;' : ''}">${escapeHtml(e.titre)}</div>
          <div style="font-size:11px;color:var(--ink-muted);margin-top:3px;">
            🏢 ${escapeHtml(e.client || '—')} ${e.contact ? '• 👤 ' + escapeHtml(e.contact) : ''} • <span style="color:${urgencyColor};font-weight:600;">${urgencyLabel}</span>
          </div>
          ${e.notes ? `<div style="font-size:12px;color:var(--ink-secondary);margin-top:6px;line-height:1.4;">${escapeHtml(e.notes)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          ${e.statut === 'en_cours' ? `
            <button onclick="Engagements.updateStatus('${e.id}','tenu');renderEngagementsList();toastOk('Engagement marqué comme tenu');" style="background:var(--ok-bg);color:var(--ok);border:1px solid var(--ok);padding:4px 10px;font-size:11px;border-radius:4px;cursor:pointer;font-family:inherit;font-weight:600;">✓ Tenu</button>
            <button onclick="Engagements.updateStatus('${e.id}','glisse');renderEngagementsList();toastInfo('Engagement glissé');" style="background:var(--bg);color:var(--ink-muted);border:1px solid var(--border);padding:4px 10px;font-size:11px;border-radius:4px;cursor:pointer;font-family:inherit;">↪ Glissé</button>
          ` : ''}
          <button onclick="if(confirm('Supprimer cet engagement ?')){Engagements.remove('${e.id}');renderEngagementsList();}" style="background:none;border:none;color:var(--ink-muted);cursor:pointer;font-size:14px;padding:4px;">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
window.renderEngagementsList = renderEngagementsList;

function showEngagementForm() {
  const cra = CyriasData.getCRA();
  const clients = [...new Set(cra.map(d => d.client).filter(Boolean))].sort();
  let modal = document.getElementById('engagement-form-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'engagement-form-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(540px,92vw);border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <h3 style="font-size:15px;font-weight:700;color:var(--primary);margin:0;">+ Nouvel engagement client</h3>
        <button onclick="document.getElementById('engagement-form-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:20px 22px;display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Engagement *</label>
          <input type="text" id="eng-titre" placeholder="Ex : Livrer la V2 du module commande" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Client *</label>
            <input type="text" id="eng-client" list="eng-client-list" placeholder="Client" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
            <datalist id="eng-client-list">${clients.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Échéance</label>
            <input type="date" id="eng-echeance" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Contact côté client</label>
          <input type="text" id="eng-contact" placeholder="Nom de la personne à qui on a promis" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:4px;">Contexte / notes</label>
          <textarea id="eng-notes" rows="3" placeholder="Contexte de l'engagement, conditions, dépendances..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;resize:vertical;"></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button class="btn btn-outline" onclick="document.getElementById('engagement-form-modal').remove()" style="font-size:12px;">Annuler</button>
          <button class="btn btn-primary" onclick="saveEngagementForm()" style="font-size:12px;">Enregistrer</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
window.showEngagementForm = showEngagementForm;

function saveEngagementForm() {
  const titre = document.getElementById('eng-titre').value.trim();
  const client = document.getElementById('eng-client').value.trim();
  if (!titre || !client) { toastWarn("Engagement et client sont obligatoires"); return; }
  Engagements.add({
    titre, client,
    echeance: document.getElementById('eng-echeance').value,
    contact: document.getElementById('eng-contact').value.trim(),
    notes: document.getElementById('eng-notes').value.trim()
  });
  document.getElementById('engagement-form-modal').remove();
  renderEngagementsList();
  toastOk('Engagement enregistré');
}
window.saveEngagementForm = saveEngagementForm;

// Étendre AnomalyDetector avec les engagements en retard
AnomalyDetector.rules.push({
  id: 'engagements_overdue',
  label: 'Engagements en retard',
  check() {
    const list = Engagements.getAll();
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = list.filter(e => {
      if (e.statut !== 'en_cours' || !e.echeance) return false;
      return new Date(e.echeance) < today;
    });
    const upcoming = list.filter(e => {
      if (e.statut !== 'en_cours' || !e.echeance) return false;
      const d = new Date(e.echeance);
      const days = (d - today) / 86400000;
      return days >= 0 && days <= 2;
    });
    if (overdue.length === 0 && upcoming.length === 0) return null;
    return {
      severity: overdue.length > 0 ? 'err' : 'warn',
      icon: '🤝',
      title: overdue.length > 0
        ? `${overdue.length} engagement(s) en retard`
        : `${upcoming.length} engagement(s) à honorer dans 48h`,
      detail: [...overdue, ...upcoming].slice(0, 3).map(e => `${e.client} : ${(e.titre || '').slice(0, 40)}`).join(' • '),
      action: { label: 'Voir', cb: () => showEngagementsModal() }
    };
  }
});


// ===========================================================
// FEATURE #15 — Diff viewer XML / JSON Ivalua
// ===========================================================
function openDiffViewer() {
  let modal = document.getElementById('diff-viewer-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'diff-viewer-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(1200px,96vw);max-height:92vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">🔀 Diff viewer XML / JSON</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Comparaison ligne à ligne — idéal pour DEV vs PROD</p>
        </div>
        <button onclick="document.getElementById('diff-viewer-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);flex:1;overflow:hidden;">
        <div style="background:var(--surface);display:flex;flex-direction:column;">
          <div style="padding:10px 14px;background:var(--bg);border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:700;color:var(--ink-secondary);">📄 Source A</span>
            <label class="btn btn-outline" style="font-size:10px;padding:3px 8px;cursor:pointer;margin:0;">
              📁 Charger
              <input type="file" accept=".xml,.json,.txt" style="display:none;" onchange="loadDiffFile(event,'A')">
            </label>
          </div>
          <textarea id="diff-input-a" placeholder="Collez ou chargez du XML / JSON ici..." style="flex:1;width:100%;padding:12px;border:none;outline:none;font-family:'JetBrains Mono',monospace;font-size:11.5px;line-height:1.5;resize:none;background:var(--surface);color:var(--ink);"></textarea>
        </div>
        <div style="background:var(--surface);display:flex;flex-direction:column;">
          <div style="padding:10px 14px;background:var(--bg);border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:700;color:var(--ink-secondary);">📄 Source B</span>
            <label class="btn btn-outline" style="font-size:10px;padding:3px 8px;cursor:pointer;margin:0;">
              📁 Charger
              <input type="file" accept=".xml,.json,.txt" style="display:none;" onchange="loadDiffFile(event,'B')">
            </label>
          </div>
          <textarea id="diff-input-b" placeholder="Collez ou chargez du XML / JSON ici..." style="flex:1;width:100%;padding:12px;border:none;outline:none;font-family:'JetBrains Mono',monospace;font-size:11.5px;line-height:1.5;resize:none;background:var(--surface);color:var(--ink);"></textarea>
        </div>
      </div>
      <div style="padding:12px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="font-size:11px;color:var(--ink-muted);">
          <label style="cursor:pointer;"><input type="checkbox" id="diff-format" checked> Reformater avant diff (auto-indent)</label>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" style="font-size:12px;" onclick="document.getElementById('diff-input-a').value='';document.getElementById('diff-input-b').value='';document.getElementById('diff-result').innerHTML='';">Réinitialiser</button>
          <button class="btn btn-primary" style="font-size:12px;" onclick="runDiff()">⚡ Comparer</button>
        </div>
      </div>
      <div id="diff-result" style="max-height:40vh;overflow-y:auto;background:#0f172a;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.openDiffViewer = openDiffViewer;

function loadDiffFile(event, side) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('diff-input-' + side.toLowerCase()).value = e.target.result;
    toastOk(`Source ${side} chargée : ${file.name}`);
  };
  reader.readAsText(file);
}
window.loadDiffFile = loadDiffFile;

function formatXmlOrJson(text) {
  text = (text || '').trim();
  if (!text) return '';
  // Tentative JSON
  try {
    const obj = JSON.parse(text);
    return JSON.stringify(obj, null, 2);
  } catch(e) {}
  // Tentative XML : indentation simple
  try {
    let formatted = '', indent = 0;
    text.replace(/(>)\s*(<)(\/*)/g, '$1\n$2$3').split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;
      if (line.match(/^<\/\w/)) indent--;
      formatted += '  '.repeat(Math.max(0, indent)) + line + '\n';
      if (line.match(/^<\w[^>]*[^/]>$/) && !line.match(/^<.*<\/.*>$/)) indent++;
    });
    return formatted.trim();
  } catch(e) {
    return text;
  }
}

function runDiff() {
  let a = document.getElementById('diff-input-a').value;
  let b = document.getElementById('diff-input-b').value;
  if (!a.trim() || !b.trim()) {
    toastWarn("Les deux sources sont requises");
    return;
  }
  if (document.getElementById('diff-format').checked) {
    a = formatXmlOrJson(a);
    b = formatXmlOrJson(b);
  }
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  // Algorithme de diff simple ligne-à-ligne (LCS approximatif via comparaison)
  // Pour simplicité on compare ligne par ligne avec padding
  const maxLen = Math.max(linesA.length, linesB.length);
  let html = '<div style="display:grid;grid-template-columns:50px 1fr 50px 1fr;gap:0;padding:12px;font-size:11px;">';
  let added = 0, removed = 0, unchanged = 0;
  // Algorithme amélioré : LCS (longest common subsequence)
  const lcs = computeLCS(linesA, linesB);
  const ops = diffFromLCS(linesA, linesB, lcs);
  let lineNumA = 0, lineNumB = 0;
  ops.forEach(op => {
    if (op.type === 'eq') {
      lineNumA++; lineNumB++; unchanged++;
      html += `<div style="color:#475569;text-align:right;padding:0 8px;">${lineNumA}</div>`;
      html += `<div style="white-space:pre;color:#cbd5e1;padding:0 8px;">${escapeHtml(op.line)}</div>`;
      html += `<div style="color:#475569;text-align:right;padding:0 8px;">${lineNumB}</div>`;
      html += `<div style="white-space:pre;color:#cbd5e1;padding:0 8px;">${escapeHtml(op.line)}</div>`;
    } else if (op.type === 'del') {
      lineNumA++; removed++;
      html += `<div style="color:#fca5a5;text-align:right;padding:0 8px;background:rgba(239,68,68,0.15);">${lineNumA}</div>`;
      html += `<div style="white-space:pre;color:#fecaca;padding:0 8px;background:rgba(239,68,68,0.15);">- ${escapeHtml(op.line)}</div>`;
      html += `<div style="padding:0 8px;background:rgba(239,68,68,0.05);">&nbsp;</div>`;
      html += `<div style="padding:0 8px;background:rgba(239,68,68,0.05);">&nbsp;</div>`;
    } else if (op.type === 'add') {
      lineNumB++; added++;
      html += `<div style="padding:0 8px;background:rgba(34,197,94,0.05);">&nbsp;</div>`;
      html += `<div style="padding:0 8px;background:rgba(34,197,94,0.05);">&nbsp;</div>`;
      html += `<div style="color:#86efac;text-align:right;padding:0 8px;background:rgba(34,197,94,0.15);">${lineNumB}</div>`;
      html += `<div style="white-space:pre;color:#bbf7d0;padding:0 8px;background:rgba(34,197,94,0.15);">+ ${escapeHtml(op.line)}</div>`;
    }
  });
  html += '</div>';
  // Stats en haut
  const stats = `<div style="padding:10px 14px;background:#1e293b;border-bottom:1px solid #334155;display:flex;gap:16px;font-size:11px;font-weight:700;">
    <span style="color:#86efac;">+${added} ajouts</span>
    <span style="color:#fca5a5;">-${removed} suppressions</span>
    <span style="color:#94a3b8;">${unchanged} inchangées</span>
  </div>`;
  document.getElementById('diff-result').innerHTML = stats + html;
  AuditLog.log('diff_run', `+${added} -${removed}`);
}
window.runDiff = runDiff;

// LCS classique pour bon diff
function computeLCS(a, b) {
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return [];
  // Pour limiter mémoire on borne (au-dessus de 2000 lignes on tronque)
  if (m * n > 4000000) return null;
  const dp = Array(m + 1).fill(null).map(() => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
      else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp;
}

function diffFromLCS(a, b, dp) {
  const ops = [];
  if (!dp) {
    // Fallback : juste afficher tout en remplacement
    a.forEach(l => ops.push({ type: 'del', line: l }));
    b.forEach(l => ops.push({ type: 'add', line: l }));
    return ops;
  }
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
      ops.unshift({ type: 'eq', line: a[i-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ type: 'add', line: b[j-1] }); j--;
    } else if (i > 0) {
      ops.unshift({ type: 'del', line: a[i-1] }); i--;
    }
  }
  return ops;
}

// ===========================================================
// FEATURE #16 — Validateur de fichiers Ivalua
// ===========================================================
function openIvaluaValidator() {
  let modal = document.getElementById('validator-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'validator-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(820px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">🔍 Validateur fichier Ivalua</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Vérifie la structure, les types et les valeurs incohérentes avant import</p>
        </div>
        <button onclick="document.getElementById('validator-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:24px;flex:1;overflow-y:auto;">
        <div id="validator-dropzone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:40px;text-align:center;cursor:pointer;transition:all var(--transition);" onclick="document.getElementById('validator-input').click()">
          <div style="font-size:32px;margin-bottom:8px;opacity:0.5;">📥</div>
          <div style="font-weight:600;font-size:14px;color:var(--ink);">Glissez un fichier ou cliquez pour sélectionner</div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:6px;">Formats supportés : XML, CSV, JSON</div>
          <input type="file" id="validator-input" accept=".xml,.csv,.json,.txt" style="display:none;" onchange="runIvaluaValidation(event)">
        </div>
        <div id="validator-result" style="margin-top:20px;"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  // Drag & drop
  const dz = document.getElementById('validator-dropzone');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.background = 'var(--secondary-light)'; dz.style.borderColor = 'var(--secondary)'; });
  dz.addEventListener('dragleave', () => { dz.style.background = ''; dz.style.borderColor = 'var(--border)'; });
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.style.background = ''; dz.style.borderColor = 'var(--border)';
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) runIvaluaValidation({ target: { files: [file] } });
  });
}
window.openIvaluaValidator = openIvaluaValidator;

function runIvaluaValidation(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const issues = [];
    const stats = { lines: 0, columns: 0, type: '' };

    // Détection du format
    const isJson = file.name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[');
    const isXml = file.name.endsWith('.xml') || text.trim().startsWith('<');
    const isCsv = file.name.endsWith('.csv') || (!isJson && !isXml && text.includes(','));

    if (isJson) {
      stats.type = 'JSON';
      try {
        const obj = JSON.parse(text);
        if (Array.isArray(obj)) {
          stats.lines = obj.length;
          if (obj.length === 0) issues.push({ severity: 'warn', msg: "Fichier JSON vide (tableau sans éléments)" });
          else {
            stats.columns = Object.keys(obj[0] || {}).length;
            // Vérifier la cohérence des clés entre objets
            const firstKeys = new Set(Object.keys(obj[0] || {}));
            obj.slice(1, 100).forEach((item, i) => {
              const keys = new Set(Object.keys(item || {}));
              const missing = [...firstKeys].filter(k => !keys.has(k));
              const extra = [...keys].filter(k => !firstKeys.has(k));
              if (missing.length > 0) issues.push({ severity: 'warn', msg: `Ligne ${i+2} : champs manquants ${missing.join(', ')}` });
              if (extra.length > 0) issues.push({ severity: 'info', msg: `Ligne ${i+2} : champs supplémentaires ${extra.join(', ')}` });
            });
            // Détection valeurs suspectes
            obj.slice(0, 200).forEach((item, i) => {
              Object.entries(item || {}).forEach(([k, v]) => {
                if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
                  const d = new Date(v);
                  if (!isNaN(d.getTime()) && d.getFullYear() > 2100) {
                    issues.push({ severity: 'warn', msg: `Ligne ${i+1}, ${k} : date suspecte (${v})` });
                  }
                }
                if (typeof v === 'number' && k.toLowerCase().includes('amount') && v < 0) {
                  issues.push({ severity: 'info', msg: `Ligne ${i+1}, ${k} : montant négatif (${v}) — vérifier le contexte` });
                }
              });
            });
          }
        } else {
          stats.lines = 1;
          stats.columns = Object.keys(obj).length;
        }
      } catch(err) {
        issues.push({ severity: 'err', msg: `JSON invalide : ${err.message}` });
      }
    } else if (isXml) {
      stats.type = 'XML';
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        const errNode = doc.querySelector('parsererror');
        if (errNode) {
          issues.push({ severity: 'err', msg: `XML mal formé : ${errNode.textContent.split('\n')[0]}` });
        } else {
          const allElements = doc.getElementsByTagName('*');
          stats.lines = allElements.length;
          stats.columns = doc.documentElement ? doc.documentElement.attributes.length : 0;
          // Vérifier les balises non fermées détectables
          const openTags = (text.match(/<[a-zA-Z][^>\s/]*[^/]>/g) || []).length;
          const closeTags = (text.match(/<\/[a-zA-Z]/g) || []).length;
          if (Math.abs(openTags - closeTags) > 0) {
            issues.push({ severity: 'warn', msg: `Possible déséquilibre de balises (${openTags} ouvertures, ${closeTags} fermetures)` });
          }
          // Encodage
          if (!text.startsWith('<?xml')) {
            issues.push({ severity: 'info', msg: "Pas de déclaration XML — peut poser problème lors de l'import (encodage non spécifié)" });
          }
        }
      } catch(err) {
        issues.push({ severity: 'err', msg: `Erreur de parsing : ${err.message}` });
      }
    } else if (isCsv) {
      stats.type = 'CSV';
      const lines = text.split('\n').filter(l => l.trim());
      stats.lines = Math.max(0, lines.length - 1);
      if (lines.length === 0) {
        issues.push({ severity: 'err', msg: "Fichier CSV vide" });
      } else {
        const detectedSep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
        const headers = lines[0].split(detectedSep);
        stats.columns = headers.length;
        if (headers.length === 1) issues.push({ severity: 'warn', msg: "Une seule colonne détectée — vérifiez le séparateur (testé : '" + detectedSep + "')" });
        // Vérifier longueur de chaque ligne
        lines.slice(1, 200).forEach((l, i) => {
          const cols = l.split(detectedSep);
          if (cols.length !== headers.length) {
            issues.push({ severity: 'warn', msg: `Ligne ${i+2} : ${cols.length} colonnes (attendu ${headers.length})` });
          }
        });
        // Header dupliqué ?
        const dupes = headers.filter((h, i) => headers.indexOf(h) !== i);
        if (dupes.length > 0) issues.push({ severity: 'warn', msg: `Colonnes dupliquées : ${[...new Set(dupes)].join(', ')}` });
        // Header vide
        const empty = headers.findIndex(h => !h.trim());
        if (empty !== -1) issues.push({ severity: 'warn', msg: `Colonne ${empty+1} sans nom` });
      }
    } else {
      issues.push({ severity: 'err', msg: "Format non reconnu" });
    }

    // Limiter le nombre d'issues affichées
    const displayed = issues.slice(0, 20);
    const result = document.getElementById('validator-result');
    const counts = { err: issues.filter(i => i.severity === 'err').length, warn: issues.filter(i => i.severity === 'warn').length, info: issues.filter(i => i.severity === 'info').length };
    const overallStatus = counts.err > 0 ? 'err' : counts.warn > 0 ? 'warn' : 'ok';
    const statusLabels = { err: '❌ Fichier non importable', warn: '⚠️ Importable avec précautions', ok: '✅ Fichier valide' };
    const colors = { err: 'var(--danger)', warn: 'var(--warn)', info: 'var(--info)', ok: 'var(--ok)' };
    result.innerHTML = `
      <div style="background:var(--bg);padding:14px 18px;border-radius:var(--radius-sm);border-left:4px solid ${colors[overallStatus]};margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;font-size:14px;color:${colors[overallStatus]};">${statusLabels[overallStatus]}</div>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:2px;">${escapeHtml(file.name)} • ${stats.type} • ${stats.lines} ligne(s) • ${stats.columns} colonne(s)</div>
          </div>
          <div style="display:flex;gap:12px;font-size:11px;">
            <span style="color:var(--danger);">${counts.err} erreur(s)</span>
            <span style="color:var(--warn);">${counts.warn} avert.</span>
            <span style="color:var(--info);">${counts.info} info(s)</span>
          </div>
        </div>
      </div>
      ${issues.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--ok);font-weight:600;">✨ Aucun problème détecté</div>' : `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);margin-bottom:8px;">Détails (${displayed.length}${issues.length > 20 ? ` sur ${issues.length}` : ''})</div>
        ${displayed.map(iss => `
          <div style="padding:8px 12px;border-left:3px solid ${colors[iss.severity]};background:var(--bg);border-radius:4px;margin-bottom:4px;font-size:12px;">
            <span style="color:${colors[iss.severity]};font-weight:700;">${iss.severity.toUpperCase()}</span> — ${escapeHtml(iss.msg)}
          </div>
        `).join('')}
      `}`;
    AuditLog.log('ivalua_file_validated', `${file.name} : ${counts.err} err, ${counts.warn} warn`);
  };
  reader.readAsText(file);
}
window.runIvaluaValidation = runIvaluaValidation;

// ===========================================================
// FEATURE #17 — Cheat sheets contextuelles
// ===========================================================
const CheatSheets = {
  sheets: [
    {
      id: 'ivalua-shortcuts',
      title: 'Raccourcis Ivalua extranet',
      icon: '⌨️',
      sections: [
        { title: 'Navigation', items: [
          { kbd: 'Ctrl + /', desc: 'Recherche globale' },
          { kbd: 'Alt + ←', desc: 'Page précédente' },
          { kbd: 'Esc', desc: 'Fermer le panneau actif' },
        ]},
        { title: 'Édition', items: [
          { kbd: 'Ctrl + S', desc: 'Sauvegarder le formulaire' },
          { kbd: 'Ctrl + Shift + S', desc: 'Sauvegarder et fermer' },
          { kbd: 'Tab', desc: 'Passer au champ suivant' },
        ]}
      ]
    },
    {
      id: 'sql-server',
      title: 'SQL Server — commandes utiles',
      icon: '⚡',
      sections: [
        { title: 'Transactions', items: [
          { kbd: 'BEGIN TRAN', desc: 'Démarrer une transaction' },
          { kbd: 'COMMIT', desc: 'Valider la transaction' },
          { kbd: 'ROLLBACK', desc: 'Annuler la transaction' },
        ]},
        { title: 'Diagnostic', items: [
          { kbd: 'sp_who2', desc: 'Voir les sessions actives' },
          { kbd: 'sp_helpindex \'table\'', desc: 'Lister les index d\'une table' },
          { kbd: 'DBCC SHRINKFILE', desc: 'Réduire un fichier de log' },
        ]},
        { title: 'Patterns courants', items: [
          { kbd: 'WITH cte AS (...)', desc: 'CTE — sous-requête nommée' },
          { kbd: 'OUTPUT INSERTED.*', desc: 'Récupérer les lignes insérées' },
          { kbd: 'TRY...CATCH', desc: 'Gestion erreurs procédurale' },
        ]}
      ]
    },
    {
      id: 'regex-fr',
      title: 'Regex courantes (français)',
      icon: '🔣',
      sections: [
        { title: 'Validation', items: [
          { kbd: '^[\\w.-]+@[\\w.-]+\\.\\w+$', desc: 'Email simple' },
          { kbd: '^(?:0|\\+33)[1-9](\\d{2}){4}$', desc: 'Téléphone français' },
          { kbd: '^\\d{2}/\\d{2}/\\d{4}$', desc: 'Date format JJ/MM/AAAA' },
          { kbd: '^FR\\d{2}\\s?(\\d{4}\\s?){5}\\d{3}$', desc: 'IBAN français' },
          { kbd: '^\\d{14}$', desc: 'SIRET (14 chiffres)' },
        ]},
        { title: 'Extraction', items: [
          { kbd: '\\b\\d{4,}\\b', desc: 'Nombres de 4 chiffres et + (numéros tickets)' },
          { kbd: 'https?://[^\\s]+', desc: 'URLs' },
        ]}
      ]
    },
    {
      id: 'codes-erreur-ivalua',
      title: 'Codes erreur Ivalua fréquents',
      icon: '🚫',
      sections: [
        { title: 'Authentification', items: [
          { kbd: 'AUTH-001', desc: 'Identifiants invalides' },
          { kbd: 'AUTH-002', desc: 'Compte verrouillé (5 essais)' },
          { kbd: 'AUTH-005', desc: 'Session expirée' },
        ]},
        { title: 'Workflow', items: [
          { kbd: 'WFL-101', desc: 'Étape de workflow non trouvée' },
          { kbd: 'WFL-102', desc: 'Validation requise mais validateur absent' },
          { kbd: 'WFL-110', desc: 'Boucle infinie détectée' },
        ]},
        { title: 'Données', items: [
          { kbd: 'DATA-201', desc: 'Champ obligatoire manquant' },
          { kbd: 'DATA-205', desc: 'Format de date invalide' },
          { kbd: 'DATA-210', desc: 'Référence intégrité (clé étrangère manquante)' },
        ]}
      ]
    }
  ]
};
window.CheatSheets = CheatSheets;

function openCheatSheets() {
  let modal = document.getElementById('cheatsheets-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'cheatsheets-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(900px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">📖 Cheat sheets</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Aide-mémoire pour les opérations courantes</p>
        </div>
        <button onclick="document.getElementById('cheatsheets-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:12px 22px;border-bottom:1px solid var(--border-light);">
        <input type="text" id="cs-search" placeholder="Rechercher dans les cheat sheets..." oninput="renderCheatSheets()" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
      </div>
      <div id="cs-content" style="overflow-y:auto;flex:1;padding:20px 24px;"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  renderCheatSheets();
}
window.openCheatSheets = openCheatSheets;

function renderCheatSheets() {
  const container = document.getElementById('cs-content');
  if (!container) return;
  const q = (document.getElementById('cs-search')?.value || '').toLowerCase().trim();
  const sheets = q
    ? CheatSheets.sheets.map(s => ({
        ...s,
        sections: s.sections.map(sec => ({
          ...sec,
          items: sec.items.filter(i => i.kbd.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q))
        })).filter(sec => sec.items.length > 0)
      })).filter(s => s.sections.length > 0 || s.title.toLowerCase().includes(q))
    : CheatSheets.sheets;
  if (sheets.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-muted);">Aucun résultat</div>';
    return;
  }
  container.innerHTML = sheets.map(s => `
    <div style="margin-bottom:24px;">
      <h4 style="font-size:14px;font-weight:700;color:var(--primary);margin:0 0 12px 0;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">${s.icon}</span> ${escapeHtml(s.title)}
      </h4>
      ${s.sections.map(sec => `
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);margin-bottom:6px;letter-spacing:0.5px;">${escapeHtml(sec.title)}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${sec.items.map(i => `
              <div style="display:grid;grid-template-columns:200px 1fr;gap:12px;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:12.5px;cursor:pointer;" onclick="navigator.clipboard.writeText('${i.kbd.replace(/'/g, "\\'")}').then(()=>toastOk('Copié !'))">
                <code style="font-family:'JetBrains Mono',monospace;color:var(--secondary-dark);font-weight:700;font-size:11.5px;">${escapeHtml(i.kbd)}</code>
                <span style="color:var(--ink-secondary);">${escapeHtml(i.desc)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}
window.renderCheatSheets = renderCheatSheets;


// ===========================================================
// FEATURE #22 — Notifications natives étendues
// ===========================================================
const NativeNotif = {
  enabled() {
    return 'Notification' in window && Notification.permission === 'granted';
  },
  request() {
    if (!('Notification' in window)) {
      toastWarn("Votre navigateur ne supporte pas les notifications");
      return Promise.resolve(false);
    }
    return Notification.requestPermission().then(p => {
      const ok = p === 'granted';
      if (ok) toastOk('Notifications activées');
      else if (p === 'denied') toastWarn('Notifications refusées — vous pouvez réactiver dans les paramètres du navigateur');
      return ok;
    });
  },
  send(title, body, options = {}) {
    if (!this.enabled()) return;
    try {
      const n = new Notification(title, { body, icon: options.icon, tag: options.tag });
      if (options.onClick) n.onclick = () => { window.focus(); options.onClick(); n.close(); };
      setTimeout(() => n.close(), options.duration || 8000);
    } catch(e) {}
  }
};
window.NativeNotif = NativeNotif;

// Vérification quotidienne des engagements proches
function dailyEngagementsCheck() {
  const last = localStorage.getItem('cyrias_eng_check_date');
  const today = new Date().toDateString();
  if (last === today) return;
  localStorage.setItem('cyrias_eng_check_date', today);
  const list = Engagements.getAll();
  const now = new Date(); now.setHours(0,0,0,0);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const dueTomorrow = list.filter(e => {
    if (e.statut !== 'en_cours' || !e.echeance) return false;
    return new Date(e.echeance).toDateString() === tomorrow.toDateString();
  });
  if (dueTomorrow.length > 0 && NativeNotif.enabled()) {
    NativeNotif.send(
      `🤝 ${dueTomorrow.length} engagement(s) demain`,
      dueTomorrow.map(e => `• ${e.client} : ${e.titre}`).join('\n'),
      { tag: 'engagements-jminus1', onClick: showEngagementsModal }
    );
  }
}

// ===========================================================
// FEATURE #24 — Indicateur "modifié non sauvegardé" pour scratchpad
// ===========================================================
function attachUnsavedIndicator() {
  const sp = document.getElementById('scratchpad-text');
  if (!sp || sp.dataset.unsavedAttached) return;
  sp.dataset.unsavedAttached = '1';

  // Trouver le header du scratchpad
  const header = document.querySelector('.scratchpad-header');
  if (!header) return;
  // Ajouter un indicateur s'il n'existe pas
  let indicator = document.getElementById('sp-saved-indicator');
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.id = 'sp-saved-indicator';
    indicator.style.cssText = 'font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.2);transition:all 0.3s;';
    indicator.textContent = '✓ Sauvegardé';
    header.appendChild(indicator);
  }

  let saveTimer = null;
  sp.addEventListener('input', () => {
    indicator.textContent = '✏️ En cours...';
    indicator.style.background = 'rgba(217,119,6,0.3)';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      indicator.textContent = '✓ Sauvegardé';
      indicator.style.background = 'rgba(34,197,94,0.3)';
      setTimeout(() => { indicator.style.background = 'rgba(255,255,255,0.2)'; }, 1500);
    }, 800);
  });
}

// ===========================================================
// FEATURE #21 — Mode lecture seule pour partage (rapport HTML autonome)
// ===========================================================
function generateShareableReport() {
  const cra = CyriasData.getCRA();
  const budgets = CyriasData.getBudgets();
  const tjm = CyriasData.getTjm();
  const username = localStorage.getItem('cyrias_username') || 'L\'équipe TMA';
  const now = new Date();

  if (cra.length === 0) {
    toastWarn("Importez au moins une source CRA pour générer un rapport partageable");
    return;
  }

  // Choisir le client (s'il y en a plusieurs)
  const clients = [...new Set(cra.map(d => d.client).filter(Boolean))].sort();
  let targetClient = clients[0];
  if (clients.length > 1) {
    const choice = prompt(`Pour quel client générer le rapport ?\n\nClients disponibles :\n${clients.map((c, i) => `${i+1}. ${c}`).join('\n')}\n\nEntrez le numéro :`, '1');
    if (choice === null) return;
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < clients.length) targetClient = clients[idx];
    else { toastWarn("Choix invalide"); return; }
  }

  // Calculer les KPI
  const data = cra.filter(d => d.client === targetClient);
  const totalJours = data.reduce((s, d) => s + (parseFloat(d.jours) || 0), 0);
  const collabs = [...new Set(data.map(d => d.collaborateur).filter(Boolean))];
  const missions = [...new Set(data.map(d => d.mission).filter(Boolean))];
  const tjmClient = tjm[targetClient] || 0;
  const ca = totalJours * tjmClient;
  // Détail par mission
  const byMission = missions.map(m => {
    const conso = data.filter(d => d.mission === m).reduce((s, d) => s + (parseFloat(d.jours) || 0), 0);
    const b = budgets[m];
    const budget = b && (b.budget || b);
    return { mission: m, conso: conso.toFixed(1), budget: budget || '—', pct: budget ? ((conso / budget) * 100).toFixed(0) : '—' };
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport TMA — ${escapeHtml(targetClient)} — ${now.toLocaleDateString('fr-FR')}</title>
<style>
body { font-family: 'Segoe UI', Arial, sans-serif; background: #F4F7F6; color: #1A202C; margin: 0; padding: 40px 20px; line-height: 1.5; }
.container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
h1 { color: #1B3B5C; font-size: 28px; margin: 0 0 8px; }
.subtitle { color: #718096; font-size: 14px; margin-bottom: 32px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
.kpi { background: #F4F7F6; padding: 18px; border-radius: 8px; border-left: 4px solid #5EB091; }
.kpi-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
.kpi-value { font-size: 26px; font-weight: 800; color: #1B3B5C; margin-top: 6px; font-family: 'Courier New', monospace; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th { background: #1B3B5C; color: white; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; }
td { padding: 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
.section { margin-top: 32px; }
.section h2 { color: #1B3B5C; font-size: 18px; padding-bottom: 8px; border-bottom: 2px solid #5EB091; }
.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #A0AEC0; text-align: center; }
.badge-ok { background: #E6F4EF; color: #4A9076; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.badge-warn { background: #FEF3C7; color: #D97706; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.badge-err { background: #FED7D7; color: #E53E3E; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
@media print { body { background: white; padding: 0; } .container { box-shadow: none; padding: 20px; } }
</style>
</head>
<body>
<div class="container">
  <h1>Rapport d'activité TMA</h1>
  <div class="subtitle">Client : <strong>${escapeHtml(targetClient)}</strong> • Généré le ${now.toLocaleDateString('fr-FR')} par ${escapeHtml(username)}</div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Jours consommés</div><div class="kpi-value">${totalJours.toFixed(1)}</div></div>
    <div class="kpi"><div class="kpi-label">Collaborateurs</div><div class="kpi-value">${collabs.length}</div></div>
    <div class="kpi"><div class="kpi-label">Missions</div><div class="kpi-value">${missions.length}</div></div>
    <div class="kpi"><div class="kpi-label">CA estimé</div><div class="kpi-value">${ca > 0 ? parseInt(ca).toLocaleString('fr-FR') + ' €' : '—'}</div></div>
  </div>

  <div class="section">
    <h2>Détail par mission</h2>
    <table>
      <thead><tr><th>Mission</th><th>Consommé</th><th>Budget</th><th>% Conso.</th><th>Statut</th></tr></thead>
      <tbody>
        ${byMission.map(m => {
          const pct = parseFloat(m.pct);
          const cls = isNaN(pct) ? '' : pct >= 100 ? 'badge-err' : pct >= 90 ? 'badge-warn' : 'badge-ok';
          const lbl = isNaN(pct) ? 'Non budgété' : pct >= 100 ? 'Dépassé' : pct >= 90 ? 'Tension' : 'OK';
          return `<tr><td><strong>${escapeHtml(m.mission)}</strong></td><td>${m.conso} j</td><td>${m.budget}${m.budget !== '—' ? ' j' : ''}</td><td>${m.pct}${m.pct !== '—' ? '%' : ''}</td><td>${cls ? `<span class="${cls}">${lbl}</span>` : lbl}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Équipe mobilisée</h2>
    <p>${collabs.length > 0 ? collabs.map(c => `<span style="display:inline-block;background:#E6F4EF;color:#4A9076;padding:4px 10px;border-radius:4px;font-size:12px;margin:2px;">${escapeHtml(c)}</span>`).join('') : 'Aucun collaborateur identifié'}</p>
  </div>

  <div class="footer">
    📄 Rapport autonome — Cyrias Buddy<br>
    Document figé au ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-${targetClient.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${now.toISOString().split('T')[0]}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  toastOk(`Rapport ${targetClient} généré`);
  AuditLog.log('shareable_report_generated', targetClient);
}
window.generateShareableReport = generateShareableReport;

// ===========================================================
// FEATURE #29 — Templates de projets (configuration TMA type)
// ===========================================================
function applyProjectTemplate() {
  const ok = confirm(
    "Appliquer une configuration TMA standard ?\n\n" +
    "Cela va créer :\n" +
    "• 5 statuts de demandes types (Nouveau, Qualifié, En dev, UAT, Clôturé)\n" +
    "• 3 catégories de liens (Documentation, Outils, Production)\n" +
    "• 4 templates d'engagements types\n\n" +
    "Vos données existantes ne seront PAS effacées.\n" +
    "Continuer ?"
  );
  if (!ok) return;

  // Statuts demandes
  try {
    const existing = JSON.parse(localStorage.getItem('cra_demandes_statuts') || '[]');
    const standard = ['Nouveau', 'Qualifié', 'En développement', 'UAT', 'Clôturé'];
    const merged = [...new Set([...existing, ...standard])];
    localStorage.setItem('cra_demandes_statuts', JSON.stringify(merged));
  } catch(e) {}

  // Catégories de liens
  try {
    const existingCats = JSON.parse(localStorage.getItem('compagnon_cats') || '[]');
    const standardCats = ['Documentation', 'Outils', 'Production'];
    const newCats = standardCats.filter(c => !existingCats.some(e => (e.name || e) === c));
    const merged = [...existingCats, ...newCats.map(c => ({ name: c, id: 'cat_' + Date.now() + Math.random() }))];
    localStorage.setItem('compagnon_cats', JSON.stringify(merged));
  } catch(e) {}

  toastOk('Configuration TMA standard appliquée');
  AuditLog.log('project_template_applied');
  // Recharger pour voir les changements
  setTimeout(() => {
    if (confirm("Recharger la page pour voir les nouvelles configurations ?")) location.reload();
  }, 500);
}
window.applyProjectTemplate = applyProjectTemplate;

// ===========================================================
// FEATURE #30 — Heatmap de l'activité (style GitHub)
// ===========================================================
function showActivityHeatmap() {
  const cra = CyriasData.getCRA();
  if (cra.length === 0) {
    toastWarn("Aucune donnée CRA — importez vos sources pour voir la heatmap");
    return;
  }
  // Agréger par date
  const byDate = {};
  cra.forEach(d => {
    const dt = d.date || d.dateSaisie;
    if (!dt) return;
    const dateStr = new Date(dt).toISOString().split('T')[0];
    byDate[dateStr] = (byDate[dateStr] || 0) + (parseFloat(d.jours) || 0);
  });
  // Limites : 1 an glissant
  const today = new Date();
  const oneYearAgo = new Date(today); oneYearAgo.setFullYear(today.getFullYear() - 1);
  // Trouver le max pour normaliser les couleurs
  const max = Math.max(...Object.values(byDate), 1);

  // Construire la grille (semaines x jours)
  const dates = [];
  const start = new Date(oneYearAgo);
  // Aligner sur le lundi
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cur = new Date(start);
  while (cur <= today) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  // Grouper par semaines (colonnes) et jours (lignes)
  const weeks = [];
  let week = [];
  dates.forEach((d, i) => {
    week.push(d);
    if (d.getDay() === 0 || i === dates.length - 1) { // dimanche ou dernier
      weeks.push(week);
      week = [];
    }
  });

  const cellColor = (value) => {
    if (value === 0 || !value) return '#ebedf0';
    const ratio = value / max;
    if (ratio < 0.25) return '#c6e48b';
    if (ratio < 0.5) return '#7bc96f';
    if (ratio < 0.75) return '#239a3b';
    return '#196127';
  };

  let modal = document.getElementById('heatmap-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'heatmap-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';

  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const dayLabels = ['Lun','Mer','Ven'];

  // Stats
  const totalJours = Object.values(byDate).reduce((s, v) => s + v, 0);
  const activeDays = Object.values(byDate).filter(v => v > 0).length;
  const avgPerActiveDay = activeDays > 0 ? (totalJours / activeDays).toFixed(2) : 0;
  const longestStreak = computeLongestStreak(byDate);

  modal.innerHTML = `
    <div style="background:var(--surface);width:min(1100px,96vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">📊 Heatmap d'activité</h3>
          <p style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Vue calendaire des saisies CRA sur 1 an</p>
        </div>
        <button onclick="document.getElementById('heatmap-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:20px 24px;overflow-y:auto;flex:1;">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
          <div style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);text-align:center;">
            <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Total annuel</div>
            <div style="font-size:22px;font-weight:800;color:var(--primary);font-family:'JetBrains Mono',monospace;">${totalJours.toFixed(0)}j</div>
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);text-align:center;">
            <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Jours actifs</div>
            <div style="font-size:22px;font-weight:800;color:var(--secondary-dark);font-family:'JetBrains Mono',monospace;">${activeDays}</div>
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);text-align:center;">
            <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Moy. par jour actif</div>
            <div style="font-size:22px;font-weight:800;color:var(--info);font-family:'JetBrains Mono',monospace;">${avgPerActiveDay}j</div>
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);text-align:center;">
            <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;">Plus longue série</div>
            <div style="font-size:22px;font-weight:800;color:var(--warn);font-family:'JetBrains Mono',monospace;">${longestStreak}j</div>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <div style="display:flex;gap:3px;padding:0 0 0 32px;font-size:9px;color:var(--ink-muted);margin-bottom:4px;">
            ${months.map((m, i) => `<div style="width:calc((100% - ${months.length-1}*3px)/12);text-align:left;">${m}</div>`).join('')}
          </div>
          <div style="display:flex;gap:3px;">
            <div style="display:flex;flex-direction:column;gap:3px;font-size:9px;color:var(--ink-muted);width:28px;padding-right:4px;">
              <div style="height:11px;"></div>
              <div style="height:11px;">${dayLabels[0]}</div>
              <div style="height:11px;"></div>
              <div style="height:11px;">${dayLabels[1]}</div>
              <div style="height:11px;"></div>
              <div style="height:11px;">${dayLabels[2]}</div>
              <div style="height:11px;"></div>
            </div>
            <div style="display:flex;gap:3px;flex:1;">
              ${weeks.map(w => {
                // Forcer l'ordre lundi-dimanche
                const cells = [null,null,null,null,null,null,null];
                w.forEach(d => {
                  const dayIdx = (d.getDay() + 6) % 7; // lundi=0 ... dimanche=6
                  cells[dayIdx] = d;
                });
                return `<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:11px;max-width:13px;">
                  ${cells.map(d => {
                    if (!d) return '<div style="height:11px;width:100%;"></div>';
                    const ds = d.toISOString().split('T')[0];
                    const v = byDate[ds] || 0;
                    return `<div title="${d.toLocaleDateString('fr-FR')} : ${v.toFixed(1)}j" style="height:11px;width:100%;background:${cellColor(v)};border-radius:2px;cursor:pointer;"></div>`;
                  }).join('')}
                </div>`;
              }).join('')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:12px;font-size:10px;color:var(--ink-muted);">
            Moins
            <div style="width:10px;height:10px;background:#ebedf0;border-radius:2px;"></div>
            <div style="width:10px;height:10px;background:#c6e48b;border-radius:2px;"></div>
            <div style="width:10px;height:10px;background:#7bc96f;border-radius:2px;"></div>
            <div style="width:10px;height:10px;background:#239a3b;border-radius:2px;"></div>
            <div style="width:10px;height:10px;background:#196127;border-radius:2px;"></div>
            Plus
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  AuditLog.log('heatmap_viewed');
}
window.showActivityHeatmap = showActivityHeatmap;

function computeLongestStreak(byDate) {
  const dates = Object.keys(byDate).filter(d => byDate[d] > 0).sort();
  let longest = 0, current = 0, prev = null;
  dates.forEach(d => {
    const cur = new Date(d);
    if (prev) {
      const diff = (cur - prev) / 86400000;
      if (diff === 1) current++;
      else current = 1;
    } else current = 1;
    longest = Math.max(longest, current);
    prev = cur;
  });
  return longest;
}

