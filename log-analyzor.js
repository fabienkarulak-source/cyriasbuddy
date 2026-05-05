/* ============================================================
   Cyrias Buddy — Log Analyzor & STES Agregator
   ============================================================ */
setTimeout(() => {
    const mainContent = document.querySelector('.main-content');
    
    // 1. EXTRACTION : Sortir le Kanban et le Board du ventre du CRAminator !
    document.querySelectorAll('.page').forEach(page => {
        // Si la page n'est pas directement à la racine (et que ce n'est pas le dashboard)
        if (page.id !== 'page-dashboard' && page.parentElement !== mainContent) {
            mainContent.appendChild(page);
        }
    });

    // 2. NETTOYAGE : Éliminer les éventuels doublons créés par le copier-coller
    const seenPages = new Set();
    document.querySelectorAll('.page').forEach(page => {
        if (seenPages.has(page.id)) {
            page.remove(); 
        } else {
            seenPages.add(page.id);
        }
    });

    // 3. MOTEUR KANBAN
    window.renderKanban = function() {
        const todoCol = document.getElementById('kanban-todo');
        const uatCol = document.getElementById('kanban-uat');
        const mepCol = document.getElementById('kanban-mep');
        if (!todoCol || !uatCol || !mepCol) return;
        
        todoCol.innerHTML = ''; uatCol.innerHTML = ''; mepCol.innerHTML = '';
        
        const tks = typeof demandesData !== 'undefined' ? demandesData : [];
        if (tks.length === 0) {
            todoCol.innerHTML = '<div style="font-size: 12px; color: var(--ink-muted); padding: 10px;">Aucun ticket en mémoire. Importez-les via CRAminator > Demandes.</div>';
            return;
        }

        const activeTickets = tks.filter(d => typeof isClosedStatut === 'function' ? !isClosedStatut(d.statut) : true);

        activeTickets.forEach(t => {
            const prioColor = (t.priorite || '').toLowerCase().includes('1') || (t.priorite || '').toLowerCase().includes('urgent') ? 'var(--danger)' : 'var(--secondary)';
            const cardHtml = `<div class="kanban-card" draggable="true" ondragstart="drag(event)" data-id="${t.id}" style="background: white; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; cursor: grab; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 3px solid ${prioColor};"><div style="font-size: 10px; color: var(--ink-muted); display: flex; justify-content: space-between; margin-bottom: 4px;"><span>${t.id}</span><span>${t.client}</span></div><div style="font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 8px;">${t.objet}</div><div style="font-size: 10px; display: inline-block; padding: 2px 6px; background: var(--bg); border-radius: 4px;">${t.statut}</div></div>`;
            
            const stat = (t.statut || '').toLowerCase();
            if (stat.includes('uat') || stat.includes('recette') || stat.includes('test')) { uatCol.innerHTML += cardHtml; } 
            else if (stat.includes('mep') || stat.includes('prod') || stat.includes('déployé')) { mepCol.innerHTML += cardHtml; } 
            else { todoCol.innerHTML += cardHtml; }
        });
    };

    // 4. MOTEUR BOARD DIRECTION
    window.renderDirectionBoard = function() {
        const healthContainer = document.getElementById('health-score-container');
        if (!healthContainer) return;
        
        // Relance les calculs si nécessaire
        if (typeof updateDashboard === 'function' && (typeof currentRacData === 'undefined' || currentRacData.length === 0)) {
            updateDashboard(); 
        }

        const dataToUse = typeof rawData !== 'undefined' ? rawData : [];
        if (dataToUse.length === 0) {
            healthContainer.innerHTML = '<div style="font-size: 12px; color: var(--ink-muted);">Aucune donnée CRA trouvée. Importez vos temps dans le CRAminator.</div>';
            return;
        }

        const clients = [...new Set(dataToUse.map(d => d.client))].sort();
        let healthHtml = '';

        clients.forEach(c => {
            const nps = (typeof clientProfiles !== 'undefined' && clientProfiles[c] && clientProfiles[c].nps != null) ? clientProfiles[c].nps : 'N/A';
            const missionRac = (typeof currentRacData !== 'undefined') ? currentRacData.find(d => d.m.includes(c)) : null;
            const racPct = missionRac ? Math.round(100 - missionRac.percent) : 'N/A';

            let healthLevel = 'Neutre'; let colorClass = 'var(--ink-muted)'; let bgClass = 'var(--bg)';
            if (nps !== 'N/A' && racPct !== 'N/A') {
                if (nps >= 8 && racPct > 20) { healthLevel = 'Excellent'; colorClass = 'var(--secondary)'; bgClass = 'rgba(94, 176, 145, 0.1)'; } 
                else if (nps <= 6 || racPct < 10) { healthLevel = 'Critique'; colorClass = 'var(--danger)'; bgClass = 'rgba(231, 91, 60, 0.1)'; } 
                else { healthLevel = 'À surveiller'; colorClass = '#D97706'; bgClass = 'rgba(233, 189, 39, 0.1)'; }
            }
            healthHtml += `<div style="padding: 12px; background: ${bgClass}; border-left: 4px solid ${colorClass}; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><strong style="color: var(--primary); font-size: 14px;">${c}</strong><div style="font-size: 12px; display: flex; gap: 16px; color: var(--ink-secondary);"><span>NPS: <strong>${nps}</strong></span><span>RAC: <strong>${racPct}%</strong></span><span style="color: ${colorClass}; font-weight: bold;">${healthLevel}</span></div></div>`;
        });
        healthContainer.innerHTML = healthHtml;
    };

    // 5. CABLAGE DU MENU
    const oldNav = window.navigateTo;
    window.navigateTo = function(page) {
        if(oldNav) oldNav(page);
        if (page === 'direction') setTimeout(window.renderDirectionBoard, 50);
        if (page === 'kanban') setTimeout(window.renderKanban, 50);
    };

}, 800); 

