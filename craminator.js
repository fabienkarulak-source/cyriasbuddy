/* ============================================================
   Cyrias Buddy — CRAminator v4
   ============================================================ */
// ==========================================
// CRAMINATOR v4 — Script complet intégré
// ==========================================

        // ===== 2. UTILITIES =====
        window.onerror = function(msg, src, line) { console.error("ERR:", msg, "L" + line); return false; };

        function openCraModal(id) { document.getElementById(id).classList.remove('hidden'); }
        function closeCraModal(id) { document.getElementById(id).classList.add('hidden'); }
        function showCustomAlert(t, m) { document.getElementById('alert-title').innerText = t; document.getElementById('alert-message').innerHTML = m; openCraModal('alert-modal'); }
        function showError(msg, t="Erreur") { document.getElementById('upload-progress-container').classList.add('hidden'); showCustomAlert(t, msg); }

        function updateFilterBadge() {
            if(!tomSelectsInitialized) return;
            const count = tsAnnee.getValue().length + tsSemestre.getValue().length + tsTrimestre.getValue().length + tsMois.getValue().length + tsEquipe.getValue().length + tsClient.getValue().length + tsMission.getValue().length + tsCollab.getValue().length + tsSource.getValue().length;
            const b = document.getElementById('filter-badge');
            if(count>0){ b.innerText = count; b.classList.remove('hidden'); } else { b.classList.add('hidden'); }
        }

        function filterModalList(inputId, listId) {
            const term = document.getElementById(inputId).value.toLowerCase();
            Array.from(document.getElementById(listId).children).forEach(row => {
                const text = row.querySelector('label').innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        }

        // ===== 3. STORAGE =====
       
        let displayConfig = SafeStorage.get('cra_display') || { chartsTop: true, chartsBottom: true, alerts: true, tables: true, commentQuality: true };
        let clientProfiles = SafeStorage.get('cra_client_profiles') || {};
        let currentSelectedClient = null;


        function applyDisplayConfig() {
            const toggle = (id, show) => { const el = document.getElementById(id); if(el) el.classList.toggle('hidden', !show); };
            toggle('block-charts-top', displayConfig.chartsTop);
            toggle('block-charts-bottom', displayConfig.chartsBottom);
            toggle('block-alerts', displayConfig.alerts);
            toggle('block-tables', displayConfig.tables);
            toggle('block-comment-quality', displayConfig.commentQuality !== false);
            toggle('block-ai', displayConfig.ai !== false);
        }

        function openDisplayModal() {
            document.getElementById('toggle-charts-top').checked = displayConfig.chartsTop;
            document.getElementById('toggle-charts-bottom').checked = displayConfig.chartsBottom;
            document.getElementById('toggle-alerts').checked = displayConfig.alerts;
            document.getElementById('toggle-tables').checked = displayConfig.tables;
            document.getElementById('toggle-comment-quality').checked = displayConfig.commentQuality !== false;
            document.getElementById('toggle-ai').checked = displayConfig.ai !== false;
            openCraModal('display-modal');
        }

        function toggleDisplayBlock(blockId, isVisible, configKey) {
            displayConfig[configKey] = isVisible;
            SafeStorage.set('cra_display', displayConfig);
            applyDisplayConfig();
        }

        // ===== NAVIGATION ONGLETS =====
        function switchCraTab(tabName) {
            const tabs = ['dashboard', 'clients', 'explorer', 'suivi', 'demandes', 'dispo'];
            const activeClass = 'btn-gradient text-xs flex items-center gap-1.5';
            const inactiveClass = 'btn-ghost text-xs flex items-center gap-1.5';

            tabs.forEach(t => {
                const content = document.getElementById(t === 'dashboard' ? 'dashboard-content' : `${t}-content`);
                const btn = document.getElementById(`btn-tab-${t}`);
                if (content) content.classList.toggle('hidden', t !== tabName);
                if (btn) btn.className = (t === tabName) ? activeClass : inactiveClass;
            });

            if (tabName === 'clients') renderClientCardList();
            if (tabName === 'explorer') renderExplorerTable();
            if (tabName === 'suivi') initSuiviTab();
            if (tabName === 'demandes') initDemandesTab();
			if (tabName === 'dispo') renderDispoTable();
        }

        // ===== EXPLORATEUR DE DONNÉES =====
        function populateExplorerFilters() {
            const clientSelect = document.getElementById('explorer-filter-client');
            const missionSelect = document.getElementById('explorer-filter-mission');
            const moisSelect = document.getElementById('explorer-filter-mois');
            if (!clientSelect || !missionSelect || !moisSelect) return;

            const currentClient = clientSelect.value;
            const currentMission = missionSelect.value;
            const currentMois = moisSelect.value;

            const clients = [...new Set(filteredData.map(d => d.client))].sort();

            let baseForMission = filteredData;
            if (currentClient) baseForMission = baseForMission.filter(d => d.client === currentClient);
            const missions = [...new Set(baseForMission.map(d => d.mission))].sort();

            let baseForMois = baseForMission;
            if (currentMission) baseForMois = baseForMois.filter(d => d.mission === currentMission);
            const moisList = [...new Set(baseForMois.map(d => d.moisAnnee).filter(m => m && m !== 'N/A'))];
            moisList.sort((a, b) => {
                const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
                return new Date(yB, mB - 1) - new Date(yA, mA - 1);
            });

            clientSelect.innerHTML = '<option value="">— Tous les clients —</option>' + clients.map(c => `<option value="${c}" ${c === currentClient ? 'selected' : ''}>${c}</option>`).join('');
            missionSelect.innerHTML = '<option value="">— Toutes les missions —</option>' + missions.map(m => `<option value="${m}" ${m === currentMission ? 'selected' : ''}>${m}</option>`).join('');
            moisSelect.innerHTML = '<option value="">— Tous les mois —</option>' + moisList.map(m => `<option value="${m}" ${m === currentMois ? 'selected' : ''}>${m}</option>`).join('');
        }

        function resetExplorerFilters() {
            const clientSelect = document.getElementById('explorer-filter-client');
            const missionSelect = document.getElementById('explorer-filter-mission');
            const moisSelect = document.getElementById('explorer-filter-mois');
            const searchInput = document.getElementById('search-explorer');
            if (clientSelect) clientSelect.value = '';
            if (missionSelect) missionSelect.value = '';
            if (moisSelect) moisSelect.value = '';
            if (searchInput) searchInput.value = '';
            renderExplorerTable();
        }

        function getExplorerFilteredData() {
            const searchVal = (document.getElementById('search-explorer')?.value || '').toLowerCase();
            const filterClient = document.getElementById('explorer-filter-client')?.value || '';
            const filterMission = document.getElementById('explorer-filter-mission')?.value || '';
            const filterMois = document.getElementById('explorer-filter-mois')?.value || '';

            return filteredData.filter(d => {
                if (filterClient && d.client !== filterClient) return false;
                if (filterMission && d.mission !== filterMission) return false;
                if (filterMois && d.moisAnnee !== filterMois) return false;
                if (searchVal) {
                    return (d.commentaire || '').toLowerCase().includes(searchVal) ||
                        (d.collaborateur || '').toLowerCase().includes(searchVal) ||
                        (d.client || '').toLowerCase().includes(searchVal) ||
                        (d.mission || '').toLowerCase().includes(searchVal) ||
                        (d.tache || '').toLowerCase().includes(searchVal) ||
                        (d.equipe || '').toLowerCase().includes(searchVal);
                }
                return true;
            });
        }

        function exportExplorerToExcel() {
            const data = getExplorerFilteredData();
            if (data.length === 0) { showCustomAlert("Info", "Aucune donnée à exporter avec les filtres actuels."); return; }

            data.sort((a, b) => (b.rawDateObj || 0) - (a.rawDateObj || 0));

            const arr = data.map(d => ({
                "Date": d.rawDateObj ? new Date(d.rawDateObj).toLocaleDateString('fr-FR') : "N/A",
                "Équipe": d.equipe,
                "Client": d.client,
                "Mission": d.mission,
                "Collaborateur": d.collaborateur,
                "Jours": d.jours,
                "Tâche": d.tache,
                "Commentaire": d.commentaire,
                "Source": d._source || ""
            }));
            const ws = XLSX.utils.json_to_sheet(arr);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Explorateur");

            const filterClient = document.getElementById('explorer-filter-client')?.value || '';
            const filterMission = document.getElementById('explorer-filter-mission')?.value || '';
            const filterMois = document.getElementById('explorer-filter-mois')?.value || '';
            let fileName = 'Export_Explorateur';
            if (filterClient) fileName += '_' + filterClient.replace(/\s+/g, '_');
            if (filterMission) fileName += '_' + filterMission.replace(/\s+/g, '_');
            if (filterMois) fileName += '_' + filterMois.replace('/', '-');
            fileName += '_' + new Date().toISOString().split('T')[0] + '.xlsx';

            XLSX.writeFile(wb, fileName);
        }

        function renderExplorerTable() {
            const tbody = document.getElementById('explorer-table-body');
            if (!tbody) return;

            populateExplorerFilters();

            const data = getExplorerFilteredData();
            data.sort((a, b) => (b.rawDateObj || 0) - (a.rawDateObj || 0));

            const totalJours = data.reduce((a, r) => a + r.jours, 0);
            document.getElementById('explorer-summary').innerText = `${data.length} lignes filtrées — ${totalJours.toFixed(1)} jours`;

            tbody.innerHTML = data.slice(0, 300).map(d => {
                const dateStr = d.rawDateObj ? new Date(d.rawDateObj).toLocaleDateString('fr-FR') : 'N/A';
                const commentHtml = d.commentaire ? `<div class="mt-0.5 italic" style="color: var(--text-muted);">${d.commentaire}</div>` : '';
                return `<tr class="hover:bg-white/[0.02] transition" style="border-color: var(--border-subtle);">
                    <td class="px-4 py-2.5 font-mono" style="color: var(--text-muted);">${dateStr}</td>
                    <td class="px-4 py-2.5" style="color: var(--text-secondary);">${d.equipe}</td>
                    <td class="px-4 py-2.5 font-semibold" style="color: #7ec8e3;">${d.client}</td>
                    <td class="px-4 py-2.5" style="color: var(--text-secondary);">${d.mission}</td>
                    <td class="px-4 py-2.5" style="color: var(--text-primary);">${d.collaborateur}</td>
                    <td class="px-4 py-2.5 text-center font-bold font-mono" style="color: #8ed4b0;">${d.jours.toFixed(2)}</td>
                    <td class="px-4 py-2.5"><div class="font-medium" style="color: var(--text-primary);">${d.tache}</div>${commentHtml}</td>
                    <td class="px-4 py-2.5 text-[10px] font-mono" style="color: var(--text-muted);">${d._source || ''}</td>
                </tr>`;
            }).join('');
        }

        // ===== SUIVI HEBDO =====
        let suiviComments = SafeStorage.get('cra_suivi_comments') || [];

        function initSuiviTab() {
            // Remplir la liste clients dans le formulaire
            const clients = [...new Set(rawData.map(d => d.client))].sort();
            const clientSelect = document.getElementById('suivi-client');
            const currentVal = clientSelect.value;
            clientSelect.innerHTML = '<option value="">— Sélectionner un client —</option>' + clients.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');

            // Remplir le filtre client historique
            const histSelect = document.getElementById('suivi-hist-client');
            const histVal = histSelect.value;
            histSelect.innerHTML = '<option value="">Tous les clients</option>' + clients.map(c => `<option value="${c}" ${c === histVal ? 'selected' : ''}>${c}</option>`).join('');

            // Pré-remplir semaine courante
            const weekInput = document.getElementById('suivi-semaine');
            if (!weekInput.value) {
                const now = new Date();
                const oneJan = new Date(now.getFullYear(), 0, 1);
                const weekNum = Math.ceil(((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
                weekInput.value = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
            }

            // Pré-remplir auteur
            document.getElementById('suivi-auteur').value = currentUserLabel || 'Utilisateur';

            renderSuiviHistory();
        }

        function addSuiviComment() {
    const client = document.getElementById('suivi-client').value;
    const semaine = document.getElementById('suivi-semaine').value;
    const categorie = document.getElementById('suivi-categorie').value;
    const auteur = document.getElementById('suivi-auteur').value;
    
    // Nouveaux champs
    const participants = document.getElementById('suivi-participants').value.trim();
    const enveloppes = document.getElementById('suivi-enveloppes').value.trim();
    const sujets = document.getElementById('suivi-sujets').value.trim();
    const attention = document.getElementById('suivi-attention').value.trim();

    if (!client || !semaine || (!sujets && !attention)) { 
        showCustomAlert('Champs requis', 'Veuillez remplir au moins le client, la semaine et les sujets ou points d\'attention.'); 
        return; 
    }

    const entry = {
        id: 'suivi_' + Date.now(),
        client,
        semaine,
        categorie,
        participants,
        enveloppes,
        sujets,
        attention,
        auteur,
        createdAt: new Date().toISOString()
    };

    suiviComments.unshift(entry);
    SafeStorage.set('cra_suivi_comments', suiviComments);

    // Reset des champs
    ['suivi-participants', 'suivi-enveloppes', 'suivi-sujets', 'suivi-attention'].forEach(id => {
        document.getElementById(id).value = '';
    });

    renderSuiviHistory();
}

        function deleteSuiviComment(id) {
            if (!confirm('Supprimer ce commentaire de suivi ?')) return;
            suiviComments = suiviComments.filter(c => c.id !== id);
            SafeStorage.set('cra_suivi_comments', suiviComments);
            renderSuiviHistory();
        }

        function getCategorieStyle(cat) {
            const map = {
                'Point général': { bg: 'rgba(68,145,182,0.12)', border: 'rgba(68,145,182,0.3)', color: '#7ec8e3' },
                'Alerte / Risque': { bg: 'rgba(231,91,60,0.12)', border: 'rgba(231,91,60,0.3)', color: '#f09a85' },
                'Décision prise': { bg: 'rgba(102,187,147,0.12)', border: 'rgba(102,187,147,0.3)', color: '#8ed4b0' },
                'Action à mener': { bg: 'rgba(233,189,39,0.12)', border: 'rgba(233,189,39,0.3)', color: '#f0d46a' },
                'Satisfaction client': { bg: 'rgba(102,187,147,0.12)', border: 'rgba(102,187,147,0.3)', color: '#8ed4b0' },
                'Staffing': { bg: 'rgba(90,162,199,0.12)', border: 'rgba(90,162,199,0.3)', color: '#8fc5df' },
                'Autre': { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', color: '#4A5568' }
            };
            return map[cat] || map['Autre'];
        }

        function formatSemaine(weekStr) {
            if (!weekStr) return '';
            const parts = weekStr.split('-W');
            if (parts.length === 2) return `S${parseInt(parts[1])} ${parts[0]}`;
            return weekStr;
        }

        function renderSuiviHistory() {
            const container = document.getElementById('suivi-history-list');
            const filterClient = document.getElementById('suivi-hist-client')?.value || '';

            let data = suiviComments;
            if (filterClient) data = data.filter(c => c.client === filterClient);

            if (data.length === 0) {
                container.innerHTML = `<div class="text-center py-10" style="color: var(--text-muted);">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <p class="text-sm">Aucun commentaire de suivi${filterClient ? ' pour ce client' : ''}.</p>
                    <p class="text-xs mt-1">Utilisez le formulaire pour ajouter vos notes hebdomadaires.</p>
                </div>`;
                return;
            }

            container.innerHTML = data.map(c => {
                const catStyle = getCategorieStyle(c.categorie);
                const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
               return `<div class="p-4 rounded-xl transition-all" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); margin-bottom: 12px;">
    <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-bold" style="color: var(--primary);">${c.client}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border" style="background: ${catStyle.bg}; color: ${catStyle.color}; border-color: ${catStyle.border};">${c.categorie}</span>
            <span class="text-[10px] font-mono text-gray-500">${formatSemaine(c.semaine)}</span>
        </div>
        <button onclick="deleteSuiviComment('${c.id}')" class="text-red-300 hover:text-red-500">×</button>
    </div>

    ${c.participants ? `<div class="mb-2"><span class="text-[10px] font-bold uppercase text-gray-400">👥 Participants:</span> <span class="text-xs">${c.participants}</span></div>` : ''}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <div class="p-2 rounded bg-white/50 border border-gray-100">
            <span class="text-[9px] font-bold uppercase text-blue-400 block mb-1">📋 Sujets en cours</span>
            <p class="text-xs" style="white-space: pre-wrap;">${c.sujets || '—'}</p>
        </div>
        <div class="p-2 rounded bg-white/50 border border-gray-100">
            <span class="text-[9px] font-bold uppercase text-emerald-500 block mb-1">💶 État Enveloppes</span>
            <p class="text-xs" style="white-space: pre-wrap;">${c.enveloppes || '—'}</p>
        </div>
    </div>

    ${c.attention ? `
    <div class="mt-3 p-2 rounded border-l-4 border-orange-400 bg-orange-50">
        <span class="text-[9px] font-bold uppercase text-orange-600 block mb-1">⚠️ Points d'attention</span>
        <p class="text-xs font-medium text-orange-900" style="white-space: pre-wrap;">${c.attention}</p>
    </div>` : ''}

    <div class="mt-3 text-[9px] text-gray-400 flex justify-between">
        <span>Saisie par ${c.auteur}</span>
        <span>${dateStr}</span>
    </div>
</div>`;
            }).join('');
        }

        function exportSuiviToExcel() {
            const filterClient = document.getElementById('suivi-hist-client')?.value || '';
            let data = suiviComments;
            if (filterClient) data = data.filter(c => c.client === filterClient);

            if (data.length === 0) { showCustomAlert('Info', 'Aucun commentaire à exporter.'); return; }

            const arr = data.map(c => ({
                'Client': c.client,
                'Semaine': formatSemaine(c.semaine),
                'Catégorie': c.categorie,
                'Commentaire': c.commentaire,
                'Auteur': c.auteur,
                'Date de saisie': c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
            }));
            const ws = XLSX.utils.json_to_sheet(arr);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Suivi_Hebdo');

            let fileName = 'Suivi_Hebdo';
            if (filterClient) fileName += '_' + filterClient.replace(/\s+/g, '_');
            fileName += '_' + new Date().toISOString().split('T')[0] + '.xlsx';
            XLSX.writeFile(wb, fileName);
        }

        // ===== DEMANDES & SATISFACTION =====
        let demandesData = SafeStorage.get('cra_demandes') || [];
        let demandesStatuts = SafeStorage.get('cra_demandes_statuts') || [
            { name: 'Nouveau', closed: false, color: '#7ec8e3' },
            { name: 'En cours', closed: false, color: '#f0d46a' },
            { name: 'En attente client', closed: false, color: '#E9BD27' },
            { name: 'Completed', closed: true, color: '#8ed4b0' },
            { name: 'Fermé', closed: true, color: '#64748b' },
            { name: 'Rejeté', closed: true, color: '#f09a85' }
        ];
        let demandesChartStatut = null, demandesChartClient = null, demandesChartSatisf = null;

        function handleDemandesImport(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
                    const getRaw = (row, names) => { const k = Object.keys(row); for (let n of names) { const m = k.find(x => String(x).trim().toLowerCase() === n.toLowerCase()); if (m && row[m] !== undefined && row[m] !== '') return row[m]; } return null; };

                    const parseAnyDate = (val) => {
                        if (!val) return null;
                        if (val instanceof Date) return val;
                        if (typeof val === 'number') return new Date((new Date(1899, 11, 30)).getTime() + val * 86400000);
                        const d = new Date(val); return isNaN(d.getTime()) ? null : d;
                    };

                    const parsed = json.map((row, i) => {
                        const createdRaw = getRaw(row, ['Created', 'Date', 'Date création', 'Date de création']);
                        const jsDate = parseAnyDate(createdRaw);
                        const plannedRaw = getRaw(row, ['Planned delivery', 'Planned deliv. date', 'Date prévue']);
                        const actualRaw = getRaw(row, ['Actual del. Date', 'Actual delivery', 'Date réelle']);
                        const requestedRaw = getRaw(row, ['Requested deliv. date', 'Date demandée']);

                        return {
                            id: String(getRaw(row, ['ID', 'N°', 'Numero', 'Ticket', 'Ref', 'Référence']) || `DEM-${i + 1}`).trim(),
                            date: jsDate ? jsDate.toISOString() : null,
                            client: String(getRaw(row, ['Project', 'Client', 'Projet']) || 'N/A').trim(),
                            objet: String(getRaw(row, ['Short description', 'Objet', 'Titre', 'Sujet', 'Demande', 'Libellé']) || '').trim(),
                            description: String(getRaw(row, ['Detailed Description', 'Description détaillée', 'Description']) || '').trim(),
                            statut: String(getRaw(row, ['Resolution', 'Statut', 'Status', 'État']) || 'Nouveau').trim(),
                            priorite: String(getRaw(row, ['P', 'Priorité', 'Priority', 'Urgence', 'Severity']) || '').trim(),
                            severite: String(getRaw(row, ['Severity', 'Sévérité', 'Gravité']) || '').trim(),
                            demandeur: String(getRaw(row, ['Requestor', 'Demandeur', 'Auteur']) || '').trim(),
                            assigneA: String(getRaw(row, ['Assigned to', 'Assigné à', 'Responsable', 'Resp']) || '').trim(),
                            datePrevue: parseAnyDate(plannedRaw)?.toISOString() || null,
                            dateReelle: parseAnyDate(actualRaw)?.toISOString() || null,
                            dateDemandee: parseAnyDate(requestedRaw)?.toISOString() || null,
                            environnement: String(getRaw(row, ['Env.', 'Environnement', 'Environment']) || '').trim(),
                            campagne: String(getRaw(row, ['Campaign', 'Campagne']) || '').trim()
                        };
                    }).filter(d => d.objet || d.client !== 'N/A');

                    if (parsed.length === 0) { showCustomAlert('Import', 'Aucune demande valide trouvée dans le fichier.'); return; }

                    // Auto-detect new statuts
                    parsed.forEach(d => {
                        if (d.statut && !demandesStatuts.find(s => s.name.toLowerCase() === d.statut.toLowerCase())) {
                            demandesStatuts.push({ name: d.statut, closed: false, color: '#4A5568' });
                        }
                    });
                    SafeStorage.set('cra_demandes_statuts', demandesStatuts);

                    const existingTickets = new Map(demandesData.map(d => [d.id, d]));
parsed.forEach(p => {
    existingTickets.set(p.id, p); 
});
demandesData = Array.from(existingTickets.values());
                    SafeStorage.set('cra_demandes', demandesData);
                    initDemandesTab();
                    showCustomAlert('Import réussi', `${parsed.length} demande(s) importée(s) avec succès.`);
                } catch (err) {
                    showCustomAlert('Erreur', 'Impossible de lire le fichier : ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
        }

        function downloadDemandesTemplate() {
            const ws = XLSX.utils.aoa_to_sheet([
                ['Project', 'ID', 'P', 'Short description', 'Detailed Description', 'Resolution', 'Severity', 'Requestor', 'Assigned to', 'Requested deliv. date', 'Planned delivery', 'Actual del. Date', 'Env.', 'Campaign', 'Created'],
                ['ClientA', 'DEM-001', 'P1', 'Correction écran login', 'Description détaillée du bug...', 'In progress', 'Blocking bug', 'jean.dupont', 'marie.martin', '', '', '', 'PROD', '', '25/03/2025'],
                ['ClientB', 'DEM-002', 'P2', 'Évolution rapport PDF', 'Ajout colonne dans le rapport', 'Nouveau', 'Evolution', 'paul.durand', '', '', '', '', 'PREPROD', '', '01/04/2025']
            ]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Demandes');
            XLSX.writeFile(wb, 'Modele_Demandes.xlsx');
        }

        function clearDemandesData() {
            if (!confirm('Supprimer toutes les demandes importées ?')) return;
            demandesData = [];
            SafeStorage.remove('cra_demandes');
            initDemandesTab();
        }

        function initDemandesTab() {
            document.getElementById('demandes-count').innerText = demandesData.length;
            populateDemandesFilters();
            renderDemandesKPIs();
            renderDemandesCharts();
            renderDemandesTable();
        }

        function populateDemandesFilters() {
            const clients = [...new Set(demandesData.map(d => d.client))].sort();
            const statuts = [...new Set(demandesData.map(d => d.statut))].sort();
            const severites = [...new Set(demandesData.map(d => d.severite).filter(s => s))].sort();
            const fc = document.getElementById('demandes-filter-client');
            const fs = document.getElementById('demandes-filter-statut');
            const fse = document.getElementById('demandes-filter-satisf');
            const cv = fc.value, sv = fs.value, sev = fse.value;
            fc.innerHTML = '<option value="">Tous</option>' + clients.map(c => `<option value="${c}" ${c === cv ? 'selected' : ''}>${c}</option>`).join('');
            fs.innerHTML = '<option value="">Tous</option>' + statuts.map(s => `<option value="${s}" ${s === sv ? 'selected' : ''}>${s}</option>`).join('');
            fse.innerHTML = '<option value="">Toutes</option>' + severites.map(s => `<option value="${s}" ${s === sev ? 'selected' : ''}>${s}</option>`).join('');
        }

        function getFilteredDemandes() {
            const fc = document.getElementById('demandes-filter-client')?.value || '';
            const fs = document.getElementById('demandes-filter-statut')?.value || '';
            const fse = document.getElementById('demandes-filter-satisf')?.value || '';
            return demandesData.filter(d => {
                if (fc && d.client !== fc) return false;
                if (fs && d.statut !== fs) return false;
                if (fse && d.severite !== fse) return false;
                return true;
            });
        }

        function isClosedStatut(statut) {
            const s = demandesStatuts.find(x => x.name.toLowerCase() === (statut || '').toLowerCase());
            return s ? s.closed : false;
        }

        function getStatutColor(statut) {
            const s = demandesStatuts.find(x => x.name.toLowerCase() === (statut || '').toLowerCase());
            return s ? s.color : '#94a3b8';
        }

        function renderDemandesKPIs() {
            const data = getFilteredDemandes();
            const total = data.length;
            const fermees = data.filter(d => isClosedStatut(d.statut)).length;
            const ouvertes = total - fermees;
            const tauxCloture = total > 0 ? ((fermees / total) * 100).toFixed(0) + '%' : '—';

            // Satisfaction from client profiles
            const clientsInData = [...new Set(data.map(d => d.client))];
            const withSat = clientsInData.filter(c => clientProfiles[c]?.satisfaction);
            const satisfaits = withSat.filter(c => clientProfiles[c].satisfaction === 'Satisfait').length;
            const insatisfaits = withSat.filter(c => clientProfiles[c].satisfaction === 'Insatisfait').length;
            const pctSatisfaits = withSat.length > 0 ? ((satisfaits / withSat.length) * 100).toFixed(0) + '%' : '—';
            const pctInsatisfaits = withSat.length > 0 ? ((insatisfaits / withSat.length) * 100).toFixed(0) + '%' : '—';

            // Note moyenne from client profiles
            const withNote = clientsInData.filter(c => clientProfiles[c]?.note > 0);
            const avgNote = withNote.length > 0 ? (withNote.reduce((a, c) => a + clientProfiles[c].note, 0) / withNote.length).toFixed(1) : '—';

            // NPS from client profiles
            const withNps = clientsInData.filter(c => clientProfiles[c]?.nps != null);
            let npsVal = '—';
            if (withNps.length > 0) {
                const promoters = withNps.filter(c => clientProfiles[c].nps >= 9).length;
                const detractors = withNps.filter(c => clientProfiles[c].nps <= 6).length;
                npsVal = Math.round(((promoters - detractors) / withNps.length) * 100);
            }

            document.getElementById('kpi-total').innerText = total;
            document.getElementById('kpi-ouvertes').innerText = ouvertes;
            document.getElementById('kpi-fermees').innerText = fermees;
            document.getElementById('kpi-taux-cloture').innerText = tauxCloture;
            document.getElementById('kpi-satisfaction').innerText = pctSatisfaits;
            document.getElementById('kpi-insatisfaits').innerText = pctInsatisfaits;
            document.getElementById('kpi-note-moy').innerText = avgNote !== '—' ? avgNote + '/5' : '—';
            const npsEl = document.getElementById('kpi-nps-global');
            npsEl.innerText = npsVal !== '—' ? (npsVal > 0 ? '+' : '') + npsVal : '—';
            npsEl.style.color = npsVal === '—' ? '#8fc5df' : (npsVal >= 50 ? '#8ed4b0' : (npsVal >= 0 ? '#f0d46a' : '#f09a85'));
        }

        function renderDemandesCharts() {
            const data = getFilteredDemandes();
            const bgColors = ['#19365D', '#66BB93', '#4491B6', '#2E678D', '#E9BD27', '#E75B3C', '#5AA2C7', '#387BA1', '#10A2C8', '#64748b'];
            const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#4A5568', font: { size: 10 }, boxWidth: 10 } } } };

            // Statut chart
            if (demandesChartStatut) demandesChartStatut.destroy();
            const statutAgg = data.reduce((a, d) => { a[d.statut] = (a[d.statut] || 0) + 1; return a; }, {});
            const statutLabels = Object.keys(statutAgg);
            const statutColors = statutLabels.map(s => getStatutColor(s));
            demandesChartStatut = new Chart(document.getElementById('demandes-chart-statut'), {
                type: 'doughnut', data: { labels: statutLabels, datasets: [{ data: Object.values(statutAgg), backgroundColor: statutColors, borderWidth: 0 }] }, options: opts
            });

            // Client chart
            if (demandesChartClient) demandesChartClient.destroy();
            const clientAgg = data.reduce((a, d) => { a[d.client] = (a[d.client] || 0) + 1; return a; }, {});
            const clientSorted = Object.entries(clientAgg).sort((a, b) => b[1] - a[1]).slice(0, 10);
            demandesChartClient = new Chart(document.getElementById('demandes-chart-client'), {
                type: 'bar', data: { labels: clientSorted.map(x => x[0]), datasets: [{ data: clientSorted.map(x => x[1]), backgroundColor: '#4491B6', borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#E2E8F0' } }, x: { grid: { display: false } } } }
            });

            // Satisfaction chart (from client profiles)
            if (demandesChartSatisf) demandesChartSatisf.destroy();
            const satAgg = { 'Satisfait': 0, 'Neutre': 0, 'Insatisfait': 0 };
            const clientsInData = [...new Set(data.map(d => d.client))];
            clientsInData.forEach(c => { const s = clientProfiles[c]?.satisfaction; if (satAgg[s] !== undefined) satAgg[s]++; });
            demandesChartSatisf = new Chart(document.getElementById('demandes-chart-satisfaction'), {
                type: 'doughnut', data: { labels: Object.keys(satAgg), datasets: [{ data: Object.values(satAgg), backgroundColor: ['#66BB93', '#E9BD27', '#E75B3C'], borderWidth: 0 }] }, options: opts
            });
        }

        function renderDemandesTable() {
            renderDemandesKPIs();
            renderDemandesCharts();
            const data = getFilteredDemandes();
            data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const tbody = document.getElementById('demandes-table-body');

            tbody.innerHTML = data.slice(0, 200).map(d => {
                const dateStr = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '—';
                const statColor = getStatutColor(d.statut);
                const prioMap = { 'p1': '#E75B3C', 'p2': '#f09a85', 'p3': '#f0d46a', 'p4': '#8ed4b0', 'haute': '#f09a85', 'high': '#f09a85', 'urgente': '#E75B3C', 'moyenne': '#f0d46a', 'medium': '#f0d46a', 'basse': '#8ed4b0', 'low': '#8ed4b0' };
                const prioColor = prioMap[(d.priorite || '').toLowerCase()] || 'var(--text-muted)';
                const sevMap = { 'blocking bug': '#E75B3C', 'major bug': '#f09a85', 'minor bug': '#f0d46a', 'evolution': '#8fc5df', 'enhancement': '#8ed4b0' };
                const sevColor = sevMap[(d.severite || '').toLowerCase()] || 'var(--text-muted)';

                return `<tr class="hover:bg-white/[0.02] transition" style="border-color: var(--border-subtle);">
                    <td class="px-3 py-2 font-mono text-[10px]" style="color: var(--text-muted);">${d.id}</td>
                    <td class="px-3 py-2 font-mono" style="color: var(--text-muted);">${dateStr}</td>
                    <td class="px-3 py-2 font-semibold" style="color: #7ec8e3;">${d.client}</td>
                    <td class="px-3 py-2" style="color: var(--text-primary);" title="${(d.description || '').substring(0, 200)}">${d.objet}</td>
                    <td class="px-3 py-2"><span class="text-[10px] font-bold px-2 py-0.5 rounded" style="background: ${statColor}22; color: ${statColor}; border: 1px solid ${statColor}44;">${d.statut}</span></td>
                    <td class="px-3 py-2 text-[10px] font-bold" style="color: ${prioColor};">${d.priorite || '—'}</td>
                    <td class="px-3 py-2 text-[10px]" style="color: ${sevColor};">${d.severite || '—'}</td>
                    <td class="px-3 py-2 text-[10px]" style="color: var(--text-secondary);">${d.assigneA || '—'}</td>
                </tr>`;
            }).join('');
        }

        function exportDemandesToExcel() {
            const data = getFilteredDemandes();
            if (data.length === 0) { showCustomAlert('Info', 'Aucune demande à exporter.'); return; }
            const arr = data.map(d => ({
                'ID': d.id, 'Date': d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '', 'Client': d.client,
                'Objet': d.objet, 'Statut': d.statut, 'Priorité': d.priorite, 'Sévérité': d.severite, 'Demandeur': d.demandeur, 'Assigné à': d.assigneA
            }));
            const ws = XLSX.utils.json_to_sheet(arr);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Demandes');
            XLSX.writeFile(wb, `Export_Demandes_${new Date().toISOString().split('T')[0]}.xlsx`);
        }

        // --- Gestion des statuts personnalisés ---
        function openStatutsModal() { renderStatutsList(); openCraModal('demandes-statuts-modal'); }

        function renderStatutsList() {
            const container = document.getElementById('statuts-list');
            container.innerHTML = demandesStatuts.map((s, i) => `
                <div class="flex items-center gap-3 p-2 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                    <input type="color" value="${s.color}" data-idx="${i}" class="statut-color-input w-6 h-6 rounded cursor-pointer border-0" style="background: transparent;">
                    <input type="text" value="${s.name}" data-idx="${i}" class="statut-name-input flex-1 rounded-lg px-2 py-1 text-sm outline-none" style="background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-primary);">
                    <label class="flex items-center gap-1 text-[10px] cursor-pointer" style="color: var(--text-muted);"><input type="checkbox" ${s.closed ? 'checked' : ''} data-idx="${i}" class="statut-closed-input"> Fermé</label>
                    <button onclick="removeStatut(${i})" class="p-1 rounded hover:bg-white/5" style="color: #f09a85;"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
            `).join('');
        }

        function addCustomStatut() {
            const input = document.getElementById('new-statut-input');
            const name = input.value.trim();
            if (!name) return;
            if (demandesStatuts.find(s => s.name.toLowerCase() === name.toLowerCase())) { showCustomAlert('Info', 'Ce statut existe déjà.'); return; }
            demandesStatuts.push({ name, closed: false, color: '#4A5568' });
            input.value = '';
            renderStatutsList();
        }

        function removeStatut(idx) {
            demandesStatuts.splice(idx, 1);
            renderStatutsList();
        }

        function saveCustomStatuts() {
            document.querySelectorAll('.statut-name-input').forEach(input => {
                const i = parseInt(input.dataset.idx);
                if (demandesStatuts[i]) demandesStatuts[i].name = input.value.trim();
            });
            document.querySelectorAll('.statut-color-input').forEach(input => {
                const i = parseInt(input.dataset.idx);
                if (demandesStatuts[i]) demandesStatuts[i].color = input.value;
            });
            document.querySelectorAll('.statut-closed-input').forEach(input => {
                const i = parseInt(input.dataset.idx);
                if (demandesStatuts[i]) demandesStatuts[i].closed = input.checked;
            });
            SafeStorage.set('cra_demandes_statuts', demandesStatuts);
            closeCraModal('demandes-statuts-modal');
            if (!document.getElementById('demandes-content').classList.contains('hidden')) initDemandesTab();
        }

        // ===== LOGIQUE FICHES CLIENTS =====
        let ficheTaskChartInstance = null;
        let ficheTimeChartInstance = null;

        function renderClientCardList() {
            const list = document.getElementById('client-card-list');
            const search = document.getElementById('search-client-card').value.toLowerCase();
            const clients = [...new Set(rawData.map(d => d.client))].sort();

            let html = '';
            clients.forEach(c => {
                if(c.toLowerCase().includes(search)) {
                    const isActive = c === currentSelectedClient;
                    const bg = isActive ? 'background: rgba(68,145,182,0.2); border-color: var(--accent-blue); color: #7ec8e3;' : 'background: var(--bg-surface); border-color: var(--border-subtle); color: var(--text-secondary); hover:border-color: var(--border-accent);';
                    html += `<button onclick="selectClientCard('${c.replace(/'/g, "\\'")}')" class="w-full text-left p-3 rounded-lg text-sm font-semibold transition-all border mb-2" style="${bg}">${c}</button>`;
                }
            });
            list.innerHTML = html;
        }

        function filterClientCards() { renderClientCardList(); }

        function buildBarRow(icon, label, count, total, color) {
            var pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
            return '<div class="flex items-center gap-2"><span class="text-xs">' + icon + '</span><span class="flex-1 text-xs font-medium" style="color: var(--text-secondary);">' + label + '</span><span class="text-xs font-mono font-bold" style="color:' + color + ';">' + count + '</span><div class="w-16 h-1.5 rounded-full" style="background: var(--border-subtle);"><div class="h-1.5 rounded-full" style="width:' + pct + '%;background:' + color + ';"></div></div><span class="text-[10px] font-mono" style="color: var(--text-muted);">' + pct + '%</span></div>';
        }

        function buildDotRow(label, count, total, color) {
            var pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
            return '<div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:' + color + ';"></span><span class="flex-1 text-xs font-medium" style="color: var(--text-secondary);">' + label + '</span><span class="text-xs font-mono font-bold" style="color:' + color + ';">' + count + '</span><div class="w-16 h-1.5 rounded-full" style="background: var(--border-subtle);"><div class="h-1.5 rounded-full" style="width:' + pct + '%;background:' + color + ';"></div></div><span class="text-[10px] font-mono" style="color: var(--text-muted);">' + pct + '%</span></div>';
        }

        function buildTicketsVentilationHtml(clientTickets, ticketTotal) {
            var sevColors = { 'blocking bug': {c:'#f09a85',icon:'🔴'}, 'major bug': {c:'#f0d46a',icon:'🟠'}, 'minor bug': {c:'#7ec8e3',icon:'🔵'}, 'evolution': {c:'#8ed4b0',icon:'🟢'}, 'enhancement': {c:'#8ed4b0',icon:'🟢'} };
            var prioColors = { 'p1': {c:'#E75B3C',icon:'🔴'}, 'p2': {c:'#f09a85',icon:'🟠'}, 'p3': {c:'#f0d46a',icon:'🟡'}, 'p4': {c:'#8ed4b0',icon:'🟢'} };
            var defStyle = {c:'#94a3b8',icon:'⚪'};

            var prioAgg = {}, sevAgg = {}, statAgg = {};
            clientTickets.forEach(function(t) { var p = t.priorite || 'Non défini'; prioAgg[p] = (prioAgg[p]||0)+1; });
            clientTickets.forEach(function(t) { var s = t.severite || 'Non défini'; sevAgg[s] = (sevAgg[s]||0)+1; });
            clientTickets.forEach(function(t) { statAgg[t.statut] = (statAgg[t.statut]||0)+1; });
            var closedCount = clientTickets.filter(function(t) { var s = demandesStatuts.find(function(x){ return x.name.toLowerCase() === (t.statut||'').toLowerCase(); }); return s ? s.closed : false; }).length;

            var prioHtml = Object.entries(prioAgg).sort(function(a,b){return a[0].localeCompare(b[0]);}).map(function(e) { var style = prioColors[e[0].toLowerCase()] || defStyle; return buildBarRow(style.icon, e[0], e[1], ticketTotal, style.c); }).join('');
            var sevHtml = Object.entries(sevAgg).sort(function(a,b){return b[1]-a[1];}).map(function(e) { var style = sevColors[e[0].toLowerCase()] || defStyle; return buildBarRow(style.icon, e[0], e[1], ticketTotal, style.c); }).join('');
            var statHtml = Object.entries(statAgg).sort(function(a,b){return b[1]-a[1];}).map(function(e) { var found = demandesStatuts.find(function(x){ return x.name.toLowerCase() === e[0].toLowerCase(); }); var color = found ? found.color : '#94a3b8'; return buildDotRow(e[0], e[1], ticketTotal, color); }).join('');

            return '<div class="mt-4 mb-6"><h3 class="text-sm font-bold mb-3 flex items-center gap-2" style="color: var(--text-primary);"><svg class="w-4 h-4" style="color: #f0d46a;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>Demandes & Tickets <span class="text-[10px] font-mono px-2 py-0.5 rounded" style="background:rgba(233,189,39,0.1);color:#f0d46a;border:1px solid rgba(233,189,39,0.2);">' + ticketTotal + ' ticket(s)</span> <span class="text-[10px] font-mono px-2 py-0.5 rounded" style="background:rgba(102,187,147,0.1);color:#8ed4b0;border:1px solid rgba(102,187,147,0.2);">' + closedCount + ' fermé(s)</span></h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-4"><div class="p-3 rounded-lg" style="background:var(--bg-surface);border:1px solid var(--border-subtle);"><h4 class="text-[10px] font-bold uppercase tracking-wider mb-2" style="color:var(--text-muted);">Par Priorité</h4><div class="space-y-1.5">' + prioHtml + '</div></div><div class="p-3 rounded-lg" style="background:var(--bg-surface);border:1px solid var(--border-subtle);"><h4 class="text-[10px] font-bold uppercase tracking-wider mb-2" style="color:var(--text-muted);">Par Sévérité</h4><div class="space-y-1.5">' + sevHtml + '</div></div><div class="p-3 rounded-lg" style="background:var(--bg-surface);border:1px solid var(--border-subtle);"><h4 class="text-[10px] font-bold uppercase tracking-wider mb-2" style="color:var(--text-muted);">Par Statut</h4><div class="space-y-1.5">' + statHtml + '</div></div></div></div>';
        }

        function buildSatisfactionHtml(clientName, currentSatisfaction) {
            var items = ['Satisfait','Neutre','Insatisfait'];
            var icons = {'Satisfait':'😊','Neutre':'😐','Insatisfait':'😟'};
            var colors = {'Satisfait':{bg:'rgba(102,187,147,0.15)',c:'#8ed4b0'},'Neutre':{bg:'rgba(233,189,39,0.15)',c:'#f0d46a'},'Insatisfait':{bg:'rgba(231,91,60,0.15)',c:'#f09a85'}};
            var escapedName = clientName.replace(/'/g, "\\'");
            return items.map(function(s) {
                var cs = colors[s];
                var sel = (currentSatisfaction === s);
                var style = sel ? 'background:'+cs.bg+';border-color:'+cs.c+';color:'+cs.c+';font-weight:700;' : 'background:var(--bg-card);border-color:var(--border-subtle);color:var(--text-muted);';
                return '<button onclick="saveClientSatisfaction(\'' + escapedName + '\',\'' + s + '\')" class="flex-1 py-2 rounded-lg text-xs border transition-all hover:scale-105 flex items-center justify-center gap-1" style="' + style + '">' + icons[s] + ' ' + s + '</button>';
            }).join('');
        }

        function buildStarsHtml(clientName, currentNote) {
            var escapedName = clientName.replace(/'/g, "\\'");
            var html = '';
            for (var i = 1; i <= 5; i++) {
                var filled = (i <= Math.round(currentNote));
                var color = filled ? '#f0d46a' : 'var(--border-accent)';
                html += '<span onclick="saveClientNote(\'' + escapedName + '\',' + i + ')" class="cursor-pointer text-lg transition-transform hover:scale-125" style="color:' + color + ';">' + (filled ? '★' : '☆') + '</span>';
            }
            return html;
        }

        function buildFicheTicketsSummary(clientName) {
            var tickets = demandesData.filter(function(d) { return d.client === clientName; });
            if (tickets.length === 0) return '<p class="text-xs" style="color: var(--text-muted);">Aucune demande importée.</p>';
            var prioAgg = {};
            tickets.forEach(function(t) { var p = t.priorite || 'Non défini'; prioAgg[p] = (prioAgg[p] || 0) + 1; });
            var sevAgg = {};
            tickets.forEach(function(t) { var s = t.severite || 'Non défini'; sevAgg[s] = (sevAgg[s] || 0) + 1; });
            var prioColors = { 'p1': '#E75B3C', 'p2': '#f09a85', 'p3': '#f0d46a', 'p4': '#8ed4b0' };
            var sevColors = { 'blocking bug': '#E75B3C', 'major bug': '#f0d46a', 'minor bug': '#7ec8e3', 'evolution': '#8ed4b0', 'enhancement': '#8ed4b0' };

            var html = '<div class="flex items-center gap-2 mb-2"><span class="text-xs font-mono font-bold" style="color: var(--text-primary);">' + tickets.length + '</span><span class="text-[10px]" style="color: var(--text-muted);">demande(s) au total</span></div>';
            html += '<div class="grid grid-cols-2 gap-2">';
            // Priorité
            html += '<div><p class="text-[9px] uppercase tracking-wider mb-1" style="color:var(--text-muted);">Priorité</p>';
            Object.entries(prioAgg).sort(function(a,b){return a[0].localeCompare(b[0]);}).forEach(function(e) {
                var c = prioColors[e[0].toLowerCase()] || '#94a3b8';
                html += '<div class="flex items-center gap-1.5 mb-0.5"><span class="w-1.5 h-1.5 rounded-full" style="background:' + c + ';"></span><span class="text-[10px]" style="color:var(--text-secondary);">' + e[0] + '</span><span class="text-[10px] font-mono font-bold" style="color:' + c + ';">' + e[1] + '</span></div>';
            });
            html += '</div>';
            // Sévérité
            html += '<div><p class="text-[9px] uppercase tracking-wider mb-1" style="color:var(--text-muted);">Sévérité</p>';
            Object.entries(sevAgg).sort(function(a,b){return b[1]-a[1];}).forEach(function(e) {
                var c = sevColors[e[0].toLowerCase()] || '#94a3b8';
                html += '<div class="flex items-center gap-1.5 mb-0.5"><span class="w-1.5 h-1.5 rounded-full" style="background:' + c + ';"></span><span class="text-[10px]" style="color:var(--text-secondary);">' + e[0] + '</span><span class="text-[10px] font-mono font-bold" style="color:' + c + ';">' + e[1] + '</span></div>';
            });
            html += '</div></div>';
            return html;
        }

        function saveClientNote(clientName, note) {
            if (!clientProfiles[clientName]) clientProfiles[clientName] = { contact: '', email: '', contrat: '', responsable: '' };
            clientProfiles[clientName].note = note;
            SafeStorage.set('cra_client_profiles', clientProfiles);
            selectClientCard(clientName);
        }

        function saveClientNps(clientName) {
            var val = parseInt(document.getElementById('fiche-nps-range').value);
            if (isNaN(val)) return;
            if (!clientProfiles[clientName]) clientProfiles[clientName] = { contact: '', email: '', contrat: '', responsable: '' };
            clientProfiles[clientName].nps = val;
            SafeStorage.set('cra_client_profiles', clientProfiles);
            // Update color without full re-render
            var el = document.getElementById('fiche-nps-val');
            if (el) el.style.color = val >= 9 ? '#8ed4b0' : (val >= 7 ? '#f0d46a' : '#f09a85');
        }

        function selectClientCard(clientName) {
            currentSelectedClient = clientName;
            renderClientCardList();
            
            if(!clientProfiles[clientName]) { clientProfiles[clientName] = { contact: '', email: '', contrat: '', responsable: '' }; }
            const p = clientProfiles[clientName];
            
            const clientData = getActiveData().filter(d => d.client === clientName);
            const totalJours = clientData.reduce((sum, d) => sum + d.jours, 0);
            const tjm = clientTjm[clientName] || 0;
            const totalCA = totalJours * tjm;
            
            const equipes = [...new Set(clientData.map(d => d.equipe))].join(', ') || 'N/A';
            const collabsCount = new Set(clientData.map(d => d.collaborateur)).size;
            
            const missions = [...new Set(clientData.map(d => d.mission))];
            let missionsHtml = '';
            missions.forEach(m => {
                const mData = clientData.filter(d => d.mission === m);
                const consumed = mData.reduce((sum, d) => sum + d.jours, 0);
                const allocated = missionBudgets[m] ? (missionBudgets[m].budget || 0) : 0;
                const rac = allocated - consumed;
                let racColor = rac < 0 ? '#E75B3C' : (rac === 0 ? '#64748b' : '#66BB93');
                
                missionsHtml += `<tr style="border-color: var(--border-subtle);">
                    <td class="px-3 py-2 text-xs font-medium" style="color: var(--text-primary);">${m}</td>
                    <td class="px-3 py-2 text-xs text-right font-mono text-gray-400">${allocated > 0 ? allocated.toFixed(2) : '-'}</td>
                    <td class="px-3 py-2 text-xs text-right font-mono" style="color: var(--text-secondary);">${consumed.toFixed(2)}</td>
                    <td class="px-3 py-2 text-xs text-right font-mono font-bold" style="color: ${racColor};">${allocated > 0 ? rac.toFixed(2) : '-'}</td>
                </tr>`;
            });
            if(!missionsHtml) missionsHtml = '<tr><td colspan="4" class="px-3 py-2 text-xs text-center" style="color: var(--text-muted);">Aucune mission.</td></tr>';

            // Ventilation demandes/tickets pour ce client
            const clientTickets = demandesData.filter(d => d.client === clientName);
            const ticketTotal = clientTickets.length;

            let ticketsHtml = '';
            if (ticketTotal > 0) {
                ticketsHtml = buildTicketsVentilationHtml(clientTickets, ticketTotal);
            }

            const detailEl = document.getElementById('client-card-detail');
            detailEl.innerHTML = `
                <div class="flex justify-between items-start mb-6 pb-4" style="border-bottom: 1px solid var(--border-subtle);">
                    <div>
                        <h2 class="text-2xl font-bold gradient-text">${clientName}</h2>
                        <p class="text-xs mt-1" style="color: var(--text-muted);">Fiche d'identité et indicateurs globaux sur la base complète</p>
                        <div class="mt-4">
                            <div class="text-2xl font-mono font-bold" style="color: #8ed4b0;">${totalCA.toLocaleString('fr-FR')} €</div>
                            <div class="text-[10px] uppercase tracking-widest mt-1" style="color: var(--text-muted);">CA Total Estimé</div>
                        </div>
                    </div>
                    
                    <div class="p-3 rounded-lg" style="background: rgba(68,145,182,0.1); border: 1px solid rgba(68,145,182,0.3); width: 260px;">
                        <h4 class="text-xs font-bold mb-2 flex items-center gap-1" style="color: #7ec8e3;">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                            Export PPTX (Ce client)
                        </h4>
                        <div class="flex flex-col gap-1.5 mb-3 text-[10px]" style="color: var(--text-secondary);">
                            <label class="flex items-center gap-1.5 cursor-pointer hover:text-white"><input type="checkbox" class="exp-fiche-cb w-3 h-3" value="infos" checked> Infos & Indicateurs</label>
                            <label class="flex items-center gap-1.5 cursor-pointer hover:text-white"><input type="checkbox" class="exp-fiche-cb w-3 h-3" value="missions" checked> Tableau des Missions</label>
                            <label class="flex items-center gap-1.5 cursor-pointer hover:text-white"><input type="checkbox" class="exp-fiche-cb w-3 h-3" value="chart-repartition" checked> Graphique Répartition</label>
                            <label class="flex items-center gap-1.5 cursor-pointer hover:text-white"><input type="checkbox" class="exp-fiche-cb w-3 h-3" value="chart-evolution" checked> Graphique Évolution</label>
                        </div>
                        <button onclick="exportFicheClientPPT('${clientName.replace(/'/g, "\\'")}')" id="btn-exp-fiche" class="w-full btn-gradient py-1.5 text-[10px]">Télécharger la fiche</button>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div class="space-y-4">
                        <h3 class="text-sm font-bold flex items-center gap-2" style="color: var(--accent-blue);">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                            Informations Commerciales
                        </h3>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style="color: var(--text-muted);">Contact Principal</label>
                            <input type="text" id="fiche-contact" value="${p.contact}" onchange="saveClientProfile('${clientName.replace(/'/g, "\\'")}')" placeholder="Nom du contact..." class="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary);" onfocus="this.style.borderColor='var(--accent-blue)'" onblur="this.style.borderColor='var(--border-subtle)'">
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style="color: var(--text-muted);">Email / Téléphone</label>
                            <input type="text" id="fiche-email" value="${p.email}" onchange="saveClientProfile('${clientName.replace(/'/g, "\\'")}')" placeholder="Coordonnées..." class="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary);" onfocus="this.style.borderColor='var(--accent-blue)'" onblur="this.style.borderColor='var(--border-subtle)'">
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style="color: var(--text-muted);">Référence Contrat</label>
                            <input type="text" id="fiche-contrat" value="${p.contrat}" onchange="saveClientProfile('${clientName.replace(/'/g, "\\'")}')" placeholder="N° de contrat, forfait..." class="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary);" onfocus="this.style.borderColor='var(--accent-blue)'" onblur="this.style.borderColor='var(--border-subtle)'">
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style="color: var(--text-muted);">Responsable Équipe (Interne)</label>
                            <input type="text" id="fiche-responsable" value="${p.responsable}" onchange="saveClientProfile('${clientName.replace(/'/g, "\\'")}')" placeholder="Manager, Chef de projet..." class="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary);" onfocus="this.style.borderColor='var(--accent-blue)'" onblur="this.style.borderColor='var(--border-subtle)'">
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <h3 class="text-sm font-bold flex items-center gap-2 mb-3" style="color: var(--accent-cyan);">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            Indicateurs Opérationnels
                        </h3>
                        
                        <div class="flex justify-between items-center p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                            <span class="text-xs font-semibold" style="color: var(--text-secondary);">TJM Actuel</span>
                            <div class="flex items-center gap-2">
                                <input type="number" min="0" step="1" id="fiche-tjm" value="${tjm}" onchange="saveClientTjm('${clientName.replace(/'/g, "\\'")}')" class="w-20 rounded-lg px-2 py-1 text-right text-sm font-mono outline-none transition-colors" style="background: var(--bg-card); border: 1px solid var(--border-subtle); color: #f0d46a;" onfocus="this.style.borderColor='var(--accent-blue)'" onblur="this.style.borderColor='var(--border-subtle)'">
                                <span class="text-xs" style="color: var(--text-muted);">€</span>
                            </div>
                        </div>
                        
                        <div class="flex justify-between items-center p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                            <span class="text-xs font-semibold" style="color: var(--text-secondary);">Jours Consommés Total</span>
                            <span class="text-sm font-mono font-bold" style="color: var(--text-primary);">${totalJours.toFixed(2)} jrs</span>
                        </div>
                        
                        <div class="flex justify-between items-center p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                            <span class="text-xs font-semibold" style="color: var(--text-secondary);">Équipes impliquées</span>
                            <span class="text-xs font-semibold" style="color: #8fc5df;">${equipes}</span>
                        </div>
                        
                        <div class="flex justify-between items-center p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                            <span class="text-xs font-semibold" style="color: var(--text-secondary);">Collaborateurs uniques</span>
                            <span class="text-sm font-mono font-bold" style="color: var(--text-primary);">${collabsCount}</span>
                        </div>
                        
                        <div class="p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider mb-2" style="color: var(--text-muted);">Satisfaction Client</label>
                            <div class="flex gap-2 mb-3">
                                ${buildSatisfactionHtml(clientName, p.satisfaction)}
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style="color: var(--text-muted);">Note /5</label>
                                    <div id="fiche-stars-container" class="flex gap-0.5">${buildStarsHtml(clientName, p.note || 0)}</div>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style="color: var(--text-muted);">NPS (0-10)</label>
                                    <div class="flex items-center gap-2">
                                        <input type="range" min="0" max="10" step="1" value="${p.nps != null ? p.nps : ''}" id="fiche-nps-range" oninput="document.getElementById('fiche-nps-val').innerText=this.value;saveClientNps('${clientName.replace(/'/g, "\\'")}')" class="flex-1 h-1.5 rounded-full appearance-none" style="background: var(--border-subtle); accent-color: #4491B6;">
                                        <span id="fiche-nps-val" class="text-sm font-mono font-bold w-6 text-center" style="color: ${(p.nps != null && p.nps >= 9) ? '#8ed4b0' : (p.nps != null && p.nps >= 7 ? '#f0d46a' : (p.nps != null ? '#f09a85' : 'var(--text-muted)'))}">${p.nps != null ? p.nps : '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider mb-2" style="color: var(--text-muted);">Demandes par criticité</label>
                            ${buildFicheTicketsSummary(clientName)}
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2 mb-6">
                    <div class="glass-card-light p-4">
                        <h4 class="text-xs font-bold mb-2" style="color: var(--text-primary);">Répartition par tâche</h4>
                        <div class="chart-container" style="height:220px;"><canvas id="fiche-chart-task"></canvas></div>
                    </div>
                    <div class="glass-card-light p-4">
                        <h4 class="text-xs font-bold mb-2" style="color: var(--text-primary);">Évolution des jours</h4>
                        <div class="chart-container" style="height:220px;"><canvas id="fiche-chart-time"></canvas></div>
                    </div>
                </div>
                
                ${ticketsHtml}
                
                <div class="mt-auto pt-4" style="border-top: 1px solid var(--border-subtle);">
                    <h3 class="text-sm font-bold mb-3 flex justify-between items-center" style="color: var(--text-primary);">
                        Missions & Budgets (Global)
                        <button onclick="openBudgetModal()" class="text-xs flex items-center gap-1 transition" style="color: #8fc5df;">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Gérer
                        </button>
                    </h3>
                    <div class="overflow-x-auto rounded-lg" style="border: 1px solid var(--border-subtle);">
                        <table class="min-w-full text-left text-xs">
                            <thead style="background: rgba(30, 41, 59, 0.5); border-bottom: 1px solid var(--border-subtle);">
                                <tr>
                                    <th class="px-3 py-2 font-semibold text-gray-400">Mission</th>
                                    <th class="px-3 py-2 font-semibold text-gray-400 text-right">Alloués</th>
                                    <th class="px-3 py-2 font-semibold text-gray-400 text-right">Consommés</th>
                                    <th class="px-3 py-2 font-semibold text-gray-400 text-right">RAC</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y" style="background: var(--bg-surface); border-color: var(--border-subtle);">
                                ${missionsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            // Génération des graphiques après injection HTML
            renderFicheCharts(clientData);
        }

        // --- NOUVEAU : Fonction pour générer les graphiques de la fiche client ---
        function renderFicheCharts(clientData) {
            if(ficheTaskChartInstance) ficheTaskChartInstance.destroy();
            if(ficheTimeChartInstance) ficheTimeChartInstance.destroy();
            if(!clientData || clientData.length === 0) return;

            const bgColors = ['#1B3B5C', '#5EB091', '#2A517A', '#4A9076', '#3B82F6', '#D97706', '#DC2626'];

            // Tâches
            const taskStats = clientData.reduce((a, r) => { a[r.tache] = (a[r.tache]||0)+r.jours; return a; }, {});
            const taskLabels = Object.keys(taskStats);
            const taskValues = Object.values(taskStats);
            const ctxTask = document.getElementById('fiche-chart-task').getContext('2d');
            ficheTaskChartInstance = new Chart(ctxTask, {
                type: 'doughnut',
                data: { labels: taskLabels, datasets: [{ data: taskValues, backgroundColor: bgColors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#4A5568', font: { size: 10 } } } }, animation: false } // animation:false est crucial pour l'export Base64 immédiat
            });

            // Evolution
            const timeStats = {};
            clientData.forEach(r => {
                if(r.sortDate !== "0000-00") {
                    if(!timeStats[r.sortDate]) timeStats[r.sortDate] = { label: r.moisAnnee, jours: 0 };
                    timeStats[r.sortDate].jours += r.jours;
                }
            });
            const sortedDates = Object.keys(timeStats).sort();
            const timeLabels = sortedDates.map(k => timeStats[k].label);
            const timeValues = sortedDates.map(k => timeStats[k].jours);
            const ctxTime = document.getElementById('fiche-chart-time').getContext('2d');
            ficheTimeChartInstance = new Chart(ctxTime, {
                type: 'bar',
                data: { labels: timeLabels, datasets: [{ label: 'Jours consommés', data: timeValues, backgroundColor: '#66BB93', borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 } } }, x: { grid: { color: '#E2E8F0' }, ticks: { color: '#4A5568', font: { size: 10 } } } }, animation: false }
            });
        }

        function saveClientProfile(clientName) {
            clientProfiles[clientName] = {
                contact: document.getElementById('fiche-contact').value,
                email: document.getElementById('fiche-email').value,
                contrat: document.getElementById('fiche-contrat').value,
                responsable: document.getElementById('fiche-responsable').value
            };
            SafeStorage.set('cra_client_profiles', clientProfiles);
        }

        function saveClientTjm(clientName) {
            const val = parseFloat(document.getElementById('fiche-tjm').value) || 0;
            clientTjm[clientName] = val;
            SafeStorage.set('cra_tjm', clientTjm);
            selectClientCard(clientName);
            updateDashboard();
        }

        function saveClientSatisfaction(clientName, satisfaction) {
            if (!clientProfiles[clientName]) clientProfiles[clientName] = { contact: '', email: '', contrat: '', responsable: '' };
            clientProfiles[clientName].satisfaction = satisfaction;
            SafeStorage.set('cra_client_profiles', clientProfiles);
            selectClientCard(clientName);
        }

        // ===== 4. MULTI-SOURCE DATA MANAGEMENT =====
        let dataSources = SafeStorage.get('cra_data_sources') || {}; 
        
        // GLOBAL: Rendre rawData accessible au Facturator et au reste du code
        if (typeof window.rawData === 'undefined') {
            window.rawData = [];
        }
        let rawData = window.rawData, filteredData = [];
        let currentWorkingDaysInPeriod = 1;
        let clientChartInstance = null, collabChartInstance = null, timeChartInstance = null, taskChartInstance = null, caChartInstance = null, commentChartInstance = null;
        let clientTjm = SafeStorage.get('cra_tjm') || {};
        let missionBudgets = SafeStorage.get('cra_budgets') || {};

        Object.keys(missionBudgets).forEach(k => {
            if (typeof missionBudgets[k] !== 'object' || missionBudgets[k] === null) { missionBudgets[k] = { budget: parseFloat(missionBudgets[k]) || 0, closed: false }; }
        });

        // SÉCURITÉ : la clé API est désormais saisie par l'utilisateur via la page Configuration
        // et stockée localement dans le navigateur (jamais dans le code source).
        const apiKey = (typeof getGeminiApiKey === 'function' ? getGeminiApiKey() : (localStorage.getItem('cyrias_gemini_key') || ''));
        let tsAnnee, tsSemestre, tsTrimestre, tsMois, tsEquipe, tsClient, tsMission, tsCollab, tsSource;
        let tomSelectsInitialized = false;

        let racSort = { col: 'm', asc: true };
        let prodSort = { col: 'c', asc: true };
        let currentRacData = [];
        let currentProdData = [];

        const sourceColors = ['source-0', 'source-1', 'source-2', 'source-3', 'source-4', 'source-5'];

        function generateSourceId() { return 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

        function rebuildRawData() {
            rawData = [];
            Object.values(dataSources).forEach(src => {
                if(src.data) rawData = rawData.concat(src.data);
            });
            // SYNC: Mettre à jour la version globale
            window.rawData = rawData;
        }

        function getActiveData() { return rawData.filter(d => { const mb = missionBudgets[d.mission]; return !(mb && mb.closed === true); }); }

        function renderSourceChips() {
            const container = document.getElementById('source-chips');
            const managerEl = document.getElementById('source-manager');
            const keys = Object.keys(dataSources);

            if (keys.length === 0) {
                managerEl.classList.add('hidden');
                return;
            }

            managerEl.classList.remove('hidden');
            document.getElementById('source-count').textContent = keys.length;
            document.getElementById('total-records-count').textContent = rawData.length;

            container.innerHTML = keys.map((id, i) => {
                const src = dataSources[id];
                const colorClass = sourceColors[i % sourceColors.length];
                return `<span class="source-chip ${colorClass}">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    ${src.name} <span class="font-mono text-[10px] opacity-60">(${src.data.length})</span>
                    <span class="remove-btn" onclick="removeSource('${id}')" title="Supprimer cette source">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </span>
                </span>`;
            }).join('');
        }

        function removeSource(id) {
            if (!confirm(`Supprimer la source "${dataSources[id]?.name}" ?`)) return;
            delete dataSources[id];
            SafeStorage.set('cra_data_sources', dataSources);
            rebuildRawData();
            renderSourceChips();

            if (Object.keys(dataSources).length === 0) {
                document.getElementById('dashboard-section').classList.add('hidden');
                document.getElementById('drop-zone').classList.remove('hidden');
            } else {
                populateFilters();
                updateDashboard();
            }
        }

function clearAllData() {
    if (!confirm("Supprimer toutes les sources de données CRA ?\n(Vos tickets et suivis seront conservés)")) return;
    dataSources = {};
    rawData = [];
    SafeStorage.remove('cra_data_sources');
    renderSourceChips();
    
    // On réaffiche la zone d'import puisqu'il n'y a plus de CRA
    document.getElementById('drop-zone').classList.remove('hidden');

    if ((!demandesData || demandesData.length === 0) && (!suiviComments || suiviComments.length === 0)) {
        // S'il n'y a vraiment plus RIEN, on cache carrément tout le dashboard
        document.getElementById('dashboard-section').classList.add('hidden');
    } else {
        // Sinon on bascule sur un onglet qui a encore des données
        if (demandesData && demandesData.length > 0) switchCraTab('demandes');
        else switchCraTab('suivi');
    }
}

        // ===== 5. FILE HANDLING (MULTI) =====
        function handleMultiFiles(e) {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            document.getElementById('upload-progress-container').classList.remove('hidden');
            processFileQueue(files, 0);
        }

        function processFileQueue(files, index) {
            if (index >= files.length) {
                document.getElementById('upload-progress-container').classList.add('hidden');
                rebuildRawData();
                SafeStorage.set('cra_data_sources', dataSources);
                renderSourceChips();
                showDashboard();
                return;
            }

            const file = files[index];
            const pct = Math.round(((index) / files.length) * 100);
            setProgress(pct);

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    if(typeof XLSX === 'undefined') throw new Error("SheetJS introuvable.");
                    const workbook = XLSX.read(new Uint8Array(evt.target.result), {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

                    const sourceId = generateSourceId();
                    const parsed = parseDataArray(json, file.name);

                    if (parsed.length > 0) {
                        dataSources[sourceId] = {
                            name: file.name.replace(/\.[^/.]+$/, ""),
                            data: parsed,
                            addedAt: Date.now()
                        };
                    }
                } catch(err) {
                    console.error("Erreur fichier " + file.name, err);
                }

                setProgress(Math.round(((index + 1) / files.length) * 100));
                setTimeout(() => processFileQueue(files, index + 1), 50);
            };
            reader.readAsArrayBuffer(file);
        }

        function setProgress(p) {
            document.getElementById('upload-progress-bar').style.width = p+'%';
            document.getElementById('upload-progress-text').innerText = p+'%';
        }

        function parseDataArray(json, sourceName) {
            if (!json || json.length === 0) return [];

            const getRawVal = (row, names) => {
                const k = Object.keys(row);
                for(let n of names){
                    const m = k.find(x => String(x).trim().toLowerCase() === n);
                    if(m && row[m] !== undefined && row[m] !== null && row[m] !== "") return row[m];
                }
                return null;
            };

            const parseTime = (val) => {
                if(val === null || val === undefined || val === "") return 0;
                if(typeof val === 'number') return val;
                try { return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0; } catch(e) { return 0; }
            };

            const parsedData = [];
            json.forEach(row => {
                try {
                    const j1 = parseTime(getRawVal(row, ['fractions', 'fraction']));
                    const j2 = parseTime(getRawVal(row, ['jours', 'jour', 'temps', 'valeur', 'quantité']));
                    const j = j1 > 0 ? j1 : j2;
                    if (j <= 0) return;

                    let jsDate = null, annee = "N/A", sem = "N/A", trim = "N/A", mois = "N/A", sort = "0000-00";
                    let rawDate = getRawVal(row, ['date', 'jour', 'date de réalisation']);

                    try {
                        if (rawDate instanceof Date) { jsDate = rawDate; }
                        else if (typeof rawDate === 'number') { jsDate = new Date((new Date(1899, 11, 30)).getTime() + rawDate * 86400000); }
                        else if (typeof rawDate === 'string') {
                            if (rawDate.includes('/')) {
                                const p = rawDate.split('/');
                                if(p.length>=3) jsDate = new Date(p[2].substring(0,4), parseInt(p[1])-1, p[0]);
                            } else if (rawDate.includes('-')) { jsDate = new Date(rawDate); }
                        }
                    } catch(e) {}

                    if (jsDate && !isNaN(jsDate.getTime())) {
                        const m = jsDate.getMonth() + 1, y = jsDate.getFullYear();
                        annee = `${y}`; sem = `S${m <= 6 ? 1 : 2} ${y}`; trim = `T${Math.ceil(m / 3)} ${y}`;
                        mois = `${String(m).padStart(2, '0')}/${y}`; sort = `${y}-${String(m).padStart(2, '0')}`;
                    }

                    parsedData.push({
                        equipe: String(getRawVal(row, ['equipe (equipe mission)', 'equipe', 'team', 'équipe']) || "N/A").trim(),
                        client: String(getRawVal(row, ['client', 'project', 'projet', 'affaire', 'customer', 'compte', 'account', 'société', 'societe', 'entité', 'entite']) || "N/A").trim(),
                        collaborateur: String(getRawVal(row, ['collaborateur', 'consultant', 'salarié', 'salarie', 'ressource', 'utilisateur', 'employee', 'employé', 'employe', 'nom']) || "N/A").trim(),
                        mission: String(getRawVal(row, ['mission', 'projet', 'project', 'enveloppe', 'phase', 'lot']) || "N/A").trim(),
                        jours: j,
                        tache: String(getRawVal(row, ['tâche', 'tache', 'libellé', 'libelle', 'task', 'activité', 'activite']) || "").trim(),
                        commentaire: String(getRawVal(row, ['commentaires des temps réalisés', 'commentaire', 'commentaires', 'comment', 'note', 'description']) || "").trim(),
                        annee, semestre: sem, trimestre: trim, moisAnnee: mois, sortDate: sort,
                        rawDateObj: jsDate ? jsDate.getTime() : null,
                        _source: sourceName || "Inconnu"
                    });
                } catch(e) { console.error("Ligne ignorée:", e); }
            });

            return parsedData;
        }

        function showDashboard() {
            document.getElementById('drop-zone').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            switchCraTab('dashboard');
            applyDisplayConfig();
            // Activer la page CRAminator dans le portail
            
            // Initialiser et dessiner (page déjà display:block grâce au CSS)
            initTomSelects();
            syncTjmWithData();
            syncBudgetsWithData();
            populateFilters();
            // Léger délai pour que le layout se stabilise
            setTimeout(updateDashboard, 30);
        }

   function checkLocalData() {
    const hasCRA = Object.keys(dataSources).length > 0;
    const hasDemandes = demandesData && demandesData.length > 0;
    const hasSuivi = suiviComments && suiviComments.length > 0;

    if (hasCRA || hasDemandes || hasSuivi) {
        document.getElementById('dashboard-section').classList.remove('hidden');

        if (hasCRA) {
            document.getElementById('drop-zone').classList.add('hidden');
            rebuildRawData();
            renderSourceChips();
            showDashboard(); 
        } else {
            // Pas de CRA ? On réaffiche impérativement la zone d'import
            document.getElementById('drop-zone').classList.remove('hidden');
            applyDisplayConfig();
            if (hasDemandes) switchCraTab('demandes');
            else switchCraTab('suivi');
        }
    } else {
        // Rien du tout en mémoire
        document.getElementById('drop-zone').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }
}  
        function triggerUrlLoad() { loadFromUrl(document.getElementById('url-input').value); }

        async function loadFromUrl(url) {
            if (!url || !url.trim()) return;
            document.getElementById('url-loader').classList.remove('hidden');
            document.getElementById('url-btn-text').textContent = '...';

            try {
                let fetchUrl = url;
                const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) fetchUrl = `https://corsproxy.io/?${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${match[1]}`)}`;
                else if (!url.startsWith(window.location.origin)) fetchUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

                const response = await fetch(fetchUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), {type: 'array'});
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

                const sourceId = generateSourceId();
                const parsed = parseDataArray(json, "Google Sheet");
                if (parsed.length > 0) {
                    dataSources[sourceId] = { name: "Google Sheet", data: parsed, addedAt: Date.now() };
                    rebuildRawData();
                    SafeStorage.set('cra_data_sources', dataSources);
                    renderSourceChips();
                    showDashboard();
                } else {
                    showError("Aucune donnée valide trouvée dans le fichier.");
                }
            } catch (error) {
                showError("Échec du téléchargement : " + error.message);
            } finally {
                document.getElementById('url-loader').classList.add('hidden');
                document.getElementById('url-btn-text').textContent = 'Connecter';
            }
        }

        function downloadTemplate() {
            const ws = XLSX.utils.aoa_to_sheet([
                ["Date", "Collaborateur", "Equipe", "Client", "Mission", "Tâche", "Jours", "Commentaire"],
                ["01/04/2025", "Jean Dupont", "Dev", "ClientA", "Projet X", "Développement", 1, "Sprint 1"],
                ["02/04/2025", "Marie Martin", "UX", "ClientB", "Projet Y", "Design", 0.5, "Maquettes"]
            ]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "CRA");
            XLSX.writeFile(wb, "Modele_CRA.xlsx");
        }

        // ===== 6. DRAG & DROP =====
        const dropZone = document.getElementById('drop-zone');
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); dropZone.classList.remove('drag-over');
            if(e.dataTransfer.files.length) {
                handleMultiFiles({ target: { files: e.dataTransfer.files } });
            }
        });

        // ===== 7. TOM SELECTS =====
        function initTomSelects() {
            if (tomSelectsInitialized || typeof TomSelect === 'undefined') return;
            const config = { plugins: ['remove_button'], maxItems: null, hideSelected: true };
            tsAnnee = new TomSelect('#filter-annee', config);
            tsSemestre = new TomSelect('#filter-semestre', config);
            tsTrimestre = new TomSelect('#filter-trimestre', config);
            tsMois = new TomSelect('#filter-mois', config);
            tsEquipe = new TomSelect('#filter-equipe', config);
            tsClient = new TomSelect('#filter-client', config);
            tsMission = new TomSelect('#filter-mission', config);
            tsCollab = new TomSelect('#filter-collab', config);
            tsSource = new TomSelect('#filter-source', config);

            const onChange = () => { updateDashboard(); updateFilterBadge(); };
            const onTimeChange = () => { updateTimeDropdowns(); updateOperationalDropdowns(); onChange(); };
            const onOperationalChange = () => { updateOperationalDropdowns(); onChange(); };
            tsAnnee.on('change', onTimeChange); tsSemestre.on('change', onTimeChange); tsTrimestre.on('change', onTimeChange); tsMois.on('change', () => { updateOperationalDropdowns(); onChange(); });
            tsEquipe.on('change', onOperationalChange); 
            tsClient.on('change', onOperationalChange); 
            tsMission.on('change', onOperationalChange); 
            tsCollab.on('change', onChange); 
            tsSource.on('change', () => { updateOperationalDropdowns(); onChange(); });
            tomSelectsInitialized = true;
        }

        function syncTS(tsInstance, newOptions, currentSelectedVals) {
            tsInstance.clearOptions();
            newOptions.forEach(opt => tsInstance.addOption({value: opt, text: opt}));
            tsInstance.setValue(currentSelectedVals.filter(v => newOptions.includes(v)), true);
        }

        function updateTimeDropdowns() {
            const vA = tsAnnee.getValue(), vS = tsSemestre.getValue(), vT = tsTrimestre.getValue(), vM = tsMois.getValue();
            let dS = getActiveData(); if(vA.length > 0) dS = dS.filter(d => vA.includes(d.annee));
            const aS = [...new Set(dS.map(d => d.semestre))].filter(v=>v!=="N/A").sort();
            let dT = dS; const actS = vS.filter(v => aS.includes(v)); if(actS.length > 0) dT = dT.filter(d => actS.includes(d.semestre));
            const aT = [...new Set(dT.map(d => d.trimestre))].filter(v=>v!=="N/A").sort();
            let dM = dT; const actT = vT.filter(v => aT.includes(v)); if(actT.length > 0) dM = dM.filter(d => actT.includes(d.trimestre));
            const aM = Array.from(new Map(dM.filter(d=>d.moisAnnee!=="N/A").map(d=>[d.moisAnnee,d.sortDate])).entries()).sort((a,b)=>b[1].localeCompare(a[1])).map(e=>e[0]);
            syncTS(tsSemestre, aS, vS); syncTS(tsTrimestre, aT, vT); syncTS(tsMois, aM, vM);
        }

        let _updatingOperational = false;
        function updateOperationalDropdowns() {
            if (_updatingOperational) return;
            _updatingOperational = true;
            try {
                const act = getActiveData();

                const fA = tsAnnee.getValue(), fS = tsSemestre.getValue(), fT = tsTrimestre.getValue(), fM = tsMois.getValue();
                const fSrc = tsSource.getValue();
                let base = act.filter(d =>
                    (fA.length===0||fA.includes(d.annee)) && (fS.length===0||fS.includes(d.semestre)) &&
                    (fT.length===0||fT.includes(d.trimestre)) && (fM.length===0||fM.includes(d.moisAnnee)) &&
                    (fSrc.length===0||fSrc.includes(d._source))
                );

                const allEquipes = [...new Set(base.map(d => d.equipe))].sort();
                syncTS(tsEquipe, allEquipes, tsEquipe.getValue());

                const fE = tsEquipe.getValue();
                let afterEquipe = base;
                if (fE.length > 0) afterEquipe = afterEquipe.filter(d => fE.includes(d.equipe));

                const availClients = [...new Set(afterEquipe.map(d => d.client))].sort();
                syncTS(tsClient, availClients, tsClient.getValue());

                const fC = tsClient.getValue();
                let afterClient = afterEquipe;
                if (fC.length > 0) afterClient = afterClient.filter(d => fC.includes(d.client));

                const availMissions = [...new Set(afterClient.map(d => d.mission))].sort();
                syncTS(tsMission, availMissions, tsMission.getValue());

                const fMi = tsMission.getValue();
                let afterMission = afterClient;
                if (fMi.length > 0) afterMission = afterMission.filter(d => fMi.includes(d.mission));

                const availCollabs = [...new Set(afterMission.map(d => d.collaborateur))].sort();
                syncTS(tsCollab, availCollabs, tsCollab.getValue());
            } finally {
                _updatingOperational = false;
            }
        }

        function populateFilters() {
            const act = getActiveData();
            syncTS(tsAnnee, [...new Set(act.map(d => d.annee))].filter(v=>v!=="N/A").sort(), tsAnnee.getValue());
            updateTimeDropdowns();
            const sourceNames = [...new Set(act.map(d => d._source))].sort();
            syncTS(tsSource, sourceNames, tsSource.getValue());
            updateOperationalDropdowns();
        }

        function resetFilters() {
            tsAnnee.clear(true); tsSemestre.clear(true); tsTrimestre.clear(true); tsMois.clear(true);
            tsEquipe.clear(true); tsClient.clear(true); tsMission.clear(true); tsCollab.clear(true); tsSource.clear(true);
            updateTimeDropdowns(); updateOperationalDropdowns(); updateDashboard(); updateFilterBadge();
        }

        // ===== 8. TJM & BUDGETS =====
        function syncTjmWithData() { [...new Set(rawData.map(d=>d.client))].forEach(c=>{ if(clientTjm[c]===undefined) clientTjm[c]=0; }); SafeStorage.set('cra_tjm', clientTjm); }
        function openTjmModal() {
            const c=document.getElementById('tjm-list-container'); c.innerHTML='';
            document.getElementById('search-tjm').value = '';
            Object.keys(clientTjm).sort().forEach(k => {
                c.innerHTML += `<div class="flex justify-between items-center mb-3 p-3 rounded-lg" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"><label class="w-3/5 truncate text-sm" style="color: var(--text-secondary);">${k}</label><div class="flex items-center w-2/5 justify-end"><input type="number" data-client="${k}" value="${clientTjm[k]}" class="tjm-input w-24 rounded-lg px-2 py-1 text-right text-sm outline-none" style="background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-primary);"> <span class="ml-2 text-xs" style="color: var(--text-muted);">€</span></div></div>`;
            });
            openCraModal('tjm-modal');
        }
        function saveTjmFromModal() { document.querySelectorAll('.tjm-input').forEach(i => clientTjm[i.getAttribute('data-client')] = parseFloat(i.value)||0); SafeStorage.set('cra_tjm', clientTjm); closeCraModal('tjm-modal'); updateDashboard(); if(currentSelectedClient) selectClientCard(currentSelectedClient); }

        function syncBudgetsWithData() { let u=false; [...new Set(rawData.map(d=>d.mission))].forEach(m=>{ if(missionBudgets[m]===undefined) { missionBudgets[m]={budget:0,closed:false}; u=true; } }); if(u) SafeStorage.set('cra_budgets', missionBudgets); }
        function openBudgetModal() {
            const c=document.getElementById('budget-list-container'); c.innerHTML='';
            document.getElementById('search-budget').value = '';
            Object.keys(missionBudgets).sort().forEach(k => {
                const mb=missionBudgets[k]||{budget:0,closed:false};
                c.innerHTML += `<div class="mission-budget-row flex justify-between items-center mb-3 p-3 rounded-lg ${mb.closed?'opacity-40':''}" style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"><label class="w-1/2 truncate font-semibold text-xs" style="color: var(--text-secondary);">${k}</label><div class="flex items-center w-1/2 justify-end gap-3"><label class="flex items-center text-xs" style="color: var(--text-muted);"><input type="checkbox" class="budget-status mr-1.5 h-4 w-4" ${mb.closed?'checked':''} onchange="this.closest('.mission-budget-row').classList.toggle('opacity-40');"> Fermé</label><input type="number" min="0" step="0.5" data-mission="${k}" value="${mb.budget}" class="budget-input w-20 rounded-lg px-2 py-1 text-right text-sm outline-none" style="background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-primary);"></div></div>`;
            });
            openCraModal('budget-modal');
        }
        function saveBudgetFromModal() { document.querySelectorAll('.mission-budget-row').forEach(r => { const i=r.querySelector('.budget-input'), cb=r.querySelector('.budget-status'); if(i && cb) missionBudgets[i.getAttribute('data-mission')] = {budget:parseFloat(i.value)||0, closed:cb.checked}; }); SafeStorage.set('cra_budgets', missionBudgets); closeCraModal('budget-modal'); populateFilters(); updateDashboard(); if(currentSelectedClient) selectClientCard(currentSelectedClient); }

        // ===== 9. WORKING DAYS =====
        function getWorkingDays(startDate, endDate) {
            let count = 0; let curDate = new Date(startDate.getTime()); curDate.setHours(0,0,0,0);
            let endD = new Date(endDate.getTime()); endD.setHours(0,0,0,0);
            while (curDate <= endD) { const dow = curDate.getDay(); if (dow !== 0 && dow !== 6) count++; curDate.setDate(curDate.getDate() + 1); }
            return count;
        }

        // ===== 10. CHARTS & DASHBOARD =====
        Chart.defaults.color = '#4A5568';
        Chart.defaults.borderColor = '#E2E8F0';
        Chart.defaults.font.family = "'Outfit', sans-serif";

        function updateDashboard() {
            // Guard: TomSelect doit être initialisé
            if (!tomSelectsInitialized || !tsAnnee) return;
            const fA = tsAnnee.getValue(), fS = tsSemestre.getValue(), fT = tsTrimestre.getValue(), fM = tsMois.getValue();
            const fE = tsEquipe.getValue(), fC = tsClient.getValue(), fMi = tsMission.getValue(), fCo = tsCollab.getValue();
            const fSrc = tsSource.getValue();

            const activeData = getActiveData();

            let timeFilteredData = activeData.filter(d =>
                (fA.length===0||fA.includes(d.annee)) && (fS.length===0||fS.includes(d.semestre)) &&
                (fT.length===0||fT.includes(d.trimestre)) && (fM.length===0||fM.includes(d.moisAnnee))
            );

            const timeDates = timeFilteredData.map(d=>d.rawDateObj).filter(t=>t!=null && !isNaN(t));
            currentWorkingDaysInPeriod = 1;
            if(timeDates.length > 0) {
                let minD = new Date(Math.min(...timeDates)), maxD = new Date(Math.max(...timeDates));
                minD = new Date(minD.getFullYear(), minD.getMonth(), 1); maxD = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
                currentWorkingDaysInPeriod = getWorkingDays(minD, maxD) || 1;
            }

            filteredData = timeFilteredData.filter(d =>
                (fE.length===0||fE.includes(d.equipe)) && (fC.length===0||fC.includes(d.client)) &&
                (fMi.length===0||fMi.includes(d.mission)) && (fCo.length===0||fCo.includes(d.collaborateur)) &&
                (fSrc.length===0||fSrc.includes(d._source))
            );

            document.getElementById('record-count').innerText = `${filteredData.length} lignes`;
            const tCa = filteredData.reduce((a, r) => a + (r.jours*(clientTjm[r.client]||0)), 0);
            const caEl = document.getElementById('total-ca');
            caEl.innerText = `CA: ${tCa.toLocaleString('fr-FR')} €`; caEl.classList.toggle('hidden', tCa===0);

            const agg = (k) => Object.entries(filteredData.reduce((a, r)=>{if(!a[r[k]])a[r[k]]={j:0,c:0}; a[r[k]].j+=r.jours; a[r[k]].c+=r.jours*(clientTjm[r.client]||0); return a;},{})).map(([n,v])=>({name:n,value:v.j,ca:v.c})).sort((a,b)=>b.value-a.value);

            const bgColors = ['#19365D', '#66BB93', '#4491B6', '#2E678D', '#5AA2C7', '#E9BD27', '#E75B3C', '#387BA1', '#20456C', '#10A2C8'];

            const drawChart = (id, data, type, horiz, isCurrency, clickCb) => {
                if(typeof Chart === 'undefined') return;
                const ctx = document.getElementById(id).getContext('2d');
                if(id==='clientChart'&&clientChartInstance)clientChartInstance.destroy();
                if(id==='collabChart'&&collabChartInstance)collabChartInstance.destroy();
                if(id==='caChart'&&caChartInstance)caChartInstance.destroy();
                const c = new Chart(ctx, {
                    type, data: { labels: data.map(d=>d.name), datasets: [{ data: data.map(d=>isCurrency ? d.ca : d.value), backgroundColor: horiz ? bgColors : bgColors.map((c,i) => data[i] ? c : '#333'), borderRadius: 6, borderWidth: 0 }] },
                    options: { indexAxis: horiz?'y':'x', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
                        scales: { x: { display: !horiz, grid: { color: '#E2E8F0' } }, y: { display: horiz, grid: { color: '#E2E8F0' } } },
                        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
                        onClick: (e, els) => { if(els.length > 0 && clickCb) clickCb(data[els[0].index].name); }
                    }
                });
                if(id==='clientChart')clientChartInstance=c; else if(id==='collabChart')collabChartInstance=c; else caChartInstance=c;
            };

            drawChart('clientChart', agg('client'), 'bar', false, false, (l)=>{ openCraModal('filters-modal'); tsClient.setValue([l]); updateDashboard(); updateFilterBadge(); });
            drawChart('collabChart', agg('collaborateur'), 'bar', true, false, (l)=>{ openCraModal('filters-modal'); tsCollab.setValue([l]); updateDashboard(); updateFilterBadge(); });
            drawChart('caChart', agg('client').sort((a,b)=>b.ca-a.ca), 'bar', true, true, (l)=>{ openCraModal('filters-modal'); tsClient.setValue([l]); updateDashboard(); updateFilterBadge(); });

            if(typeof Chart !== 'undefined' && document.getElementById('taskChart')) {
                if(taskChartInstance) taskChartInstance.destroy();
                const taskData = agg('tache');
                taskChartInstance = new Chart(document.getElementById('taskChart').getContext('2d'), {
                    type: 'doughnut', data: { labels: taskData.map(d=>d.name), datasets: [{ data: taskData.map(d=>d.value), backgroundColor: bgColors, borderWidth: 0 }] },
                    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right', labels: { boxWidth: 10, font: { size: 10 } }}} }
                });
            }

            if(typeof Chart !== 'undefined' && document.getElementById('timeChart')) {
                const allDatesSet = new Set(); const dateToLabel = {};
                filteredData.forEach(r => { if(r.sortDate !== "0000-00") { allDatesSet.add(r.sortDate); dateToLabel[r.sortDate] = r.moisAnnee; } });
                const sortedDates = Array.from(allDatesSet).sort(); const lbl = sortedDates.map(d => dateToLabel[d]);
                const clientData = {};
                filteredData.forEach(r => {
                    if(r.sortDate !== "0000-00") {
                        if(!clientData[r.client]) clientData[r.client] = {};
                        if(!clientData[r.client][r.sortDate]) clientData[r.client][r.sortDate] = 0;
                        clientData[r.client][r.sortDate] += r.jours;
                    }
                });
                const datasets = Object.keys(clientData).sort().map((clientName, index) => {
                    const color = bgColors[index % bgColors.length];
                    return { label: clientName, data: sortedDates.map(d => clientData[clientName][d] || 0), borderColor: color, backgroundColor: color+'20', fill: false, tension: 0.4, borderWidth: 2, pointRadius: 2 };
                });
                if(timeChartInstance) timeChartInstance.destroy();
                timeChartInstance = new Chart(document.getElementById('timeChart').getContext('2d'), {
                    type: 'line', data: { labels: lbl, datasets },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { y: { beginAtZero: true, grid: { color: '#E2E8F0' } }, x: { grid: { color: '#E2E8F0' } } } }
                });
            }

            renderHeatmap();
            generateTableData();
            renderRacTable();
            renderProdTable();
            renderCommentChart();
            if(!document.getElementById('explorer-content').classList.contains('hidden')) renderExplorerTable();
        }

        function renderHeatmap() {
            const container = document.getElementById('heatmap-container');
            if(filteredData.length === 0) { container.innerHTML = '<p class="text-xs" style="color: var(--text-muted);">Aucune donnée.</p>'; return; }
            const dailyData = {}; let minT = Infinity, maxT = -Infinity;
            filteredData.forEach(d => { if(d.rawDateObj) { if(d.rawDateObj < minT) minT = d.rawDateObj; if(d.rawDateObj > maxT) maxT = d.rawDateObj; const dStr = new Date(d.rawDateObj).toISOString().split('T')[0]; dailyData[dStr] = (dailyData[dStr] || 0) + d.jours; } });
            if(minT === Infinity) { container.innerHTML = ''; return; }
            const maxJ = Math.max(...Object.values(dailyData), 1);
            let html = '<div class="flex flex-wrap gap-[3px]">';
            let curr = new Date(minT); const end = new Date(maxT); let days = 0;
            while(curr <= end && days < 365) {
                const dStr = curr.toISOString().split('T')[0]; const val = dailyData[dStr] || 0;
                const intensity = val === 0 ? 0 : Math.max(0.2, val / maxJ);
                const color = val === 0 ? 'var(--border-subtle)' : `rgba(102, 187, 147, ${intensity})`;
                html += `<div class="w-3 h-3 rounded-sm" style="background: ${color}" title="${new Date(curr).toLocaleDateString('fr-FR')}: ${val.toFixed(2)} jrs"></div>`;
                curr.setDate(curr.getDate() + 1); days++;
            }
            html += '</div>';
            container.innerHTML = html;
        }

        function renderCommentChart() {
            if (typeof Chart === 'undefined' || !document.getElementById('commentChart')) return;
            if (commentChartInstance) commentChartInstance.destroy();

            const stats = {};
            filteredData.forEach(d => {
                if (!stats[d.collaborateur]) stats[d.collaborateur] = { total: 0, empty: 0 };
                stats[d.collaborateur].total++;
                if (!d.commentaire || d.commentaire.trim() === '') stats[d.collaborateur].empty++;
            });

            const collabs = Object.keys(stats).sort((a, b) => {
                const pctA = stats[a].total > 0 ? stats[a].empty / stats[a].total : 0;
                const pctB = stats[b].total > 0 ? stats[b].empty / stats[b].total : 0;
                return pctB - pctA;
            });

            if (collabs.length === 0) {
                document.getElementById('comment-quality-summary').textContent = 'Aucune donnée.';
                return;
            }

            const emptyVals = collabs.map(c => stats[c].empty);
            const filledVals = collabs.map(c => stats[c].total - stats[c].empty);

            const totalAll = filteredData.length;
            const emptyAll = filteredData.filter(d => !d.commentaire || d.commentaire.trim() === '').length;
            const pctAll = totalAll > 0 ? ((emptyAll / totalAll) * 100).toFixed(1) : 0;
            document.getElementById('comment-quality-summary').textContent = `${emptyAll} commentaire(s) vide(s) sur ${totalAll} lignes — ${pctAll}% global`;

            const ctx = document.getElementById('commentChart').getContext('2d');
            commentChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: collabs,
                    datasets: [
                        { label: 'Commentaires vides', data: emptyVals, backgroundColor: '#E75B3C', borderRadius: 4, borderWidth: 0 },
                        { label: 'Commentaires renseignés', data: filledVals, backgroundColor: '#66BB93', borderRadius: 4, borderWidth: 0 }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                        tooltip: { callbacks: { afterBody: function(context) { const idx = context[0].dataIndex; const c = collabs[idx]; const pct = stats[c].total > 0 ? ((stats[c].empty / stats[c].total) * 100).toFixed(1) : 0; return `Taux vide : ${pct}% (${stats[c].empty}/${stats[c].total})`; } } }
                    },
                    scales: {
                        x: { stacked: true, grid: { color: '#E2E8F0' }, title: { display: true, text: 'Nombre de lignes', color: '#64748b', font: { size: 11 } } },
                        y: { stacked: true, grid: { color: '#E2E8F0' } }
                    }
                }
            });
        }

        // ===== 11. TABLES =====
        function generateTableData() {
            const activeData = getActiveData();
            const gCons = activeData.reduce((a,r)=>{ if(!a[r.mission]) a[r.mission] = { jours: 0, ca: 0 }; a[r.mission].jours += r.jours; a[r.mission].ca += r.jours * (clientTjm[r.client] || 0); return a; }, {});
            const missionsToDisplay = [...new Set(filteredData.map(d => d.mission))];

            currentRacData = missionsToDisplay.map(m => {
                const consumed = gCons[m] ? gCons[m].jours : 0; const ca = gCons[m] ? gCons[m].ca : 0;
                const allocated = missionBudgets[m] ? (missionBudgets[m].budget || 0) : 0;
                return { m, allocated, consumed, ca, remaining: allocated - consumed, percent: allocated > 0 ? Math.min((consumed / allocated) * 100, 100) : 0 };
            });

            const collabStats = filteredData.reduce((a, r) => { if(!a[r.collaborateur]) a[r.collaborateur] = 0; a[r.collaborateur] += r.jours; return a; }, {});
            currentProdData = Object.keys(collabStats).map(c => {
                const jours = collabStats[c]; return { c, jours, rate: currentWorkingDaysInPeriod > 0 ? (jours / currentWorkingDaysInPeriod) * 100 : 0 };
            });
        }

        function updateSortHeaders(tableId, sortObj) {
            const table = document.getElementById(tableId).closest('table');
            table.querySelectorAll('th.sortable').forEach(th => {
                th.classList.remove('asc', 'desc');
                if (th.getAttribute('onclick').includes(`'${sortObj.col}'`)) th.classList.add(sortObj.asc ? 'asc' : 'desc');
            });
        }

        function sortRacData(col) { if(racSort.col === col) racSort.asc = !racSort.asc; else { racSort.col = col; racSort.asc = true; } updateSortHeaders('rac-table-body', racSort); renderRacTable(); }
        function sortProdData(col) { if(prodSort.col === col) prodSort.asc = !prodSort.asc; else { prodSort.col = col; prodSort.asc = true; } updateSortHeaders('prod-table-body', prodSort); renderProdTable(); }

        function renderRacTable() {
            const tbody = document.getElementById('rac-table-body');
            const alertsCont = document.getElementById('budget-alerts-container'), alertsList = document.getElementById('budget-alerts-list');
            tbody.innerHTML = ''; alertsList.innerHTML = '';
            if(currentRacData.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-4 text-center text-xs" style="color: var(--text-muted);">Aucune donnée.</td></tr>'; if(displayConfig.alerts) alertsCont.classList.add('hidden'); return; }
            currentRacData.sort((a,b) => { let vA=a[racSort.col], vB=b[racSort.col]; if(typeof vA==='string') return racSort.asc ? vA.localeCompare(vB) : vB.localeCompare(vA); return racSort.asc ? vA-vB : vB-vA; });

            let html='', alertCount=0;
            currentRacData.forEach(d => {
                let racHtml = '-';
                if (d.allocated > 0) {
                    const pct = d.remaining / d.allocated;
                    let badgeStyle = d.remaining < 0 ? 'background:rgba(231,91,60,0.15);color:#f09a85;border-color:rgba(231,91,60,0.3)' : (d.remaining === 0 ? 'background:rgba(100,116,139,0.15);color:#94a3b8;border-color:rgba(100,116,139,0.3)' : (pct <= 0.10 ? 'background:rgba(233,189,39,0.15);color:#f0d46a;border-color:rgba(233,189,39,0.3)' : 'background:rgba(102,187,147,0.15);color:#8ed4b0;border-color:rgba(102,187,147,0.3)'));
                    racHtml = `<span class="px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono" style="${badgeStyle}">${d.remaining.toFixed(2)}</span>`;
                    if (pct <= 0.10) {
                        alertCount++;
                        let st = d.remaining < 0 ? 'Dépassement' : (d.remaining === 0 ? 'Épuisé' : 'Critique');
                        let sc = d.remaining < 0 ? 'color:#f09a85;background:rgba(231,91,60,0.1);border-color:rgba(231,91,60,0.2)' : 'color:#f0d46a;background:rgba(233,189,39,0.1);border-color:rgba(233,189,39,0.2)';
                        alertsList.innerHTML += `<div class="p-3 rounded-lg flex flex-col justify-between" style="background:var(--bg-surface);border:1px solid var(--border-subtle);"><div class="font-bold text-xs truncate mb-1" style="color:var(--text-primary);" title="${d.m}">${d.m}</div><div class="flex justify-between items-end"><span class="text-[10px] font-mono" style="color:var(--text-muted);">Reste: ${d.remaining.toFixed(2)} jrs</span><span class="text-[10px] font-bold px-1.5 py-0.5 rounded border" style="${sc}">${st}</span></div></div>`;
                    }
                }
                let progressHtml = '-';
                if (d.allocated > 0) {
                    let barColor = d.remaining < 0 ? '#E75B3C' : (d.remaining === 0 ? '#64748b' : ((d.remaining/d.allocated) <= 0.10 ? '#E9BD27' : '#4491B6'));
                    progressHtml = `<div class="w-full h-1.5 rounded-full" style="background:var(--border-subtle);"><div class="h-1.5 rounded-full" style="width:${d.percent}%;background:${barColor};"></div></div><div class="text-[10px] text-center mt-0.5 font-mono" style="color:var(--text-muted);">${d.percent.toFixed(0)}%</div>`;
                }
                html += `<tr class="hover:bg-white/[0.02] transition" style="border-color: var(--border-subtle);"><td class="px-3 py-2 font-medium text-xs" style="color:var(--text-primary);">${d.m}</td><td class="px-3 py-2 text-right font-mono text-xs">${d.allocated > 0 ? d.allocated.toFixed(2) : '-'}</td><td class="px-3 py-2 text-right font-mono text-xs">${d.consumed.toFixed(2)}</td><td class="px-3 py-2 text-right font-mono text-xs" style="color:#8ed4b0;">${d.ca.toLocaleString('fr-FR')} €</td><td class="px-3 py-2 text-right">${racHtml}</td><td class="px-3 py-2">${progressHtml}</td></tr>`;
            });
            tbody.innerHTML = html;
            if (displayConfig.alerts) { if (alertCount > 0) alertsCont.classList.remove('hidden'); else alertsCont.classList.add('hidden'); }
            updateSortHeaders('rac-table-body', racSort);
        }

        function renderProdTable() {
            const tbody = document.getElementById('prod-table-body');
            const alertsCont = document.getElementById('qc-alerts-container'), alertsList = document.getElementById('qc-alerts-list');
            tbody.innerHTML = ''; alertsList.innerHTML = '';
            if (currentProdData.length === 0 || currentWorkingDaysInPeriod <= 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-xs" style="color: var(--text-muted);">Aucune donnée.</td></tr>';
                document.getElementById('working-days-info').innerText = '0 jours ouvrés'; if(displayConfig.alerts) alertsCont.classList.add('hidden'); return;
            }
            currentProdData.sort((a,b) => { let vA=a[prodSort.col], vB=b[prodSort.col]; if(typeof vA==='string') return prodSort.asc ? vA.localeCompare(vB) : vB.localeCompare(vA); return prodSort.asc ? vA-vB : vB-vA; });

            let html='', anomalies=0;
            currentProdData.forEach(d => {
                let color = '#8ed4b0'; let barColor = '#66BB93';
                if (d.rate < 50) { color = '#f09a85'; barColor = '#E75B3C'; }
                else if (d.rate < 80) { color = '#f0d46a'; barColor = '#E9BD27'; }
                else if (d.rate > 100) { color = '#8fc5df'; barColor = '#5AA2C7'; }
                let progressHtml = `<div class="w-full h-1.5 rounded-full" style="background:var(--border-subtle);"><div class="h-1.5 rounded-full" style="width:${Math.min(d.rate, 100)}%;background:${barColor};"></div></div>`;
                html += `<tr class="hover:bg-white/[0.02] transition" style="border-color: var(--border-subtle);"><td class="px-3 py-2 font-medium text-xs" style="color:var(--text-primary);">${d.c}</td><td class="px-3 py-2 text-right font-mono text-xs">${d.jours.toFixed(2)}</td><td class="px-3 py-2 text-right font-mono text-xs font-bold" style="color:${color};">${d.rate.toFixed(1)}%</td><td class="px-3 py-2">${progressHtml}</td></tr>`;
                if (d.rate > 100 || d.rate < 50) {
                    anomalies++;
                    let type = d.rate > 100 ? "Surcharge" : "Sous-charge";
                    let sc = d.rate > 100 ? 'color:#8fc5df;background:rgba(90,162,199,0.1);border-color:rgba(90,162,199,0.2)' : 'color:#f09a85;background:rgba(231,91,60,0.1);border-color:rgba(231,91,60,0.2)';
                    alertsList.innerHTML += `<div class="p-3 rounded-lg flex justify-between items-center" style="background:var(--bg-surface);border:1px solid var(--border-subtle);"><span class="font-bold text-xs" style="color:var(--text-primary);">${d.c}</span><span class="text-[10px] font-bold px-1.5 py-0.5 rounded border" style="${sc}">${type} (${d.rate.toFixed(0)}%)</span></div>`;
                }
            });
            tbody.innerHTML = html;
            document.getElementById('working-days-info').innerText = `${currentWorkingDaysInPeriod} jrs ouvrés`;
            if (displayConfig.alerts) { if (anomalies > 0) alertsCont.classList.remove('hidden'); else alertsCont.classList.add('hidden'); }
            updateSortHeaders('prod-table-body', prodSort);
        }

        // ===== 12. EXPORTS EXCEL & NOUVEAU PPTX =====
        function exportToExcel() {
            // 1. Si on est sur l'onglet Explorateur (utilise ses propres filtres)
            if (!document.getElementById('explorer-content').classList.contains('hidden')) {
                return exportExplorerToExcel();
            }
            
            // 2. Si on est sur l'onglet Suivi Hebdo
            if (!document.getElementById('suivi-content').classList.contains('hidden')) {
                return exportSuiviToExcel();
            }

            // 3. Si on est sur l'onglet Demandes
            if (!document.getElementById('demandes-content').classList.contains('hidden')) {
                return exportDemandesToExcel();
            }

            // 4. Par défaut : Dashboard global OU Fiches Clients
            let dataToExport = filteredData;
            let fileName = `Export_CRA_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Si on est spécifiquement sur l'onglet "Fiches Clients" avec un client sélectionné
            if (!document.getElementById('clients-content').classList.contains('hidden') && currentSelectedClient) {
                dataToExport = filteredData.filter(d => d.client === currentSelectedClient);
                fileName = `Export_${currentSelectedClient.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            }

            if(dataToExport.length === 0) { showCustomAlert("Info", "Aucune donnée à exporter."); return; }

            // Création du fichier
            const arr = dataToExport.map(d => ({ 
                "Date": d.rawDateObj ? new Date(d.rawDateObj).toLocaleDateString('fr-FR') : "N/A", 
                "Collaborateur": d.collaborateur, 
                "Équipe": d.equipe, 
                "Client": d.client, 
                "Mission": d.mission, 
                "Tâche": d.tache, 
                "Jours": d.jours, 
                "Source": d._source, 
                "Commentaire": d.commentaire 
            }));
            
            const ws = XLSX.utils.json_to_sheet(arr); 
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Données");
            XLSX.writeFile(wb, fileName);
        }

        function getChartBase64(chartId) {
            const srcCanvas = document.getElementById(chartId); 
            if (!srcCanvas) return null;
            const chartInstance = Chart.getChart(srcCanvas);
            if (!chartInstance) return null;

            const scale = 3;
            const origW = srcCanvas.width; const origH = srcCanvas.height; const origStyleW = srcCanvas.style.width; const origStyleH = srcCanvas.style.height; const origRatio = chartInstance.options.devicePixelRatio; const origResponsive = chartInstance.options.responsive; const origAnimation = chartInstance.options.animation;

            const exportW = 1200; const exportH = (chartId === 'timeChart' || chartId === 'fiche-chart-time' || chartId === 'fiche-chart-task') ? 800 : 700;

            chartInstance.options.responsive = false; chartInstance.options.animation = false; chartInstance.options.devicePixelRatio = scale;
            srcCanvas.width = exportW * scale; srcCanvas.height = exportH * scale; srcCanvas.style.width = exportW + 'px'; srcCanvas.style.height = exportH + 'px';
            chartInstance.resize(exportW, exportH); chartInstance.update('none');

            const exportCanvas = document.createElement('canvas'); exportCanvas.width = exportW * scale; exportCanvas.height = exportH * scale; const ectx = exportCanvas.getContext('2d'); ectx.fillStyle = '#FFFFFF'; ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height); ectx.drawImage(srcCanvas, 0, 0);

            const dataUrl = exportCanvas.toDataURL('image/png', 1.0);

            chartInstance.options.responsive = origResponsive; chartInstance.options.animation = origAnimation; chartInstance.options.devicePixelRatio = origRatio || undefined;
            srcCanvas.width = origW; srcCanvas.height = origH; srcCanvas.style.width = origStyleW; srcCanvas.style.height = origStyleH;
            chartInstance.resize(); chartInstance.update('none');

            return dataUrl;
        }

        function downloadSingleChart(chartId, filename) {
            const base64 = getChartBase64(chartId); if(!base64) return;
            fetch(base64).then(res => res.blob()).then(blob => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.download = filename; link.href = url; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(url), 100); });
        }

        // --- NOUVEAU : Ouverture du modal d'export global ---
        function openExportModal() {
            if(filteredData.length === 0) { showCustomAlert("Info", "Aucune donnée à exporter."); return; }
            
            // Remplir la liste des clients disponibles
            const clients = [...new Set(filteredData.map(d => d.client))].sort();
            const listEl = document.getElementById('export-client-list');
            listEl.innerHTML = '';
            clients.forEach(c => {
                listEl.innerHTML += `<label class="flex items-center gap-2 cursor-pointer p-1 hover:bg-white/5"><input type="checkbox" class="chk-exp-client-slide w-4 h-4" value="${c.replace(/"/g, '&quot;')}" checked> <span class="text-sm text-[var(--text-primary)]">${c}</span></label>`;
            });

            document.getElementById('export-ppt-status').innerText = "";
            openCraModal('export-ppt-modal');
        }

        // --- NOUVEAU : Export PPTX Personnalisé (Global + Clients sélectionnés) ---
        async function executeCustomExport() {
            if (typeof PptxGenJS === 'undefined') { showError("PptxGenJS non chargé."); return; }
            
            const btn = document.getElementById('btn-execute-export');
            const statusLabel = document.getElementById('export-ppt-status');
            btn.disabled = true;
            statusLabel.innerText = "Génération en cours, veuillez patienter...";

            setTimeout(async () => {
                try {
                    const CY = { navy: '19365D', green: '66BB93', blueMid: '2E678D', blueLight: '4491B6', blueSky: '5AA2C7', cyan: '10A2C8', white: 'FFFFFF', grayText: '94a3b8', darkText: '252525', tableBg: 'f0f4f8', tableHead: '19365D' };
                    let pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_16x9';

                    // Slide de titre
                    let s1 = pptx.addSlide(); s1.background = { fill: CY.navy };
                    s1.addShape(pptx.ShapeType.rect, { x: 1.2, y: 4.3, w: 7.5, h: 0.06, fill: { color: CY.green } });
                    s1.addText("Comité de Pilotage", { x: 1.2, y: 2.0, w: 8, h: 1, fontSize: 40, bold: true, color: CY.white, fontFace: 'Arial' });
                    s1.addText("Reporting CRA", { x: 1.2, y: 3.0, w: 8, h: 0.6, fontSize: 20, color: CY.green, fontFace: 'Arial' });
                    s1.addText(`Généré le ${new Date().toLocaleDateString('fr-FR')} par ${currentUserLabel}`, { x: 1.2, y: 4.6, w: 8, h: 0.5, fontSize: 12, color: CY.grayText, fontFace: 'Arial' });

                    const accentColors = [CY.green, CY.blueLight, CY.blueSky, CY.blueMid, CY.cyan]; let accentIdx = 0;
                    
                    function addChartSlide(title, subtitle, chartId) {
                        const img = getChartBase64(chartId); if (!img) return;
                        const accent = accentColors[accentIdx % accentColors.length]; accentIdx++;
                        const s = pptx.addSlide(); s.background = { fill: CY.white };
                        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: accent } });
                        s.addText(title, { x: 0.5, y: 0.25, w: 8.5, h: 0.55, fontSize: 22, color: CY.navy, bold: true, fontFace: 'Arial' });
                        s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.82, w: 1.8, h: 0.04, fill: { color: CY.green } });
                        if (subtitle) s.addText(subtitle, { x: 0.5, y: 0.92, w: 8, h: 0.35, fontSize: 11, color: CY.blueMid, italic: true, fontFace: 'Arial' });
                        const chartY = subtitle ? 1.35 : 1.1; const chartH = subtitle ? 5.65 : 5.9;
                        s.addImage({ data: img, x: 0.4, y: chartY, w: 9.2, h: chartH });
                    }

                    // 1. Export des Graphes sélectionnés
                    const totalJ = filteredData.reduce((s, r) => s + r.jours, 0); 
                    if(document.getElementById('chk-exp-client').checked) addChartSlide("Jours par Client", `${totalJ.toFixed(1)} jours au total sur ${filteredData.length} lignes`, 'clientChart');
                    if(document.getElementById('chk-exp-collab').checked) addChartSlide("Jours par Collaborateur", `Jours prestés sur la période`, 'collabChart');
                    if(document.getElementById('chk-exp-task').checked) addChartSlide("Répartition par Tâche", `Analyse typologique`, 'taskChart');
                    if(document.getElementById('chk-exp-ca').checked) addChartSlide("Chiffre d'Affaires par Client", `Valeur estimée`, 'caChart');
                    if(document.getElementById('chk-exp-time').checked) addChartSlide("Évolution de l'Activité", "Tendance sur la période filtrée", 'timeChart');
                    if(document.getElementById('chk-exp-qualite').checked) addChartSlide("Qualité de Saisie", "Analyse des commentaires", 'commentChart');

                    // 2. Export des Fiches Clients sélectionnées
                    const checkedClientCbs = document.querySelectorAll('.chk-exp-client-slide:checked');
                    if(checkedClientCbs.length > 0) {
                        checkedClientCbs.forEach(cb => {
                            const cName = cb.value;
                            const cData = filteredData.filter(d => d.client === cName);
                            const tJ = cData.reduce((a,r) => a+r.jours, 0);
                            const tCA = tJ * (clientTjm[cName]||0);
                            
                            const sC = pptx.addSlide(); sC.background = { fill: CY.white };
                            sC.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: CY.navy } });
                            sC.addText(`Revue : ${cName}`, { x: 0.5, y: 0.25, w: 8.5, h: 0.55, fontSize: 22, color: CY.navy, bold: true, fontFace: 'Arial' });
                            sC.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.82, w: 1.8, h: 0.04, fill: { color: CY.green } });
                            
                            // Infos
                            sC.addText("Indicateurs Globaux", { x: 0.5, y: 1.2, w: 4, h: 0.4, fontSize: 14, color: CY.blueMid, bold:true, fontFace: 'Arial' });
                            sC.addText(`Jours Consommés : ${tJ.toFixed(2)} jrs\nCA Généré : ${tCA.toLocaleString('fr-FR')} €\nTJM Appliqué : ${clientTjm[cName]||0} €`, { x: 0.5, y: 1.7, w: 4, h: 1, fontSize: 12, color: CY.darkText, fontFace: 'Arial' });

                            // Tableau Missions pour ce client
                            const cMissions = [...new Set(cData.map(d => d.mission))];
                            if(cMissions.length > 0) {
                                sC.addText("Suivi des Missions", { x: 0.5, y: 3.0, w: 8, h: 0.4, fontSize: 14, color: CY.blueMid, bold:true, fontFace: 'Arial' });
                                let tRows = [[ { text: "Mission", options: { bold: true, fill: CY.tableHead, color: CY.white, fontFace: 'Arial', fontSize: 10 } }, { text: "Alloués", options: { bold: true, fill: CY.tableHead, color: CY.white, align: 'center', fontFace: 'Arial', fontSize: 10 } }, { text: "Consommés", options: { bold: true, fill: CY.tableHead, color: CY.white, align: 'center', fontFace: 'Arial', fontSize: 10 } }, { text: "RAC", options: { bold: true, fill: CY.tableHead, color: CY.white, align: 'center', fontFace: 'Arial', fontSize: 10 } } ]];
                                
                                cMissions.forEach((m, i) => {
                                    const mD = cData.filter(d=>d.mission === m);
                                    const cons = mD.reduce((a,r)=>a+r.jours,0);
                                    const allo = missionBudgets[m] ? (missionBudgets[m].budget || 0) : 0;
                                    const rac = allo - cons;
                                    const rowBg = i % 2 === 0 ? 'FFFFFF' : CY.tableBg;
                                    tRows.push([ 
                                        { text: m, options: { fill: rowBg, fontFace: 'Arial', fontSize: 9 } }, 
                                        { text: allo > 0 ? allo.toFixed(2) : '-', options: { fill: rowBg, align: 'center', fontFace: 'Arial', fontSize: 9 } }, 
                                        { text: cons.toFixed(2), options: { fill: rowBg, align: 'center', fontFace: 'Arial', fontSize: 9 } }, 
                                        { text: allo > 0 ? rac.toFixed(2) : '-', options: { bold: true, fill: rowBg, align: 'center', fontFace: 'Arial', fontSize: 9, color: (rac<0 ? 'E75B3C' : '66BB93') } } 
                                    ]);
                                });
                                sC.addTable(tRows, { x: 0.5, y: 3.5, w: 9, fontSize: 9, border: { type: 'solid', color: 'dee2e6', pt: 0.5 } });
                            }
                        renderProdTable();
            renderCommentChart();
            if(!document.getElementById('explorer-content').classList.contains('hidden')) renderExplorerTable();
            
            // LIGNE À AJOUTER ICI :
            if (typeof window.renderHomeDispoWidget === 'function') window.renderHomeDispoWidget();
        
						});
                    }

                    // Slide de fin
                    let sEnd = pptx.addSlide(); sEnd.background = { fill: CY.navy }; sEnd.addShape(pptx.ShapeType.rect, { x: 1.2, y: 4.0, w: 3, h: 0.06, fill: { color: CY.green } }); sEnd.addText("Merci !", { x: 1.2, y: 3.0, w: 5, h: 0.8, fontSize: 36, bold: true, color: CY.white, fontFace: 'Arial' });
                    
                    await pptx.writeFile({ fileName: `Export_Dashboard_${new Date().toISOString().split('T')[0]}.pptx` });
                    
                    closeCraModal('export-ppt-modal');
                } catch(err) { 
                    showError("Erreur PPTX: " + err.message); 
                } finally { 
                    btn.disabled = false;
                    statusLabel.innerText = "";
                }
            }, 100);
        }

        // --- NOUVEAU : Fonction d'export spécifique à un client depuis la vue "Fiche Client" ---
        function exportFicheClientPPT(clientName) {
            const checkboxes = document.querySelectorAll('.exp-fiche-cb:checked');
            const selected = Array.from(checkboxes).map(c => c.value);
            
            if(selected.length === 0) { toastWarn("Veuillez sélectionner au moins un élément."); return; }

            const btn = document.getElementById('btn-exp-fiche');
            const origText = btn.innerText;
            btn.innerText = "Génération en cours..."; btn.disabled = true;

            setTimeout(async () => {
                try {
                    let pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_16x9';
                    const CY = { navy: '19365D', green: '66BB93', white: 'FFFFFF', blueMid: '2E678D', darkText: '252525' };

                    // Slide Couverture
                    let s1 = pptx.addSlide(); s1.background = { fill: CY.navy };
                    s1.addText(`Revue Client : ${clientName}`, { x: 1, y: 3, w: 8, h: 1, fontSize: 36, color: CY.white, bold: true, align: 'center', fontFace: 'Arial' });

                    // Slide Infos & Missions (combinés)
                    if(selected.includes('infos') || selected.includes('missions')) {
                        const cData = getActiveData().filter(d => d.client === clientName);
                        let s2 = pptx.addSlide(); s2.background = { fill: CY.white };
                        s2.addText(`Fiche Identité : ${clientName}`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, color: CY.navy, bold: true, fontFace: 'Arial' });
                        s2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.9, w: 2, h: 0.04, fill: { color: CY.green } });
                        
                        let startY = 1.2;
                        if(selected.includes('infos')) {
                            const p = clientProfiles[clientName] || {};
                            s2.addText(`Contact : ${p.contact || 'Non renseigné'}\nEmail : ${p.email || 'Non renseigné'}`, { x: 0.5, y: startY, w: 4, h: 1, fontSize: 12, fontFace: 'Arial', color: CY.darkText });
                            s2.addText(`Contrat : ${p.contrat || 'Non renseigné'}\nResp. interne : ${p.responsable || 'Non renseigné'}`, { x: 5, y: startY, w: 4, h: 1, fontSize: 12, fontFace: 'Arial', color: CY.darkText });
                            startY = 2.5;
                        }

                        if(selected.includes('missions') && cData.length > 0) {
                            const cMissions = [...new Set(cData.map(d => d.mission))];
                            s2.addText("État des Missions", { x: 0.5, y: startY, w: 9, h: 0.3, fontSize: 14, color: CY.blueMid, bold:true, fontFace: 'Arial' });
                            
                            let tRows = [[ { text: "Mission", options: { bold: true, fill: CY.navy, color: CY.white } }, { text: "Alloués", options: { bold: true, fill: CY.navy, color: CY.white } }, { text: "Consommés", options: { bold: true, fill: CY.navy, color: CY.white } }, { text: "RAC", options: { bold: true, fill: CY.navy, color: CY.white } } ]];
                            cMissions.forEach((m) => {
                                const mD = cData.filter(d=>d.mission === m);
                                const cons = mD.reduce((a,r)=>a+r.jours,0);
                                const allo = missionBudgets[m] ? (missionBudgets[m].budget || 0) : 0;
                                tRows.push([ m, (allo > 0 ? allo.toFixed(2) : '-'), cons.toFixed(2), (allo > 0 ? (allo-cons).toFixed(2) : '-') ]);
                            });
                            s2.addTable(tRows, { x: 0.5, y: startY + 0.5, w: 9, fontSize: 10, border: { pt: 0.5, color: 'cccccc' } });
                        }
                    }

                    // Charts
                    if(selected.includes('chart-repartition')) {
                        let s3 = pptx.addSlide();
                        s3.addText(`Répartition par Tâche`, { x: 0.5, y: 0.3, fontSize: 22, color: CY.navy, bold: true, fontFace:'Arial' });
                        const imgTask = getChartBase64('fiche-chart-task');
                        if(imgTask) s3.addImage({ data: imgTask, x: 1, y: 1.2, w: 8, h: 4.5 });
                    }
                    if(selected.includes('chart-evolution')) {
                        let s4 = pptx.addSlide();
                        s4.addText(`Évolution de l'activité`, { x: 0.5, y: 0.3, fontSize: 22, color: CY.navy, bold: true, fontFace:'Arial' });
                        const imgTime = getChartBase64('fiche-chart-time');
                        if(imgTime) s4.addImage({ data: imgTime, x: 0.5, y: 1.2, w: 9, h: 4.5 });
                    }

                    await pptx.writeFile({ fileName: `Export_Fiche_${clientName.replace(/\s+/g, '_')}.pptx` });
                } catch(e) {
                    toastErr("Erreur export PPTX : " + e.message);
                } finally {
                    btn.innerText = origText; btn.disabled = false;
                }
            }, 100);
        }

        // ===== 13. AI =====
        async function generateAIAnalysis() {
            if (filteredData.length === 0) return;
            // Vérification de la présence de la clé API Gemini
            const currentApiKey = localStorage.getItem('cyrias_gemini_key') || '';
            if (!currentApiKey) {
                alert("⚠️ Clé API Gemini non configurée.\n\nRendez-vous dans la page « Configuration » pour saisir votre clé API personnelle.\n\nObtenez une clé gratuite sur : https://aistudio.google.com/app/apikey");
                return;
            }
            const btnAi = document.getElementById('btn-ai-analyze'); btnAi.disabled = true; btnAi.classList.add('opacity-50');
            document.getElementById('ai-result-container').classList.add('hidden'); document.getElementById('ai-error').classList.add('hidden');
            document.getElementById('ai-loading').classList.remove('hidden'); document.getElementById('ai-loading').classList.add('flex');
            try {
                const totalJ = filteredData.reduce((s, r) => s + r.jours, 0);
                const coms = filteredData.filter(d => d.commentaire.trim()).map(d => `[${d.collaborateur}]: ${d.tache} - ${d.commentaire}`).slice(0, 30);
                const fmt = (arr) => arr.length > 0 ? arr.join(', ') : "Toutes";
                const pTime = fmt(tsMois.getValue()) !== "Toutes" ? fmt(tsMois.getValue()) : (fmt(tsTrimestre.getValue()) !== "Toutes" ? fmt(tsTrimestre.getValue()) : fmt(tsAnnee.getValue()));
                const sources = Object.values(dataSources).map(s => s.name).join(', ');

                const budgetAlerts = currentRacData.filter(d => d.allocated > 0 && (d.remaining / d.allocated) <= 0.10).map(d => `${d.m}: ${d.remaining.toFixed(1)}j restants sur ${d.allocated}j (${(d.remaining < 0 ? 'DÉPASSÉ' : 'CRITIQUE')})`);
                const prodInfo = currentProdData.map(d => `${d.c}: ${d.rate.toFixed(0)}% (${d.jours.toFixed(1)}j)`);
                const emptyComments = filteredData.filter(d => !d.commentaire || d.commentaire.trim() === '').length;
                const commentPct = filteredData.length > 0 ? ((emptyComments / filteredData.length) * 100).toFixed(0) : 0;
                const totalCA = filteredData.reduce((a, r) => a + (r.jours * (clientTjm[r.client] || 0)), 0);

                const prompt = `Analyse ces données CRA de TMA (${Object.keys(dataSources).length} source(s): ${sources}).
**Filtres actifs:** Équipes=${fmt(tsEquipe.getValue())}, Clients=${fmt(tsClient.getValue())}, Collabs=${fmt(tsCollab.getValue())}, Période=${pTime}.
**Résumé chiffré:**
- Total: ${totalJ.toFixed(1)} jours sur ${filteredData.length} lignes
- CA estimé: ${totalCA.toLocaleString('fr-FR')} €
- Jours ouvrés période: ${currentWorkingDaysInPeriod}
- Commentaires vides: ${emptyComments}/${filteredData.length} (${commentPct}%)
**Alertes budgétaires (RAC ≤ 10%):**
${budgetAlerts.length > 0 ? budgetAlerts.join('\n') : 'Aucune alerte'}
**Taux de production par collaborateur:**
${prodInfo.join('\n')}
**Extraits de commentaires:**
${coms.join('\n')}
Fais une synthèse structurée avec: 1. Vue d'ensemble de l'activité 2. Points d'attention (budgets, charges, qualité de saisie) 3. Recommandations opérationnelles`;
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }, systemInstruction: { parts: [{ text: "Tu es un assistant analytique expert en gestion de projet et TMA. Réponds en français avec des listes à puces structurées. Identifie les tendances, anomalies et points d'attention." }] }}) });
                if (!res.ok) throw new Error(await res.text());
                const result = await res.json();
                const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!aiText) throw new Error("Réponse vide.");
                document.getElementById('ai-response-content').innerHTML = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n\*/g, '<br>•').replace(/\n-/g, '<br>•').replace(/\n/g, '<br>');
                document.getElementById('ai-result-container').classList.remove('hidden');
            } catch (e) { document.getElementById('ai-error').innerText = "Erreur IA : " + e.message; document.getElementById('ai-error').classList.remove('hidden'); }
            finally { document.getElementById('ai-loading').classList.add('hidden'); document.getElementById('ai-loading').classList.remove('flex'); btnAi.disabled = false; btnAi.classList.remove('opacity-50'); }
        }

    


