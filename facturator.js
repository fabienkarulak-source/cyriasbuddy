/* ============================================================
   Cyrias Buddy — Facturator
   ============================================================ */
// ============================================================

// ============================================================
// FACTURATOR — Script complet
// ============================================================

// --- Données et état ---
let factDataSources = SafeStorage.get('fact_data_sources') || {};
let factData = [];
let factFilteredData = [];
let factStatuts = SafeStorage.get('fact_statuts') || {}; // {client_mission_moisAnnee: {pascal, sent, paid}}
let factTjm = SafeStorage.get('fact_tjm') || {};
let factCurrentClient = null;

// Charts
let factChartClient = null, factChartEnvelope = null, factChartEvolution = null, factChartFiche = null;

const FACT_PALETTE = ['#1B3B5C','#5EB091','#2A517A','#4A9076','#D97706','#DC2626','#3B82F6','#7C3AED','#0891B2','#059669'];

// --- Utilitaires ---
function factGetStatutKey(client, mission, moisAnnee) {
    return (client + '||' + mission + '||' + moisAnnee).replace(/[^a-zA-Z0-9|\/\-_]/g, '_');
}
function factGetStatut(client, mission, moisAnnee) {
    const k = factGetStatutKey(client, mission, moisAnnee);
    return factStatuts[k] || { pascal: false, sent: false, paid: false };
}
function factSetStatut(client, mission, moisAnnee, field, val) {
    const k = factGetStatutKey(client, mission, moisAnnee);
    if (!factStatuts[k]) factStatuts[k] = { pascal: false, sent: false, paid: false };
    factStatuts[k][field] = val;
    // Cohérence: payée → envoyée → pascal forcément coché
    if (field === 'paid' && val) { factStatuts[k].sent = true; factStatuts[k].pascal = true; }
    if (field === 'sent' && val) { factStatuts[k].pascal = true; }
    if (field === 'pascal' && !val) { factStatuts[k].sent = false; factStatuts[k].paid = false; }
    if (field === 'sent' && !val) { factStatuts[k].paid = false; }
    SafeStorage.set('fact_statuts', factStatuts);
    factUpdateKPIs();
    factRenderTable();
    if (factCurrentClient) factRenderClientDetail(factCurrentClient);
}

// --- Import ---
function factHandleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
                const parsed = parseDataArray(json, file.name); // réutilise le parser du CRAminator
                if (parsed.length > 0) {
                    const id = 'fact_' + Date.now() + '_' + Math.random().toString(36).substr(2,5);
                    factDataSources[id] = { name: file.name.replace(/\.[^/.]+$/, ''), data: parsed, addedAt: Date.now() };
                    SafeStorage.set('fact_data_sources', factDataSources);
                }
            } catch(err) { console.error('Facturator import error:', err); }
            factRebuildData();
        };
        reader.readAsArrayBuffer(file);
    });
    e.target.value = '';
}

function factLoadFromCRA() {
    // Réutilise les données du CRAminator (rawData)
    if (!rawData || rawData.length === 0) {
        showCustomAlert('Info', 'Le CRAminator ne contient pas de données. Importez d\'abord dans le CRAminator ou utilisez l\'import direct.');
        return;
    }
    factDataSources['cra_shared'] = { name: 'CRAminator (partagé)', data: rawData, addedAt: Date.now(), shared: true };
    SafeStorage.set('fact_data_sources', factDataSources);
    // Synchroniser les TJM depuis le CRAminator
    Object.keys(clientTjm).forEach(c => { if (!factTjm[c]) factTjm[c] = clientTjm[c]; });
    SafeStorage.set('fact_tjm', factTjm);
    factRebuildData();
}

function factRebuildData() {
    factData = [];
    Object.values(factDataSources).forEach(src => { if (src.data) factData = factData.concat(src.data); });
    // Sync TJM depuis CRAminator
    Object.keys(clientTjm).forEach(c => { if (factTjm[c] === undefined) factTjm[c] = clientTjm[c]; });
    factRenderSourceChips();
    if (factData.length > 0) {
        const uploadEl = document.getElementById('fact-upload-section');
        const dashEl   = document.getElementById('fact-dashboard');
        const countEl  = document.getElementById('fact-record-count');
        if (uploadEl) uploadEl.classList.add('hidden');
        if (dashEl)   dashEl.classList.remove('hidden');
        if (countEl)  countEl.innerText = factData.length + ' lignes';
        factPopulateFilters();
        factFilteredData = factGetFiltered();
        factUpdateKPIs();
        factRenderTable();
        factRenderClientList();
		renderHomeGrid();
        // Activer la page et dessiner les charts après rendu
        navigateTo('facturator');
        setTimeout(factDrawCharts, 80);
    }
}