// --- LOGIQUE STES AGREGATOR (SPLITTER INTEGRÉ) ---
let agData = [], agHeaders = [], agClientGroups = {}, agSelectedCols = new Set();
const AG_DEFAULT_KEEP = ['Collaborateur','Nom de la mission','Tâche','Date','Commentaire','Fractions'];

// Initialisation de l'écouteur de fichier
document.addEventListener('DOMContentLoaded', () => {
    const fileIn = document.getElementById('ag-file-input');
    if(fileIn) fileIn.addEventListener('change', e => { if (e.target.files[0]) agHandleFile(e.target.files[0]); });
});

function agHandleFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'DD/MM/YYYY' });
    
    if (!rows.length) return;
    agHeaders = Object.keys(rows[0]);
    agData = rows;
    
    const clientCol = agHeaders.find(h => h.toLowerCase().includes('client')) || agHeaders[0];
    agClientGroups = {};
    rows.forEach(r => {
      const key = String(r[clientCol] || 'Inconnu').trim();
      if (!agClientGroups[key]) agClientGroups[key] = [];
      agClientGroups[key].push(r);
    });

    agSelectedCols = new Set(agHeaders.filter(h => AG_DEFAULT_KEEP.includes(h)));
    agRenderUI();
  };
  reader.readAsArrayBuffer(file);
}

