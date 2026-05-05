/* ============================================================
   Cyrias Buddy — Kanban & Board Direction
   ============================================================ */
// ============================================================
// EXTENSIONS CYRIAS BUDDY : DIRECTION, KANBAN, TECHNIQUE
// ============================================================

// --- 1. BOARD DIRECTION : HEALTH SCORE ---
function renderDirectionBoard() {
    const healthContainer = document.getElementById('health-score-container');
    if (!healthContainer) return;
    
    if (!window.rawData || window.rawData.length === 0) {
        healthContainer.innerHTML = '<div style="font-size: 12px; color: var(--ink-muted);">Aucune donnée client disponible. Importez des CRA.</div>';
        return;
    }

    const clients = [...new Set(window.rawData.map(d => d.client))].sort();
    let healthHtml = '';

    clients.forEach(c => {
        const nps = (clientProfiles[c] && clientProfiles[c].nps != null) ? clientProfiles[c].nps : 'N/A';
        const missionRac = currentRacData.find(d => d.m.includes(c));
        const racPct = missionRac ? Math.round(100 - missionRac.percent) : 'N/A';

        let healthLevel = 'Neutre';
        let colorClass = 'var(--ink-muted)';
        let bgClass = 'var(--bg)';

        if (nps !== 'N/A' && racPct !== 'N/A') {
            if (nps >= 8 && racPct > 20) {
                healthLevel = 'Excellent'; colorClass = 'var(--secondary)'; bgClass = 'rgba(94, 176, 145, 0.1)';
            } else if (nps <= 6 || racPct < 10) {
                healthLevel = 'Critique'; colorClass = 'var(--danger)'; bgClass = 'rgba(231, 91, 60, 0.1)';
            } else {
                healthLevel = 'À surveiller'; colorClass = '#D97706'; bgClass = 'rgba(233, 189, 39, 0.1)';
            }
        }

        healthHtml += `
            <div style="padding: 12px; background: ${bgClass}; border-left: 4px solid ${colorClass}; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: var(--primary); font-size: 14px;">${c}</strong>
                <div style="font-size: 12px; display: flex; gap: 16px; color: var(--ink-secondary);">
                    <span>NPS: <strong>${nps}</strong></span>
                    <span>RAC: <strong>${racPct}%</strong></span>
                    <span style="color: ${colorClass}; font-weight: bold;">${healthLevel}</span>
                </div>
            </div>
        `;
    });

    healthContainer.innerHTML = healthHtml;
}

// --- 2. KANBAN & GESTION DE PROJET (Drag & Drop) ---
function renderKanban() {
    const todoCol = document.getElementById('kanban-todo');
    const uatCol = document.getElementById('kanban-uat');
    const mepCol = document.getElementById('kanban-mep');
    
    if (!todoCol || !uatCol || !mepCol) return;

    todoCol.innerHTML = ''; uatCol.innerHTML = ''; mepCol.innerHTML = '';

    if (!demandesData || demandesData.length === 0) {
        todoCol.innerHTML = '<div style="font-size: 12px; color: var(--ink-muted);">Aucun ticket importé.</div>';
        return;
    }

    const activeTickets = demandesData.filter(d => !isClosedStatut(d.statut));

    activeTickets.forEach(t => {
        const prioColor = (t.priorite || '').toLowerCase().includes('1') || (t.priorite || '').toLowerCase().includes('urgent') ? 'var(--danger)' : 'var(--secondary)';
        const cardHtml = `
            <div class="kanban-card" draggable="true" ondragstart="drag(event)" data-id="${t.id}" style="background: white; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; cursor: grab; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 3px solid ${prioColor};">
                <div style="font-size: 10px; color: var(--ink-muted); display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>${t.id}</span>
                    <span>${t.client}</span>
                </div>
                <div style="font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 8px;">${t.objet}</div>
                <div style="font-size: 10px; display: inline-block; padding: 2px 6px; background: var(--bg); border-radius: 4px;">${t.statut}</div>
            </div>
        `;

        if ((t.statut || '').toLowerCase().includes('uat') || (t.statut || '').toLowerCase().includes('recette')) {
            uatCol.innerHTML += cardHtml;
        } else if ((t.statut || '').toLowerCase().includes('mep') || (t.statut || '').toLowerCase().includes('prod')) {
            mepCol.innerHTML += cardHtml;
        } else {
            todoCol.innerHTML += cardHtml;
        }
    });

    [todoCol, uatCol, mepCol].forEach(col => {
        col.addEventListener('dragover', allowDrop);
        col.addEventListener('drop', drop);
    });
}

