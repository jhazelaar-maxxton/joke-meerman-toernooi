// ================================================================
// ADMIN LOGIN + SESSION
// ================================================================

const ADMIN_SESSION_KEY = 'jmt_admin_until';
const ADMIN_SESSION_HOURS = 8;

function saveAdminSession() {
  const until = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  localStorage.setItem(ADMIN_SESSION_KEY, String(until));
}

function checkAdminSession() {
  const until = Number(localStorage.getItem(ADMIN_SESSION_KEY) || 0);
  return Date.now() < until;
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  function tryLogin(e) {
    e.preventDefault();
    if (pw === CONFIG.ADMIN_PASSWORD) { saveAdminSession(); onLogin(); }
    else { setError('Onjuist wachtwoord.'); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-1">⚙️ Admin</h2>
        <p className="text-slate-400 text-sm mb-5">Log in om het toernooi te beheren.</p>
        <form onSubmit={tryLogin} className="space-y-3">
          <input
            type="password" className="input" placeholder="Wachtwoord"
            value={pw} onChange={e => { setPw(e.target.value); setError(''); }}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full" type="submit">Inloggen</button>
        </form>
      </div>
    </div>
  );
}

// ================================================================
// HOOFD APP
// ================================================================

function App() {
  const { players, teams, groups, groupTeams, matches, loading, refresh } = useData();
  const [view, setView] = useState('overzicht'); // overzicht | schema | standen | uitslagen
  const [adminView, setAdminView] = useState('uitslagen'); // spelers | teams | poules | schema | uitslagen
  const [isAdmin, setIsAdmin] = useState(() => checkAdminSession());
  const [showAdminPanel, setShowAdminPanel] = useState(() => checkAdminSession());

  useEffect(() => { window.scrollTo(0, 0); }, [view]);
  useEffect(() => { window.scrollTo(0, 0); }, [adminView]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-slate-400">Toernooi laden…</p>
      </div>
    );
  }

  // Check Supabase config
  if (CONFIG.SUPABASE_URL === 'JOUW_SUPABASE_URL') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md">
          <h2 className="text-xl font-bold section-title mb-3">⚠️ Configuratie vereist</h2>
          <p className="text-slate-300 text-sm mb-3">
            Open <code className="code-inline">js/config.js</code> in een teksteditor en vul bovenaan je Supabase URL, anon key en admin wachtwoord in bij <code className="code-inline">CONFIG</code>.
          </p>
          <p className="text-slate-400 text-xs">Zie de setupinstructies voor meer uitleg.</p>
        </div>
      </div>
    );
  }

  if (showAdminPanel && !isAdmin) {
    return <AdminLogin onLogin={() => setIsAdmin(true)} />;
  }

  if (showAdminPanel && isAdmin) {
    const adminTabs = [
      { id: 'spelers', label: '👤 Spelers' },
      { id: 'teams', label: '👕 Teams' },
      { id: 'poules', label: '🏆 Poules' },
      { id: 'schema', label: '📅 Schema' },
      { id: 'finales', label: '🏅 Kruis Finales' },
      { id: 'uitslagen', label: '⚽ Uitslagen' },
    ];

    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-blue-900 px-3 sm:px-4 py-3 flex items-center justify-between" style={{background:'#0a1628'}}>
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="img/svod_logo.png" alt="SVOD'22" className="h-8 sm:h-10 w-auto" />
            <span className="font-bold text-white text-sm sm:text-base">{CONFIG.TOURNAMENT_NAME}</span>
            <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded hidden sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs sm:text-sm" onClick={() => setShowAdminPanel(false)}>← Publiek</button>
            <button className="btn-secondary text-xs sm:text-sm" onClick={() => { clearAdminSession(); setIsAdmin(false); setShowAdminPanel(false); }}>Uitloggen</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-blue-900 px-2 sm:px-4 overflow-x-auto" style={{background:'#0d1b35'}}>
          <div className="flex gap-1 min-w-max">
            {adminTabs.map(tab => (
              <button
                key={tab.id}
                className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${adminView === tab.id ? 'tab-active' : 'text-slate-400 hover:text-white'}`}
                onClick={() => setAdminView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {adminView === 'spelers'  && <AdminPlayers players={players} teams={teams} refresh={refresh} />}
          {adminView === 'teams'    && <AdminTeams players={players} teams={teams} refresh={refresh} />}
          {adminView === 'poules'   && <AdminGroups teams={teams} groups={groups} groupTeams={groupTeams} matches={matches} refresh={refresh} />}
          {adminView === 'schema'   && <AdminSchedule groups={groups} groupTeams={groupTeams} teams={teams} matches={matches} refresh={refresh} />}
          {adminView === 'finales'  && <AdminFinales groups={groups} groupTeams={groupTeams} teams={teams} matches={matches} refresh={refresh} />}
          {adminView === 'uitslagen' && <AdminResults matches={matches} teams={teams} groups={groups} refresh={refresh} />}
        </div>
      </div>
    );
  }

  // Publieke weergave
  const hasKnockout = groups.some(g => g.name === 'Halve Finales' || g.name === 'Finale');
  const publicTabs = [
    { id: 'overzicht', label: '📺 Overzicht' },
    { id: 'schema',   label: '📅 Speelschema' },
    { id: 'standen',  label: '🏆 Standen' },
    { id: 'uitslagen', label: '⚽ Uitslagen' },
    ...(hasKnockout ? [{ id: 'finales', label: '🏅 Finales' }] : []),
    ...(teams.length > 0 ? [{ id: 'teams', label: '👕 Teams' }] : []),
    { id: 'spelregels', label: '📋 Spelregels' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-blue-900 px-3 sm:px-4 py-3 sm:py-4" style={{background:'#0a1628'}}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src="img/svod_logo.png" alt="SVOD'22" className="h-9 sm:h-12 w-auto" />
            <div>
              <div className="font-bold text-white text-sm sm:text-lg leading-tight">{CONFIG.TOURNAMENT_NAME}</div>
              <div className="text-xs text-blue-300 hidden sm:block">{teams.length} teams · {matches.length} wedstrijden · {groups.length} poules</div>
            </div>
          </div>
          <button
            className="text-blue-700 hover:text-blue-400 text-base p-1"
            onClick={() => setShowAdminPanel(true)}
          >⚙</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-blue-900 overflow-x-auto" style={{background:'#0d1b35'}}>
        <div className="max-w-4xl mx-auto flex px-2 sm:px-4">
          {publicTabs.map(tab => (
            <button
              key={tab.id}
              className={`px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${view === tab.id ? 'tab-active' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 xl:px-6 py-4 sm:py-6">
        {view === 'overzicht'  && <PublicOverview matches={matches} teams={teams} groups={groups} groupTeams={groupTeams} players={players} />}
        {view === 'schema'    && <PublicSchedule matches={matches} teams={teams} groups={groups} groupTeams={groupTeams} />}
        {view === 'standen'   && <PublicStandings groups={groups} groupTeams={groupTeams} teams={teams} matches={matches} />}
        {view === 'uitslagen' && <PublicResults matches={matches} teams={teams} groups={groups} />}
        {view === 'finales'   && <PublicFinales groups={groups} groupTeams={groupTeams} teams={teams} matches={matches} />}
        {view === 'teams'      && <PublicTeams teams={teams} players={players} />}
        {view === 'spelregels' && <PublicRules />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