// --- FONCTION ONGLET DISPO CRAMINATOR ---
// --- GESTION DU STAFFING MANUEL ---
let manualStaffing = SafeStorage.get('cra_manual_staffing') || {};

function getStaffingDates() {
    const dates = [];
    const now = new Date();
    
    // Trouver le lundi de cette semaine proprement (Local Time - pour éviter le bug UTC)
    let day = now.getDay();
    if (day === 0) day = 7; 
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    
    for(let i = 0; i < 14; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        
        if(d.getDay() !== 0 && d.getDay() !== 6) { // Exclure weekends
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            
            dates.push({
                iso: `${yyyy}-${mm}-${dd}`, // Format YYYY-MM-DD sécurisé
                label: d.toLocaleDateString('fr-FR', {weekday: 'short', day: '2-digit', month: '2-digit'})
            });
        }
    }
    return dates;
}

function renderStaffingCalendar() {
    const container = document.getElementById('staffing-calendar-container');
    if(!container) return;
    
    const dates = getStaffingDates();
    let html = `<div class="staffing-cell staffing-header">Collaborateur</div>`;
    dates.forEach(d => html += `<div class="staffing-cell staffing-header">${d.label}</div>`);
    
    // Liste des collabs (CRA ou Saisie manuelle)
    let collabs = [...new Set([...(window.rawData || []).map(d => d.collaborateur), ...Object.keys(manualStaffing)])].filter(n => n && n !== 'N/A').sort();
    
    if(collabs.length === 0) collabs = ["Nouveau Collab"];

    collabs.forEach(name => {
        const escapedName = name.replace(/'/g, "\\'"); // Sécurité apostrophe
        html += `<div class="staffing-cell staffing-name">${name}</div>`;
        
        dates.forEach(d => {
            const val = (manualStaffing[name] && manualStaffing[name][d.iso]) || "";
            html += `<div class="staffing-cell">
                <input type="text" class="staffing-input" placeholder="0" value="${val}" 
                onchange="saveStaffingValue('${escapedName}', '${d.iso}', this.value)">
            </div>`;
        });
    });
    container.innerHTML = html;
}

function saveStaffingValue(name, date, val) {
    if(!manualStaffing[name]) manualStaffing[name] = {};
    
    // Remplacement de la virgule française par un point pour les calculs
    let cleanVal = val.trim().replace(',', '.');
    manualStaffing[name][date] = cleanVal;
    
    SafeStorage.set('cra_manual_staffing', manualStaffing);
    if (typeof window.renderHomeDispoWidget === 'function') window.renderHomeDispoWidget();
}

function addStaffingRow() {
    const name = prompt("Nom du collaborateur :");
    if(name && name.trim() !== '') {
        const cleanName = name.trim();
        if(!manualStaffing[cleanName]) {
            manualStaffing[cleanName] = {};
            SafeStorage.set('cra_manual_staffing', manualStaffing); // Sauvegarde immédiate
        }
        renderStaffingCalendar();
    }
}

// --- MISE À JOUR DES FONCTIONS EXISTANTES ---
function renderDispoTable() {
    renderStaffingCalendar();
    
    const tbody = document.getElementById('dispo-table-body');
    if (!tbody) return;
    
    document.getElementById('dispo-period-info').innerText = `${currentWorkingDaysInPeriod} jours ouvrés (période filtrée)`;
    
    if (!currentProdData || currentProdData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-xs" style="color: var(--text-muted);">Aucune donnée CRA chargée.</td></tr>';
        return;
    }
    
    let html = '';
    currentProdData.forEach(d => {
        const capacity = currentWorkingDaysInPeriod;
        const consumed = d.jours;
        const remaining = capacity - consumed;
        const rate = d.rate;
        
        let rateColor = rate > 95 ? '#E75B3C' : (rate > 75 ? '#E9BD27' : '#8ed4b0');
        let remColor = remaining < 0 ? '#E75B3C' : (remaining > 0 ? '#66BB93' : '#64748b');
        
        html += `<tr class="hover:bg-white/[0.02]">
            <td class="px-4 py-3 font-semibold">${d.c}</td>
            <td class="px-4 py-3 text-center font-mono">${capacity}</td>
            <td class="px-4 py-3 text-center font-mono">${consumed.toFixed(2)}</td>
            <td class="px-4 py-3 text-center font-mono font-bold" style="color: ${remColor};">${remaining.toFixed(2)}</td>
            <td class="px-4 py-3 text-center">
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
                    <div class="w-16 h-1.5 rounded-full" style="background:var(--border-subtle);">
                        <div class="h-1.5 rounded-full" style="width:${Math.min(rate, 100)}%;background:${rateColor};"></div>
                    </div>
                    <span class="text-[10px] font-mono" style="color: ${rateColor};">${rate.toFixed(0)}%</span>
                </div>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

window.renderHomeDispoWidget = function() {
    const container = document.getElementById('home-dispo-widget');
    if (!container) return;

    const dates = getStaffingDates().slice(0, 5); // Cette semaine (Lundi au Vendredi)
    const collabs = [...new Set([...(window.rawData || []).map(d => d.collaborateur), ...Object.keys(manualStaffing)])].filter(n => n && n !== 'N/A').sort();

    if (collabs.length === 0) {
        container.innerHTML = '<div style="font-size: 12px; color: var(--ink-muted);">Aucune ressource saisie ou chargée.</div>';
        return;
    }

    let html = '';
    collabs.forEach(c => {
        let planned = 0;
        dates.forEach(d => {
            if(manualStaffing[c] && manualStaffing[c][d.iso]) {
                // Analyse sécurisée avec virgule prise en compte
                planned += parseFloat(manualStaffing[c][d.iso].replace(',', '.')) || 0;
            }
        });
        
        const remaining = 5 - planned;
        let color = remaining <= 0 ? 'var(--danger)' : (remaining <= 1.5 ? '#D97706' : 'var(--secondary)');
        let icon = remaining <= 0 ? '🔴' : (remaining <= 1.5 ? '🟠' : '✅');

        html += `<div style="padding: 12px; border: 1px solid var(--border-light); border-radius: 8px; background: var(--bg);">
            <div style="font-weight: 700; font-size: 13px; color: var(--primary); margin-bottom: 8px; display: flex; justify-content: space-between;">
                <span>${c}</span><span>${icon}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-secondary);">
                <span>Prévu (Saisie):</span> <span style="font-family: 'JetBrains Mono';">${planned.toFixed(1)} / 5j</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: ${color}; margin-top: 4px;">
                <span>Reste dispo:</span> <span style="font-family: 'JetBrains Mono';">${Math.max(0, remaining).toFixed(1)} jrs</span>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