function agRenderUI() {
  const grid = document.getElementById('ag-col-grid');
  grid.innerHTML = agHeaders.map(h => {
      const active = agSelectedCols.has(h) ? 'background: var(--secondary-light); border-color: var(--secondary); color: var(--secondary-dark);' : 'background: var(--bg); border: 1px solid var(--border);';
      return `<div class="col-chip" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; ${active}" onclick="agToggleCol('${h.replace(/'/g,"\\'")}', this)">${h}</div>`;
  }).join('');
  
  const list = document.getElementById('ag-clients-list');
  list.innerHTML = Object.keys(agClientGroups).sort().map(name => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border-light);">
      <span style="flex:1; font-weight:600; font-size:13px; color: var(--primary);">${name}</span>
      <span style="font-size:11px; color:var(--ink-muted);">${agClientGroups[name].length} lignes</span>
    </div>
  `).join('');
  
  document.getElementById('ag-preview-section').style.display = 'block';
}

function agToggleCol(h, el) {
  if (agSelectedCols.has(h)) {
    agSelectedCols.delete(h);
    el.style.background = 'var(--bg)';
    el.style.borderColor = 'var(--border)';
    el.style.color = 'inherit';
  } else {
    agSelectedCols.add(h);
    el.style.background = 'var(--secondary-light)';
    el.style.borderColor = 'var(--secondary)';
    el.style.color = 'var(--secondary-dark)';
  }
}

function agResetDefaultCols() {
  agSelectedCols = new Set(agHeaders.filter(h => AG_DEFAULT_KEEP.includes(h)));
  agRenderUI();
}

function agToggleAllCols(val) {
  if(val) agHeaders.forEach(h => agSelectedCols.add(h));
  else agSelectedCols.clear();
  agRenderUI();
}

async function agExportAll() {
  const clients = Object.keys(agClientGroups);
  document.getElementById('ag-progress-section').style.display = 'block';
  const fill = document.getElementById('ag-prog-fill');
  const log = document.getElementById('ag-log-list');
  log.innerHTML = '';

  const cols = agHeaders.filter(h => agSelectedCols.has(h));

  for (let i = 0; i < clients.length; i++) {
    const name = clients[i];
    fill.style.width = `${((i+1)/clients.length)*100}%`;
    
    try {
      const rows = agClientGroups[name].map(r => {
        let o = {}; cols.forEach(c => o[c] = r[c]); return o;
      });
      const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CRA');
      XLSX.writeFile(wb, `CRA_${name.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`);
      
      const li = document.createElement('li');
      li.style.color = 'var(--secondary-dark)';
      li.textContent = `✓ ${name} généré (${rows.length} lignes)`;
      log.appendChild(li);
    } catch(err) { console.error(err); }
    
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}
// ==========================================
// LOG ANALYZOR SCRIPT
// ==========================================
const LA_BUILTIN_RULES = [
  // ════════════════════════════════════════════════════════════════════
  // ── ERREURS BACK-END / SQL (AVEC EXTRACTION DE CHAMPS) ──────────────
  // ════════════════════════════════════════════════════════════════════
  
  {
    // Règle très précise pour les clés étrangères
    id: 'sql-fk-violation',
    type: 'error', severity: 'CRITIQUE',
    title: 'SqlException : Violation de Clé Étrangère (FK)',
    pattern: /conflicted with the FOREIGN KEY constraint "([^"]+)".*?table "([^"]+)", column '([^']+)'/gi,
    location: m => `Table : ${m[2]} | Champ : ${m[3]}`,
    explain: m => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> Tentative d'insertion d'une valeur inconnue dans le champ <code>${m[3]}</code> de la table <code>${m[2]}</code>.</div>
      <div style="padding:10px; background:rgba(255,107,107,0.1); border-left:3px solid var(--la-red); margin-bottom:10px;">
        <strong>Explication métier :</strong> La valeur envoyée pour le champ <strong>${m[3]}</strong> n'existe pas dans la table de référence (référentiel manquant ou désynchronisé).<br>
        <em>Contrainte en échec : ${m[1]}</em>
      </div>`,
    fix: m => `-- 🛠️ REQUÊTE DE DIAGNOSTIC GÉNÉRÉE :
-- Vérifiez quelle valeur tente d'être insérée dans ${m[3]} :
SELECT ${m[3]}, * FROM ${m[2]} (NOLOCK)
-- Comparez ensuite cette valeur avec la table de référence liée à la contrainte ${m[1]}.`
  },

  {
    // Extraction de la colonne tronquée (SQL Server 2019+)
    id: 'sql-truncation-exact',
    type: 'error', severity: 'HAUTE',
    title: 'SqlException : Troncature de données identifiée',
    pattern: /String or binary data would be truncated in table '([^']+)', column '([^']+)'/gi,
    location: m => `Table : ${m[1]} | Champ : ${m[2]}`,
    explain: m => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> La valeur que vous essayez d'insérer dans le champ <code>${m[2]}</code> est trop longue pour la table <code>${m[1]}</code>.</div>
      <div style="padding:10px; background:rgba(255,166,87,0.1); border-left:3px solid var(--la-orange); margin-bottom:10px;">
        <strong>Action immédiate :</strong> Repérez l'interface ou le formulaire qui alimente <strong>${m[2]}</strong> et vérifiez la taille de la chaîne envoyée.
      </div>`,
    fix: m => `-- 🛠️ REQUÊTE DE VÉRIFICATION :
-- Taille maximale autorisée pour le champ en erreur :
SELECT CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = '${m[1].split('.').pop()}' -- Nettoyage du schéma si présent
  AND COLUMN_NAME = '${m[2]}';`
  },

  {
    // Troncature générique (Anciennes versions SQL)
    id: 'sql-truncation-generic',
    type: 'error', severity: 'HAUTE',
    title: 'SqlException : Troncature de données (Générique)',
    pattern: /String or binary data would be truncated(?!\s+in table)/gi,
    location: () => 'Base de données',
    explain: () => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> Une valeur est trop longue pour son champ de destination. <em>SQL Server n'a pas fourni le nom du champ (version antérieure à 2019 ou paramètre désactivé).</em></div>`,
    fix: () => `// 🛠️ ASTUCE IVALUA :
// Pour trouver le champ coupable, ouvrez le Profiler SQL Ivalua ou SQL Server Profiler pour intercepter la requête exacte et sa déclaration de variables.`
  },

  {
    // Nom de colonne invalide
    id: 'sql-invalid-col',
    type: 'error', severity: 'CRITIQUE',
    title: 'SqlException : Champ introuvable',
    pattern: /Invalid column name '([^']+)'/gi,
    location: m => `Champ en erreur : ${m[1]}`,
    explain: m => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> La requête SQL tente d'appeler le champ <code>${m[1]}</code>, mais il n'existe pas dans la table interrogée.</div>
      <div style="padding:10px; background:rgba(88,166,255,0.1); border-left:3px solid var(--la-blue); margin-bottom:10px;">
        <strong>Causes fréquentes Ivalua :</strong>
        <ul style="margin-left:20px; margin-top:5px;">
          <li>Le champ de paramétrage <strong>${m[1]}</strong> n'a pas été publié (Data Dictionary).</li>
          <li>Faute de frappe dans une requête SQL Custom (Custom Action / SqlTask).</li>
        </ul>
      </div>`,
    fix: m => `-- 🛠️ PLAN D'ACTION :
