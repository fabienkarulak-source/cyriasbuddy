/* ============================================================
   Cyrias Buddy — SQL Generator
   ============================================================ */
// ==========================================
// SQL GENERATOR - LOGIQUE COMPLÈTE
// ==========================================
var CRITERIA = [
  'En-tête obligatoire (Login / Date / Request / Purpose)',
  'Commentaires SQL étape par étape',
  'Justification si exécution >= 20 secondes',
  'Keywords SQL en MAJUSCULES',
  'Types de données en minuscules',
  'Pas de keywords SQL comme alias',
  'Pas de tables sur schéma dbo — @table ou #temp',
  'GO statement en fin de script',
  'Batch si >1000 lignes à traiter (WAITFOR DELAY)',
  'Objets qualifiés avec schéma (dbo.TableName)',
  'Pas de SELECT *',
  'Colonnes explicites et minimales',
  'Alias sur colonnes dans SELECT/JOIN/WHERE',
  'Méthode EXISTS/IN/JOIN/CROSS APPLY appropriée',
  'Pas de liste IN > 100 valeurs hardcodées',
  'CASE expressions simples',
  'IS NULL / IS NOT NULL uniquement (jamais = NULL)',
  'COALESCE() plutôt que ISNULL()',
  'Préférer instructions positives',
  'Pas de OR — utiliser IN ou UNION',
  'Pas de variables locales dans WHERE',
  'Pas de fonctions sur colonnes en JOIN/WHERE',
  'Éviter CTE récursifs inutiles',
  'Pas de wildcard % en début de LIKE',
  'Éviter colonne language si non nécessaire',
  'GROUP BY sur colonnes indexées',
  'Pas de curseurs — set-based ou CROSS APPLY',
  'Minimiser les boucles WHILE',
  'TRY...CATCH pour la gestion des erreurs',
  'ERROR_MESSAGE/NUMBER/SEVERITY/PROCEDURE',
  'BEGIN/COMMIT/ROLLBACK avec CATCH complet',
  'Pas de varchar(max) dans tables temp/variables',
  'Types non surdimensionnés',
  'Pas de mismatch de type en JOIN/WHERE'
];

let curDML = 'SELECT';
let curSQL = '';

document.addEventListener('DOMContentLoaded', () => {
    // Remplir la checklist
    const cl = document.getElementById('sql-clist');
    if (cl) {
        CRITERIA.forEach(c => {
            cl.innerHTML += `<div class="sql-cr"><div class="sql-cd"></div>${c}</div>`;
        });
    }
    // Remplir la date du jour par défaut
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
});

function selDML(el) {
    document.querySelectorAll('.sql-dml-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    curDML = el.dataset.dml;
}

function hl(code){
  var KW = /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|INNER|LEFT|RIGHT|OUTER|FULL|CROSS|APPLY|ON|SET|BEGIN|END|COMMIT|ROLLBACK|TRANSACTION|TRAN|TRY|CATCH|DECLARE|AS|WITH|UNION|ALL|DISTINCT|TOP|ORDER|BY|GROUP|HAVING|EXISTS|IN|NOT|AND|OR|IS|NULL|CASE|WHEN|THEN|ELSE|IF|WHILE|RETURN|EXEC|EXECUTE|CREATE|ALTER|DROP|TABLE|VIEW|GO|USE|RAISERROR|XACT_STATE|WAITFOR|DELAY|CAST|CONVERT|COALESCE|COUNT|SUM|AVG|MIN|MAX|ROW_NUMBER|OVER|PARTITION|VALUES|OUTPUT|NOCOUNT|OFF|PRINT|GETDATE|DATEDIFF|SECOND|ROWS|FETCH|NEXT|ONLY|OFFSET)\b/g;
  var TP = /\b(int|bigint|smallint|tinyint|varchar|nvarchar|char|nchar|datetime|datetime2|date|time|decimal|numeric|float|real|bit|money|uniqueidentifier|varbinary|xml|sysname)\b/g;
  var NM = /\b(\d+(\.\d+)?)\b/g;
  return code
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(\/\*[\s\S]*?\*\/|--[^\n]*)/g,function(m){return '<span class="cm">'+m+'</span>';})
    .replace(/('[^']*')/g,function(m){return '<span class="st">'+m+'</span>';})
    .replace(KW,function(m){return '<span class="kw">'+m+'</span>';})
    .replace(TP,function(m){return '<span class="tp">'+m+'</span>';})
    .replace(NM,function(m){return '<span style="color:#e3b341">'+m+'</span>';});
}

