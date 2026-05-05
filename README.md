# 🛡️ Cyrias Buddy — Portail & Outils TMA

> Portail de productivité pour consultants TMA : suivi CRA, facturation, Kanban, SQL Generator, et plus.

## 📁 Structure du projet

```
cyrias-buddy/
├── index.html              # Page principale (squelette HTML)
├── css/
│   └── style.css           # Design system "Calm Productivity" + dark mode
├── js/
│   ├── theme.js            # Thème (FOUC prevention, dark mode, icônes)
│   ├── storage.js          # SafeStorage, CyriasData, AuditLog
│   ├── utils.js            # Audio, modales, toasts, helpers sécurité
│   ├── navigation.js       # Routing, sidebar, recherche globale, raccourcis
│   ├── home.js             # Dashboard, liens personnalisés, KPIs, onboarding
│   ├── craminator.js       # CRAminator v4 — analyse CRA multi-sources
│   ├── facturator.js       # Facturator — suivi facturation
│   ├── sql-generator.js    # Générateur SQL Ivalua avec scoring qualité
│   ├── xml-translator.js   # XML Translator (Ivalua ETL Viewer)
│   ├── tools.js            # Scratchpad, Stafiz, Communicator, DevTools
│   ├── kanban.js           # Kanban drag & drop + Board Direction
│   ├── log-analyzor.js     # Log Analyzor + STES Agregator
│   ├── snippets.js         # Boîte à snippets avec tags & recherche
│   ├── features.js         # Features #3–#30 (Pomodoro, comparateur, etc.)
│   ├── backup.js           # Backup/Restore, quota, clé API
│   └── init.js             # Initialisation, SelfTests, Debug
├── assets/                 # Icônes et images (réservé)
└── README.md
```

## 🚀 Démarrage rapide

Aucun build nécessaire — ouvrez `index.html` dans un navigateur moderne.

```bash
# Cloner le repo
git clone https://github.com/<votre-user>/cyrias-buddy.git
cd cyrias-buddy

# Ouvrir directement
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Ou servez via un serveur local :
```bash
npx serve .
# ou
python3 -m http.server 8080
```

## 🧩 Modules principaux

| Module | Description |
|--------|-------------|
| **CRAminator** | Import multi-sources Excel, dashboard interactif, graphiques Chart.js, export PPTX/Excel |
| **Facturator** | Suivi de facturation par client/mission avec KPIs |
| **SQL Generator** | Générateur de requêtes Ivalua avec scoring qualité et timer |
| **Kanban** | Board drag & drop avec SLA par criticité |
| **Log Analyzor** | Analyse de logs avec règles de détection intégrées |
| **Pomodoro** | Timer intégré avec gamification |

## ⚙️ Technologies

- **HTML/CSS/JS** vanilla (aucun framework)
- **Tailwind CSS** (CDN, preflight désactivé)
- **Chart.js** pour les graphiques
- **SheetJS (xlsx)** pour l'import/export Excel
- **PptxGenJS** pour l'export PowerPoint
- **Tom Select** pour les filtres multi-sélection
- **Canvas Confetti** pour la gamification

## 🌙 Thèmes

Le portail supporte le mode clair et sombre, avec détection automatique des préférences système et persistance via `localStorage`.

## 📄 Licence

Usage interne — © Cyrias