function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.currentTarget.getAttribute('data-id')); }
function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const draggedEl = document.querySelector(`[data-id="${data}"]`);
    if (!draggedEl) return;
    
    let dropTarget = ev.target;
    while (dropTarget && !dropTarget.id.startsWith('kanban-') && dropTarget !== document.body) {
        dropTarget = dropTarget.parentNode;
    }
    
    if (dropTarget && dropTarget.id.startsWith('kanban-')) {
        dropTarget.appendChild(draggedEl);
    }
}

// --- 3. TECHNIQUE : LOG ANALYZER & ROLLBACK ---
function analyzeIvaluaLog() {
    const input = document.getElementById('log-input').value;
    const output = document.getElementById('log-output');
    
    if (!input) {
        output.style.display = 'block';
        output.innerHTML = "Veuillez coller un log.";
        return;
    }

    let result = "<strong>Analyse automatique :</strong><br><br>";

    if (input.includes('NullReferenceException')) {
        result += "⚠️ <strong>Erreur de référence nulle.</strong> Un objet attendu dans le code n'a pas été instancié. Vérifiez les champs obligatoires manquants ou un paramétrage de workflow incomplet.";
    } else if (input.includes('SqlException') || input.includes('String or binary data would be truncated')) {
        result += "⚠️ <strong>Erreur SQL (Troncature).</strong> Vous essayez d'insérer une chaîne de caractères trop longue pour la colonne de destination en base de données.";
    } else if (input.includes('Timeout')) {
        result += "⚠️ <strong>Timeout.</strong> Une requête SQL ou un appel API prend trop de temps. Vérifiez les index de la table ou la taille du batch.";
    } else {
        result += "ℹ️ Log générique. Pas de motif d'erreur critique identifié dans la base de connaissances.";
    }

    output.style.display = 'block';
    output.innerHTML = result;
}

function generateRollback() {
    const table = document.getElementById('rb-table').value.trim();
    const where = document.getElementById('rb-where').value.trim();
    
    if (!table || !where) {
        toastWarn("Veuillez saisir la table et la condition WHERE.");
        return;
    }

    const backupTableName = table.replace('dbo.', '') + '_BKP_' + new Date().toISOString().split('T')[0].replace(/-/g, '');

    const script = `-- 1. CRÉATION DE LA SAUVEGARDE (À lancer AVANT votre modification)
SELECT * INTO dbo.${backupTableName}
FROM ${table}
WHERE ${where};

-- 2. SCRIPT DE ROLLBACK (En cas de problème)
/*
UPDATE cible
SET 
    cible.Col1 = bkp.Col1, 
    cible.Col2 = bkp.Col2 -- Listez les colonnes modifiées
FROM ${table} cible
INNER JOIN dbo.${backupTableName} bkp ON cible.Id = bkp.Id;
*/`;

    document.getElementById('rb-output').value = script;
}

// Intercepter la navigation pour charger les données dynamiques au clic
const originalNavigateTo = navigateTo;
navigateTo = function(page) {
    originalNavigateTo(page);
    if (page === 'direction') setTimeout(renderDirectionBoard, 50);
    else if (page === 'kanban') setTimeout(renderKanban, 50);
};


/* ============================================================================
   v12 — FEATURE #7 : Kanban fonctionnel avec drag & drop + SLA
   ============================================================================ */