function renderCode(sql){
  if (!sql) {
    console.error('renderCode: SQL vide');
    return;
  }
  
  try {
    curSQL = sql;
    var lines = sql.split('\n');
    
    var lcount = document.getElementById('sql-lcount');
    var lnums = document.getElementById('sql-lnums');
    var ccontent = document.getElementById('sql-ccontent');
    var cpyBtn = document.getElementById('sql-cpyBtn');
    var dlBtn = document.getElementById('sql-dlBtn');
    
    if (!lcount || !lnums || !ccontent || !cpyBtn || !dlBtn) {
      console.error('renderCode: Éléments SQL manquants');
      return;
    }
    
    lcount.textContent = lines.length + ' lignes';
    lnums.innerHTML = lines.map(function(_,i){return '<span style="display:block; padding: 0 12px;">'+(i+1)+'</span>';}).join('');
    ccontent.innerHTML = hl(sql);
    cpyBtn.style.display = 'inline-flex';
    dlBtn.style.display = 'inline-flex';
  } catch (e) {
    console.error('renderCode error:', e);
  }
}

function buildSQL(o){
  var a = o.alias || (o.table.charAt(0).toLowerCase());
  var st = o.schema + '.' + o.table;
  var cols = o.cols.length ? o.cols : ['Id','Name','CreatedAt'];
  var sel = cols.map(function(c){return '    '+a+'.'+c.trim();}).join(',\n');
  var big = o.volume === 'large', med = o.volume === 'medium';
  var nb = big || med;
  var jst = o.dur === 'gt20';

  var H=[
'/************************************************************************/',
'/* Login              : '+o.login+'                 */',
'/* Date               : '+o.date+'                              */',
'/* Request (Mandatory): '+o.demande+'                           */',
'/* Purpose            : '+o.purpose+'  */',
'/* Estimation duration: '+(jst?'> 20 secondes - voir justification':'< 20 secondes')+'  */',
'/************************************************************************/'
].join('\n');

  var J = jst ? '-- JUSTIFICATION >= 20s : volume estimé '+(big?'>10 000':med?'1 000-10 000':'elevé')+', traitement par batch de '+o.bsz+' lignes.\n' : '';

  var V=[
'-- ================================================================',
'-- SECTION 1 : Variables et paramètres',
'-- ================================================================',
'DECLARE @BatchSize  int       = '+o.bsz+';    -- Taille du batch',
'DECLARE @RowCount   int       = 0;            -- Compteur cumulé',
'DECLARE @TotalRows  int       = 0;            -- Total à traiter',
'DECLARE @Offset     int       = 0;            -- Curseur pagination',
'DECLARE @StartTime  datetime  = GETDATE();    -- Horodatage début'
].join('\n');

  var VT=[
'',
'-- Table variable pour les IDs à traiter (critère 15 : évite IN > 100 valeurs)',
'DECLARE @Ids TABLE (',
'    Id int NOT NULL',
');',
'',
'-- Alimentation de la table variable',
'INSERT INTO @Ids (Id)',
'SELECT '+a+'.'+cols[0].trim(),
'FROM '+st+' '+a+(o.join?'\nINNER JOIN '+o.join:''),
'WHERE '+(o.where?o.where:a+'.'+cols[0].trim()+' IS NOT NULL')+';',
'',
'SET @TotalRows = (SELECT COUNT(1) FROM @Ids);',
'PRINT \'Total lignes à traiter : \' + CAST(@TotalRows AS varchar(20));'
].join('\n');

  var BODY='';
  if(curDML==='SELECT'){
    BODY=[
'-- ================================================================',
'-- SECTION 2 : Sélection des données',
'-- Critères : pas de SELECT *, alias sur toutes les colonnes, EXISTS',
'-- ================================================================',
'SELECT',
sel,
'FROM '+st+' '+a+(o.join?'\nINNER JOIN '+o.join:''),
'WHERE EXISTS (',
'    SELECT 1 FROM @Ids ids WHERE ids.Id = '+a+'.'+cols[0].trim(),')',
(o.where?'  AND '+o.where:''),
'ORDER BY '+a+'.'+cols[0].trim()+';'
].filter(Boolean).join('\n');
  } else if(curDML==='UPDATE'){
    var uc=cols.filter(function(c){return !/^id$/i.test(c.trim());});
    if(!uc.length) uc=['Name'];
    BODY=[
'-- ================================================================',
'-- SECTION 2 : Valeurs de mise à jour',
'-- ================================================================',
uc.map(function(c){return 'DECLARE @New'+c.trim()+' nvarchar(255) = N\'\'; -- TODO: définir la valeur';}).join('\n'),
'',
'-- ================================================================',
'-- SECTION 3 : UPDATE par batch (critère 9)',
'-- ================================================================',
'WHILE @Offset < @TotalRows',
'BEGIN',
'    UPDATE '+a,
'    SET',
uc.map(function(c){return '        '+a+'.'+c.trim()+' = @New'+c.trim();}).join(',\n'),
'    FROM '+st+' '+a,
'    INNER JOIN (',
'        SELECT ids.Id FROM @Ids ids',
'        ORDER BY ids.Id OFFSET @Offset ROWS FETCH NEXT @BatchSize ROWS ONLY',
'    ) batch ON batch.Id = '+a+'.'+cols[0].trim(),
(o.where?'    WHERE '+o.where:''),
'    ;',
'    SET @RowCount = @RowCount + @@ROWCOUNT;',
'    SET @Offset   = @Offset + @BatchSize;',
'    WAITFOR DELAY \'00:00:01\';',
'    PRINT \'Batch UPDATE — cumul : \' + CAST(@RowCount AS varchar(20)) + \' / \' + CAST(@TotalRows AS varchar(20));',
'END'
].filter(Boolean).join('\n');
  } else if(curDML==='INSERT'){
    var ic=cols.filter(function(c){return !/^id$/i.test(c.trim());});
    if(!ic.length) ic=['Name'];
    BODY=[
'-- ================================================================',
'-- SECTION 2 : Insertion des données',
'-- ================================================================',
'INSERT INTO '+st+' (',
ic.map(function(c){return '    '+c.trim();}).join(',\n'),
')',
'SELECT',
ic.map(function(c){return '    src.'+c.trim();}).join(',\n'),
'FROM '+o.schema+'.Source'+o.table+' src',
'WHERE EXISTS (',
'    SELECT 1 FROM @Ids ids WHERE ids.Id = src.'+cols[0].trim(),')',
(o.where?'  AND src.'+o.where:''),
';',
'SET @RowCount = @@ROWCOUNT;',
'PRINT CAST(@RowCount AS varchar(20)) + \' ligne(s) insérée(s).\';'
].filter(Boolean).join('\n');
  } else if(curDML==='DELETE'){
    BODY=[
'-- ================================================================',
'-- SECTION 2 : Suppression par batch (critère 9)',
'-- ================================================================',
'WHILE @Offset < @TotalRows',
'BEGIN',
'    DELETE '+a,
'    FROM '+st+' '+a,
'    INNER JOIN (',
'        SELECT ids.Id FROM @Ids ids',
'        ORDER BY ids.Id OFFSET @Offset ROWS FETCH NEXT @BatchSize ROWS ONLY',
'    ) batch ON batch.Id = '+a+'.'+cols[0].trim(),
(o.where?'    WHERE '+o.where:''),
'    ;',
'    SET @RowCount = @RowCount + @@ROWCOUNT;',
'    SET @Offset   = @Offset + @BatchSize;',
'    WAITFOR DELAY \'00:00:01\';',
'    PRINT \'Batch DELETE — cumul : \' + CAST(@RowCount AS varchar(20)) + \' / \' + CAST(@TotalRows AS varchar(20));',
'END'
].filter(Boolean).join('\n');
  }

  var EX = o.existing ? [
'\n-- ================================================================',
'-- SCRIPT EXISTANT RÉINTÉGRÉ (conformisé aux standards)',
'-- ================================================================',
o.existing
].join('\n') : '';

  var TC=[
'-- ================================================================',
'-- TRANSACTION + GESTION D\'ERREUR (critères 29 à 31)',
'-- TRY/CATCH, BEGIN TRAN, COMMIT, ROLLBACK, RAISERROR, ERROR_*',
'-- ================================================================',
'BEGIN TRY',
'    BEGIN TRANSACTION;',
'    SET NOCOUNT ON;',
'',
V,
VT,
'',
BODY,
EX,
'',
'    -- Rapport de fin',
'    PRINT \'Traitement terminé en \' + CAST(DATEDIFF(SECOND, @StartTime, GETDATE()) AS varchar(10)) + \'s — \' + CAST(@RowCount AS varchar(20)) + \' ligne(s) affectée(s).\';',
'    COMMIT TRANSACTION;',
'',
'END TRY',
'BEGIN CATCH',
'    -- Capture complète des infos d\'erreur (critère 30)',
'    DECLARE @err_msg nvarchar(4000) =',
'          COALESCE(\'Procedure : \' + ERROR_PROCEDURE(), \'\')',
'        + \' - Line \'           + CAST(ERROR_LINE()     AS varchar(10))',
'        + \' - Error Number : \' + CAST(ERROR_NUMBER()   AS varchar(10))',
'        + \' - \'                + ERROR_MESSAGE();',
'    DECLARE @err_svt int = ERROR_SEVERITY();',
'    DECLARE @err_stt int = ERROR_STATE();',
'',
'    -- Rollback si transaction active (critère 31)',
'    IF XACT_STATE() <> 0',
'    BEGIN',
'        ROLLBACK TRANSACTION;',
'        PRINT \'Transaction annulée (ROLLBACK).\';',
'    END',
'',
'    RAISERROR(@err_msg, @err_svt, @err_stt);',
'    RETURN;',
'END CATCH',
'',
'GO'
].join('\n');

  return [H,'',J,TC].join('\n');
}

