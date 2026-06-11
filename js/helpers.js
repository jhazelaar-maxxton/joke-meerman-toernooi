// ─── Datum/tijd helpers ───────────────────────────────────────

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Kleine UI-componenten ────────────────────────────────────

function LevelDots({ level }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`level-dot ${i > level ? 'level-dot-empty' : ''}`} />
      ))}
    </span>
  );
}

function PosBadge({ pos }) {
  return <span className={`badge-${pos} text-xs font-bold px-2 py-0.5 rounded`}>{pos}</span>;
}

function Spinner() {
  return <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full inline-block" />;
}

function QRCodeWidget() {
  const screenRef = useRef(null);
  const printRef  = useRef(null);
  const [url] = useState(() => window.location.href);

  useEffect(() => {
    if (typeof QRCode === 'undefined') return;
    [{ ref: screenRef, size: 148 }, { ref: printRef, size: 320 }].forEach(({ ref, size }) => {
      if (ref.current) {
        ref.current.innerHTML = '';
        new QRCode(ref.current, {
          text: url, width: size, height: size,
          colorDark: '#000000', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    });
  }, [url]);

  return (
    <>
      {/* Schermversie in overzicht */}
      <div className="card">
        <h3 className="font-bold section-title mb-2">Scan &amp; Volg</h3>
        <p className="text-xs text-slate-400 mb-3">Scan de QR code om het toernooi live te volgen op je telefoon.</p>
        <div className="flex items-start gap-4">
          <div ref={screenRef} className="flex-shrink-0 rounded overflow-hidden bg-white p-1" />
          <div className="flex flex-col gap-2 min-w-0">
            <button className="btn-secondary text-sm" onClick={() => window.print()}>
              🖨 QR code printen
            </button>
            <p className="text-xs text-slate-500 break-all">{url}</p>
          </div>
        </div>
      </div>

      {/* Printversie — alleen zichtbaar tijdens afdrukken */}
      <div className="qr-print-section" style={{display:'none'}}>
        <div style={{fontSize:'28px',fontWeight:'bold',marginBottom:'12px',color:'#0a1628'}}>{CONFIG.TOURNAMENT_NAME}</div>
        <div ref={printRef} style={{margin:'16px 0'}} />
        <p style={{fontSize:'16px',color:'#444',marginBottom:'8px'}}>Scan de QR code om de toernooipagina te openen</p>
        <p style={{fontSize:'12px',color:'#888'}}>{url}</p>
      </div>
    </>
  );
}

function ClubBadge({ name, size = 22 }) {
  const club = CLUB_DATA[name];
  if (!club) return null;
  const { abbr, bg, fg, logo } = club;
  const [imgFailed, setImgFailed] = useState(false);

  if (logo && !imgFailed) {
    return (
      <img
        src={logo}
        alt={abbr}
        width={size}
        height={size}
        style={{flexShrink:0,objectFit:'contain',verticalAlign:'middle'}}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const fs = abbr.length >= 4 ? Math.round(size * 0.30) : abbr.length === 3 ? Math.round(size * 0.34) : Math.round(size * 0.40);
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" style={{flexShrink:0,verticalAlign:'middle'}} aria-hidden="true">
      <path d="M20 2 L38 8 L38 27 C38 37 20 46 20 46 C20 46 2 37 2 27 L2 8 Z" fill={bg}/>
      <path d="M20 5 L35 11 L35 27 C35 36 20 43 20 43 C20 43 5 36 5 27 L5 11 Z" fill="none" stroke={fg} strokeWidth="1" strokeOpacity="0.3"/>
      <text x="20" y="28" textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight="bold" fill={fg} fontFamily="system-ui,Arial,sans-serif">{abbr}</text>
    </svg>
  );
}

function TeamName({ name, size, reverse }) {
  if (!name) return <span>—</span>;
  const badge = <ClubBadge name={name} size={size || 20} />;
  const label = <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{name}</span>;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'0.35rem',maxWidth:'100%',minWidth:0}}>
      {reverse ? <>{label}{badge}</> : <>{badge}{label}</>}
    </span>
  );
}

// ─── Team generatie algoritme ─────────────────────────────────

function generateBalancedTeams(players, numTeams) {
  const teams = Array.from({ length: numTeams }, (_, i) => ({ index: i, players: [] }));

  // Stap 1: keepers eerst verdelen (snake draft)
  const gks  = players.filter(p => p.position === 'GK').sort((a, b) => b.level - a.level);
  const rest = players.filter(p => p.position !== 'GK').sort((a, b) => b.level - a.level);

  let idx = 0;
  let direction = 1;

  function draft(pool) {
    pool.forEach(player => {
      teams[idx].players.push(player);
      idx += direction;
      if (idx >= numTeams) { idx = numTeams - 1; direction = -1; }
      else if (idx < 0)    { idx = 0;            direction =  1; }
    });
  }

  draft(gks);
  draft(rest);

  // Stap 2: egaleer teamgroottes (maximaal 1 verschil), verplaats bij voorkeur geen keeper
  let changed = true;
  while (changed) {
    changed = false;
    const largest = teams.reduce((a, b) => a.players.length > b.players.length ? a : b);
    const smallest = teams.reduce((a, b) => a.players.length < b.players.length ? a : b);
    if (largest.players.length - smallest.players.length > 1) {
      const movable = largest.players.filter(p => p.position !== 'GK');
      const pool = movable.length > 0 ? movable : largest.players;
      const avgSmallest = smallest.players.length > 0
        ? smallest.players.reduce((s, p) => s + p.level, 0) / smallest.players.length
        : 3;
      const playerToMove = pool.reduce((best, p) =>
        Math.abs(p.level - avgSmallest) < Math.abs(best.level - avgSmallest) ? p : best
      , pool[0]);
      largest.players = largest.players.filter(p => p !== playerToMove);
      smallest.players.push(playerToMove);
      changed = true;
    }
  }

  // Stap 3: swap-optimalisatie — ruil spelers tussen teams totdat de score-spreiding niet meer daalt
  const teamScore = t => t.players.reduce((s, p) => s + p.level, 0);

  let improved = true;
  while (improved) {
    improved = false;
    const scores = teams.map(teamScore);
    const currentSpread = Math.max(...scores) - Math.min(...scores);
    if (currentSpread <= 1) break;

    outer:
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        if (teams[i].players.length !== teams[j].players.length) continue;
        for (const pa of teams[i].players) {
          for (const pb of teams[j].players) {
            // Keeper-constraint: haal geen keeper weg uit een team dat er maar één heeft
            if (pa.position === 'GK' && pb.position !== 'GK') {
              if (teams[i].players.filter(p => p.position === 'GK').length === 1) continue;
            }
            if (pb.position === 'GK' && pa.position !== 'GK') {
              if (teams[j].players.filter(p => p.position === 'GK').length === 1) continue;
            }

            const newScoreI = scores[i] - pa.level + pb.level;
            const newScoreJ = scores[j] - pb.level + pa.level;
            const newScores = [...scores];
            newScores[i] = newScoreI;
            newScores[j] = newScoreJ;
            const newSpread = Math.max(...newScores) - Math.min(...newScores);

            if (newSpread < currentSpread) {
              teams[i].players = teams[i].players.map(p => p === pa ? pb : p);
              teams[j].players = teams[j].players.map(p => p === pb ? pa : p);
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }

  return teams;
}

// ─── Speelschema generatie (round-robin) ──────────────────────

function generateRoundRobin(teamIds) {
  const n = teamIds.length;
  const teams = n % 2 === 0 ? [...teamIds] : [...teamIds, null]; // bye indien oneven
  const rounds = [];
  const total = teams.length - 1;

  for (let round = 0; round < total; round++) {
    const matches = [];
    for (let i = 0; i < teams.length / 2; i++) {
      const home = teams[i];
      const away = teams[teams.length - 1 - i];
      if (home !== null && away !== null) {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    // Roteer: houd teams[0] vast, roteer de rest
    teams.splice(1, 0, teams.pop());
  }
  return rounds;
}

// ─── Winner bepalen in knockout (rekening met strafschoppen) ─

function getMatchWinner(m) {
  if (m.home_score > m.away_score) return m.home_team_id;
  if (m.away_score > m.home_score) return m.away_team_id;
  if (m.home_penalties != null && m.away_penalties != null)
    return m.home_penalties > m.away_penalties ? m.home_team_id : m.away_team_id;
  return m.home_team_id;
}

// ─── Poulestanden berekenen ───────────────────────────────────

function calcStandings(teams, matches) {
  const stats = {};
  teams.forEach(t => {
    stats[t.id] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });

  matches.filter(m => m.status === 'played').forEach(m => {
    const h = stats[m.home_team_id];
    const a = stats[m.away_team_id];
    if (!h || !a) return;
    h.p++; a.p++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.w++; h.pts += 3; a.l++; }
    else if (m.home_score < m.away_score) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });

  return Object.values(stats).sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
  );
}

// ─── Scheidsrechter berekenen per wedstrijd ───────────────────

function calcReferees(matches, groups, groupTeams) {
  // Alleen poulewedstrijden (groepen met teams in group_teams)
  const poolGroupIds = new Set(
    groups.filter(g => groupTeams.some(gt => gt.group_id === g.id)).map(g => g.id)
  );

  const groupTeamMap = {};
  groupTeams.forEach(gt => {
    if (!groupTeamMap[gt.group_id]) groupTeamMap[gt.group_id] = [];
    groupTeamMap[gt.group_id].push(gt.team_id);
  });

  const poolMatches = matches.filter(m => poolGroupIds.has(m.group_id));

  const matchesByTime = {};
  poolMatches.forEach(m => {
    const key = m.scheduled_time || 'unknown';
    if (!matchesByTime[key]) matchesByTime[key] = [];
    matchesByTime[key].push(m);
  });

  const sortedSlots = Object.entries(matchesByTime)
    .sort(([a], [b]) => new Date(a) - new Date(b));

  const refCount = {};
  const refereeMap = {};

  sortedSlots.forEach(([, slotMatches]) => {
    const playingTeams = new Set(slotMatches.flatMap(m => [m.home_team_id, m.away_team_id]));

    slotMatches.forEach(m => {
      const candidates = [];
      Object.entries(groupTeamMap).forEach(([groupId, teamIds]) => {
        if (groupId !== m.group_id) {
          teamIds.forEach(tid => {
            if (!playingTeams.has(tid)) candidates.push(tid);
          });
        }
      });
      if (candidates.length === 0) return;
      // Kies het team met de minste scheidsrechtersbeurten voor eerlijke verdeling
      candidates.sort((a, b) => (refCount[a] || 0) - (refCount[b] || 0));
      const chosen = candidates[0];
      refereeMap[m.id] = chosen;
      refCount[chosen] = (refCount[chosen] || 0) + 1;
    });
  });

  return refereeMap;
}
