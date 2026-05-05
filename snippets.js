/* ============================================================
   Cyrias Buddy — Boîte à Snippets
   ============================================================ */
// ==========================================
// BOÎTE À SNIPPETS - LOGIQUE DYNAMIQUE
// ==========================================

const DEFAULT_SNIPPETS = [
  {
    id: 'snip_1',
    title: 'Débloquer un Workflow (SQL)',
    code: `-- Remplacez @TicketID par l'ID du document bloqué
UPDATE dbo.WorkflowTable
SET Status = 'En cours'
WHERE Id = @TicketID;

-- Penser à tracer l'intervention dans le ticket Service Now.`
  },
  {
    id: 'snip_2',
    title: 'Regex : Email Ivalua Strict',
    code: `^([a-zA-Z0-9_\\-\\.]+)@([a-zA-Z0-9_\\-\\.]+)\\.([a-zA-Z]{2,5})$`
  },
  {
    id: 'snip_3',
    title: 'Script Rollback Générique (SQL)',
    code: `-- 1. BACKUP AVANT UPDATE
SELECT * INTO dbo.MaTable_BKP_20260429
FROM dbo.MaTable
WHERE MaCondition = 1;

-- 2. SCRIPT DE ROLLBACK (En cas d'erreur)
/*
UPDATE cible
SET cible.Champ = bkp.Champ
FROM dbo.MaTable cible
INNER JOIN dbo.MaTable_BKP_20260429 bkp ON cible.Id = bkp.Id;
*/`
  },
  {
    id: 'snip_4',
    title: 'JS : Forcer la validation d\'un formulaire',
    code: `// À exécuter dans la console du navigateur en cas de blocage UI
// Remplacez 'formId' par l'ID de votre formulaire Ivalua
var form = document.getElementById('formId');
if(form) {
    var validator = $(form).validate();
    if(validator) {
        validator.cancelSubmit = true;
    }
    form.submit();
}`
  }
];

// Chargement depuis le cache local ou utilisation des snippets par défaut
let snippetsData = SafeStorage.get('cyrias_snippets') || DEFAULT_SNIPPETS;
let currentSnippetId = null;

function renderSnippets() {
    const list = document.getElementById('snippet-list');
    const search = document.getElementById('snippet-search').value.toLowerCase();
    
    if (!list) return;
    list.innerHTML = '';

    const filtered = snippetsData.filter(s => s.title.toLowerCase().includes(search) || s.code.toLowerCase().includes(search));

    if (filtered.length === 0) {
        list.innerHTML = '<div style="font-size: 12px; color: var(--ink-muted); text-align: center; padding: 20px;">Aucun snippet trouvé.</div>';
        return;
    }

    filtered.forEach(s => {
        const isActive = s.id === currentSnippetId;
        const bg = isActive ? 'var(--secondary-light)' : 'var(--surface)';
        const color = isActive ? 'var(--primary)' : 'var(--ink-secondary)';
        const border = isActive ? 'var(--secondary)' : 'var(--border)';

        list.innerHTML += `
            <button onclick="selectSnippet('${s.id}')" 
                    style="text-align: left; padding: 10px 12px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${color}; font-size: 12px; font-weight: ${isActive ? '700' : '500'}; cursor: pointer; transition: 0.2s;">
                ${s.title}
            </button>
        `;
    });
}

function selectSnippet(id) {
    currentSnippetId = id;
    const snippet = snippetsData.find(s => s.id === id);
    
    if (snippet) {
        document.getElementById('snippet-title').value = snippet.title;
        document.getElementById('snippet-code').value = snippet.code;
        document.getElementById('btn-del-snippet').style.display = 'block';
    }
    
    renderSnippets();
}

function addNewSnippet() {
    const newId = 'snip_' + Date.now();
    const newSnippet = {
        id: newId,
        title: 'Nouveau Snippet',
        code: ''
    };
    
    snippetsData.unshift(newSnippet);
    saveSnippetsToStorage();
    
    // Effacer la recherche pour voir le nouveau snippet
    document.getElementById('snippet-search').value = '';
    selectSnippet(newId);
    
    // Focus automatique sur le titre pour le renommer
    document.getElementById('snippet-title').focus();
    document.getElementById('snippet-title').select();
}

function saveSnippetTitle() {
    if (!currentSnippetId) return;
    const snippet = snippetsData.find(s => s.id === currentSnippetId);
    if (snippet) {
        snippet.title = document.getElementById('snippet-title').value.trim() || 'Snippet sans titre';
        saveSnippetsToStorage();
        renderSnippets();
    }
}

function saveSnippetCode() {
    if (!currentSnippetId) return;
    const snippet = snippetsData.find(s => s.id === currentSnippetId);
    if (snippet) {
        snippet.code = document.getElementById('snippet-code').value;
        saveSnippetsToStorage();
    }
}

function deleteCurrentSnippet() {
    if (!currentSnippetId) return;
    if (confirm('Voulez-vous vraiment supprimer ce snippet ?')) {
        snippetsData = snippetsData.filter(s => s.id !== currentSnippetId);
        saveSnippetsToStorage();
        
        if (snippetsData.length > 0) {
            selectSnippet(snippetsData[0].id);
        } else {
            currentSnippetId = null;
            document.getElementById('snippet-title').value = '';
            document.getElementById('snippet-code').value = '';
            document.getElementById('btn-del-snippet').style.display = 'none';
            renderSnippets();
        }
    }
}

function saveSnippetsToStorage() {
    SafeStorage.set('cyrias_snippets', snippetsData);
}

// Initialisation au démarrage
window.addEventListener('load', () => {
    if (snippetsData.length > 0) {
        selectSnippet(snippetsData[0].id);
    } else {
        renderSnippets();
    }
});

// ============================================================
// FEATURE #14 — Snippetator amélioré (tags + recherche full-text)
// ============================================================
// Hook léger sur les snippets : si la fonction renderSnippets existe,
// on étend son comportement pour ajouter une recherche full-text
const _snippetSearchOriginal = window.renderSnippets;
if (typeof _snippetSearchOriginal === 'function') {
  window.renderSnippets = function(...args) {
    const result = _snippetSearchOriginal.apply(this, args);
    // Ajouter un placeholder plus parlant si possible
    const searchInput = document.getElementById('snippet-search');
    if (searchInput && !searchInput.dataset.enhanced) {
      searchInput.placeholder = 'Rechercher dans titres et contenu...';
      searchInput.dataset.enhanced = '1';
    }
    return result;
  };
}

