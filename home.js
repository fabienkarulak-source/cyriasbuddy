/* ============================================================
   Cyrias Buddy — Home, Dashboard, Links, Onboarding
   ============================================================ */
// 5. FONCTION D'AJOUT DE LIENS
function addLink() {
    const elCat = document.getElementById('link-category');
    const elName = document.getElementById('link-name');
    const elUrl = document.getElementById('link-url');

    if (!elName || !elUrl) return;

    const cat = elCat ? elCat.value : 'Favoris';
    const name = elName.value.trim();
    let url = elUrl.value.trim();

    if (!name || !url) {
        toastWarn("Veuillez remplir le nom et l'URL");
        return;
    }

    if (!url.match(/^[a-zA-Z]+:\/\//)) {
        url = 'https://' + url;
    }

    if (!userLinks[cat]) userLinks[cat] = [];
    userLinks[cat].push({ name: name, url: url });
    
    SafeStorage.set('user_links', userLinks);
    
    if (typeof renderAllLinks === 'function') renderAllLinks(); 
    if (typeof renderHomeGrid === 'function') renderHomeGrid();
    closeLinkModal();
}

// --- Le reste de votre code (renderHomeGrid, etc.) reste ici en dessous ---
function renderHomeGrid() {
    const grid = document.getElementById('home-grid');
    if (!grid) return;

    const kpis = getGlobalKPIs();

    grid.innerHTML = `
        <div class="card p-6 border-l-4 border-orange-500 cursor-pointer hover:bg-gray-50 transition" onclick="navigateTo('facturator')">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-500">À facturer (${kpis.periode})</span>
                <span class="text-orange-500 text-xl">⏳</span>
            </div>
            <div class="text-2xl font-bold text-gray-800">${kpis.pending}</div>
            <p class="text-xs text-gray-400 mt-1">Montant HT restant à traiter</p>
        </div>

        <div class="card p-6 border-l-4 border-blue-500">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Prod. Mensuelle</span>
                <span class="text-blue-500 text-xl">📊</span>
            </div>
            <div class="text-2xl font-bold text-gray-800">${kpis.jours}</div>
            <p class="text-xs text-gray-400 mt-1">Total jours sur ${kpis.periode}</p>
        </div>

        <div class="card p-6 border-l-4 border-green-500">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-500">CA Mensuel (HT)</span>
                <span class="text-green-500 text-xl">💰</span>
            </div>
            <div class="text-2xl font-bold text-gray-800">${kpis.total}</div>
            <p class="text-xs text-gray-400 mt-1">Base TJM sur ${kpis.periode}</p>
        </div>
    `;
}

function renderAllLinks() {
    // On cible les deux pages en même temps
    const containers = [
        document.getElementById('links-container'), 
        document.getElementById('home-links-container')
    ];

    const categories = ['Favoris', 'Outils', 'Clients', 'Admin'];

    containers.forEach(container => {
        if (!container) return;
        container.innerHTML = ''; // On vide avant de redessiner

        categories.forEach(cat => {
            const links = userLinks[cat] || [];
            // On cache les catégories vides, sauf Favoris
            if (links.length === 0 && cat !== 'Favoris') return;

            const section = document.createElement('div');
            section.className = 'mb-8';
            
            // On crée un ID unique pour éviter les conflits entre les deux pages
            const gridId = `grid-${cat}-${Math.random().toString(36).substr(2, 9)}`;
            
            section.innerHTML = `
                <h3 style="font-size:11px; font-weight:700; color:var(--ink-muted); text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid var(--border-light); padding-bottom:8px; margin-bottom:15px;">${cat}</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:15px;" id="${gridId}"></div>
            `;
            container.appendChild(section);

            const grid = document.getElementById(gridId);
            links.forEach((link, index) => {
                const card = document.createElement('div');
                card.style = "background:white; border:1px solid var(--border); padding:12px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s;";
                card.onmouseover = () => { card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; card.style.borderColor = "var(--primary)"; };
                card.onmouseout = () => { card.style.boxShadow = "none"; card.style.borderColor = "var(--border)"; };
                
                card.innerHTML = `
                    <a href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:inherit; flex-grow:1; overflow:hidden;">
                        <div style="font-weight:700; color:var(--ink); margin-bottom:2px;">${escapeHtml(link.name || '')}</div>
                        <div style="font-size:10px; color:var(--ink-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((link.url || '').replace('https://',''))}</div>
                    </a>
                    <button onclick="deleteLink('${cat}', ${index})" style="background:transparent; border:none; color:#ffb7b7; cursor:pointer; padding:5px; font-size:16px;">×</button>
                `;
                grid.appendChild(card);
            });
        });
    });
}
function deleteLink(cat, index) {
    if (confirm('Supprimer ce lien ?')) {
        userLinks[cat].splice(index, 1);
        SafeStorage.set('user_links', userLinks);
        renderAllLinks();
    }
}


function renderConfigTable() {
    const tbody = document.getElementById('config-table-body');
    if (!tbody) return;
    tbody.innerHTML = linksData.map(l => `
        <tr>
            <td>${escapeHtml(l.icon || '')} ${escapeHtml(l.name || '')}</td>
            <td>${escapeHtml(l.cat || '—')}</td>
            <td>
                <button class="btn btn-outline" onclick="editLink(${l.id})">✏️ Modifier</button>
                <button class="btn btn-danger" onclick="deleteLink(${l.id})">Supprimer</button>
            </td>
        </tr>`).join('');
    const catBody = document.getElementById('config-cat-body');
    if (catBody) catBody.innerHTML = catsData.map(c => `
        <tr>
            <td>${escapeHtml(c.name || '')}</td>
            <td><button class="btn btn-danger" onclick="deleteCat(${c.id})">Supprimer</button></td>
        </tr>`).join('');
}

function openLinkModal() {
    const modal = document.getElementById('link-modal');
    if (modal) {
        // On force l'affichage en flex pour le centrage
        modal.style.setProperty('display', 'flex', 'important');
        
        // Nettoyage des champs
        if (document.getElementById('link-name')) document.getElementById('link-name').value = '';
        if (document.getElementById('link-url')) document.getElementById('link-url').value = '';
    }
}

function closeLinkModal() {
    const modal = document.getElementById('link-modal');
    if (modal) {
        // On cache la modale
        modal.style.setProperty('display', 'none', 'important');
    }
}

function saveLinkModal() {
    const name = document.getElementById('link-name').value.trim();
    if (!name) { toastWarn('Nom requis'); return; }
    const link = { id: editingLinkId || Date.now(), name, url: document.getElementById('link-url').value, desc: document.getElementById('link-desc').value, icon: document.getElementById('link-icon').value, cat: document.getElementById('link-cat').value };
    if (editingLinkId) { linksData = linksData.map(l=>l.id===editingLinkId ? link : l); }
    else { linksData.push(link); }
    localStorage.setItem('compagnon_links', JSON.stringify(linksData));
    closeCraModal('link-modal'); renderConfigTable();
}

function deleteLink(id) { if (confirm('Supprimer ce lien ?')) { linksData = linksData.filter(l=>l.id!==id); localStorage.setItem('compagnon_links', JSON.stringify(linksData)); renderConfigTable(); } }

function openCatModal() {
    editingCatId = null;
    document.getElementById('cat-name').value = '';
    openCraModal('cat-modal');
}

function saveCatModal() {
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { alert('Nom requis'); return; }
    catsData.push({ id: Date.now(), name });
    localStorage.setItem('compagnon_cats', JSON.stringify(catsData));
    closeCraModal('cat-modal'); renderConfigTable();
}

function deleteCat(id) { if (confirm('Supprimer cette catégorie ?')) { catsData = catsData.filter(c=>c.id!==id); localStorage.setItem('compagnon_cats', JSON.stringify(catsData)); renderConfigTable(); } }

// ----- Bandeau d'accueil personnalisé -----
function initHomeWelcomeBanner() {
  const greetingEl = document.getElementById('home-greeting');
  const userEl = document.getElementById('home-username');
  const dateEl = document.getElementById('home-date');
  if (!greetingEl) return;

  // Salutation contextuelle
  const h = new Date().getHours();
  let greeting = 'Bonjour';
  if (h < 6) greeting = 'Bonne fin de nuit';
  else if (h < 12) greeting = 'Bonjour';
  else if (h < 18) greeting = 'Bon après-midi';
  else greeting = 'Bonsoir';
  greetingEl.textContent = greeting;

  // Nom (depuis localStorage, modifiable par l'utilisateur)
  const username = localStorage.getItem('cyrias_username') || '';
  if (username) {
    userEl.textContent = username;
  } else {
    userEl.innerHTML = '<button onclick="askUserName()" style="background:none;border:1px dashed var(--border);color:var(--ink-muted);padding:2px 10px;border-radius:6px;font-size:14px;cursor:pointer;font-family:inherit;">Cliquez pour personnaliser</button>';
  }

  // Date du jour en français
  const days = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const d = new Date();
  const weekNum = getWeekNumber(d);
  dateEl.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} — semaine ${weekNum}`;
}

function getWeekNumber(d) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function askUserName() {
  const current = localStorage.getItem('cyrias_username') || '';
  const name = prompt("Comment souhaitez-vous être appelé(e) ?", current);
  if (name === null) return;
  if (name.trim()) {
    localStorage.setItem('cyrias_username', name.trim());
    toastOk(`Bienvenue ${name.trim()} ! 👋`);
  } else {
    localStorage.removeItem('cyrias_username');
  }
  initHomeWelcomeBanner();
}

/* ============================================================================
   v10 — SPRINT A : Features Chef de projet / Directeur / Développeur
   ============================================================================ */


// ===========================================================
// Intégration dashboard : ajouter les nouvelles actions rapides
// ===========================================================
function enhanceDashboardWithSprintB() {
  const enhanced = document.getElementById('dashboard-enhanced');
  if (!enhanced) return;
  if (document.getElementById('sprintb-quickactions')) return;
  const qaContainer = enhanced.querySelector('.qa-btn');
  if (!qaContainer) return;
  const grid = qaContainer.parentElement;
  const newActions = [
    { icon: 'users', label: 'Comparateur clients', sub: 'Côte à côte', cb: 'openClientComparator()' },
    { icon: 'crystal', label: 'Forecast fin de mois', sub: 'Projection auto', cb: 'showForecastModal()' },
    { icon: 'handshake', label: 'Engagements clients', sub: 'Tracker', cb: 'showEngagementsModal()' },
    { icon: 'sparkles', label: 'Mémoire décisions', sub: 'Comité', cb: 'showDecisionsModal()' },
    { icon: 'activity', label: 'Heatmap activité', sub: '1 an glissant', cb: 'showActivityHeatmap()' },
    { icon: 'book', label: 'Cheat sheets', sub: 'SQL / Regex', cb: 'openCheatSheets()' },
    { icon: 'diff', label: 'Diff XML/JSON', sub: 'DEV vs PROD', cb: 'openDiffViewer()' },
    { icon: 'check', label: 'Validateur Ivalua', sub: 'Pré-import', cb: 'openIvaluaValidator()' },
    { icon: 'filetext', label: 'Rapport partageable', sub: 'HTML autonome', cb: 'generateShareableReport()' }
  ];
  const wrapper = document.createElement('div');
  wrapper.id = 'sprintb-quickactions';
  wrapper.style.cssText = 'display:contents;';
  wrapper.innerHTML = newActions.map(a => `
    <button class="qa-btn" onclick="${a.cb}">
      <span class="qa-btn-icon" data-icon="${a.icon}" data-icon-size="22"></span>
      <span class="qa-btn-label">${a.label}</span>
      <span class="qa-btn-sub">${a.sub}</span>
    </button>`).join('');
  grid.appendChild(wrapper);
  // Hydrater les nouvelles icônes
  Icons.hydrate(wrapper);
}

// Ajouter les outils dans la page Configuration
function enhanceConfigWithSprintB() {
  const config = document.getElementById('page-config');
  if (!config || document.getElementById('sprintb-config-card')) return;
  // Trouver la dernière config-card (Outils avancés ajoutée en v10)
  const cards = config.querySelectorAll('.config-card');
  if (cards.length === 0) return;
  const lastCard = cards[cards.length - 1];
  // Ajouter une nouvelle carte juste après
  const card = document.createElement('div');
  card.className = 'config-card';
  card.id = 'sprintb-config-card';
  card.innerHTML = `
    <div class="config-header">
      <h3>🚀 Outils v11 — Direction & développement</h3>
    </div>
    <div style="padding: 16px 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
      <button class="btn btn-outline" onclick="openClientComparator()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">⚖️ Comparateur clients</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Vue côte-à-côte 2-4 clients</span>
      </button>
      <button class="btn btn-outline" onclick="showForecastModal()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">🔮 Forecast budgétaire</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Projection fin de mois</span>
      </button>
      <button class="btn btn-outline" onclick="showDecisionsModal()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">🧠 Mémoire des décisions</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Tracé des décisions comité</span>
      </button>
      <button class="btn btn-outline" onclick="showEngagementsModal()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">🤝 Engagements clients</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Tracker des promesses</span>
      </button>
      <button class="btn btn-outline" onclick="openDiffViewer()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">🔀 Diff XML/JSON</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Comparer DEV vs PROD</span>
      </button>
      <button class="btn btn-outline" onclick="openIvaluaValidator()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">🔍 Validateur Ivalua</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">XML, CSV, JSON</span>
      </button>
      <button class="btn btn-outline" onclick="openCheatSheets()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">📖 Cheat sheets</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Aide-mémoires SQL/Regex/Ivalua</span>
      </button>
      <button class="btn btn-outline" onclick="showActivityHeatmap()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">📊 Heatmap activité</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Vue calendaire 1 an</span>
      </button>
      <button class="btn btn-outline" onclick="generateShareableReport()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">📄 Rapport partageable</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">HTML autonome pour client</span>
      </button>
      <button class="btn btn-outline" onclick="applyProjectTemplate()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">📋 Template projet TMA</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Configuration standard</span>
      </button>
      <button class="btn btn-outline" onclick="NativeNotif.request()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">🔔 Activer notifications</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Alertes natives navigateur</span>
      </button>
      <button class="btn btn-outline" onclick="KeyShortcuts.showCheatSheet()" style="display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;">
        <span style="font-weight:700;font-size:13px;">⌨️ Raccourcis clavier</span>
        <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Liste complète (touche ?)</span>
      </button>
    </div>`;
  lastCard.parentNode.insertBefore(card, lastCard.nextSibling);
}


const Onboarding = {
  steps: [
    {
      title: 'Bienvenue dans Cyrias Buddy 👋',
      icon: '🎉',
      body: `
        <p style="font-size:13.5px;line-height:1.6;color:var(--ink-secondary);margin-bottom:16px;">
          Cyrias Buddy est votre <strong>cockpit TMA</strong> tout-en-un : pilotage de l'activité, suivi des tickets,
          générateurs SQL/mails, et bien plus.
        </p>
        <p style="font-size:13px;line-height:1.6;color:var(--ink-secondary);">
          Ce guide rapide (5 min) vous présentera les fonctionnalités essentielles. 
          Vous pourrez le rouvrir à tout moment depuis ⚙️ Configuration.
        </p>
        <div style="background:var(--info-bg);padding:12px 14px;border-radius:6px;margin-top:14px;font-size:12px;color:var(--ink-secondary);">
          🔒 <strong>Vos données restent chez vous</strong> : tout est stocké localement dans votre navigateur, aucune donnée n'est envoyée sur un serveur (sauf si vous activez l'IA Gemini).
        </div>`
    },
    {
      title: 'Personnalisez votre accueil',
      icon: '👤',
      body: `
        <p style="font-size:13px;line-height:1.6;color:var(--ink-secondary);margin-bottom:14px;">
          Comment souhaitez-vous être appelé ? Cela personnalisera votre tableau de bord et apparaîtra dans les exports.
        </p>
        <input type="text" id="ob-username" placeholder="Votre prénom ou pseudo" 
               value="${(localStorage.getItem('cyrias_username') || '').replace(/"/g, '&quot;')}"
               style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-family:inherit;">
        <p style="font-size:11px;color:var(--ink-muted);margin-top:8px;">Optionnel — vous pourrez le modifier plus tard depuis l'accueil.</p>`,
      onNext() {
        const v = document.getElementById('ob-username')?.value.trim();
        if (v) localStorage.setItem('cyrias_username', v);
      }
    },
    {
      title: 'Quel est votre rôle ?',
      icon: '🎯',
      body: `
        <p style="font-size:13px;line-height:1.6;color:var(--ink-secondary);margin-bottom:14px;">
          Cela permettra de mettre en avant les fonctionnalités les plus utiles pour vous.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <label class="ob-role" data-role="director">
            <input type="radio" name="ob-role" value="director" style="display:none;">
            <div style="font-size:24px;">👔</div>
            <div style="font-weight:700;font-size:13px;">Directeur de projet</div>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:4px;">Vision macro, décisions, reporting</div>
          </label>
          <label class="ob-role" data-role="cdp">
            <input type="radio" name="ob-role" value="cdp" style="display:none;">
            <div style="font-size:24px;">📋</div>
            <div style="font-weight:700;font-size:13px;">Chef de projet</div>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:4px;">Animation équipe, escalades, suivi</div>
          </label>
          <label class="ob-role" data-role="dev">
            <input type="radio" name="ob-role" value="dev" style="display:none;">
            <div style="font-size:24px;">💻</div>
            <div style="font-weight:700;font-size:13px;">Développeur / Consultant</div>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:4px;">Code, SQL, snippets, debug</div>
          </label>
          <label class="ob-role" data-role="all">
            <input type="radio" name="ob-role" value="all" style="display:none;" checked>
            <div style="font-size:24px;">✨</div>
            <div style="font-weight:700;font-size:13px;">Polyvalent</div>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:4px;">Un peu de tout</div>
          </label>
        </div>`,
      onMount() {
        document.querySelectorAll('.ob-role').forEach(el => {
          el.addEventListener('click', () => {
            document.querySelectorAll('.ob-role').forEach(x => x.classList.remove('ob-role-active'));
            el.classList.add('ob-role-active');
            el.querySelector('input').checked = true;
          });
        });
        // Activer celui par défaut
        const def = document.querySelector('.ob-role input[checked], .ob-role input:checked');
        if (def) def.closest('.ob-role').classList.add('ob-role-active');
      },
      onNext() {
        const sel = document.querySelector('.ob-role input:checked');
        if (sel) localStorage.setItem('cyrias_user_role', sel.value);
      }
    },
    {
      title: 'La recherche, votre meilleure alliée',
      icon: '🔍',
      body: `
        <p style="font-size:13px;line-height:1.6;color:var(--ink-secondary);margin-bottom:14px;">
          Avec 15+ modules, le plus rapide est souvent la <strong>recherche universelle</strong>.
        </p>
        <div style="background:var(--bg);padding:16px;border-radius:8px;margin-bottom:14px;text-align:center;">
          <div style="font-size:11px;color:var(--ink-muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">Appuyez n'importe où sur</div>
          <div style="display:inline-flex;gap:6px;align-items:center;">
            <kbd style="background:var(--surface);padding:8px 14px;border-radius:6px;border:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.05);">Ctrl</kbd>
            <span style="color:var(--ink-muted);">+</span>
            <kbd style="background:var(--surface);padding:8px 14px;border-radius:6px;border:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.05);">K</kbd>
          </div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:10px;">Recherchez modules, snippets, tickets, liens...</div>
        </div>
        <p style="font-size:12px;color:var(--ink-secondary);">
          🎯 Astuces clavier : appuyez sur <kbd style="background:var(--bg);padding:1px 6px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:11px;">?</kbd> pour voir tous les raccourcis (g+c → CRAminator, g+s → Snippets...).
        </p>`
    },
    {
      title: 'Importez vos premières données',
      icon: '📥',
      body: `
        <p style="font-size:13px;line-height:1.6;color:var(--ink-secondary);margin-bottom:14px;">
          Pour activer toute la puissance du portail, importez vos exports Stafiz dans <strong>CRAminator</strong>.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:8px;">
            <span style="font-size:24px;">1️⃣</span>
            <div style="font-size:12.5px;color:var(--ink-secondary);">Allez dans <strong>📊 CRAminator</strong> (menu Pilotage)</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:8px;">
            <span style="font-size:24px;">2️⃣</span>
            <div style="font-size:12.5px;color:var(--ink-secondary);">Glissez votre export Excel ou utilisez le bouton d'import</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:8px;">
            <span style="font-size:24px;">3️⃣</span>
            <div style="font-size:12.5px;color:var(--ink-secondary);">Configurez les TJM et budgets — les KPI se calculent automatiquement</div>
          </div>
        </div>
        <div style="background:var(--secondary-light);padding:12px;border-radius:6px;margin-top:14px;font-size:12px;color:var(--ink-secondary);border-left:3px solid var(--secondary);">
          💡 <strong>Astuce</strong> : Vous pouvez importer plusieurs CRA d'affilée — ils seront fusionnés.
        </div>`
    },
    {
      title: 'Sauvegardez vos données régulièrement',
      icon: '💾',
      body: `
        <p style="font-size:13px;line-height:1.6;color:var(--ink-secondary);margin-bottom:14px;">
          Toutes vos données sont stockées <strong>uniquement dans votre navigateur</strong>. 
          Pour ne rien perdre :
        </p>
        <ul style="font-size:12.5px;color:var(--ink-secondary);line-height:1.8;padding-left:20px;margin-bottom:14px;">
          <li>Exportez une sauvegarde JSON <strong>au moins une fois par semaine</strong></li>
          <li>Avant de changer de poste ou vider le cache du navigateur</li>
          <li>Le portail vous rappelle automatiquement après 14 jours sans sauvegarde</li>
        </ul>
        <div style="background:var(--info-bg);padding:12px;border-radius:6px;font-size:12px;color:var(--ink-secondary);">
          📍 <strong>Où trouver ça ?</strong><br>
          ⚙️ Configuration → 💾 Sauvegarde &amp; Restauration
        </div>`
    },
    {
      title: 'Vous êtes prêt ! 🚀',
      icon: '🎊',
      body: `
        <p style="font-size:14px;line-height:1.6;color:var(--ink-secondary);margin-bottom:16px;">
          Voilà l'essentiel. Quelques pistes pour aller plus loin :
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div style="padding:12px;background:var(--bg);border-radius:8px;border-left:3px solid var(--secondary);">
            <div style="font-weight:700;font-size:13px;color:var(--ink);margin-bottom:4px;">📋 Saisir des tickets</div>
            <div style="font-size:11px;color:var(--ink-muted);">Le Kanban supporte le drag &amp; drop et calcule les SLA automatiquement</div>
          </div>
          <div style="padding:12px;background:var(--bg);border-radius:8px;border-left:3px solid var(--info);">
            <div style="font-weight:700;font-size:13px;color:var(--ink);margin-bottom:4px;">🎤 Standup quotidien</div>
            <div style="font-size:11px;color:var(--ink-muted);">Bouton sur l'accueil — génère votre point en 1 clic</div>
          </div>
          <div style="padding:12px;background:var(--bg);border-radius:8px;border-left:3px solid var(--warn);">
            <div style="font-weight:700;font-size:13px;color:var(--ink);margin-bottom:4px;">✉️ Templates mails</div>
            <div style="font-size:11px;color:var(--ink-muted);">Bibliothèque de 6 modèles pré-remplis</div>
          </div>
          <div style="padding:12px;background:var(--bg);border-radius:8px;border-left:3px solid #8b5cf6;">
            <div style="font-weight:700;font-size:13px;color:var(--ink);margin-bottom:4px;">🔮 Forecast</div>
            <div style="font-size:11px;color:var(--ink-muted);">Projection automatique de la conso budgétaire</div>
          </div>
        </div>
        <div style="background:var(--secondary-light);padding:14px;border-radius:8px;text-align:center;font-size:12.5px;color:var(--ink-secondary);">
          ❓ Besoin d'aide ? Appuyez sur <kbd style="background:white;padding:2px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;border:1px solid var(--border);">?</kbd> pour voir tous les raccourcis clavier.
        </div>`
    }
  ],

  current: 0,

  shouldShow() {
    return !localStorage.getItem('cyrias_onboarding_done');
  },

  start(force = false) {
    this.current = 0;
    this.render();
    AuditLog.log('onboarding_started', force ? 'manual' : 'auto');
  },

  finish() {
    localStorage.setItem('cyrias_onboarding_done', new Date().toISOString());
    document.getElementById('onboarding-modal')?.remove();
    toastOk("Vous êtes opérationnel ! Bonne TMA 🚀", { title: "C'est parti", duration: 5000 });
    AuditLog.log('onboarding_completed');
  },

  next() {
    const step = this.steps[this.current];
    if (step.onNext) try { step.onNext(); } catch(e) { console.warn(e); }
    this.current++;
    if (this.current >= this.steps.length) this.finish();
    else this.render();
  },

  prev() {
    if (this.current > 0) {
      this.current--;
      this.render();
    }
  },

  skip() {
    if (confirm("Vous pouvez relancer ce guide à tout moment depuis ⚙️ Configuration.\n\nFermer maintenant ?")) {
      this.finish();
    }
  },

  render() {
    let modal = document.getElementById('onboarding-modal');
    if (modal) modal.remove();
    const step = this.steps[this.current];
    const total = this.steps.length;
    const isLast = this.current === total - 1;
    modal = document.createElement('div');
    modal.id = 'onboarding-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);backdrop-filter:blur(2px);';
    modal.innerHTML = `
      <div style="background:var(--surface);width:min(560px,92vw);max-height:90vh;border-radius:var(--radius-lg);box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;animation:slideUp 0.25s ease-out;display:flex;flex-direction:column;">
        <!-- Header avec progress -->
        <div style="background:linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);color:white;padding:20px 24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;opacity:0.85;letter-spacing:0.6px;">Guide de démarrage</span>
            <button onclick="Onboarding.skip()" style="background:rgba(255,255,255,0.15);border:none;color:white;font-size:11px;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;">Passer</button>
          </div>
          <div style="display:flex;gap:4px;margin-bottom:14px;">
            ${this.steps.map((_, i) => `
              <div style="flex:1;height:3px;background:${i <= this.current ? 'white' : 'rgba(255,255,255,0.25)'};border-radius:2px;transition:background 0.3s;"></div>
            `).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="font-size:36px;line-height:1;">${step.icon}</div>
            <div>
              <h3 style="margin:0;font-size:18px;font-weight:700;">${step.title}</h3>
              <div style="font-size:11px;opacity:0.85;margin-top:2px;">Étape ${this.current + 1} sur ${total}</div>
            </div>
          </div>
        </div>
        <!-- Body -->
        <div style="padding:24px;overflow-y:auto;flex:1;">
          ${step.body}
        </div>
        <!-- Footer -->
        <div style="padding:14px 24px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:space-between;align-items:center;">
          <button onclick="Onboarding.prev()" style="background:none;border:none;color:var(--ink-muted);font-size:13px;cursor:pointer;font-family:inherit;${this.current === 0 ? 'visibility:hidden;' : ''}">← Précédent</button>
          <button class="btn btn-primary" onclick="Onboarding.next()" style="font-size:13px;padding:8px 20px;">${isLast ? "C'est parti ! 🚀" : "Suivant →"}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    if (step.onMount) try { step.onMount(); } catch(e) { console.warn(e); }
  }
};
window.Onboarding = Onboarding;

// CSS pour l'onboarding (rôles)
(function() {
  const s = document.createElement('style');
  s.textContent = `
    .ob-role { display:flex; flex-direction:column; align-items:center; padding:16px 12px; border:2px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.15s; text-align:center; }
    .ob-role:hover { border-color:var(--secondary); background:var(--secondary-light); }
    .ob-role.ob-role-active { border-color:var(--secondary); background:var(--secondary-light); box-shadow:0 0 0 3px rgba(94,176,145,0.15); }
  `;
  document.head.appendChild(s);
})();

// Auto-lancement au premier chargement
window.addEventListener('load', () => {
  setTimeout(() => {
    if (Onboarding.shouldShow()) {
      Onboarding.start();
    }
  }, 1500);
});

// Bouton dans la page Configuration pour relancer
function addOnboardingToConfig() {
  const card = document.getElementById('sprintb-config-card');
  if (!card) return;
  const grid = card.querySelector('div[style*="grid-template-columns"]');
  if (!grid || document.getElementById('btn-onboarding-restart')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-onboarding-restart';
  btn.className = 'btn btn-outline';
  btn.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;text-align:left;gap:4px;';
  btn.innerHTML = `
    <span style="font-weight:700;font-size:13px;">🎓 Relancer le guide</span>
    <span style="font-size:11px;color:var(--ink-muted);font-weight:400;">Tour de présentation des features</span>`;
  btn.onclick = () => Onboarding.start(true);
  grid.appendChild(btn);
}
window.addEventListener('load', () => setTimeout(addOnboardingToConfig, 1000));