-- Vérifiez l'existence du champ dans le dictionnaire de données Ivalua.
-- Ou en SQL directement :
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE COLUMN_NAME LIKE '%${m[1]}%';`
  },

  // ════════════════════════════════════════════════════════════════════
  // ── ERREURS C# / IVALUA METIER (AVEC EXTRACTION DE MÉTHODES) ────────
  // ════════════════════════════════════════════════════════════════════

  {
    // Extraction précise de l'exception NullRef avec la méthode C#
    id: 'csharp-nullref-exact',
    type: 'error', severity: 'CRITIQUE',
    title: 'NullReferenceException (C#)',
    pattern: /System\.NullReferenceException:[\s\S]*?at\s+([^\n]+)/gi,
    location: m => `Méthode : ${m[1].trim().split('(')[0]}`,
    explain: m => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> Un objet attendu vaut <code>null</code> dans le code backend.</div>
      <div style="padding:10px; background:rgba(255,107,107,0.1); border-left:3px solid var(--la-red); margin-bottom:10px;">
        <strong>Point de plantage exact :</strong> Le crash a eu lieu dans la méthode C# :<br>
        <code style="color:var(--la-accent);">${m[1].trim()}</code><br><br>
        S'il s'agit d'une classe Ivalua standard, un champ obligatoire est vide en base. S'il s'agit d'une classe "Cyrias", le code custom n'est pas sécurisé.
      </div>`,
    fix: m => `// 🛠️ PISTE DE DEBUG :
// Cherchez les appels à la méthode : ${m[1].trim().split('.').pop()}
// Quel paramètre est manquant ? (ID de fournisseur vide, montant null, etc.)`
  },

  {
    // Extraction des erreurs de validation (Souvent remontées par Ivalua)
    id: 'ivalua-validation',
    type: 'warn', severity: 'HAUTE',
    title: 'Erreur de Validation Métier',
    pattern: /(?:Field|Champ|Colonne)\s+'?([^'\s]+)'?\s+(?:is required|est obligatoire|cannot be null|doit être renseigné)/gi,
    location: m => `Champ manquant : ${m[1]}`,
    explain: m => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> Le système refuse l'enregistrement car le champ <strong>${m[1]}</strong> est obligatoire mais a été soumis vide.</div>`,
    fix: m => `// 🛠️ CORRECTION :
// 1. Assurez-vous que le champ ${m[1]} est visible et modifiable sur la page.
// 2. Si l'enregistrement se fait par API/ETL, vérifiez le fichier source pour la colonne ${m[1]}.`
  },

  // ════════════════════════════════════════════════════════════════════
  // ── ERREURS FRONT-END / JS (AVEC EXTRACTION) ────────────────────────
  // ════════════════════════════════════════════════════════════════════

  {
    id: 'typeerror-undefined-exact',
    type: 'error', severity: 'HAUTE',
    title: 'TypeError JS : Propriété introuvable',
    pattern: /TypeError:\s*Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '([^']+)'\))?/gi,
    location: m => `Champ accédé : ${m[2] || 'Inconnu'}`,
    explain: m => `
      <div style="margin-bottom:10px;"><strong>Description :</strong> Le script UI tente de lire le champ <code>${m[2] ? m[2] : '?'}</code> sur un objet qui vaut <code>${m[1]}</code>.</div>
      <div style="padding:10px; background:rgba(255,166,87,0.1); border-left:3px solid var(--la-orange); margin-bottom:10px;">
        <strong>Contexte :</strong> L'objet parent de <strong>${m[2]}</strong> n'a pas été chargé. Vérifiez si l'appel AJAX précédent a bien retourné des données.
      </div>`,
    fix: m => `// 🛠️ CORRECTION SUGGÉRÉE :
// Ne tentez pas d'accéder à ${m[2]} sans vérifier son parent :
const valeur = parentObject?.${m[2] || 'champ'};`
  }
];
let laUserRules = [];
let laCurrentIssues = [];

