// ================================================================
// ADMIN COMPONENTS
// ================================================================

// ─── CSV parser (handles quoted fields) ──────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(line => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += line[i];
      }
    }
    cols.push(current.trim());
    return cols;
  }).filter(row => row.some(cell => cell !== ''));
}

function mapPosition(val) {
  const v = (val || '').toLowerCase().trim();
  if (v === 'gk' || v.includes('keeper') || v.includes('doel')) return 'GK';
  if (v === 'def' || v.includes('verde') || v.includes('back')) return 'DEF';
  if (v === 'mid' || v.includes('midden') || v.includes('midfield')) return 'MID';
  if (v === 'fwd' || v.includes('aanval') || v.includes('forward') || v.includes('spits')) return 'FWD';
  return null;
}

// ─── Datum/tijd invoervelden in Nederlands formaat ───────────

function DateInput({ value, onChange, className, disabled }) {
  function toDisplay(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function toIso(display) {
    const parts = display.split('/');
    if (parts.length !== 3) return '';
    const [d, m, y] = parts;
    if (d && m && y && y.length === 4) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return '';
  }
  const [display, setDisplay] = React.useState(() => toDisplay(value));
  React.useEffect(() => { setDisplay(toDisplay(value)); }, [value]);
  return (
    <input
      type="text"
      className={className}
      value={display}
      placeholder="dd/mm/jjjj"
      disabled={disabled}
      onChange={e => setDisplay(e.target.value)}
      onBlur={() => {
        const iso = toIso(display);
        if (iso) onChange({ target: { value: iso } });
        else setDisplay(toDisplay(value));
      }}
    />
  );
}

function TimeInput({ value, onChange, className, disabled }) {
  const [display, setDisplay] = React.useState(value || '');
  React.useEffect(() => { setDisplay(value || ''); }, [value]);
  return (
    <input
      type="text"
      className={className}
      value={display}
      placeholder="uu:mm"
      disabled={disabled}
      onChange={e => setDisplay(e.target.value)}
      onBlur={() => {
        const match = display.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (match) {
          const formatted = `${match[1].padStart(2,'0')}:${match[2]}`;
          setDisplay(formatted);
          onChange({ target: { value: formatted } });
        } else {
          setDisplay(value || '');
        }
      }}
    />
  );
}

// ─── Google Sheets import component ──────────────────────────

function GoogleSheetsImport({ players, refresh }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('paste'); // 'paste' | 'url'
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [nameCol, setNameCol] = useState('');
  const [posCol, setPosCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [defaultPos, setDefaultPos] = useState('MID');
  const [defaultLevel, setDefaultLevel] = useState(3);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);

  function reset() {
    setHeaders([]); setRows([]); setError(''); setImportResult(null);
  }

  function extractSheetId(u) {
    const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  }

  function applyParsed(parsed) {
    if (parsed.length < 2) throw new Error('Geen data gevonden. Zorg dat de sheet minimaal een koptekstrij en één datarij heeft.');
    const hdrs = parsed[0];
    const lower = hdrs.map(h => h.toLowerCase());
    const nameIdx = lower.findIndex(h => h.includes('naam') || h.includes('name') || h === 'speler' || h === 'spelers');
    const posIdx  = lower.findIndex(h => h.includes('positie') || h.includes('position') || h === 'pos');
    const lvlIdx  = lower.findIndex(h => h.includes('niveau') || h.includes('level') || h === 'lvl' || h === 'sterkte');
    setHeaders(hdrs);
    setRows(parsed.slice(1).filter(r => r.some(c => c)));
    setNameCol(nameIdx >= 0 ? String(nameIdx) : '0');
    setPosCol(posIdx >= 0 ? String(posIdx) : '');
    setLevelCol(lvlIdx >= 0 ? String(lvlIdx) : '');
  }

  function loadFromPaste() {
    setError('');
    setImportResult(null);
    try {
      if (!pasteText.trim()) { setError('Plak eerst de inhoud van je sheet.'); return; }
      // Detecteer tab-gescheiden (kopiëren vanuit Sheets) of kommagescheiden
      const isTab = pasteText.includes('\t');
      let parsed;
      if (isTab) {
        parsed = pasteText.trim().split('\n').map(line => line.split('\t').map(c => c.trim()));
      } else {
        parsed = parseCSV(pasteText);
      }
      applyParsed(parsed);
    } catch (e) {
      setError(e.message);
    }
  }

  async function fetchSheet() {
    setError('');
    setHeaders([]);
    setRows([]);
    setImportResult(null);
    const sheetId = extractSheetId(url);
    if (!sheetId) { setError('Ongeldige URL. Kopieer de volledige URL uit de adresbalk van Google Sheets.'); return; }
    setFetching(true);
    try {
      // pub?output=csv werkt voor sheets die gepubliceerd zijn via Bestand → Publiceren op web
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`Kon sheet niet laden (HTTP ${res.status}). Zie de instructies hieronder.`);
      const text = await res.text();
      applyParsed(parseCSV(text));
    } catch (e) {
      setError(e.message + (e.message.includes('fetch') ? ' — Gebruik de "Plakken" methode als alternatief.' : ''));
    }
    setFetching(false);
  }

  const preview = rows.slice(0, 5).map(row => ({
    name: nameCol !== '' ? row[parseInt(nameCol)] : '',
    position: posCol !== '' ? (mapPosition(row[parseInt(posCol)]) || defaultPos) : defaultPos,
    level: levelCol !== '' ? (parseInt(row[parseInt(levelCol)]) || defaultLevel) : defaultLevel,
  })).filter(r => r.name);

  async function doImport() {
    if (nameCol === '') { setError('Selecteer minimaal de naamkolom.'); return; }
    const existingNames = new Set((players || []).map(p => p.name.toLowerCase()));
    const seenInBatch = new Set();
    const skippedDuplicates = [];
    const toInsert = rows.map(row => ({
      name: row[parseInt(nameCol)]?.trim(),
      position: posCol !== '' ? (mapPosition(row[parseInt(posCol)]) || defaultPos) : defaultPos,
      level: levelCol !== '' ? Math.min(5, Math.max(1, parseInt(row[parseInt(levelCol)]) || parseInt(defaultLevel))) : parseInt(defaultLevel),
    })).filter(r => {
      if (!r.name) return false;
      const key = r.name.toLowerCase();
      if (existingNames.has(key) || seenInBatch.has(key)) {
        skippedDuplicates.push(r.name);
        return false;
      }
      seenInBatch.add(key);
      return true;
    });

    if (skippedDuplicates.length > 0 && toInsert.length === 0) {
      setError(`Alle ${skippedDuplicates.length} spelers bestaan al: ${skippedDuplicates.slice(0, 3).join(', ')}${skippedDuplicates.length > 3 ? '…' : ''}`);
      return;
    }
    if (toInsert.length === 0) { setError('Geen geldige spelers gevonden om te importeren.'); return; }
    const dupMsg = skippedDuplicates.length > 0 ? ` (${skippedDuplicates.length} dubbel overgeslagen)` : '';
    if (!confirm(`${toInsert.length} spelers importeren${dupMsg}? Bestaande spelers blijven staan.`)) return;

    setImporting(true);
    setError('');

    // Voeg spelers één voor één in om network- en batch-problemen te omzeilen
    let successCount = 0;
    const failed = [];
    for (const player of toInsert) {
      try {
        const { error: err } = await sb.from('players').insert(player);
        if (err) {
          failed.push(`${player.name}: ${err.message}`);
        } else {
          successCount++;
        }
      } catch (e) {
        failed.push(`${player.name}: ${e.message}`);
      }
    }

    setImporting(false);

    if (successCount === 0 && failed.length > 0) {
      const firstErr = failed[0];
      if (firstErr.includes('Failed to fetch') || firstErr.includes('NetworkError')) {
        setError(`Kan geen verbinding maken met de database. Controleer je internetverbinding en of het handmatig toevoegen van een speler ook werkt.`);
      } else {
        setError(`Import mislukt: ${firstErr}`);
      }
      return;
    }

    if (failed.length > 0) {
      setImportResult(`${successCount} spelers geïmporteerd, ${failed.length} mislukt (${failed[0]})${skippedDuplicates.length > 0 ? `, ${skippedDuplicates.length} dubbel overgeslagen` : ''}`);
    } else {
      setImportResult(skippedDuplicates.length > 0 ? `${successCount} (${skippedDuplicates.length} dubbel overgeslagen)` : successCount);
    }
    setRows([]); setHeaders([]); setUrl(''); setPasteText('');
    refresh();
  }

  if (!open) {
    return (
      <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
        📊 Importeer uit Google Sheets
      </button>
    );
  }

  return (
    <div className="card border border-blue-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold section-title">Importeer uit Google Sheets</h2>
        <button className="text-slate-400 hover:text-white text-xl leading-none" onClick={() => { setOpen(false); reset(); }}>×</button>
      </div>

      {/* Methode tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${mode === 'paste' ? 'tab-active' : 'text-slate-400 hover:text-white'}`}
          onClick={() => { setMode('paste'); reset(); }}
        >📋 Plakken (aanbevolen)</button>
        <button
          className={`px-4 py-2 text-sm font-medium ${mode === 'url' ? 'tab-active' : 'text-slate-400 hover:text-white'}`}
          onClick={() => { setMode('url'); reset(); }}
        >🔗 Via URL</button>
      </div>

      {mode === 'paste' && (
        <>
          <ol className="text-sm text-slate-400 mb-3 space-y-1 list-decimal list-inside">
            <li>Open je Google Sheet</li>
            <li>Selecteer alle cellen met data (inclusief koptekstrij) met <strong className="text-slate-300">Ctrl+A</strong></li>
            <li>Kopieer met <strong className="text-slate-300">Ctrl+C</strong></li>
            <li>Klik in het vak hieronder en plak met <strong className="text-slate-300">Ctrl+V</strong></li>
          </ol>
          <textarea
            className="input w-full h-32 font-mono text-xs mb-3"
            placeholder="Plak hier de inhoud van je Google Sheet..."
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); reset(); }}
          />
          <button className="btn-secondary mb-4" onClick={loadFromPaste} disabled={!pasteText.trim()}>
            🔍 Verwerken
          </button>
        </>
      )}

      {mode === 'url' && (
        <>
          <div className="text-sm text-slate-400 mb-3 p-3 bg-slate-800 rounded text-xs space-y-1">
            <p><strong className="text-slate-300">Vereiste instelling:</strong> Bestand → Publiceren op web → Publiceer als CSV</p>
            <p>Gewoon "Delen" is niet genoeg — de sheet moet gepubliceerd zijn.</p>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              className="input flex-1"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              onChange={e => { setUrl(e.target.value); reset(); }}
            />
            <button className="btn-secondary" onClick={fetchSheet} disabled={fetching || !url}>
              {fetching ? <Spinner /> : '📥 Laden'}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {importResult && <p className="text-green-400 text-sm mb-4">✓ {importResult} spelers succesvol geïmporteerd!</p>}

      {headers.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="form-label">Kolom: Naam *</label>
              <select className="select" value={nameCol} onChange={e => setNameCol(e.target.value)}>
                {headers.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i+1}`}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Kolom: Positie</label>
              <select className="select" value={posCol} onChange={e => setPosCol(e.target.value)}>
                <option value="">— gebruik standaard —</option>
                {headers.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i+1}`}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Kolom: Niveau</label>
              <select className="select" value={levelCol} onChange={e => setLevelCol(e.target.value)}>
                <option value="">— gebruik standaard —</option>
                {headers.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i+1}`}</option>)}
              </select>
            </div>
            {posCol === '' && (
              <div>
                <label className="form-label">Standaard positie</label>
                <select className="select" value={defaultPos} onChange={e => setDefaultPos(e.target.value)}>
                  {POSITIONS.map(p => <option key={p} value={p}>{POS_LABELS[p]}</option>)}
                </select>
              </div>
            )}
            {levelCol === '' && (
              <div>
                <label className="form-label">Standaard niveau</label>
                <select className="select" value={defaultLevel} onChange={e => setDefaultLevel(e.target.value)}>
                  {[1,2,3,4,5].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
          </div>

          {preview.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Preview (eerste {Math.min(5, rows.length)} van {rows.length} rijen):</p>
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="table-header">
                    <th className="pb-1">Naam</th>
                    <th className="pb-1">Positie</th>
                    <th className="pb-1">Niveau</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} className="table-row">
                      <td className="py-1 font-medium">{p.name}</td>
                      <td className="py-1"><PosBadge pos={p.position} /></td>
                      <td className="py-1"><LevelDots level={p.level} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn-primary" onClick={doImport} disabled={importing || nameCol === ''}>
            {importing ? <Spinner /> : `⬆️ Importeer ${rows.length} spelers`}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Spelers beheer ──────────────────────────────────────────

function AdminPlayers({ players, teams, refresh }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('MID');
  const [level, setLevel] = useState(3);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const [goalEdits, setGoalEdits] = useState({});
  const [savingGoals, setSavingGoals] = useState(null);

  async function saveGoals(playerId) {
    const goals = goalEdits[playerId];
    if (goals === undefined) return;
    setSavingGoals(playerId);
    await sb.from('players').update({ goals: Math.max(0, parseInt(goals) || 0) }).eq('id', playerId);
    setSavingGoals(null);
    setGoalEdits(prev => { const n = {...prev}; delete n[playerId]; return n; });
    refresh();
  }

  async function addPlayer(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const nameNorm = name.trim().toLowerCase();
    if (players.some(p => p.name.toLowerCase() === nameNorm)) {
      setAddError(`"${name.trim()}" bestaat al als speler.`);
      return;
    }
    setAddError('');
    setSaving(true);
    await sb.from('players').insert({ name: name.trim(), position, level: parseInt(level) });
    setName('');
    setSaving(false);
    refresh();
  }

  async function deletePlayer(id) {
    if (!confirm('Speler verwijderen?')) return;
    await sb.from('players').delete().eq('id', id);
    refresh();
  }

  const teamName = id => teams.find(t => t.id === id)?.name || '—';

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-lg font-bold mb-4 section-title">Speler toevoegen</h2>
        <form onSubmit={addPlayer} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="form-label">Naam</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Naam speler" required />
          </div>
          <div>
            <label className="form-label">Positie</label>
            <select className="select" value={position} onChange={e => setPosition(e.target.value)}>
              {POSITIONS.map(p => <option key={p} value={p}>{POS_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Niveau (1–5)</label>
            <select className="select" value={level} onChange={e => setLevel(e.target.value)}>
              {[1,2,3,4,5].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner /> : '+ Toevoegen'}
          </button>
        </form>
        {addError && <p className="text-red-400 text-sm mt-2">{addError}</p>}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <GoogleSheetsImport players={players} refresh={refresh} />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold section-title">Spelers ({players.length})</h2>
        </div>
        {players.length === 0 ? (
          <p className="text-slate-400 text-sm">Nog geen spelers toegevoegd.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="pb-2">Naam</th>
                  <th className="pb-2">Positie</th>
                  <th className="pb-2">Niveau</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2 text-center">Doelpunten</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id} className="table-row">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2"><PosBadge pos={p.position} /></td>
                    <td className="py-2"><LevelDots level={p.level} /></td>
                    <td className="py-2 text-slate-400">{teamName(p.team_id)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="number" min="0" max="99"
                          className="input w-14 text-center text-sm py-1"
                          value={goalEdits[p.id] !== undefined ? goalEdits[p.id] : (p.goals || 0)}
                          onChange={e => setGoalEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        {goalEdits[p.id] !== undefined && (
                          <button className="btn-primary text-xs py-1 px-2" onClick={() => saveGoals(p.id)} disabled={savingGoals === p.id}>
                            {savingGoals === p.id ? <Spinner /> : '✓'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <button className="btn-danger text-xs py-1 px-2" onClick={() => deletePlayer(p.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team generatie ───────────────────────────────────────────

function AdminTeams({ players, teams, refresh }) {
  const [numTeams, setNumTeams] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  function generatePreview() {
    const n = Math.min(parseInt(numTeams), ALLE_CLUBS.length);
    const geselecteerd = n >= ALLE_CLUBS.length
      ? [...ALLE_CLUBS]
      : [...ALLE_CLUBS].sort(() => Math.random() - 0.5).slice(0, n);
    const result = generateBalancedTeams(players, n);
    setPreview(result.map((t, i) => ({ ...t, name: geselecteerd[i] })));
  }

  async function deleteAllTeams() {
    if (!confirm('Alle teams, poules en het speelschema worden verwijderd. Spelers blijven staan. Doorgaan?')) return;
    setDeleting(true);
    await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('group_teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('players').update({ team_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
    setPreview(null);
    setDeleting(false);
    refresh();
  }

  async function saveTeams() {
    if (!preview) return;
    if (!confirm('Huidige teams en indelingen worden overschreven. Doorgaan?')) return;
    setGenerating(true);
    // Verwijder alles
    await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('group_teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('players').update({ team_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');

    // Maak nieuwe teams
    for (const t of preview) {
      const { data } = await sb.from('teams').insert({ name: t.name }).select().single();
      if (data) {
        for (const player of t.players) {
          await sb.from('players').update({ team_id: data.id }).eq('id', player.id);
        }
      }
    }
    setPreview(null);
    setGenerating(false);
    refresh();
  }

  const playersByTeam = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = players.filter(p => p.team_id === t.id); });
    return map;
  }, [teams, players]);

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-lg font-bold mb-4 section-title">Teams genereren</h2>
        <p className="text-sm text-slate-400 mb-4">
          Teams worden automatisch gebalanceerd op positie en niveau (snake draft).
          Je hebt <strong className="text-slate-800">{players.length} spelers</strong> geregistreerd.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label">Aantal teams</label>
            <select className="select" value={numTeams} onChange={e => setNumTeams(e.target.value)}>
              {[4,5,6,7,8,9,10,11].map(n => <option key={n} value={n}>{n} teams</option>)}
            </select>
          </div>
          <button className="btn-secondary w-full sm:w-auto" onClick={generatePreview}>
            🔀 Preview genereren
          </button>
          {preview && (
            <button className="btn-primary w-full sm:w-auto" onClick={saveTeams} disabled={generating}>
              {generating ? <Spinner /> : '💾 Teams opslaan'}
            </button>
          )}
        </div>
      </div>

      {preview && (() => {
        // Bereken positiebalans-waarschuwingen
        const posWarnings = POSITIONS.filter(pos => {
          const counts = preview.map(t => t.players.filter(p => p.position === pos).length);
          return Math.max(...counts) - Math.min(...counts) > 1;
        });
        const sizes = preview.map(t => t.players.length);
        const sizeOk = Math.max(...sizes) - Math.min(...sizes) <= 1;

        return (
          <div className="card">
            <h3 className="font-bold section-title mb-3">Preview — {preview.length} teams</h3>

            {/* Balans-indicatoren */}
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className={sizeOk ? 'text-green-400' : 'text-red-400'}>
                {sizeOk ? '✓' : '⚠'} Teamgrootte: {Math.min(...sizes)}–{Math.max(...sizes)} spelers
              </span>
              {posWarnings.length === 0 ? (
                <span className="text-green-400">✓ Positieverdeling gelijk</span>
              ) : (
                <span className="text-yellow-400">
                  ⚠ Ongelijke positieverdeling: {posWarnings.map(p => POS_LABELS[p]).join(', ')}
                  {' '}(onvermijdelijk bij scheef spelersaanbod)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {preview.map((team, i) => (
                <div key={i} className="sub-card">
                  <div className="sub-card-title flex items-center gap-2"><ClubBadge name={team.name} size={26} /><span>{team.name}</span></div>
                  <div className="flex gap-2 text-xs text-slate-400 mb-1">
                    <span>Gem. niveau: {team.players.length > 0 ? (team.players.reduce((s, p) => s + p.level, 0) / team.players.length).toFixed(1) : '—'}</span>
                    <span>·</span>
                    <span>{team.players.length} spelers</span>
                    <span>·</span>
                    <span>{POSITIONS.map(pos => {
                      const n = team.players.filter(p => p.position === pos).length;
                      return n > 0 ? `${n}${pos}` : null;
                    }).filter(Boolean).join(' ')}</span>
                  </div>
                  {team.players.map(p => (
                    <div key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
                      <PosBadge pos={p.position} />
                      <span>{p.name}</span>
                      <LevelDots level={p.level} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {teams.length > 0 && !preview && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold section-title">Huidige teams ({teams.length})</h3>
            <button className="btn-danger text-sm" onClick={deleteAllTeams} disabled={deleting}>
              {deleting ? <Spinner /> : '🗑 Verwijder alle teams'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <div key={team.id} className="sub-card">
                <div className="sub-card-title flex items-center gap-2"><ClubBadge name={team.name} size={26} /><span>{team.name}</span></div>
                {(playersByTeam[team.id] || []).map(p => (
                  <div key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <PosBadge pos={p.position} />
                    <span>{p.name}</span>
                    <LevelDots level={p.level} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Poule generatie ──────────────────────────────────────────

function AdminGroups({ teams, groups, groupTeams, matches, refresh }) {
  const [numGroups, setNumGroups] = useState(2);
  const [generating, setGenerating] = useState(false);

  const teamsByGroup = useMemo(() => {
    const map = {};
    groups.forEach(g => {
      map[g.id] = groupTeams.filter(gt => gt.group_id === g.id).map(gt => teams.find(t => t.id === gt.team_id)).filter(Boolean);
    });
    return map;
  }, [groups, groupTeams, teams]);

  async function generateGroups() {
    if (teams.length < 2) { alert('Voeg eerst teams toe.'); return; }
    if (!confirm('Poules en speelschema worden opnieuw gegenereerd. Doorgaan?')) return;
    setGenerating(true);

    // Wis bestaande poules en wedstrijden
    await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('group_teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const n = parseInt(numGroups);
    const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    // Shuffle teams
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const groupsList = [];

    for (let i = 0; i < n; i++) {
      const { data } = await sb.from('groups').insert({ name: `Poule ${groupNames[i]}` }).select().single();
      if (data) groupsList.push(data);
    }

    // Verdeel teams over poules (round-robin verdeling)
    for (let i = 0; i < shuffled.length; i++) {
      const groupIdx = i % n;
      if (groupsList[groupIdx]) {
        await sb.from('group_teams').insert({ group_id: groupsList[groupIdx].id, team_id: shuffled[i].id });
      }
    }

    setGenerating(false);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-lg font-bold mb-4 section-title">Poules genereren</h2>
        <p className="text-sm text-slate-400 mb-4">
          Teams worden random verdeeld over de poules. Je hebt <strong className="text-slate-800">{teams.length} teams</strong>.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label">Aantal poules</label>
            <select className="select" value={numGroups} onChange={e => setNumGroups(e.target.value)}>
              {[2,3,4].map(n => <option key={n} value={n}>{n} poules</option>)}
            </select>
          </div>
          <button className="btn-primary w-full sm:w-auto" onClick={generateGroups} disabled={generating || teams.length < 2}>
            {generating ? <Spinner /> : '🎲 Genereer poules'}
          </button>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Huidige poules</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map(g => (
              <div key={g.id} className="sub-card">
                <div className="sub-card-title">{g.name}</div>
                {(teamsByGroup[g.id] || []).map(t => (
                  <div key={t.id} className="py-0.5 text-sm text-slate-600 flex items-center gap-1.5">
                    <ClubBadge name={t.name} size={18} /><span>{t.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Speelschema generatie ────────────────────────────────────

function AdminSchedule({ groups, groupTeams, teams, matches, refresh }) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [matchDuration, setMatchDuration] = useState(15);
  const [breakTime, setBreakTime] = useState(5);
  const [numFields, setNumFields] = useState(2);
  const [numRoundsPerTeam, setNumRoundsPerTeam] = useState(1);
  const [generating, setGenerating] = useState(false);

  const teamsByGroup = useMemo(() => {
    const map = {};
    groups.forEach(g => {
      map[g.id] = groupTeams.filter(gt => gt.group_id === g.id).map(gt => teams.find(t => t.id === gt.team_id)).filter(Boolean);
    });
    return map;
  }, [groups, groupTeams, teams]);

  const refereeMap = useMemo(
    () => calcReferees(matches, groups, groupTeams),
    [matches, groups, groupTeams]
  );

  async function generateSchedule() {
    if (!startDate) { alert('Selecteer een startdatum.'); return; }
    if (groups.length === 0) { alert('Genereer eerst poules.'); return; }
    if (!confirm('Het huidige speelschema wordt overschreven. Doorgaan?')) return;
    setGenerating(true);

    await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const slotMinutes = parseInt(matchDuration) + parseInt(breakTime);
    const fields = parseInt(numFields);

    // Genereer rondes per poule
    const allGroupsData = groups
      .map(group => {
        const teamIds = (teamsByGroup[group.id] || []).map(t => t.id);
        if (teamIds.length < 2) return null;
        return { group, rounds: generateRoundRobin(teamIds) };
      })
      .filter(Boolean);

    // Interleaf wedstrijden over poules, ronde voor ronde
    const interleavedMatches = [];
    const maxRounds = allGroupsData.length > 0
      ? Math.max(...allGroupsData.map(g => g.rounds.length))
      : 0;

    const totalPasses = parseInt(numRoundsPerTeam);
    for (let pass = 0; pass < totalPasses; pass++) {
      for (let r = 0; r < maxRounds; r++) {
        for (const { group, rounds } of allGroupsData) {
          if (r < rounds.length) {
            rounds[r].forEach(match => {
              // Wissel thuis/uit om bij de tweede helft (heen & terug)
              const home = pass % 2 === 0 ? match.home : match.away;
              const away = pass % 2 === 0 ? match.away : match.home;
              interleavedMatches.push({ group, match: { home, away }, roundNumber: pass * maxRounds + r + 1 });
            });
          }
        }
      }
    }

    // Verdeel over (tijdslot, veld)
    for (let i = 0; i < interleavedMatches.length; i++) {
      const { group, match, roundNumber } = interleavedMatches[i];
      const slotIndex = Math.floor(i / fields);
      const field = (i % fields) + 1;
      const totalMinutes = slotIndex * slotMinutes;
      const dt = new Date(`${startDate}T${startTime.padStart(5,'0')}:00`);
      dt.setMinutes(dt.getMinutes() + totalMinutes);

      await sb.from('matches').insert({
        group_id: group.id,
        home_team_id: match.home,
        away_team_id: match.away,
        scheduled_time: dt.toISOString(),
        status: 'scheduled',
        round_number: roundNumber,
        field_number: field,
      });
    }

    setGenerating(false);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-lg font-bold mb-4 section-title">Speelschema genereren</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="form-label">Datum</label>
            <DateInput className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Starttijd</label>
            <TimeInput className="input" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Wedstrijdduur (min)</label>
            <input type="number" className="input" value={matchDuration} min={5} max={90} onChange={e => setMatchDuration(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Pauze tussen (min)</label>
            <input type="number" className="input" value={breakTime} min={0} max={30} onChange={e => setBreakTime(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Aantal velden</label>
            <select className="select" value={numFields} onChange={e => setNumFields(e.target.value)}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Keer tegen elkaar</label>
            <select className="select" value={numRoundsPerTeam} onChange={e => setNumRoundsPerTeam(e.target.value)}>
              <option value={1}>1× (enkelvoudig)</option>
              <option value={2}>2× (heen & terug)</option>
            </select>
          </div>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={generateSchedule} disabled={generating || groups.length === 0}>
          {generating ? <Spinner /> : '📅 Genereer speelschema'}
        </button>
      </div>

      {matches.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Schema ({matches.length} wedstrijden)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="pb-2">Tijd</th>
                  <th className="pb-2">Veld</th>
                  <th className="pb-2">Thuis</th>
                  <th className="pb-2">Uit</th>
                  <th className="pb-2">Poule</th>
                  <th className="pb-2">Scheidsrechter</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => {
                  const home = teams.find(t => t.id === m.home_team_id);
                  const away = teams.find(t => t.id === m.away_team_id);
                  const group = groups.find(g => g.id === m.group_id);
                  const referee = teams.find(t => t.id === refereeMap[m.id]);
                  return (
                    <tr key={m.id} className="table-row">
                      <td className="py-2 text-slate-300">{formatDateTime(m.scheduled_time)}</td>
                      <td className="py-2 text-slate-400">Veld {m.field_number}</td>
                      <td className="py-2 font-medium"><TeamName name={home?.name} size={18} /></td>
                      <td className="py-2 font-medium"><TeamName name={away?.name} size={18} /></td>
                      <td className="py-2 text-slate-400">{group?.name || '—'}</td>
                      <td className="py-2">
                        {referee
                          ? <span className="inline-flex items-center gap-1.5 text-yellow-500 font-medium">
                              <img src="img/football-referee.png" alt="sch" className="w-4 h-4 object-contain inline-block" />
                              <ClubBadge name={referee.name} size={16} />
                              {referee.name}
                            </span>
                          : <span className="text-slate-600">—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kruis Finales genereren ─────────────────────────────────

function AdminFinales({ groups, groupTeams, teams, matches, refresh }) {
  const [sfDate, setSfDate] = useState('');
  const [sfTime, setSfTime] = useState('14:00');
  const [sfDuration, setSfDuration] = useState(15);
  const [sfBreak, setSfBreak] = useState(5);
  const [sfFields, setSfFields] = useState(2);
  const [finalDate, setFinalDate] = useState('');
  const [finalTime, setFinalTime] = useState('15:30');
  const [finalDuration, setFinalDuration] = useState(20);
  const [finalBreak, setFinalBreak] = useState(5);
  const [finalFields, setFinalFields] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [savingReferee, setSavingReferee] = useState(null);

  const poolGroups = useMemo(() =>
    groups.filter(g => groupTeams.some(gt => gt.group_id === g.id)),
    [groups, groupTeams]
  );

  const sfGroup     = groups.find(g => g.name === 'Halve Finales');
  const finaleGroup = groups.find(g => g.name === 'Finale');
  const sfMatches   = sfGroup     ? [...matches.filter(m => m.group_id === sfGroup.id)].sort((a,b) => a.round_number - b.round_number)     : [];
  const finaleMatches = finaleGroup ? [...matches.filter(m => m.group_id === finaleGroup.id)].sort((a,b) => a.round_number - b.round_number) : [];
  const nPools           = poolGroups.length;
  const actualSFMatches  = sfMatches.filter(m => m.round_number <= nPools);
  const consolMatches    = sfMatches.filter(m => m.round_number > nPools);
  const sfAllPlayed = actualSFMatches.length > 0 && actualSFMatches.every(m => {
    if (m.status !== 'played') return false;
    if (m.home_score === m.away_score && (m.home_penalties == null || m.away_penalties == null)) return false;
    return true;
  });

  function sfLabel(roundNumber) {
    if (roundNumber <= nPools) return `HF ${roundNumber}`;
    const idx      = roundNumber - nPools - 1;
    const posStart = 2 * nPools + 1 + idx * 2;
    return `${posStart}e/${posStart + 1}e Plek`;
  }

  const standingsPerGroup = useMemo(() =>
    poolGroups.map(g => {
      const gTeams   = groupTeams.filter(gt => gt.group_id === g.id).map(gt => teams.find(t => t.id === gt.team_id)).filter(Boolean);
      const gMatches = matches.filter(m => m.group_id === g.id);
      return { group: g, standings: calcStandings(gTeams, gMatches) };
    }),
    [poolGroups, groupTeams, teams, matches]
  );

  async function saveReferee(matchId, teamId) {
    setSavingReferee(matchId);
    await sb.from('matches').update({ referee_team_id: teamId || null }).eq('id', matchId);
    setSavingReferee(null);
    refresh();
  }

  function getAvailableReferees(match) {
    const busyIds = new Set(
      match.scheduled_time
        ? matches
            .filter(o => o.id !== match.id && o.scheduled_time === match.scheduled_time)
            .flatMap(o => [o.home_team_id, o.away_team_id])
        : []
    );
    busyIds.add(match.home_team_id);
    busyIds.add(match.away_team_id);
    return teams.filter(t => !busyIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function deleteKnockout() {
    if (!confirm('Verwijder alle kruis finale wedstrijden?')) return;
    for (const g of [sfGroup, finaleGroup].filter(Boolean)) {
      await sb.from('matches').delete().eq('group_id', g.id);
      await sb.from('groups').delete().eq('id', g.id);
    }
    refresh();
  }

  async function generateSemis() {
    if (!sfDate) { alert('Selecteer een datum voor de halve finales.'); return; }
    if (poolGroups.length < 2) { alert('Minimaal 2 poules nodig voor kruis finales.'); return; }
    if (!confirm('Halve finales en plaatsingswedstrijden genereren op basis van de huidige poulestanden?')) return;
    setGenerating(true);

    if (sfGroup) {
      await sb.from('matches').delete().eq('group_id', sfGroup.id);
      await sb.from('groups').delete().eq('id', sfGroup.id);
    }

    const { data: newSfGroup } = await sb.from('groups').insert({ name: 'Halve Finales' }).select().single();
    if (!newSfGroup) { setGenerating(false); return; }

    const slotMinutes = parseInt(sfDuration) + parseInt(sfBreak);
    const fields      = parseInt(sfFields);
    const n           = poolGroups.length;

    // Halve finales: kruis koppeling 1e poule[i] vs 2e poule[(i + ceil(n/2)) % n]
    const sfMatchList = [];
    for (let i = 0; i < n; i++) {
      const j     = (i + Math.ceil(n / 2)) % n;
      const team1 = standingsPerGroup[i]?.standings[0]?.team;
      const team2 = standingsPerGroup[j]?.standings[1]?.team;
      if (team1 && team2) sfMatchList.push({ home: team1.id, away: team2.id });
    }

    // Plaatsingswedstrijden: 3e vs 3e (plek 5/6), 4e vs 4e (plek 7/8), ...
    const consolList = [];
    const minTeamsPerPool = Math.min(...standingsPerGroup.map(s => s.standings.length));
    for (let rank = 2; rank < minTeamsPerPool; rank++) {
      const matchTeams = standingsPerGroup.map(s => s.standings[rank]?.team).filter(Boolean);
      if (matchTeams.length >= 2) {
        consolList.push({ home: matchTeams[0].id, away: matchTeams[1].id });
      }
    }

    // Sla halve finales op
    for (let i = 0; i < sfMatchList.length; i++) {
      const slotIndex = Math.floor(i / fields);
      const field     = (i % fields) + 1;
      const dt = new Date(`${sfDate}T${sfTime.padStart(5,'0')}:00`);
      dt.setMinutes(dt.getMinutes() + slotIndex * slotMinutes);
      await sb.from('matches').insert({
        group_id: newSfGroup.id, home_team_id: sfMatchList[i].home, away_team_id: sfMatchList[i].away,
        scheduled_time: dt.toISOString(), status: 'scheduled', round_number: i + 1, field_number: field,
      });
    }

    // Sla plaatsingswedstrijden op — ná de halve finales (zodat finalisten rust hebben)
    const sfSlots = Math.ceil(sfMatchList.length / fields);
    for (let i = 0; i < consolList.length; i++) {
      const slotIndex = sfSlots + Math.floor(i / fields);
      const field     = (i % fields) + 1;
      const dt = new Date(`${sfDate}T${sfTime.padStart(5,'0')}:00`);
      dt.setMinutes(dt.getMinutes() + slotIndex * slotMinutes);
      await sb.from('matches').insert({
        group_id: newSfGroup.id, home_team_id: consolList[i].home, away_team_id: consolList[i].away,
        scheduled_time: dt.toISOString(), status: 'scheduled',
        round_number: sfMatchList.length + i + 1, field_number: field,
      });
    }

    setGenerating(false);
    refresh();
  }

  async function generateFinal() {
    if (!sfAllPlayed) { alert('Speel eerst alle halve finales.'); return; }
    if (!finalDate) { alert('Selecteer een datum voor de finale.'); return; }
    if (!confirm('Finale en 3e plaatswedstrijd genereren op basis van de halve finale uitslagen?')) return;
    setGenerating(true);

    if (finaleGroup) {
      await sb.from('matches').delete().eq('group_id', finaleGroup.id);
      await sb.from('groups').delete().eq('id', finaleGroup.id);
    }

    const { data: newFinaleGroup } = await sb.from('groups').insert({ name: 'Finale' }).select().single();
    if (!newFinaleGroup) { setGenerating(false); return; }

    const slotMinutes = parseInt(finalDuration) + parseInt(finalBreak);
    const fields      = parseInt(finalFields);

    const winners = actualSFMatches.map(m => getMatchWinner(m));
    const losers  = actualSFMatches.map(m => {
      const w = getMatchWinner(m);
      return w === m.home_team_id ? m.away_team_id : m.home_team_id;
    });

    const finalMatchList = winners.length >= 2
      ? [{ home: winners[0], away: winners[1], roundNumber: 1 }, { home: losers[0], away: losers[1], roundNumber: 2 }]
      : [];

    for (let i = 0; i < finalMatchList.length; i++) {
      const slotIndex = Math.floor(i / fields);
      const field     = (i % fields) + 1;
      const dt = new Date(`${finalDate}T${finalTime.padStart(5,'0')}:00`);
      dt.setMinutes(dt.getMinutes() + slotIndex * slotMinutes);
      await sb.from('matches').insert({
        group_id: newFinaleGroup.id, home_team_id: finalMatchList[i].home, away_team_id: finalMatchList[i].away,
        scheduled_time: dt.toISOString(), status: 'scheduled', round_number: finalMatchList[i].roundNumber, field_number: field,
      });
    }

    setGenerating(false);
    refresh();
  }

  return (
    <div className="space-y-5">

      {/* Overzicht poulestanden */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3 section-title">Poulestanden (overzicht)</h2>
        {standingsPerGroup.length === 0 ? (
          <p className="text-slate-400 text-sm">Nog geen poules aangemaakt.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {standingsPerGroup.map(({ group, standings }) => (
              <div key={group.id} className="sub-card">
                <div className="sub-card-title">{group.name}</div>
                {standings.map((s, i) => (
                  <div key={s.team.id} className={`flex justify-between text-sm py-0.5 ${i < 2 ? 'text-green-400 font-medium' : 'text-slate-400'}`}>
                    <span className="inline-flex items-center gap-1">{i + 1}. <ClubBadge name={s.team.name} size={16} />{s.team.name}</span>
                    <span>{s.pts} pnt</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">Groen = door naar de kruis finales (top 2 per poule)</p>
      </div>

      {/* Halve finales genereren */}
      <div className="card">
        <h2 className="text-lg font-bold mb-2 section-title">Halve Finales genereren</h2>
        <p className="text-sm text-slate-400 mb-4">
          Kruis finale: <strong className="text-slate-300">1e Poule A vs 2e Poule B</strong> en <strong className="text-slate-300">1e Poule B vs 2e Poule A</strong>.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div><label className="form-label">Datum</label>
            <DateInput className="input" value={sfDate} onChange={e => setSfDate(e.target.value)} /></div>
          <div><label className="form-label">Starttijd</label>
            <TimeInput className="input" value={sfTime} onChange={e => setSfTime(e.target.value)} /></div>
          <div><label className="form-label">Duur (min)</label>
            <input type="number" className="input" value={sfDuration} min={5} max={90} onChange={e => setSfDuration(e.target.value)} /></div>
          <div><label className="form-label">Pauze (min)</label>
            <input type="number" className="input" value={sfBreak} min={0} max={30} onChange={e => setSfBreak(e.target.value)} /></div>
          <div><label className="form-label">Aantal velden</label>
            <select className="select" value={sfFields} onChange={e => setSfFields(e.target.value)}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary w-full sm:w-auto" onClick={generateSemis} disabled={generating || poolGroups.length < 2}>
            {generating ? <Spinner /> : '🏆 Genereer halve finales'}
          </button>
          {(sfGroup || finaleGroup) && (
            <button className="btn-danger text-sm w-full sm:w-auto" onClick={deleteKnockout} disabled={generating}>🗑 Verwijder finales</button>
          )}
        </div>
      </div>

      {/* Halve finale wedstrijden tonen */}
      {sfMatches.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Halve Finales &amp; Plaatsingswedstrijden</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sfMatches.map(m => {
              const home = teams.find(t => t.id === m.home_team_id);
              const away = teams.find(t => t.id === m.away_team_id);
              const isPlayed = m.status === 'played';
              const isConsol = m.round_number > nPools;
              return (
                <div key={m.id} className={`rounded-lg border p-3 space-y-2${isPlayed ? ' border-yellow-200 bg-yellow-50' : ' border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${isConsol ? 'text-orange-400' : 'text-blue-400'}`}>{sfLabel(m.round_number)}</span>
                    <span className="text-xs text-slate-500 text-right">{formatDateTime(m.scheduled_time)} · Veld {m.field_number}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 font-medium text-right text-sm min-w-0"><TeamName name={home?.name} size={18} reverse /></div>
                    <div className="w-16 text-center font-bold text-sm flex-shrink-0">
                      {isPlayed ? (
                        <div>
                          <div>{m.home_score} – {m.away_score}</div>
                          {m.home_score === m.away_score && m.home_penalties != null && (
                            <div className="text-xs text-yellow-500">({m.home_penalties}–{m.away_penalties} n.s.)</div>
                          )}
                        </div>
                      ) : <span className="text-slate-400">vs</span>}
                    </div>
                    <div className="flex-1 font-medium text-sm min-w-0"><TeamName name={away?.name} size={18} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src="img/football-referee.png" alt="sch" className="w-4 h-4 object-contain flex-shrink-0" />
                    <select
                      className="select text-xs py-0.5 flex-1"
                      value={m.referee_team_id || ''}
                      onChange={e => saveReferee(m.id, e.target.value)}
                      disabled={savingReferee === m.id}
                    >
                      <option value="">— Geen scheidsrechter —</option>
                      {getAvailableReferees(m).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {savingReferee === m.id && <Spinner />}
                  </div>
                </div>
              );
            })}
          </div>
          {!sfAllPlayed && <p className="text-xs text-slate-500 mt-3">Voer de uitslagen in via het tabblad "Uitslagen" om daarna de finale te kunnen genereren. Bij gelijkspel zijn ook strafschoppenstanden vereist.</p>}
        </div>
      )}

      {/* Finale genereren */}
      <div className="card">
        <h2 className={`text-lg font-bold mb-2 ${sfAllPlayed ? 'section-title' : 'text-slate-600'}`}>
          Finale &amp; 3e Plaatswedstrijd genereren
        </h2>
        {!sfAllPlayed && (
          <p className="text-slate-500 text-sm mb-3">Beschikbaar zodra alle halve finales gespeeld zijn.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div><label className="form-label">Datum</label>
            <DateInput className="input" value={finalDate} onChange={e => setFinalDate(e.target.value)} disabled={!sfAllPlayed} /></div>
          <div><label className="form-label">Starttijd</label>
            <TimeInput className="input" value={finalTime} onChange={e => setFinalTime(e.target.value)} disabled={!sfAllPlayed} /></div>
          <div><label className="form-label">Duur (min)</label>
            <input type="number" className="input" value={finalDuration} min={5} max={90} onChange={e => setFinalDuration(e.target.value)} disabled={!sfAllPlayed} /></div>
          <div><label className="form-label">Pauze (min)</label>
            <input type="number" className="input" value={finalBreak} min={0} max={30} onChange={e => setFinalBreak(e.target.value)} disabled={!sfAllPlayed} /></div>
          <div><label className="form-label">Aantal velden</label>
            <select className="select" value={finalFields} onChange={e => setFinalFields(e.target.value)} disabled={!sfAllPlayed}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select></div>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={generateFinal} disabled={generating || !sfAllPlayed}>
          {generating ? <Spinner /> : '🥇 Genereer finale + 3e plaatswedstrijd'}
        </button>
      </div>

      {/* Finale wedstrijden tonen */}
      {finaleMatches.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Finale</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finaleMatches.map((m, i) => {
              const home = teams.find(t => t.id === m.home_team_id);
              const away = teams.find(t => t.id === m.away_team_id);
              const isPlayed = m.status === 'played';
              const label = i === 0 ? '🥇 Finale' : '🥉 3e Plaats';
              return (
                <div key={m.id} className={`rounded-lg border p-3 space-y-2${isPlayed ? ' border-yellow-200 bg-yellow-50' : ' border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-yellow-500 font-bold">{label}</span>
                    <span className="text-xs text-slate-500 text-right">{formatDateTime(m.scheduled_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 font-medium text-right text-sm min-w-0"><TeamName name={home?.name} size={18} reverse /></div>
                    <div className="w-16 text-center font-bold text-sm flex-shrink-0">
                      {isPlayed ? (
                        <div>
                          <div>{m.home_score} – {m.away_score}</div>
                          {m.home_score === m.away_score && m.home_penalties != null && (
                            <div className="text-xs text-yellow-500">({m.home_penalties}–{m.away_penalties} n.s.)</div>
                          )}
                        </div>
                      ) : <span className="text-slate-400">vs</span>}
                    </div>
                    <div className="flex-1 font-medium text-sm min-w-0"><TeamName name={away?.name} size={18} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src="img/football-referee.png" alt="sch" className="w-4 h-4 object-contain flex-shrink-0" />
                    <select
                      className="select text-xs py-0.5 flex-1"
                      value={m.referee_team_id || ''}
                      onChange={e => saveReferee(m.id, e.target.value)}
                      disabled={savingReferee === m.id}
                    >
                      <option value="">— Geen scheidsrechter —</option>
                      {getAvailableReferees(m).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {savingReferee === m.id && <Spinner />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Uitslagen invoeren ───────────────────────────────────────

function AdminResults({ matches, teams, groups, refresh }) {
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(null);

  const knockoutGroupIds = useMemo(() =>
    new Set(groups.filter(g => g.name === 'Halve Finales' || g.name === 'Finale').map(g => g.id)),
    [groups]
  );

  const groupedMatches = useMemo(() => {
    const grouped = {};
    groups.forEach(g => { grouped[g.id] = { group: g, matches: [] }; });
    matches.forEach(m => {
      if (grouped[m.group_id]) grouped[m.group_id].matches.push(m);
    });
    return Object.values(grouped);
  }, [matches, groups]);

  async function saveScore(matchId) {
    const s = scores[matchId];
    if (!s || s.home === '' || s.away === '') { alert('Vul beide scores in.'); return; }
    const match = matches.find(m => m.id === matchId);
    const isKnockout = match && knockoutGroupIds.has(match.group_id);
    const isDraw = parseInt(s.home) === parseInt(s.away);
    if (isKnockout && isDraw) {
      if (s.home_penalties == null || s.home_penalties === '' || s.away_penalties == null || s.away_penalties === '') {
        alert('Het duel eindigde gelijk — vul ook de strafschoppenstanden in.'); return;
      }
      if (parseInt(s.home_penalties) === parseInt(s.away_penalties)) {
        alert('De strafschoppenstand kan niet gelijk eindigen.'); return;
      }
    }
    setSaving(matchId);
    const updatePayload = {
      home_score: parseInt(s.home),
      away_score: parseInt(s.away),
      status: 'played',
    };
    if (isKnockout) {
      updatePayload.home_penalties = isDraw ? parseInt(s.home_penalties) : null;
      updatePayload.away_penalties = isDraw ? parseInt(s.away_penalties) : null;
    }
    await sb.from('matches').update(updatePayload).eq('id', matchId);
    setSaving(null);
    refresh();
  }

  async function clearScore(matchId) {
    const match = matches.find(m => m.id === matchId);
    const isKnockout = match && knockoutGroupIds.has(match.group_id);
    const clearPayload = { home_score: null, away_score: null, status: 'scheduled' };
    if (isKnockout) { clearPayload.home_penalties = null; clearPayload.away_penalties = null; }
    await sb.from('matches').update(clearPayload).eq('id', matchId);
    refresh();
  }

  return (
    <div className="space-y-5">
      {groupedMatches.map(({ group, matches: gMatches }) => (
        <div key={group.id} className="card">
          <h2 className="text-lg font-bold mb-4 section-title">{group.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {gMatches.map(m => {
              const home = teams.find(t => t.id === m.home_team_id);
              const away = teams.find(t => t.id === m.away_team_id);
              const sc = scores[m.id] || { home: m.home_score ?? '', away: m.away_score ?? '', home_penalties: m.home_penalties ?? '', away_penalties: m.away_penalties ?? '' };
              const isPlayed = m.status === 'played';
              const isKnockout = knockoutGroupIds.has(m.group_id);
              const isDraw = sc.home !== '' && sc.away !== '' && parseInt(sc.home) === parseInt(sc.away);
              const needsPenalties = isKnockout && isDraw;

              return (
                <div key={m.id} className="space-y-1">
                  <div className={`rounded-lg border p-3${isPlayed ? ' border-yellow-200 bg-yellow-50' : ' border-slate-200 bg-white'}`}>
                    <div className="text-xs text-slate-500 mb-2">{formatDateTime(m.scheduled_time)}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-1 font-medium text-right text-sm min-w-0"><TeamName name={home?.name} size={18} reverse /></div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number" min="0" max="99"
                          className="input w-12 text-center"
                          value={sc.home}
                          onChange={e => setScores(prev => ({ ...prev, [m.id]: { ...sc, home: e.target.value } }))}
                        />
                        <span className="text-slate-400 select-none">–</span>
                        <input
                          type="number" min="0" max="99"
                          className="input w-12 text-center"
                          value={sc.away}
                          onChange={e => setScores(prev => ({ ...prev, [m.id]: { ...sc, away: e.target.value } }))}
                        />
                      </div>
                      <div className="flex-1 font-medium text-sm min-w-0"><TeamName name={away?.name} size={18} /></div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          className="btn-primary text-xs py-1 px-2"
                          onClick={() => saveScore(m.id)}
                          disabled={saving === m.id}
                        >
                          {saving === m.id ? <Spinner /> : '✓'}
                        </button>
                        {isPlayed && (
                          <button className="btn-secondary text-xs py-1 px-2" onClick={() => clearScore(m.id)}>↩</button>
                        )}
                      </div>
                    </div>
                  </div>
                  {needsPenalties && (
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-yellow-950 rounded text-sm border border-yellow-900">
                      <span className="text-xs text-yellow-400 flex-shrink-0">⚽ Strafschoppen:</span>
                      <span className="text-xs text-slate-300 flex-shrink-0 truncate max-w-24">{home?.name}</span>
                      <input
                        type="number" min="0" max="20"
                        className="input w-10 text-center text-xs py-0.5"
                        value={sc.home_penalties}
                        onChange={e => setScores(prev => ({ ...prev, [m.id]: { ...sc, home_penalties: e.target.value } }))}
                      />
                      <span className="text-slate-500 text-xs">–</span>
                      <input
                        type="number" min="0" max="20"
                        className="input w-10 text-center text-xs py-0.5"
                        value={sc.away_penalties}
                        onChange={e => setScores(prev => ({ ...prev, [m.id]: { ...sc, away_penalties: e.target.value } }))}
                      />
                      <span className="text-xs text-slate-300 flex-shrink-0 truncate max-w-24">{away?.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {groupedMatches.length === 0 && (
        <div className="card empty-state">Nog geen wedstrijden. Genereer eerst het speelschema.</div>
      )}
    </div>
  );
}