function generateSQL(){
  var prenom = document.getElementById('prenom').value.trim();
  var nom = document.getElementById('nom').value.trim();
  var demande = document.getElementById('demande').value.trim();
  var date = document.getElementById('date').value;
  var desc = document.getElementById('description').value.trim();

  if(!prenom || !nom || !demande || !desc){
    toastWarn('Veuillez remplir : Prénom, Nom, N° demande et Description.');
    return;
  }

  var login = prenom.toLowerCase() + '.' + nom.toLowerCase();
  var cols = (document.getElementById('cols').value || '').split(',').map(function(c){return c.trim();}).filter(Boolean);
  if(!cols.length) cols = ['Id','Name','CreatedAt'];

  var existingScript = document.getElementById('sqlIn') ? document.getElementById('sqlIn').value.trim() : '';

  var sql = buildSQL({
    login: login, date: date, demande: demande, purpose: desc,
    table: document.getElementById('tbl').value.trim() || 'MyTable',
    schema: document.getElementById('sch').value.trim() || 'dbo',
    alias: document.getElementById('ali').value.trim(),
    cols: cols,
    where: document.getElementById('whr').value.trim(),
    join: document.getElementById('jn').value.trim(),
    volume: document.getElementById('vol').value,
    bsz: document.getElementById('bsz').value || '500',
    dur: document.getElementById('dur').value,
    existing: existingScript
  });

  renderCode(sql);
}