function laGetUserRules() {
  return laUserRules.filter(r => r.pattern.trim()).map((r, i) => ({
    id: `user-${i}`, type: r.type, severity: r.type === 'error' ? 'HAUTE' : r.type === 'warn' ? 'MOYENNE' : 'INFO',
    title: r.msg || `Règle perso #${i+1}`, pattern: (() => { try { return new RegExp(r.pattern, 'gi'); } catch { return null; } })(),
    location: () => `Pattern : ${r.pattern}`, explain: () => `Correspondance avec <code>${laHesc(r.pattern)}</code>`, fix: () => `// Correction selon votre règle.`
  })).filter(r => r.pattern);
}

function laShowView(id) {
  document.querySelectorAll('.la-view').forEach(v => v.classList.remove('la-active'));
  document.getElementById(id).classList.add('la-active');
}

function laGoInput() {
  laShowView('la-view-input');
  document.getElementById('la-hdr-badges').style.display = 'none';
}

function laSwitchTab(tab) {
  document.getElementById('la-tab-log').classList.toggle('la-active', tab === 'log');
  document.getElementById('la-tab-rules').classList.toggle('la-active', tab === 'rules');
  document.getElementById('la-pane-log').style.display = tab === 'log' ? '' : 'none';
  document.getElementById('la-pane-rules').style.display = tab === 'rules' ? '' : 'none';
}