function factRenderSourceChips() {
    const keys = Object.keys(factDataSources);
    const mgr = document.getElementById('fact-source-manager');
    const chips = document.getElementById('fact-source-chips');
    if (keys.length === 0) { mgr.classList.add('hidden'); return; }
    mgr.classList.remove('hidden');
    document.getElementById('fact-source-count').textContent = keys.length;
    document.getElementById('fact-total-records').textContent = factData.length;
    chips.innerHTML = keys.map((id, idx) => {
        const src = factDataSources[id];
        const colors = ['#1B3B5C','#4A9076','#2A517A','#D97706'];
        const c = colors[idx % colors.length];
        return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${c}15;border:1px solid ${c}40;color:${c};">
            ${src.name} <span style="opacity:.6">(${src.data.length})</span>
            <button onclick="factRemoveSource('${id}')" style="background:none;border:none;cursor:pointer;color:#DC2626;font-weight:700;padding:0;margin-left:2px;">×</button>
        </span>`;
    }).join('');
}

function removeSource(id) {
    if (!confirm(`Supprimer la source "${dataSources[id]?.name}" ?`)) return;
    delete dataSources[id];
    SafeStorage.set('cra_data_sources', dataSources);
    rebuildRawData();
    renderSourceChips();

    // S'il ne reste plus aucun fichier CRA après suppression
    if (Object.keys(dataSources).length === 0) {
        document.getElementById('drop-zone').classList.remove('hidden');

        if ((!demandesData || demandesData.length === 0) && (!suiviComments || suiviComments.length === 0)) {
            document.getElementById('dashboard-section').classList.add('hidden');
        } else {
            if (demandesData && demandesData.length > 0) switchCraTab('demandes');
            else switchCraTab('suivi');
        }
    } else {
        populateFilters();
        updateDashboard();
    }
}

function clearDemandesData() {
    if (!confirm('Supprimer toutes les demandes importées ?')) return;
    demandesData = [];
    SafeStorage.remove('cra_demandes');
    initDemandesTab();
    
    // Si on a plus rien du tout (ni CRA, ni Suivi, ni Demandes), on remet la zone de drop
    if (Object.keys(dataSources).length === 0 && (!suiviComments || suiviComments.length === 0)) {
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('drop-zone').classList.remove('hidden');
    }
}

// --- Filtres ---
function factPopulateFilters() {
    const annees = [...new Set(factData.map(d => d.annee).filter(a => a && a !== 'N/A'))].sort();
    const moisSet = [...new Set(factData.map(d => d.moisAnnee).filter(m => m && m !== 'N/A'))];
    
    moisSet.sort((a, b) => {
        const [mA, yA] = a.split('/'), [mB, yB] = b.split('/');
        return new Date(yA, mA - 1) - new Date(yB, mB - 1);
    });

    const selAn = document.getElementById('fact-filter-annee');
    const selMo = document.getElementById('fact-filter-mois');
    const selTblC = document.getElementById('fact-tbl-client');
    const selTblM = document.getElementById('fact-tbl-mois');

    if (!selAn || !selMo) return;

    const curAn = selAn.value, curMo = selMo.value;
    selAn.innerHTML = '<option value="">Toutes années</option>' + annees.map(a => `<option value="${a}" ${a === curAn ? 'selected' : ''}>${a}</option>`).join('');
    selMo.innerHTML = '<option value="">Tous mois</option>' + moisSet.map(m => `<option value="${m}" ${m === curMo ? 'selected' : ''}>${m}</option>`).join('');

    const clients = [...new Set(factData.map(d => d.client))].sort();
    if (selTblC) selTblC.innerHTML = '<option value="">Tous les clients</option>' + clients.map(c => `<option value="${c}">${c}</option>`).join('');
    if (selTblM) selTblM.innerHTML = '<option value="">Tous les mois</option>' + moisSet.map(m => `<option value="${m}">${m}</option>`).join('');

    // Par défaut : Mois précédent
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const lastMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    if (!selMo.value && moisSet.includes(lastMonthStr)) {
        selMo.value = lastMonthStr;
    }
}


function factGetFiltered() {
    const fAn = document.getElementById('fact-filter-annee')?.value || '';
    const fMo = document.getElementById('fact-filter-mois')?.value || '';
    return factData.filter(d => {
        if (fAn && d.annee !== fAn) return false;
        if (fMo && d.moisAnnee !== fMo) return false;
        return true;
    });
}

// --- Agrégation par (client, mission, mois) ---
function factAggregate(data) {
    const map = {};
    data.forEach(d => {
        const key = d.client + '||' + d.mission + '||' + d.moisAnnee;
        if (!map[key]) map[key] = { client: d.client, mission: d.mission, moisAnnee: d.moisAnnee, sortDate: d.sortDate || '0000-00', jours: 0 };
        map[key].jours += d.jours;
    });
    return Object.values(map).sort((a, b) => {
        if (a.client !== b.client) return a.client.localeCompare(b.client);
        if (a.sortDate !== b.sortDate) return a.sortDate.localeCompare(b.sortDate);
        return a.mission.localeCompare(b.mission);
    });
}

// --- Mise à jour globale ---
function factUpdateAll() {
    factFilteredData = factGetFiltered();
    factUpdateKPIs();
    factRenderTable();
    factRenderClientList();
    if (factCurrentClient) factRenderClientDetail(factCurrentClient);
    // Charts uniquement si l'onglet dashboard est visible
    const dashTab = document.getElementById('fact-tab-dashboard');
    if (dashTab && !dashTab.classList.contains('hidden')) {
        factDrawCharts();
    }
}

// --- KPIs ---
function factUpdateKPIs() {
    const agg = factAggregate(factFilteredData);
    let totalCA = 0, toPascal = 0, sent = 0, paid = 0;
    agg.forEach(row => {
        const tjm = factTjm[row.client] || clientTjm[row.client] || 0;
        const montant = row.jours * tjm;
        const st = factGetStatut(row.client, row.mission, row.moisAnnee);
        totalCA += montant;
        if (!st.pascal) toPascal += montant;
        if (st.sent && !st.paid) sent += montant;
        if (st.paid) paid += montant;
    });
    const fmt = v => v > 0 ? v.toLocaleString('fr-FR', {maximumFractionDigits:0}) + ' €' : '—';
    document.getElementById('fact-kpi-ca').innerText = fmt(totalCA);
    document.getElementById('fact-kpi-pascal').innerText = fmt(toPascal);
    document.getElementById('fact-kpi-sent').innerText = fmt(sent);
    document.getElementById('fact-kpi-paid').innerText = fmt(paid);
}

// --- Graphes ---
function factDrawCharts() {
    if (typeof Chart === 'undefined') return;
    const agg = factAggregate(factFilteredData);

    // CA par client
    const byClient = {};
    agg.forEach(r => {
        const tjm = factTjm[r.client] || clientTjm[r.client] || 0;
        byClient[r.client] = (byClient[r.client] || 0) + r.jours * tjm;
    });
    const clientEntries = Object.entries(byClient).sort((a,b) => b[1]-a[1]);
    const ctxC = document.getElementById('fact-chart-client')?.getContext('2d');
    if (ctxC) {
        if (factChartClient) factChartClient.destroy();
        factChartClient = new Chart(ctxC, {
            type: 'bar',
            data: { labels: clientEntries.map(e=>e[0]), datasets: [{ data: clientEntries.map(e=>e[1]), backgroundColor: FACT_PALETTE, borderRadius: 5, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.raw.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' } } },
                scales: { x: { grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 11 } } }, y: { grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 }, callback: v => v.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' } } } }
        });
    }

    // CA par enveloppe (mission)
    const byEnv = {};
    agg.forEach(r => {
        const tjm = factTjm[r.client] || clientTjm[r.client] || 0;
        const label = r.client + ' / ' + r.mission;
        byEnv[label] = (byEnv[label] || 0) + r.jours * tjm;
    });
    const envEntries = Object.entries(byEnv).sort((a,b) => b[1]-a[1]).slice(0, 12);
    const ctxE = document.getElementById('fact-chart-envelope')?.getContext('2d');
    if (ctxE) {
        if (factChartEnvelope) factChartEnvelope.destroy();
        factChartEnvelope = new Chart(ctxE, {
            type: 'bar',
            data: { labels: envEntries.map(e=>e[0]), datasets: [{ data: envEntries.map(e=>e[1]), backgroundColor: FACT_PALETTE, borderRadius: 5, borderWidth: 0 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.raw.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' } } },
                scales: { x: { grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 }, callback: v => v.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' } }, y: { grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 } } } } }
        });
    }

    // Évolution mensuelle
    const byMois = {};
    agg.forEach(r => {
        const tjm = factTjm[r.client] || clientTjm[r.client] || 0;
        if (!byMois[r.sortDate]) byMois[r.sortDate] = { label: r.moisAnnee, total: 0, paid: 0, sent: 0 };
        const montant = r.jours * tjm;
        const st = factGetStatut(r.client, r.mission, r.moisAnnee);
        byMois[r.sortDate].total += montant;
        if (st.paid) byMois[r.sortDate].paid += montant;
        else if (st.sent) byMois[r.sortDate].sent += montant;
    });
    const sortedMois = Object.keys(byMois).filter(k => k !== '0000-00').sort();
    const ctxT = document.getElementById('fact-chart-evolution')?.getContext('2d');
    if (ctxT) {
        if (factChartEvolution) factChartEvolution.destroy();
        factChartEvolution = new Chart(ctxT, {
            type: 'bar',
            data: {
                labels: sortedMois.map(k => byMois[k].label),
                datasets: [
                    { label: 'Payées', data: sortedMois.map(k => byMois[k].paid), backgroundColor: '#5EB091', borderRadius: 3, borderWidth: 0 },
                    { label: 'Envoyées', data: sortedMois.map(k => byMois[k].sent), backgroundColor: '#2A517A', borderRadius: 3, borderWidth: 0 },
                    { label: 'À envoyer', data: sortedMois.map(k => byMois[k].total - byMois[k].paid - byMois[k].sent), backgroundColor: '#E2E8F0', borderRadius: 3, borderWidth: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { color: '#4A5568', boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.raw.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' } } },
                scales: { x: { stacked: true, grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 } } },
                    y: { stacked: true, grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 }, callback: v => v.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' } } }
            }
        });
    }
}
function getGlobalKPIs() {
    const data = (factData && factData.length > 0) ? factData : (rawData || []);
    
    // Calcul du mois précédent pour le filtre automatique (ex: 03/2026)
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const lastMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    let pendingFact = 0;
    let totalHT = 0;
    let totalJours = 0;
    
    data.forEach(d => {
        // Condition CRITIQUE : on ne traite que le mois dernier pour éviter les chiffres démesurés
        if (d.moisAnnee === lastMonthStr) {
            const tjm = factTjm[d.client] || clientTjm[d.client] || 0;
            const st = factGetStatut(d.client, d.mission, d.moisAnnee);
            const montant = d.jours * tjm;
            
            totalHT += montant;
            totalJours += d.jours;

            if (!st.paid && !st.sent && !st.pascal) {
                pendingFact += montant;
            }
        }
    });

    return {
        pending: pendingFact.toLocaleString('fr-FR') + " €",
        total: totalHT.toLocaleString('fr-FR') + " €",
        jours: totalJours.toFixed(1) + " j",
        periode: lastMonthStr
    };
}
// --- Tableau de facturation ---
function factRenderTable() {
    const tbody = document.getElementById('fact-table-body');
    if (!tbody) return;

    const fClient = document.getElementById('fact-tbl-client')?.value || '';
    const fMois = document.getElementById('fact-tbl-mois')?.value || '';
    const fStatut = document.getElementById('fact-tbl-statut')?.value || '';

    let data = factAggregate(factFilteredData);
    if (fClient) data = data.filter(r => r.client === fClient);
    if (fMois) data = data.filter(r => r.moisAnnee === fMois);
    if (fStatut) {
        data = data.filter(r => {
            const st = factGetStatut(r.client, r.mission, r.moisAnnee);
            if (fStatut === 'todo') return !st.pascal;
            if (fStatut === 'sent') return st.sent && !st.paid;
            if (fStatut === 'paid') return st.paid;
            return true;
        });
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--ink-muted);font-size:13px;">Aucune ligne pour ces filtres.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((row, idx) => {
        const tjm = factTjm[row.client] || clientTjm[row.client] || 0;
        const montant = row.jours * tjm;
        const st = factGetStatut(row.client, row.mission, row.moisAnnee);
        const k = factGetStatutKey(row.client, row.mission, row.moisAnnee);
        const rowBg = st.paid ? 'background:rgba(94,176,145,.07)' : (st.sent ? 'background:rgba(42,81,122,.05)' : '');
        const montantColor = st.paid ? '#4A9076' : (st.sent ? '#2A517A' : (montant > 0 ? 'var(--primary)' : 'var(--ink-muted)'));

        return `<tr style="border-bottom:1px solid var(--border-light);${rowBg};transition:.15s;">
            <td style="padding:10px 14px;font-weight:600;color:var(--primary);font-size:12px;">${row.client}</td>
            <td style="padding:10px 14px;color:var(--ink-secondary);font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${row.mission}">${row.mission}</td>
            <td style="padding:10px 14px;color:var(--ink-secondary);font-size:12px;font-family:'JetBrains Mono',monospace;">${row.moisAnnee}</td>
            <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-secondary);">${row.jours.toFixed(2)}</td>
            <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-muted);">${tjm > 0 ? tjm.toLocaleString('fr-FR') + ' €' : '<span style="color:var(--ink-muted);font-style:italic;">Non défini</span>'}</td>
            <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${montantColor};">${montant > 0 ? montant.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €' : '—'}</td>
            <td style="padding:10px 14px;text-align:center;">
                <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;" title="Envoyé à Pascal">
                    <input type="checkbox" ${st.pascal?'checked':''} onchange="factSetStatut('${row.client.replace(/'/g,"\\'")}','${row.mission.replace(/'/g,"\\'")}','${row.moisAnnee}','pascal',this.checked)"
                        style="width:16px;height:16px;cursor:pointer;accent-color:#D97706;">
                    ${st.pascal ? '<span style="font-size:10px;color:#D97706;font-weight:600;">✓</span>' : ''}
                </label>
            </td>
            <td style="padding:10px 14px;text-align:center;">
                <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;" title="Facture envoyée">
                    <input type="checkbox" ${st.sent?'checked':''} onchange="factSetStatut('${row.client.replace(/'/g,"\\'")}','${row.mission.replace(/'/g,"\\'")}','${row.moisAnnee}','sent',this.checked)"
                        style="width:16px;height:16px;cursor:pointer;accent-color:#2A517A;">
                    ${st.sent ? '<span style="font-size:10px;color:#2A517A;font-weight:600;">✓</span>' : ''}
                </label>
            </td>
            <td style="padding:10px 14px;text-align:center;">
                <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;" title="Facture payée">
                    <input type="checkbox" ${st.paid?'checked':''} onchange="factSetStatut('${row.client.replace(/'/g,"\\'")}','${row.mission.replace(/'/g,"\\'")}','${row.moisAnnee}','paid',this.checked)"
                        style="width:16px;height:16px;cursor:pointer;accent-color:#5EB091;">
                    ${st.paid ? '<span style="font-size:10px;color:#4A9076;font-weight:600;">✓</span>' : ''}
                </label>
            </td>
        </tr>`;
    }).join('');
}

// --- Navigation interne ---
function factSwitchTab(tab) {
    ['dashboard','clients','facturation'].forEach(t => {
        const el = document.getElementById('fact-tab-' + t);
        const btn = document.getElementById('fact-btn-' + t);
        if (el) el.classList.toggle('hidden', t !== tab);
        if (btn) {
            if (t === tab) {
                btn.style.cssText = 'font-size:12px;padding:6px 14px;border-radius:6px;cursor:pointer;background:var(--primary);color:white;border:none;font-weight:600;';
            } else {
                btn.style.cssText = 'font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid var(--border);color:var(--primary);font-weight:500;';
            }
        }
    });
    if (tab === 'clients') factRenderClientList();
    if (tab === 'facturation') { factPopulateFilters(); factRenderTable(); }
    if (tab === 'dashboard') setTimeout(factDrawCharts, 30);
}

// --- Fiches clients ---
function factRenderClientList() {
    const list = document.getElementById('fact-client-list');
    if (!list) return;
    const search = (document.getElementById('fact-search-client')?.value || '').toLowerCase();
    const clients = [...new Set(factFilteredData.map(d => d.client))].sort();
    list.innerHTML = clients.filter(c => c.toLowerCase().includes(search)).map(c => {
        const isActive = c === factCurrentClient;
        return `<button onclick="factSelectClient('${c.replace(/'/g,"\\'")}')"
            style="width:100%;text-align:left;padding:10px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid;transition:.15s;
            ${isActive ? 'background:var(--secondary-light);color:var(--primary);border-color:var(--secondary);' : 'background:var(--surface);color:var(--ink-secondary);border-color:var(--border);'}">
            ${c}
        </button>`;
    }).join('');
}

function factRenderClientDetail(clientName) {
    const el = document.getElementById('fact-client-detail');
    if (!el || !clientName) return;
    factCurrentClient = clientName;

    const clientData = factAggregate(factFilteredData.filter(d => d.client === clientName));
    const tjm = factTjm[clientName] || clientTjm[clientName] || 0;
    const totalJours = clientData.reduce((s, r) => s + r.jours, 0);
    
    // TVA par client (20% par défaut)
    if (factStatuts[clientName + '_tva'] === undefined) factStatuts[clientName + '_tva'] = 20;
    const tvaRate = factStatuts[clientName + '_tva'];

    const totalHT = totalJours * tjm;
    const montantTVA = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + montantTVA;

    const enveloppeHtml = Object.entries(clientData.reduce((acc, r) => {
        if (!acc[r.mission]) acc[r.mission] = { jours: 0, montant: 0, rows: [] };
        acc[r.mission].jours += r.jours;
        acc[r.mission].montant += r.jours * tjm;
        acc[r.mission].rows.push(r);
        return acc;
    }, {})).map(([mission, data]) => {
        const rowsHtml = data.rows.sort((a,b) => a.sortDate.localeCompare(b.sortDate)).map(r => {
            const st = factGetStatut(r.client, r.mission, r.moisAnnee);
            const badge = st.paid ? `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:rgba(94,176,145,.15);color:#4A9076;font-weight:700;">Payée</span>` : st.sent ? `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:rgba(42,81,122,.12);color:#2A517A;font-weight:700;">Envoyée</span>` : st.pascal ? `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:rgba(217,119,6,.12);color:#D97706;font-weight:700;">→ Pascal</span>` : `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:var(--bg);color:var(--ink-muted);font-weight:600;border:1px solid var(--border);">À traiter</span>`;
            return `<tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:7px 10px;font-size:11px;font-family:'JetBrains Mono',monospace;">${r.moisAnnee}</td>
                <td style="padding:7px 10px;text-align:right;font-size:11px;">${r.jours.toFixed(2)} j</td>
                <td style="padding:7px 10px;text-align:right;font-size:11px;font-weight:700;">${(r.jours * tjm).toLocaleString('fr-FR')} €</td>
                <td style="padding:7px 10px;text-align:center;">${badge}</td>
            </tr>`;
        }).join('');
        return `<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
            <div style="padding:8px 12px;background:var(--bg);font-size:12px;font-weight:700;display:flex;justify-content:space-between;">
                <span>${mission}</span><span>${data.montant.toLocaleString('fr-FR')} € HT</span>
            </div>
            <table style="width:100%;border-collapse:collapse;"><tbody>${rowsHtml}</tbody></table>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--border);">
            <h2 style="font-size:22px;font-weight:800;color:var(--primary);font-family:'Fraunces',serif;margin-bottom:15px;">${clientName}</h2>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px;">
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">
                    <div style="font-size:9px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:4px;">Jours</div>
                    <div style="font-size:18px;font-weight:800;color:var(--primary);">${totalJours.toFixed(2)}</div>
                </div>
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">
                    <div style="font-size:9px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:4px;">TJM HT</div>
                    <input type="number" value="${tjm}" onchange="factSaveTjm('${clientName.replace(/'/g,"\\")}')" id="fact-tjm-${clientName.replace(/[^a-zA-Z0-9]/g,'_')}"
                        style="width:70px;font-size:14px;font-weight:700;text-align:center;border:1px solid var(--border);border-radius:4px;color:var(--primary);">
                </div>
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">
                    <div style="font-size:9px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:4px;">TVA %</div>
                    <input type="number" value="${tvaRate}" onchange="factSaveTva('${clientName.replace(/'/g,"\\")}', this.value)"
                        style="width:60px;font-size:14px;font-weight:700;text-align:center;border:1px solid var(--border);border-radius:4px;color:var(--secondary-dark);">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:10px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:4px;">Total HT</div>
                    <div style="font-size:20px;font-weight:800;color:var(--primary);">${totalHT.toLocaleString('fr-FR')} €</div>
                </div>
                <div style="background:var(--primary);border-radius:8px;padding:12px;text-align:center;color:white;">
                    <div style="font-size:10px;text-transform:uppercase;opacity:0.8;margin-bottom:4px;">Total TTC</div>
                    <div style="font-size:20px;font-weight:800;">${totalTTC.toLocaleString('fr-FR')} €</div>
                </div>
            </div>
        </div>
        ${enveloppeHtml}
    `;
}

