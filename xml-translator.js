/* ============================================================
   Cyrias Buddy — XML Translator (Ivalua ETL Viewer)
   ============================================================ */
// ==========================================
// XML TRANSLATOR (IVALUA ETL VIEWER)
// ==========================================

function handleXMLFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('xml-raw-input').value = e.target.result;
    parseIvaluaXML();
  };
  reader.readAsText(file);
}

function parseIvaluaXML() {
  const xmlString = document.getElementById('xml-raw-input').value.trim();
  if (!xmlString) {
    toastWarn("Veuillez coller un XML ou charger un fichier.");
    return;
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Vérification d'erreur de parsing
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) throw new Error("Format XML invalide.");

    // 1. Extraire les métadonnées globales
    const author = xmlDoc.querySelector("author")?.textContent || "N/A";
    const exportDate = xmlDoc.querySelector("export_date")?.textContent || "N/A";
    const dbName = xmlDoc.querySelector("db_name")?.textContent || "N/A";

    // 2. Extraire la configuration ETL principale
    const etlNode = xmlDoc.querySelector("t_etl_import_type snapshot_row");
    if (!etlNode) throw new Error("Balise <t_etl_import_type> introuvable. Est-ce bien un export d'interface Ivalua ?");

    const code = etlNode.querySelector("imptype_code")?.textContent || "Inconnu";
    const label = etlNode.querySelector("imptype_label_fr")?.textContent || etlNode.querySelector("imptype_label_en")?.textContent || "Sans titre";
    const sep = etlNode.querySelector("imptype_column_terminator")?.textContent || "";
    const enc = etlNode.querySelector("imptype_file_encoding")?.textContent || "N/A";
    const startLine = etlNode.querySelector("imptype_first_line_index")?.textContent || "1";

    document.getElementById('etl-title').textContent = `${code} — ${label}`;

    document.getElementById('etl-meta-table').innerHTML = `
      <tr><td style="padding: 6px 0; font-weight: 600; color: var(--ink-muted);">Auteur :</td><td style="padding: 6px 0;">${author}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600; color: var(--ink-muted);">Date d'export :</td><td style="padding: 6px 0;">${new Date(exportDate).toLocaleString('fr-FR')}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600; color: var(--ink-muted);">Base de données :</td><td style="padding: 6px 0;"><span style="background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: monospace;">${dbName}</span></td></tr>
    `;

    document.getElementById('etl-params-table').innerHTML = `
      <tr><td style="padding: 6px 0; font-weight: 600; color: var(--ink-muted);">Séparateur :</td><td style="padding: 6px 0;"><span style="background: #F8FAFC; padding: 2px 8px; border: 1px solid var(--border); font-family: monospace; font-weight: bold; color: var(--danger);">${sep}</span></td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600; color: var(--ink-muted);">Encodage :</td><td style="padding: 6px 0;">${enc}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600; color: var(--ink-muted);">Ligne de début :</td><td style="padding: 6px 0;">Ligne ${startLine}</td></tr>
    `;

    // 3. Extraire et croiser le Mapping
    // A. Origine
    const originNodes = xmlDoc.querySelectorAll("t_etl_origin_column snapshot_row");
    const origins = {};
    originNodes.forEach(n => {
      const name = n.querySelector("ocol_name")?.textContent;
      const order = parseInt(n.querySelector("ocol_source_order")?.textContent || "0", 10);
      if (name) origins[name] = { order, label: name };
    });

    // B. Transformation & Cible
    const transNodes = xmlDoc.querySelectorAll("t_etl_transformation_detail snapshot_row");
    let mappings = [];
    transNodes.forEach(n => {
      const ocol = n.querySelector("ocol_name")?.textContent || "N/A (Valeur par défaut / Fixe)";
      const tcol = n.querySelector("tcol_name")?.textContent || "Inconnu";
      const method = n.querySelector("tmethod_code")?.textContent || "";
      const transco = n.querySelector("tdesc_name_transco")?.textContent || "";
      
      let rule = `<span style="color: var(--secondary-dark); font-weight: 600;">${method}</span>`;
      if (transco) {
        rule += `<br><span style="font-size: 10px; background: rgba(233, 189, 39, 0.15); color: #D97706; padding: 2px 4px; border-radius: 4px;">Transco: ${transco}</span>`;
      }

      mappings.push({
        order: origins[ocol] ? origins[ocol].order : 999,
        source: ocol,
        rule: rule,
        target: tcol
      });
    });

    // Tri par ordre du fichier source
    mappings.sort((a, b) => a.order - b.order);

    const mappingTable = document.getElementById('etl-mapping-table');
    mappingTable.innerHTML = mappings.map(m => `
      <tr style="border-bottom: 1px solid var(--border-light); background: ${m.order === 999 ? '#FAFAFA' : 'transparent'};">
        <td style="padding: 8px 10px; font-family: monospace; color: var(--ink-muted);">${m.order === 999 ? '-' : m.order}</td>
        <td style="padding: 8px 10px; font-weight: 600; color: var(--primary);">${m.source}</td>
        <td style="padding: 8px 10px;">${m.rule}</td>
        <td style="padding: 8px 10px; font-family: 'JetBrains Mono', monospace; color: var(--secondary-dark);">${m.target}</td>
      </tr>
    `).join('');

    // 4. Extraire les SQL Callbacks
    const sqlNodes = xmlDoc.querySelectorAll("t_bas_event_type_callback snapshot_row");
    const sqlContainer = document.getElementById('etl-sql-container');
    const sqlCard = document.getElementById('etl-sql-card');
    
    let sqlHtml = "";
    sqlNodes.forEach(n => {
      const order = n.querySelector("evtcb_order")?.textContent || "";
      const sqlParams = n.querySelector("evtcb_params")?.textContent || "";
      
      if (sqlParams.trim()) {
        sqlHtml += `
          <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="background: var(--bg); padding: 8px 12px; font-size: 11px; font-weight: 700; color: var(--ink-muted); border-bottom: 1px solid var(--border);">
              Exécution Ordre n°${order}
            </div>
            <pre style="margin: 0; padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #1E293B; background: #F8FAFC; overflow-x: auto; white-space: pre-wrap;">${sqlParams.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
          </div>
        `;
      }
    });

    if (sqlHtml) {
      sqlContainer.innerHTML = sqlHtml;
      sqlCard.style.display = 'block';
    } else {
      sqlCard.style.display = 'none';
    }

    // Basculer l'affichage
    document.getElementById('xml-input-zone').style.display = 'none';
    document.getElementById('xml-result-zone').style.display = 'flex';

  } catch (err) {
    toastErr("Erreur d'analyse : " + err.message);
  }
}