function laRenderRuleEditor() {
  const ed = document.getElementById('la-rule-editor');
  ed.innerHTML = `<div style="font-size:11px;color:var(--la-muted);margin-bottom:10px;display:grid;grid-template-columns:1fr 110px 1fr auto;gap:8px;"><span>Pattern (RegExp)</span><span>Type</span><span>Message</span><span></span></div>`;
  laUserRules.forEach((r, i) => {
    const row = document.createElement('div'); row.className = 'la-rule-row';
    row.innerHTML = `<input style="flex:2" placeholder="/pattern/gi" value="${laHesc(r.pattern)}" oninput="laUserRules[${i}].pattern=this.value;laUpdateRuleCount()">
      <select style="width:110px" onchange="laUserRules[${i}].type=this.value"><option value="error"${r.type==='error'?' selected':''}>🔴 Erreur</option><option value="warn"${r.type==='warn'?' selected':''}>🟠 Alerte</option><option value="info"${r.type==='info'?' selected':''}>🔵 Info</option></select>
      <input style="flex:3" placeholder="Message affiché" value="${laHesc(r.msg||'')}" oninput="laUserRules[${i}].msg=this.value">
      <button class="la-ri-del" onclick="laDeleteRule(${i})">✕</button>`;
    ed.appendChild(row);
  });
  laUpdateRuleCount();
}

function laAddRule() { laUserRules.push({ pattern: '', type: 'warn', msg: '' }); laRenderRuleEditor(); }
function laDeleteRule(i) { laUserRules.splice(i, 1); laRenderRuleEditor(); }
function laUpdateRuleCount() { const n = laUserRules.filter(r => r.pattern.trim()).length; document.getElementById('la-rule-count').textContent = n > 0 ? `(+${n})` : ''; }

function laOnInput() {
  const val = document.getElementById('la-log-input').value;
  document.getElementById('la-char-count').textContent = `${val.length.toLocaleString('fr-FR')} caractère${val.length>1?'s':''}`;
  document.getElementById('la-btn-go').disabled = val.trim().length < 5;
}

function laAnalyze() {
  const text = document.getElementById('la-log-input').value;
  if (!text.trim()) return;
  const lines = text.split('\n');
  const allRules = [...LA_BUILTIN_RULES, ...laGetUserRules()];
  const found = []; let uid = 1; const seenKey = new Set();

  allRules.forEach(rule => {
    if (!rule.pattern) return;
    const rx = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    let m;
    while ((m = rx.exec(text)) !== null) {
      const key = `${rule.id}::${m[0]}`; if (seenKey.has(key)) continue; seenKey.add(key);
      const pos = m.index; let charCnt = 0, lineNum = 1;
      for (const ln of lines) { if (charCnt + ln.length >= pos) { break; } charCnt += ln.length + 1; lineNum++; }
      const li = lineNum - 1;
      const ctxLines = lines.slice(Math.max(0, li-1), Math.min(lines.length, li+2)).map((t, idx) => ({ ln: Math.max(1, li-1) + idx + 1, text: t, highlight: (Math.max(0, li-1) + idx === li) ? rule.type : null }));
      found.push({ id: uid++, type: rule.type, severity: rule.severity, title: rule.title, location: rule.location(m), symbol: m[0].length > 60 ? m[0].slice(0,60)+'…' : m[0], codeLines: ctxLines, explain: rule.explain(m), fix: rule.fix(m) });
      if ([...seenKey].filter(k => k.startsWith(rule.id+'::')).length >= 3) break;
    }
  });

  const order = { error: 0, warn: 1, info: 2 };
  found.sort((a,b) => order[a.type] - order[b.type]);
  laCurrentIssues = found; laRenderResults(found);
}