function factSaveTjm(clientName) {
    const inputId = 'fact-tjm-' + clientName.replace(/[^a-zA-Z0-9]/g,'_');
    const val = parseFloat(document.getElementById(inputId)?.value) || 0;
    factTjm[clientName] = val;
    SafeStorage.set('fact_tjm', factTjm);
    factUpdateAll();
}

// --- Export Excel ---
function exportFacturateurExcel() {
    if (typeof XLSX === 'undefined') return;
    const agg = factAggregate(factFilteredData);
    const rows = agg.map(r => {
        const tjm = factTjm[r.client] || clientTjm[r.client] || 0;
        const st = factGetStatut(r.client, r.mission, r.moisAnnee);
        return {
            'Client': r.client, 'Enveloppe': r.mission, 'Mois': r.moisAnnee,
            'Jours': parseFloat(r.jours.toFixed(2)), 'TJM (€)': tjm,
            'Montant (€)': parseFloat((r.jours * tjm).toFixed(2)),
            'Envoyé à Pascal': st.pascal ? 'Oui' : 'Non',
            'Facture envoyée': st.sent ? 'Oui' : 'Non',
            'Facture payée': st.paid ? 'Oui' : 'Non'
        };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturation');
    XLSX.writeFile(wb, 'Export_Facturator_' + new Date().toISOString().split('T')[0] + '.xlsx');
}

// --- Init si données sauvegardées ---
function factInit() {
    if (Object.keys(factDataSources).length > 0) {
        factData = [];
        Object.values(factDataSources).forEach(src => { if(src.data) factData = factData.concat(src.data); });
        if (factData.length > 0) {
            const uploadEl = document.getElementById('fact-upload-section');
            const dashEl   = document.getElementById('fact-dashboard');
            const countEl  = document.getElementById('fact-record-count');
            if (uploadEl) uploadEl.classList.add('hidden');
            if (dashEl)   dashEl.classList.remove('hidden');
            if (countEl)  countEl.innerText = factData.length + ' lignes';
            factRenderSourceChips();
            factPopulateFilters();
            factFilteredData = factGetFiltered();
            factUpdateKPIs();
            factRenderTable();
            factRenderClientList();
        }
    }
}



// Init au chargement
window.onload = function() {
    renderHomeGrid();
	renderAllLinks();
    checkLocalData();
    factInit();
	renderHomeGrid();
};
function factSelectClient(name) {
    factCurrentClient = name;
    factRenderClientList();
    factRenderClientDetail(name);
}

function factSaveTva(clientName, val) {
    factStatuts[clientName + '_tva'] = parseFloat(val) || 0;
    SafeStorage.set('fact_statuts', factStatuts);
    factUpdateKPIs(); // Met à jour les compteurs du haut
    factRenderClientDetail(clientName); // Rafraîchit la fiche
}
