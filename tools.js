/* ============================================================
   Cyrias Buddy — Tools (Chart, Scratchpad, Stafiz, Communicator, DevTools)
   ============================================================ */
// --- CHART PERFORMANCE ---
function initOrgChart() {
  const canvas = document.getElementById('perfChart');
  if(!canvas) return;
  
  const ctx = canvas.getContext('2d');
  orgChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Tâches terminées',
        data: [],
        borderColor: 'var(--secondary)',
        backgroundColor: 'rgba(94, 176, 145, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: 'var(--secondary)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'var(--ink)', font: { family: "'Outfit', sans-serif" } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: 'var(--ink-muted)' },
          grid: { color: 'var(--border)' }
        },
        x: {
          ticks: { color: 'var(--ink-muted)' },
          grid: { color: 'var(--border)' }
        }
      }
    }
  });
  updateOrgChart();
}

function updateOrgChart() {
  if(!orgChart) return;
  
  const days = [];
  for(let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  
  const counts = days.map(day => {
    return orgTasks.filter(t => t.done && t.completedAt === day).length;
  });
  
  orgChart.data.labels = days.map(d => {
    const parts = d.split('-');
    return parts[2] + '/' + parts[1];
  });
  orgChart.data.datasets[0].data = counts;
  orgChart.update();
}
// --- 1. SCRATCHPAD ---
window.addEventListener('load', () => {
  const savedNotes = localStorage.getItem('cyrias_scratchpad');
  if (savedNotes) document.getElementById('scratchpad-text').value = savedNotes;
});

function toggleScratchpad() {
    const panel = document.getElementById('scratchpad-panel');
    if(panel) panel.classList.toggle('open');
  }
  
  // Restauration automatique au chargement
  window.addEventListener('DOMContentLoaded', () => {
    const savedNotes = localStorage.getItem('cyrias_scratchpad');
    if (savedNotes && document.getElementById('scratchpad-text')) {
      document.getElementById('scratchpad-text').value = savedNotes;
    }
  });

// --- 2. STAFIZ GENERATOR ---
function generateStafizReport() {
  const today = new Date().toISOString().split('T')[0];
  // On récupère les tâches de l'organisator qui sont faites aujourd'hui
  const doneTasks = (orgTasks || []).filter(t => t.done && t.completedAt === today);
  
  if (doneTasks.length === 0) {
    toastInfo("Aucune tâche terminée aujourd'hui dans l'Organisator !");
    return;
  }

  let report = "Activités du jour :\n";
  doneTasks.forEach(t => {
    report += `- [${t.type}] ${t.text}\n`;
  });

  navigator.clipboard.writeText(report).then(() => {
    toastOk("Rapport copié dans le presse-papier — prêt pour Stafiz", { title: "Copié" });
  });
}

// --- 3. COMMUNICATOR ---
function generateTemplate() {
  const type = document.getElementById('comm-type').value;
  const lang = document.getElementById('comm-lang').value;
  const ticket = document.getElementById('comm-ticket').value || '[Numéro du Ticket]';
  const client = document.getElementById('comm-client').value || '[Client]';
  const dateVal = document.getElementById('comm-date').value;
  
  // Formatage de la date selon la langue
  const dateStr = dateVal ? new Date(dateVal).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US') : '[Date]';

  let txt = "";

  if (type === 'mep') {
    if (lang === 'fr') {
      txt = `Bonjour l'équipe IT,

Veuillez trouver ci-dessous une nouvelle demande de déploiement pour ${client}.

• Référence du ticket : ${ticket}
• Environnement cible : PROD
• Date cible : ${dateStr}
• Plan de rollback : Fourni dans le script joint ou la description du ticket.

Merci de nous confirmer une fois le déploiement terminé.

Cordialement,
${currentUserLabel || 'L\'équipe Cyrias'}`;
    } else {
      txt = `Hi IT Team,

Please find below a new deployment request for ${client}.

• Ticket Reference: ${ticket}
• Target Environment: PROD
• Target Date: ${dateStr}
• Rollback Plan: Provided in the attached script / ticket description.

Please confirm once the deployment is completed.

Thank you,
${currentUserLabel || 'Cyrias Team'}`;
    }
  } else if (type === 'uat') {
    if (lang === 'fr') {
      txt = `Bonjour l'équipe,

Nous vous informons que la demande ${ticket} a été déployée sur l'environnement de Recette (UAT).
Vous pouvez dès à présent procéder à vos tests.

N'hésitez pas à nous faire un retour en mettant à jour le statut du ticket une fois vos tests terminés.

Cordialement,
${currentUserLabel || 'L\'équipe Cyrias'}`;
    } else {
      txt = `Hello team,

We would like to inform you that the request ${ticket} has been deployed to the UAT environment.
You can now proceed with your testing.

Please feel free to provide your feedback by updating the ticket status once your tests are completed.

Best regards,
${currentUserLabel || 'Cyrias Team'}`;
    }
  } else if (type === 'relance') {
    if (lang === 'fr') {
      txt = `Bonjour,

Sauf erreur de notre part, nous sommes en attente de votre validation concernant le ticket ${ticket}.
Pourriez-vous nous indiquer si les tests ont été concluants afin que nous puissions planifier le passage en production ?

Restant à votre disposition,
${currentUserLabel || 'L\'équipe Cyrias'}`;
    } else {
      txt = `Hello,

Unless we are mistaken, we are waiting for your validation regarding ticket ${ticket}.
Could you please let us know if the tests were successful so that we can schedule the deployment to production?

Remaining at your disposal,
${currentUserLabel || 'Cyrias Team'}`;
    }
  }

  document.getElementById('comm-result').value = txt;
}
function copyToolContent(elementId, btn) {
  const el = document.getElementById(elementId);
  if (!el.value) return;
  navigator.clipboard.writeText(el.value).then(() => {
    const oldText = btn.innerText;
    btn.innerText = "✓ Copié";
    setTimeout(() => btn.innerText = oldText, 2000);
  });
}

// --- 4. DEVTOOLS ---
function formatJSON() {
  const input = document.getElementById('dev-json-in');
  try {
    const parsed = JSON.parse(input.value);
    input.value = JSON.stringify(parsed, null, 4);
  } catch (e) {
    toastErr("JSON invalide : " + e.message);
  }
}

function extractTickets() {
  const text = document.getElementById('dev-regex-in').value;
  // Cherche les motifs du type ABC-1234, INC001234, REQ-897
  const regex = /[A-Z]+-?\d{3,}/g; 
  const matches = text.match(regex);
  
  if (matches) {
    // Retire les doublons et affiche
    const unique = [...new Set(matches)];
    document.getElementById('dev-regex-out').value = unique.join(', ');
  } else {
    document.getElementById('dev-regex-out').value = "Aucun numéro de ticket trouvé.";
  }
}