function cpySQL(){
  if(!curSQL) return;
  navigator.clipboard.writeText(curSQL).then(function(){
    var b = document.getElementById('sql-cpyBtn');
    var originalHTML = b.innerHTML;
    b.innerHTML = '✓ Copié !';
    setTimeout(function(){ b.innerHTML = originalHTML; }, 2000);
  });
}

function dlSQL(){
  if(!curSQL) return;
  var p = document.getElementById('prenom').value || 'script';
  var d = document.getElementById('demande').value || 'sql';
  var fn = p.toLowerCase() + '_' + d.replace(/[^a-z0-9]/gi,'_').toLowerCase() + '.sql';
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([curSQL], {type: 'text/plain;charset=utf-8'}));
  a.download = fn; 
  document.body.appendChild(a); 
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
}

/* =========================================
   ORGANISATOR - TIMER & GESTION TÂCHES
   ========================================= */

let orgTasks = JSON.parse(localStorage.getItem('cyrias_tasks')) || [];
let orgChart = null;
let orgTimer = null;
let timeLeft = 1500;
let isTimerRunning = false;

// Initialisation au chargement
window.addEventListener('load', function() {
  // Initialiser le timer et le chart si la page organisator est visible
  if(document.getElementById('page-organisator')) {
    updateTimerDisplay();
    if(!orgChart) initOrgChart();
    renderOrgTasks();
    updateOrgStats();
  }
});

// --- FUNCTIONS TIMER ---
function setTimer(minutes) {
  clearInterval(orgTimer);
  timeLeft = minutes * 60;
  isTimerRunning = false;
  updateTimerDisplay();
}