function laRenderResults(issues) {
  const c = { error:0, warn:0, info:0 };
  issues.forEach(i => { if (i.type in c) c[i.type]++; });
  document.getElementById('la-cnt-e').textContent = `${c.error} err`;
  document.getElementById('la-cnt-w').textContent = `${c.warn} alertes`;
  document.getElementById('la-cnt-i').textContent = `${c.info} infos`;
  document.getElementById('la-hdr-badges').style.display = 'flex';

  const bar = document.getElementById('la-sumbar'); bar.innerHTML = '';
  [{l:'Erreurs',v:c.error,col:'var(--la-red)'},{l:'Alertes',v:c.warn,col:'var(--la-orange)'},{l:'Infos',v:c.info,col:'var(--la-blue)'}].forEach(s => {
    bar.innerHTML += `<div class="la-sc"><div class="la-sc-label">${s.l}</div><div class="la-sc-val" style="color:${s.col}">${s.v}</div></div>`;
  });

  const list = document.getElementById('la-issue-list'); list.innerHTML = '';
  const TL = {error:'Erreur',warn:'Alerte',info:'Info'};

  if (issues.length === 0) {
    list.innerHTML = `<div style="padding:30px 20px;text-align:center;color:var(--la-muted)"><div style="font-size:32px;margin-bottom:10px">✅</div><div style="font-size:13px;">Aucun problème détecté.</div></div>`;
  } else {
    issues.forEach(issue => {
      const el = document.createElement('div'); el.className = 'la-issue-item'; el.dataset.id = issue.id;
      el.innerHTML = `<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px"><span class="la-itype la-itype-${issue.type}">${TL[issue.type]||issue.type}</span><span style="font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${laHesc(issue.title)}</span></div><div class="la-iloc">${laHesc(issue.location||'')}</div>`;
      el.addEventListener('click', () => laSelectIssue(issue.id));
      list.appendChild(el);
    });
  }
  laShowView('la-view-result');
  if (issues.length > 0) laSelectIssue(issues[0].id);
}

function laSelectIssue(id) {
  document.querySelectorAll('.la-issue-item').forEach(el => el.classList.toggle('la-active', +el.dataset.id === id));
  const issue = laCurrentIssues.find(i => i.id === id); if (!issue) return;

  const BG = {error:'rgba(255,107,107,0.15)',warn:'rgba(255,166,87,0.15)',info:'rgba(88,166,255,0.15)'};
  const TX = {error:'var(--la-red)',warn:'var(--la-orange)',info:'var(--la-blue)'};
  const TL = {error:'Erreur',warn:'Alerte',info:'Info'};
  const SEV_COLOR = {CRITIQUE:TX.error,HAUTE:'var(--la-orange)',MOYENNE:'#E3B341',BASSE:TX.info,INFO:TX.info};

  const codeHtml = (issue.codeLines||[]).map(l => `<span class="${l.highlight ? 'la-hl-'+l.highlight : ''}"><span style="color:var(--la-muted);user-select:none">${String(l.ln).padStart(3,' ')}  </span>${laHesc(l.text)}</span>`).join('\n');
  const fixHtml = (issue.fix||'').split('\n').map(line => line.startsWith('//') ? `<span style="color:var(--la-muted)">${laHesc(line)}</span>` : `<span style="color:var(--la-green)">${laHesc(line)}</span>`).join('\n');

  document.getElementById('la-detail-panel').innerHTML = `
    <div class="la-idetail">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid var(--la-border)">
        <span style="padding:5px 11px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;background:${BG[issue.type]};color:${TX[issue.type]};border:1px solid ${TX[issue.type]}40">${TL[issue.type]} · <span style="color:${SEV_COLOR[issue.severity]||TX[issue.type]}">${issue.severity}</span></span>
        <div><div style="font-size:16px;font-weight:700;margin-bottom:3px">${laHesc(issue.title)}</div><div style="font-size:12px;color:var(--la-muted);font-family:'JetBrains Mono',monospace">${laHesc(issue.location||'')} · <code style="background:var(--la-bg3);padding:1px 5px;border-radius:4px;color:var(--la-accent)">${laHesc(issue.symbol||'')}</code></div></div>
      </div>
      ${codeHtml ? `<div class="la-slabel">Extrait</div><div class="la-codeblock"><div class="la-cbhead"><span>${laHesc(issue.location||'')}</span></div><div class="la-cbcontent">${codeHtml}</div></div>` : ''}
      <div class="la-slabel">Explication</div><div class="la-explainbox">${issue.explain||''}</div>
      ${issue.fix ? `<div class="la-slabel">Correction suggérée</div><div class="la-fixbox"><div style="padding:8px 14px;border-bottom:1px solid rgba(94,176,145,.15);font-size:11px;font-weight:700;color:var(--la-green);text-transform:uppercase">✦ Fix</div><div class="la-fixcode">${fixHtml}</div></div>` : ''}
    </div>`;
}

function laHesc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Sécurité : Ne lance l'éditeur de règles que si le Log Analyzer existe sur la page
if (document.getElementById('la-rule-editor')) {
    laRenderRuleEditor();
}