const Kanban = {
  // Configuration SLA par criticité (jours ouvrés avant alerte)
  SLA_RULES: {
    bloquant:    { qualif: 1, dev: 3,  uat: 1, mep: 2 },
    majeur:      { qualif: 2, dev: 5,  uat: 2, mep: 5 },
    mineur:      { qualif: 5, dev: 10, uat: 3, mep: 10 },
    cosmetique:  { qualif: 10, dev: 20, uat: 5, mep: 30 }
  },
  STATUSES: ['qualif', 'dev', 'uat', 'mep', 'closed'],
  STATUS_LABELS: { qualif: 'À qualifier', dev: 'En développement', uat: 'UAT', mep: 'MEP planifiée', closed: 'Clôturé' },
  CRITICITE_LABELS: { bloquant: 'Bloquant', majeur: 'Majeur', mineur: 'Mineur', cosmetique: 'Cosmétique' },
  CRITICITE_COLORS: { bloquant: '#dc2626', majeur: '#ea580c', mineur: '#ca8a04', cosmetique: '#64748b' },

  load() {
    try { return JSON.parse(localStorage.getItem('cyrias_kanban_tickets') || '[]'); }
    catch(e) { return []; }
  },
  save(tickets) {
    safeLocalSet('cyrias_kanban_tickets', JSON.stringify(tickets));
  },

  // Calcul jours ouvrés écoulés depuis une date
  workDaysSince(dateStr) {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    const end = new Date();
    if (isNaN(start.getTime())) return 0;
    let count = 0;
    const cur = new Date(start);
    cur.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    while (cur < end) {
      cur.setDate(cur.getDate() + 1);
      const d = cur.getDay();
      if (d !== 0 && d !== 6) count++;
    }
    return count;
  },

  // Calcul SLA pour un ticket
  computeSLA(ticket) {
    if (ticket.statut === 'closed') return { status: 'ok', daysElapsed: 0, daysAllowed: 0, label: 'Clôturé' };
    const crit = ticket.criticite || 'mineur';
    const rules = this.SLA_RULES[crit] || this.SLA_RULES.mineur;
    const daysAllowed = rules[ticket.statut] || 999;
    const daysElapsed = this.workDaysSince(ticket.statusChangedAt || ticket.createdAt);
    let status = 'ok';
    if (daysElapsed > daysAllowed) status = 'breach';
    else if (daysElapsed >= daysAllowed * 0.7) status = 'warn';
    return {
      status,
      daysElapsed,
      daysAllowed,
      label: status === 'breach' ? `⚠️ SLA dépassé (+${daysElapsed - daysAllowed}j)` :
             status === 'warn'   ? `🟡 SLA approche (${daysElapsed}/${daysAllowed}j)` :
                                   `✅ ${daysElapsed}/${daysAllowed}j`
    };
  },

  add(t) {
    const tickets = this.load();
    const ticket = {
      id: 'tk_' + Date.now() + Math.floor(Math.random() * 1000),
      ...t,
      createdAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
      history: [{ ts: Date.now(), action: 'created', from: null, to: t.statut || 'qualif' }]
    };
    tickets.unshift(ticket);
    this.save(tickets);
    AuditLog.log('kanban_ticket_added', `${ticket.numero || ''} ${ticket.titre || ''}`);
    return ticket;
  },

  update(id, patch) {
    const tickets = this.load();
    const t = tickets.find(x => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    this.save(tickets);
    AuditLog.log('kanban_ticket_updated', t.numero || t.titre || id);
  },

  changeStatus(id, newStatus) {
    const tickets = this.load();
    const t = tickets.find(x => x.id === id);
    if (!t || t.statut === newStatus) return;
    const oldStatus = t.statut;
    t.statut = newStatus;
    t.statusChangedAt = new Date().toISOString();
    if (!t.history) t.history = [];
    t.history.push({ ts: Date.now(), action: 'moved', from: oldStatus, to: newStatus, by: localStorage.getItem('cyrias_username') || 'Anonyme' });
    this.save(tickets);
    AuditLog.log('kanban_ticket_moved', `${t.numero || t.titre || ''} : ${oldStatus} → ${newStatus}`);
  },

  remove(id) {
    const tickets = this.load().filter(t => t.id !== id);
    this.save(tickets);
    AuditLog.log('kanban_ticket_deleted');
  }
};
window.Kanban = Kanban;

// Rendu du board
function renderKanban() {
  const tickets = Kanban.load();
  const filterText = (document.getElementById('kanban-filter-text')?.value || '').toLowerCase().trim();
  const filterClient = document.getElementById('kanban-filter-client')?.value || '';
  const filterCrit = document.getElementById('kanban-filter-criticite')?.value || '';

  // Mettre à jour les options de clients
  const clientSel = document.getElementById('kanban-filter-client');
  if (clientSel) {
    const clients = [...new Set(tickets.map(t => t.client).filter(Boolean))].sort();
    const current = clientSel.value;
    clientSel.innerHTML = '<option value="">Tous les clients</option>' + clients.map(c => `<option value="${escapeHtml(c)}" ${c === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }

  // Filtrer
  const filtered = tickets.filter(t => {
    if (filterText) {
      const blob = `${t.numero || ''} ${t.titre || ''} ${t.description || ''} ${t.client || ''}`.toLowerCase();
      if (!blob.includes(filterText)) return false;
    }
    if (filterClient && t.client !== filterClient) return false;
    if (filterCrit && t.criticite !== filterCrit) return false;
    return true;
  });

  // Vider et remplir chaque colonne
  Kanban.STATUSES.forEach(status => {
    const zone = document.querySelector(`.kanban-dropzone[data-status="${status}"]`);
    const counter = document.querySelector(`.kanban-count[data-status="${status}"]`);
    if (!zone) return;
    const colTickets = filtered.filter(t => t.statut === status);
    counter.textContent = colTickets.length;

    if (colTickets.length === 0) {
      zone.innerHTML = `<div class="kanban-empty">
        <div class="kanban-empty-icon">📭</div>
        <div class="kanban-empty-text">Glissez un ticket ici</div>
      </div>`;
      return;
    }

    zone.innerHTML = colTickets.map(t => {
      const sla = Kanban.computeSLA(t);
      const slaChipClass = { ok: 'chip-ok', warn: 'chip-warn', breach: 'chip-err' }[sla.status] || 'chip-neutral';
      const critChipClass = { bloquant: 'chip-err', majeur: 'chip-warn', mineur: 'chip-info', cosmetique: 'chip-neutral' }[t.criticite] || 'chip-neutral';
      const critColor = Kanban.CRITICITE_COLORS[t.criticite] || '#94a3b8';
      const chargeInfo = t.chargeEstimee ? `${t.chargeReelle || 0}/${t.chargeEstimee}j` : '';
      return `<div class="kanban-card" draggable="true" data-id="${t.id}" 
                onclick="kanbanOpenTicketForm('${t.id}')"
                style="border-left-color:${critColor};">
          <div class="kanban-card-head">
            <span class="kanban-card-num">${escapeHtml(t.numero || '#' + t.id.slice(-4))}</span>
            <span class="chip ${critChipClass}">${escapeHtml(Kanban.CRITICITE_LABELS[t.criticite] || '—')}</span>
          </div>
          <div class="kanban-card-title">${escapeHtml(t.titre || 'Sans titre')}</div>
          <div class="kanban-card-meta">
            ${t.client ? `<span class="kanban-card-meta-item">🏢 ${escapeHtml(t.client)}</span>` : ''}
            ${t.assignee ? `<span class="kanban-card-meta-item">👤 ${escapeHtml(t.assignee)}</span>` : ''}
          </div>
          <div class="kanban-card-foot">
            <span class="chip ${slaChipClass}">${sla.label}</span>
            ${chargeInfo ? `<span class="kanban-card-charge">⏱️ ${chargeInfo}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  });

  attachKanbanDragHandlers();
}
window.renderKanban = renderKanban;

// Drag & drop natif HTML5
function attachKanbanDragHandlers() {
  const cards = document.querySelectorAll('.kanban-card');
  const zones = document.querySelectorAll('.kanban-dropzone');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.style.opacity = '0.4';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '';
    });
  });

  zones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('kanban-dropzone-active');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('kanban-dropzone-active');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('kanban-dropzone-active');
      const id = e.dataTransfer.getData('text/plain');
      const newStatus = zone.dataset.status;
      if (id && newStatus) {
        Kanban.changeStatus(id, newStatus);
        renderKanban();
        toastOk(`Ticket déplacé vers "${Kanban.STATUS_LABELS[newStatus]}"`);
      }
    });
  });
}

// Formulaire ticket (création + édition)
function kanbanOpenTicketForm(id) {
  const tickets = Kanban.load();
  const isEdit = !!id;
  const t = isEdit ? tickets.find(x => x.id === id) : {};
  if (isEdit && !t) return;
  const cra = CyriasData.getCRA();
  const clients = [...new Set(cra.map(d => d.client).filter(Boolean))].sort();

  let modal = document.getElementById('kanban-form-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'kanban-form-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(640px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;display:flex;flex-direction:column;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">${isEdit ? '✏️ Éditer ticket' : '+ Nouveau ticket'}</h3>
          ${isEdit && t.numero ? `<p style="font-size:11px;color:var(--ink-muted);margin-top:2px;font-family:'JetBrains Mono',monospace;">${escapeHtml(t.numero)}</p>` : ''}
        </div>
        <button onclick="document.getElementById('kanban-form-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:20px 22px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="kf-label">N° Ivalua</label>
            <input type="text" id="kf-numero" value="${escapeHtml(t.numero || '')}" placeholder="Ex : REQ-2025-1234" class="kf-input">
          </div>
          <div>
            <label class="kf-label">Client</label>
            <input type="text" id="kf-client" list="kf-client-list" value="${escapeHtml(t.client || '')}" placeholder="Client" class="kf-input">
            <datalist id="kf-client-list">${clients.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          </div>
        </div>
        <div>
          <label class="kf-label">Titre *</label>
          <input type="text" id="kf-titre" value="${escapeHtml(t.titre || '')}" placeholder="Titre court du ticket" class="kf-input">
        </div>
        <div>
          <label class="kf-label">Description</label>
          <textarea id="kf-desc" rows="3" placeholder="Contexte, reproduction, impact..." class="kf-input">${escapeHtml(t.description || '')}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <label class="kf-label">Statut</label>
            <select id="kf-statut" class="kf-input">
              ${Kanban.STATUSES.map(s => `<option value="${s}" ${(t.statut || 'qualif') === s ? 'selected' : ''}>${Kanban.STATUS_LABELS[s]}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="kf-label">Criticité</label>
            <select id="kf-criticite" class="kf-input">
              ${Object.entries(Kanban.CRITICITE_LABELS).map(([k, l]) => `<option value="${k}" ${(t.criticite || 'mineur') === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="kf-label">Assigné à</label>
            <input type="text" id="kf-assignee" value="${escapeHtml(t.assignee || '')}" placeholder="Prénom Nom" class="kf-input">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="kf-label">Charge estimée (j)</label>
            <input type="number" id="kf-charge-est" value="${t.chargeEstimee || ''}" step="0.5" placeholder="Ex : 2.5" class="kf-input">
          </div>
          <div>
            <label class="kf-label">Charge réelle (j)</label>
            <input type="number" id="kf-charge-reel" value="${t.chargeReelle || ''}" step="0.5" placeholder="Ex : 3" class="kf-input">
          </div>
        </div>
        ${isEdit && t.history ? `
          <div style="margin-top:8px;padding-top:12px;border-top:1px solid var(--border-light);">
            <label class="kf-label">Historique</label>
            <div style="font-size:11px;color:var(--ink-muted);max-height:120px;overflow-y:auto;">
              ${t.history.slice().reverse().map(h => `<div style="padding:3px 0;">📌 ${new Date(h.ts).toLocaleString('fr-FR')} — ${h.action}${h.from ? ` (${h.from} → ${h.to})` : ''}${h.by ? ` par ${escapeHtml(h.by)}` : ''}</div>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div style="padding:14px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:space-between;align-items:center;">
        ${isEdit ? `<button class="btn btn-outline" style="font-size:12px;color:var(--danger);border-color:var(--danger);" onclick="kanbanDeleteTicket('${id}')">🗑️ Supprimer</button>` : '<span></span>'}
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" onclick="document.getElementById('kanban-form-modal').remove()" style="font-size:12px;">Annuler</button>
          <button class="btn btn-primary" onclick="kanbanSaveTicket('${id || ''}')" style="font-size:12px;">${isEdit ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.kanbanOpenTicketForm = kanbanOpenTicketForm;

function kanbanSaveTicket(id) {
  const titre = document.getElementById('kf-titre').value.trim();
  if (!titre) { toastWarn("Le titre est obligatoire"); return; }
  const data = {
    numero: document.getElementById('kf-numero').value.trim(),
    titre,
    description: document.getElementById('kf-desc').value.trim(),
    client: document.getElementById('kf-client').value.trim(),
    statut: document.getElementById('kf-statut').value,
    criticite: document.getElementById('kf-criticite').value,
    assignee: document.getElementById('kf-assignee').value.trim(),
    chargeEstimee: parseFloat(document.getElementById('kf-charge-est').value) || null,
    chargeReelle: parseFloat(document.getElementById('kf-charge-reel').value) || null
  };
  if (id) {
    // Si le statut change, mettre à jour statusChangedAt
    const tickets = Kanban.load();
    const t = tickets.find(x => x.id === id);
    if (t && t.statut !== data.statut) {
      data.statusChangedAt = new Date().toISOString();
      if (!t.history) t.history = [];
      t.history.push({ ts: Date.now(), action: 'moved', from: t.statut, to: data.statut, by: localStorage.getItem('cyrias_username') || 'Anonyme' });
      data.history = t.history;
    }
    Kanban.update(id, data);
    toastOk('Ticket mis à jour');
  } else {
    Kanban.add(data);
    toastOk('Ticket créé');
  }
  document.getElementById('kanban-form-modal').remove();
  renderKanban();
}
window.kanbanSaveTicket = kanbanSaveTicket;

function kanbanDeleteTicket(id) {
  if (!confirm("Supprimer définitivement ce ticket ?")) return;
  Kanban.remove(id);
  document.getElementById('kanban-form-modal')?.remove();
  renderKanban();
  toastOk('Ticket supprimé');
}
window.kanbanDeleteTicket = kanbanDeleteTicket;

// Statistiques Kanban
function kanbanShowStats() {
  const tickets = Kanban.load();
  if (tickets.length === 0) {
    toastInfo("Aucun ticket dans le Kanban");
    return;
  }
  const byStatus = {};
  Kanban.STATUSES.forEach(s => byStatus[s] = tickets.filter(t => t.statut === s).length);
  const byCrit = {};
  Object.keys(Kanban.CRITICITE_LABELS).forEach(c => byCrit[c] = tickets.filter(t => t.criticite === c).length);
  const breaches = tickets.filter(t => Kanban.computeSLA(t).status === 'breach').length;
  const warns = tickets.filter(t => Kanban.computeSLA(t).status === 'warn').length;
  const closed = tickets.filter(t => t.statut === 'closed');
  // Temps moyen avant clôture
  let avgClosure = '—';
  if (closed.length > 0) {
    const durations = closed.map(t => {
      const start = new Date(t.createdAt).getTime();
      const end = new Date(t.statusChangedAt || t.createdAt).getTime();
      return Math.round((end - start) / 86400000);
    });
    avgClosure = (durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1);
  }

  let modal = document.getElementById('kanban-stats-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'kanban-stats-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);';
  modal.innerHTML = `
    <div style="background:var(--surface);width:min(640px,94vw);max-height:90vh;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;animation:slideUp 0.2s ease-out;">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <h3 style="font-size:16px;font-weight:700;color:var(--primary);margin:0;">📊 Statistiques Kanban</h3>
        <button onclick="document.getElementById('kanban-stats-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink-muted);">×</button>
      </div>
      <div style="padding:20px 22px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="background:var(--bg);padding:12px;border-radius:6px;text-align:center;">
            <div style="font-size:10px;color:var(--ink-muted);font-weight:700;text-transform:uppercase;">Total</div>
            <div style="font-size:22px;font-weight:800;color:var(--primary);">${tickets.length}</div>
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:6px;text-align:center;">
            <div style="font-size:10px;color:var(--ink-muted);font-weight:700;text-transform:uppercase;">Ouverts</div>
            <div style="font-size:22px;font-weight:800;color:var(--info);">${tickets.length - byStatus.closed}</div>
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:6px;text-align:center;">
            <div style="font-size:10px;color:var(--ink-muted);font-weight:700;text-transform:uppercase;">SLA dépassés</div>
            <div style="font-size:22px;font-weight:800;color:var(--danger);">${breaches}</div>
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:6px;text-align:center;">
            <div style="font-size:10px;color:var(--ink-muted);font-weight:700;text-transform:uppercase;">Avg clôture</div>
            <div style="font-size:22px;font-weight:800;color:var(--secondary-dark);">${avgClosure}<span style="font-size:13px;">j</span></div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);margin-bottom:8px;">Répartition par statut</div>
          ${Kanban.STATUSES.map(s => {
            const pct = tickets.length > 0 ? (byStatus[s] / tickets.length * 100).toFixed(0) : 0;
            return `<div style="display:grid;grid-template-columns:140px 1fr 50px;gap:10px;align-items:center;margin-bottom:4px;font-size:12px;">
              <span>${Kanban.STATUS_LABELS[s]}</span>
              <div style="background:var(--bg);height:8px;border-radius:4px;overflow:hidden;"><div style="background:var(--secondary);height:100%;width:${pct}%;"></div></div>
              <span style="text-align:right;color:var(--ink-muted);">${byStatus[s]} (${pct}%)</span>
            </div>`;
          }).join('')}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--ink-muted);margin-bottom:8px;">Répartition par criticité</div>
          ${Object.entries(byCrit).map(([k, n]) => {
            const pct = tickets.length > 0 ? (n / tickets.length * 100).toFixed(0) : 0;
            return `<div style="display:grid;grid-template-columns:140px 1fr 50px;gap:10px;align-items:center;margin-bottom:4px;font-size:12px;">
              <span style="color:${Kanban.CRITICITE_COLORS[k]};font-weight:600;">${Kanban.CRITICITE_LABELS[k]}</span>
              <div style="background:var(--bg);height:8px;border-radius:4px;overflow:hidden;"><div style="background:${Kanban.CRITICITE_COLORS[k]};height:100%;width:${pct}%;"></div></div>
              <span style="text-align:right;color:var(--ink-muted);">${n} (${pct}%)</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
window.kanbanShowStats = kanbanShowStats;

function kanbanExportCSV() {
  const tickets = Kanban.load();
  if (tickets.length === 0) { toastWarn("Aucun ticket à exporter"); return; }
  const csv = ['Numero,Titre,Client,Statut,Criticite,Assignee,Cree_le,Charge_est,Charge_reelle,SLA_status', ...tickets.map(t => {
    const sla = Kanban.computeSLA(t);
    return [
      t.numero || '',
      `"${(t.titre || '').replace(/"/g, '""')}"`,
      t.client || '',
      Kanban.STATUS_LABELS[t.statut] || '',
      Kanban.CRITICITE_LABELS[t.criticite] || '',
      t.assignee || '',
      new Date(t.createdAt).toLocaleDateString('fr-FR'),
      t.chargeEstimee || '',
      t.chargeReelle || '',
      sla.status
    ].join(',');
  })].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kanban-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  toastOk(`${tickets.length} ticket(s) exporté(s)`);
}
window.kanbanExportCSV = kanbanExportCSV;

// Étendre AnomalyDetector avec les SLA Kanban
AnomalyDetector.rules.push({
  id: 'kanban_sla',
  label: 'Tickets SLA dépassés',
  check() {
    const tickets = Kanban.load();
    const breaches = tickets.filter(t => t.statut !== 'closed' && Kanban.computeSLA(t).status === 'breach');
    if (breaches.length === 0) return null;
    return {
      severity: 'err',
      icon: '⏱️',
      title: `${breaches.length} ticket(s) en dépassement SLA`,
      detail: breaches.slice(0, 3).map(t => `${t.numero || t.titre || '?'} (${Kanban.STATUS_LABELS[t.statut]})`).join(' • '),
      action: { label: 'Voir Kanban', cb: () => navigateTo('kanban') }
    };
  }
});

// Hook le rendu Kanban dans navigateTo
const _origNavToKanban = window.navigateTo;
if (typeof _origNavToKanban === 'function') {
  window.navigateTo = function(p) {
    _origNavToKanban(p);
    if (p === 'kanban') {
      setTimeout(renderKanban, 100);
    }
  };
}

// Style additionnel pour le kanban
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .kanban-board {
      padding: 20px 40px 40px;
      display: flex;
      gap: 14px;
      overflow-x: auto;
      min-height: 600px;
    }
    .kanban-filters {
      padding: 18px 40px 0;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .kanban-column {
      flex: 1;
      min-width: 270px;
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 12px;
      display: flex;
      flex-direction: column;
      transition: border-color var(--t-base);
    }
    [data-theme="dark"] .kanban-column {
      background: var(--bg-subtle);
    }
    .kanban-col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 4px 6px 12px;
      margin-bottom: 10px;
      border-bottom: 2px solid var(--col-accent, var(--brand));
    }
    .kanban-col-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kanban-col-icon {
      font-size: 16px;
    }
    .kanban-col-title {
      font-size: var(--fs-base);
      font-weight: var(--fw-bold);
      color: var(--ink);
      letter-spacing: -0.2px;
    }
    .kanban-count {
      background: var(--col-accent, var(--brand));
      color: white;
      padding: 2px 9px;
      border-radius: var(--radius-pill);
      font-size: var(--fs-xs);
      font-weight: var(--fw-bold);
      font-variant-numeric: tabular-nums;
      line-height: 1.5;
      min-width: 24px;
      text-align: center;
    }
    
    .kanban-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 4px solid var(--ink-muted);
      border-radius: var(--radius-sm);
      padding: 11px 13px;
      cursor: grab;
      transition: all var(--t-fast);
      position: relative;
      box-shadow: var(--elev-1);
      margin-bottom: 8px;
    }
    .kanban-card:hover { 
      box-shadow: var(--elev-3); 
      transform: translateY(-2px); 
      border-color: var(--brand);
      border-left-width: 4px;
    }
    .kanban-card:active { cursor: grabbing; }
    
    .kanban-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .kanban-card-num {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: var(--fw-bold);
      color: var(--ink-muted);
      letter-spacing: 0.3px;
    }
    .kanban-card-title {
      font-weight: var(--fw-semibold);
      font-size: var(--fs-base);
      color: var(--ink);
      line-height: 1.35;
      margin-bottom: 6px;
    }
    .kanban-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      margin-bottom: 4px;
    }
    .kanban-card-meta-item {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      line-height: 1.3;
    }
    .kanban-card-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--divider);
    }
    .kanban-card-charge {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      font-family: var(--font-mono);
      font-weight: var(--fw-medium);
    }
    
    .kanban-empty {
      text-align: center;
      padding: 28px 12px;
      border: 2px dashed var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      transition: all var(--t-base);
    }
    .kanban-empty-icon {
      font-size: 24px;
      opacity: 0.4;
      margin-bottom: 4px;
    }
    .kanban-empty-text {
      font-size: var(--fs-xs);
      color: var(--ink-muted);
      font-weight: var(--fw-medium);
    }
    
    .kanban-dropzone { 
      transition: all var(--t-fast); 
      padding: 4px; 
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      min-height: 400px;
      flex: 1;
    }
    .kanban-dropzone-active {
      background: var(--brand-soft);
      box-shadow: inset 0 0 0 2px var(--brand);
    }
    .kanban-dropzone-active .kanban-empty {
      border-color: var(--brand);
      background: var(--brand-soft);
    }
    
    /* Form kanban */
    .kf-label { 
      font-size: var(--fs-xs); 
      font-weight: var(--fw-bold); 
      text-transform: uppercase; 
      color: var(--ink-secondary); 
      display: block; 
      margin-bottom: 5px; 
      letter-spacing: 0.4px; 
    }
    .kf-input { 
      width: 100%; 
      padding: 9px 11px; 
      border: 1px solid var(--border); 
      border-radius: var(--radius-sm); 
      font-size: var(--fs-md); 
      font-family: inherit; 
      outline: none; 
      background: var(--surface); 
      color: var(--ink);
      transition: all var(--t-fast);
    }
    .kf-input:hover { border-color: var(--border-strong); }
    .kf-input:focus { 
      border-color: var(--brand); 
      box-shadow: var(--elev-glow); 
    }
    select.kf-input { cursor: pointer; }
    textarea.kf-input { resize: vertical; min-height: 70px; }
  `;
  document.head.appendChild(style);
})();

// Init au chargement
window.addEventListener('load', () => {
  setTimeout(renderKanban, 800);
});


/* ============================================================================
   v12 — Guide de démarrage utilisateur (onboarding)
   ============================================================================ */