function setCustomTimer() {
  const custom = parseInt(document.getElementById('customTime').value) || 25;
  setTimer(custom);
}

function startTimer() {
    if (isTimerRunning) return;
    
    // Réveil forcé de l'audio
    if (audioCtx.state === 'suspended') audioCtx.resume();

    console.log("Permission actuelle :", Notification.permission);

    isTimerRunning = true;
    clearInterval(orgTimer);
    orgTimer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(orgTimer);
            orgTimer = null;
            isTimerRunning = false;
            timeLeft = 0;
            updateTimerDisplay();

            console.log("Timer fini. Tentative de son et notification...");
            playAlarmSequence(); 

            if (Notification.permission === "granted") {
                try {
                    new Notification("Cyrias Buddy", { 
                        body: "Focus terminé ! C'est l'heure de la pause.",
                        requireInteraction: true // La notif reste jusqu'à ce que vous cliquiez
                    });
                } catch (e) {
                    console.error("Erreur création notification :", e);
                }
            } else {
                console.warn("Notification refusée par le navigateur.");
                alert("Focus terminé ! (Notification bloquée par Chrome)");
            }
            return;
        }
        timeLeft--;
        updateTimerDisplay();
    }, 1000);
}

function pauseTimer() {
  clearInterval(orgTimer);
  isTimerRunning = false;
}

function resetTimer() {
  clearInterval(orgTimer);
  isTimerRunning = false;
  timeLeft = 1500;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const display = document.getElementById('timerDisplay');
  if(display) display.textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

// --- FUNCTIONS TÂCHES ---
function addTask() {
  const text = document.getElementById('taskInput').value.trim();
  const date = document.getElementById('dateInput').value;
  const priority = document.getElementById('priorityInput').value;
  const type = document.getElementById('typeInput').value;
  const repeat = document.getElementById('repeatInput').checked;
  
  if(!text || !date) {
    toastWarn('Veuillez remplir le titre et la date');
    return;
  }
  
  orgTasks.push({
    id: Date.now(),
    text: text,
    date: date,
    priority: priority,
    type: type,
    repeat: repeat,
    done: false,
    completedAt: null
  });
  
  saveOrgTasks();
  document.getElementById('taskInput').value = '';
  document.getElementById('dateInput').value = '';
  renderOrgTasks();
  updateOrgStats();
}

function toggleTask(id) {
  const task = orgTasks.find(t => t.id === id);
  if(task) {
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString().split('T')[0] : null;
    
    if(task.done && task.repeat) {
      const next = new Date(task.date);
      next.setDate(next.getDate() + 7);
      orgTasks.push({
        id: Date.now() + 1,
        text: task.text,
        date: next.toISOString().split('T')[0],
        priority: task.priority,
        type: task.type,
        repeat: true,
        done: false,
        completedAt: null
      });
    }
    
    if(task.done) confetti({spread: 70});
    saveOrgTasks();
    renderOrgTasks();
    updateOrgStats();
    updateOrgChart();
  }
}

function deleteTask(id) {
  orgTasks = orgTasks.filter(t => t.id !== id);
  saveOrgTasks();
  renderOrgTasks();
  updateOrgStats();
}

function saveOrgTasks() {
  localStorage.setItem('cyrias_tasks', JSON.stringify(orgTasks));
}

function renderOrgTasks() {
  const container = document.getElementById('taskList');
  if(!container) return;
  
  container.innerHTML = '';
  
  if(orgTasks.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--ink-muted); padding: 20px;">Aucune tâche. Commencez par en ajouter une ! 🚀</div>';
    return;
  }
  
  orgTasks.sort((a,b) => a.done - b.done).forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item task-' + task.priority + (task.done ? ' done' : '');
    
    const typeColors = {
      'TMA': 'badge-tma',
      'Formation': 'badge-formation',
      'Réunion': 'badge-reunion'
    };
    
    taskEl.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${task.id})">
      <div class="task-content">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          <span class="task-badge ${typeColors[task.type] || ''}">✓ ${task.type}</span>
          📅 ${task.date} ${task.repeat ? '🔄' : ''}
        </div>
      </div>
      <button class="task-delete" onclick="deleteTask(${task.id})" title="Supprimer">🗑️</button>
    `;
    container.appendChild(taskEl);
  });
}

