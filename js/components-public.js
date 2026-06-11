// ================================================================
// PUBLIEKE VIEWS
// ================================================================

// ─── Gedeelde match-kaart component (mobiel-vriendelijk) ──────

function PublicMatchCard({ m, teams, groups, refereeTeam, labelText, labelColor, showTime = true }) {
  const home = teams.find(t => t.id === m.home_team_id);
  const away = teams.find(t => t.id === m.away_team_id);
  const group = groups.find(g => g.id === m.group_id);
  const isPlayed = m.status === 'played';
  const hasPenalties = isPlayed && m.home_score === m.away_score &&
                       m.home_penalties != null && m.away_penalties != null;
  const homeWin = isPlayed && (m.home_score > m.away_score ||
                  (hasPenalties && m.home_penalties > m.away_penalties));
  const awayWin = isPlayed && (m.away_score > m.home_score ||
                  (hasPenalties && m.away_penalties > m.home_penalties));
  const label = labelText || group?.name || '';
  return (
    <div className={`match-card${isPlayed ? ' match-card-played' : ''}`}>
      <div className="match-card-meta">
        {showTime && <span className="match-card-time">{formatTime(m.scheduled_time)}</span>}
        <span>Veld {m.field_number}</span>
        {label && <span className={`ml-auto font-medium ${labelColor || 'text-slate-500'}`}>{label}</span>}
      </div>
      <div className="match-card-row">
        <div className={`match-card-team text-right ${homeWin ? 'win-text' : isPlayed && !homeWin ? 'text-slate-400' : ''}`}>
          <TeamName name={home?.name} size={18} reverse />
        </div>
        <div className="match-card-score">
          {isPlayed
            ? <span>{m.home_score} – {m.away_score}</span>
            : <span className="text-slate-400 text-sm">vs</span>}
        </div>
        <div className={`match-card-team ${awayWin ? 'win-text' : isPlayed && !awayWin ? 'text-slate-400' : ''}`}>
          <TeamName name={away?.name} size={18} />
        </div>
      </div>
      {hasPenalties && (
        <div className="text-center text-xs text-yellow-600 mt-1 font-medium">
          ({m.home_penalties}–{m.away_penalties} n.s.)
        </div>
      )}
      {refereeTeam && (
        <div className="match-card-referee">
          <img src="img/football-referee.png" alt="sch" className="w-3.5 h-3.5 object-contain" />
          <ClubBadge name={refereeTeam.name} size={16} />
          <span>{refereeTeam.name}</span>
        </div>
      )}
    </div>
  );
}

// ─── Speelschema publiek ─────────────────────────────────────

function PublicSchedule({ matches, teams, groups, groupTeams }) {
  const [teamFilter, setTeamFilter] = useState('');

  const refereeMap = useMemo(
    () => calcReferees(matches, groups, groupTeams || []),
    [matches, groups, groupTeams]
  );

  const groupedByDate = useMemo(() => {
    const map = {};
    matches.forEach(m => {
      const date = m.scheduled_time ? new Date(m.scheduled_time).toDateString() : 'Onbekend';
      if (!map[date]) map[date] = [];
      map[date].push(m);
    });
    return Object.entries(map).sort(([a], [b]) => new Date(a) - new Date(b));
  }, [matches]);

  const filtered = useMemo(() => {
    const q = teamFilter.trim().toLowerCase();
    if (!q) return groupedByDate;
    return groupedByDate.map(([date, ms]) => [
      date,
      ms.filter(m => {
        const h = teams.find(t => t.id === m.home_team_id)?.name?.toLowerCase() || '';
        const a = teams.find(t => t.id === m.away_team_id)?.name?.toLowerCase() || '';
        return h.includes(q) || a.includes(q);
      }),
    ]).filter(([, ms]) => ms.length > 0);
  }, [groupedByDate, teamFilter, teams]);

  if (matches.length === 0) {
    return <div className="card empty-state">Speelschema is nog niet beschikbaar.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card py-3">
        <input
          className="input"
          placeholder="🔍 Zoek op teamnaam…"
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
        />
      </div>
      {filtered.map(([date, dayMatches]) => {
        const slotMap = {};
        dayMatches.forEach(m => {
          const key = m.scheduled_time || 'unknown';
          if (!slotMap[key]) slotMap[key] = [];
          slotMap[key].push(m);
        });
        const slots = Object.entries(slotMap).sort(([a], [b]) => new Date(a) - new Date(b));
        return (
          <div key={date} className="card">
            <h3 className="font-bold section-title mb-4">{formatDate(dayMatches[0]?.scheduled_time)}</h3>
            <div className="space-y-4">
              {slots.map(([time, slotMatches]) => (
                <div key={time}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="match-card-time">{formatTime(time)}</span>
                    <div className="flex-1 border-t" style={{borderColor:'var(--border)'}} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {slotMatches.map(m => {
                      const referee = teams.find(t => t.id === refereeMap[m.id]);
                      return <PublicMatchCard key={m.id} m={m} teams={teams} groups={groups} refereeTeam={referee} showTime={false} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && teamFilter && (
        <div className="card empty-state">Geen wedstrijden gevonden voor "{teamFilter}".</div>
      )}
    </div>
  );
}

// ─── Poulestanden publiek ─────────────────────────────────────

function PublicStandings({ groups, groupTeams, teams, matches }) {
  // Alleen poule-groepen tonen (groepen met teams), niet kruis finale groepen
  const poolGroups = useMemo(() =>
    groups.filter(g => groupTeams.some(gt => gt.group_id === g.id)),
    [groups, groupTeams]
  );

  const teamsByGroup = useMemo(() => {
    const map = {};
    poolGroups.forEach(g => {
      map[g.id] = groupTeams.filter(gt => gt.group_id === g.id).map(gt => teams.find(t => t.id === gt.team_id)).filter(Boolean);
    });
    return map;
  }, [poolGroups, groupTeams, teams]);

  const matchesByGroup = useMemo(() => {
    const map = {};
    poolGroups.forEach(g => { map[g.id] = matches.filter(m => m.group_id === g.id); });
    return map;
  }, [poolGroups, matches]);

  if (poolGroups.length === 0) {
    return <div className="card empty-state">Poules zijn nog niet beschikbaar.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {poolGroups.map(g => {
        const standings = calcStandings(teamsByGroup[g.id] || [], matchesByGroup[g.id] || []);
        return (
          <div key={g.id} className="card">
            <h3 className="font-bold section-title mb-3">{g.name}</h3>
            <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="table-header">
                  <th className="pb-2 w-6">#</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2 text-center w-8">S</th>
                  <th className="pb-2 text-center w-8">W</th>
                  <th className="pb-2 text-center w-8">G</th>
                  <th className="pb-2 text-center w-8">V</th>
                  <th className="pb-2 text-center w-9 hidden sm:table-cell">DV</th>
                  <th className="pb-2 text-center w-9 hidden sm:table-cell">DT</th>
                  <th className="pb-2 text-center w-9">DS</th>
                  <th className="pb-2 text-center w-10">Pnt</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team.id} className={`table-row ${i === 0 && s.pts > 0 ? 'winner' : ''}`}>
                    <td className="py-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 font-medium overflow-hidden"><TeamName name={s.team.name} size={20} /></td>
                    <td className="py-2 col-neutral">{s.p}</td>
                    <td className="py-2 col-win">{s.w}</td>
                    <td className="py-2 col-neutral">{s.d}</td>
                    <td className="py-2 col-loss">{s.l}</td>
                    <td className="py-2 text-center hidden sm:table-cell">{s.gf}</td>
                    <td className="py-2 text-center hidden sm:table-cell">{s.ga}</td>
                    <td className="py-2 text-center text-sm">{s.gf - s.ga > 0 ? `+${s.gf - s.ga}` : s.gf - s.ga}</td>
                    <td className="py-2 col-pts">{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="text-xs text-slate-600 mt-2">S=Gespeeld, W=Gewonnen, G=Gelijk, V=Verloren, DS=Doelsaldo, <span className="hidden sm:inline">DV=Doelpunten voor, DT=Doelpunten tegen, </span>Pnt=Punten</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Finales publiek ─────────────────────────────────────────

function PublicFinales({ groups, groupTeams, teams, matches }) {
  const sfGroup     = groups.find(g => g.name === 'Halve Finales');
  const finaleGroup = groups.find(g => g.name === 'Finale');
  const sfMatches   = sfGroup     ? [...matches.filter(m => m.group_id === sfGroup.id)].sort((a,b) => a.round_number - b.round_number)     : [];
  const finaleMatches = finaleGroup ? [...matches.filter(m => m.group_id === finaleGroup.id)].sort((a,b) => a.round_number - b.round_number) : [];

  const nPools = groups.filter(g => groupTeams.some(gt => gt.group_id === g.id)).length;

  function sfLabel(roundNumber) {
    if (roundNumber <= nPools) return `HF ${roundNumber}`;
    const idx      = roundNumber - nPools - 1;
    const posStart = 2 * nPools + 1 + idx * 2;
    return `${posStart}e/${posStart + 1}e Plek`;
  }

  if (!sfGroup && !finaleGroup) {
    return <div className="card empty-state">Kruis finales zijn nog niet beschikbaar.</div>;
  }

  function KnockoutRow({ match, label, labelColor }) {
    const referee = teams.find(t => t.id === match.referee_team_id);
    return (
      <PublicMatchCard
        m={match}
        teams={teams}
        groups={groups}
        refereeTeam={referee}
        labelText={label}
        labelColor={labelColor}
      />
    );
  }

  const actualSFs   = sfMatches.filter(m => m.round_number <= nPools);
  const consolation = sfMatches.filter(m => m.round_number > nPools);

  return (
    <div className="space-y-5">
      {actualSFs.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Halve Finales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {actualSFs.map(m => <KnockoutRow key={m.id} match={m} label={sfLabel(m.round_number)} labelColor="text-blue-400" />)}
          </div>
        </div>
      )}
      {consolation.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Plaatsingswedstrijden</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {consolation.map(m => <KnockoutRow key={m.id} match={m} label={sfLabel(m.round_number)} labelColor="text-orange-400" />)}
          </div>
        </div>
      )}
      {finaleMatches.length > 0 && (
        <div className="card">
          <h3 className="font-bold section-title mb-3">Finale</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {finaleMatches.map((m, i) => (
              <KnockoutRow key={m.id} match={m}
                label={i === 0 ? '🥇 Finale' : '🥉 3e Plaats'}
                labelColor={i === 0 ? 'text-yellow-400' : 'text-slate-400'} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Topscorer Klassement ─────────────────────────────────────

function TopScorers({ players }) {
  const scorers = [...players]
    .filter(p => (p.goals || 0) > 0)
    .sort((a, b) => (b.goals || 0) - (a.goals || 0))
    .slice(0, 10);

  if (scorers.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-xl font-bold section-title mb-3">⚽ Topscorer Klassement</h3>
      <table className="w-full">
        <thead>
          <tr className="table-header text-sm">
            <th className="pb-2 text-left w-7">#</th>
            <th className="pb-2 text-left">Speler</th>
            <th className="pb-2 text-center w-16">Goals</th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((p, i) => (
            <tr key={p.id} className="table-row">
              <td className="py-2 text-slate-500 text-base">{i + 1}</td>
              <td className={`py-2 font-bold text-xl ${i === 0 ? 'text-yellow-600' : ''}`}>{p.name}</td>
              <td className={`py-2 text-center font-bold text-2xl col-pts ${i === 0 ? 'text-yellow-600' : ''}`}>{p.goals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Overzicht (TV-modus) ─────────────────────────────────────

function PublicOverview({ matches, teams, groups, groupTeams, players }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const poolGroups = useMemo(() =>
    groups.filter(g => groupTeams.some(gt => gt.group_id === g.id)),
    [groups, groupTeams]
  );

  const teamsByGroup = useMemo(() => {
    const map = {};
    poolGroups.forEach(g => {
      map[g.id] = groupTeams.filter(gt => gt.group_id === g.id)
        .map(gt => teams.find(t => t.id === gt.team_id)).filter(Boolean);
    });
    return map;
  }, [poolGroups, groupTeams, teams]);

  const standingsPerGroup = useMemo(() =>
    poolGroups.map(g => ({
      group: g,
      standings: calcStandings(teamsByGroup[g.id] || [], matches.filter(m => m.group_id === g.id)),
    })),
    [poolGroups, teamsByGroup, matches]
  );

  const scheduleMatches = useMemo(() =>
    [...matches].sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time)),
    [matches]
  );

  const sfGroup     = groups.find(g => g.name === 'Halve Finales');
  const finaleGroup = groups.find(g => g.name === 'Finale');
  const sfMatches   = sfGroup     ? scheduleMatches.filter(m => m.group_id === sfGroup.id)     : [];
  const finMatches  = finaleGroup ? scheduleMatches.filter(m => m.group_id === finaleGroup.id) : [];
  const poolMatches = scheduleMatches.filter(m => m.group_id !== sfGroup?.id && m.group_id !== finaleGroup?.id);

  // group pool matches by time slot (round)
  const matchesBySlot = useMemo(() => {
    const map = {};
    poolMatches.forEach(m => {
      const key = m.scheduled_time || 'unknown';
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return Object.entries(map).sort(([a], [b]) => new Date(a) - new Date(b));
  }, [poolMatches]);

  if (matches.length === 0 && groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400 text-2xl">Toernooi is nog niet gestart.</p>
      </div>
    );
  }

  function MatchRow({ m, labelOverride }) {
    const home    = teams.find(t => t.id === m.home_team_id);
    const away    = teams.find(t => t.id === m.away_team_id);
    const group   = groups.find(g => g.id === m.group_id);
    const played  = m.status === 'played';
    const hasPenalties = played && m.home_score === m.away_score &&
                         m.home_penalties != null && m.away_penalties != null;
    const homeWinPen = hasPenalties && m.home_penalties > m.away_penalties;
    const awayWinPen = hasPenalties && m.away_penalties > m.home_penalties;
    const homeWin = played && (m.home_score > m.away_score || homeWinPen);
    const awayWin = played && (m.away_score > m.home_score || awayWinPen);

    return (
      <div className={`match-card${played ? ' match-card-played' : ''}`}>
        <div className="match-card-meta text-sm">
          <span className="match-card-time text-sm sm:text-base">{formatTime(m.scheduled_time)}</span>
          <span className="hidden sm:inline">Veld {m.field_number}</span>
          <span className="ml-auto">{labelOverride || group?.name || ''}</span>
        </div>
        <div className="match-card-row">
          <div className={`match-card-team text-right font-bold text-base sm:text-xl ${homeWin ? 'win-text' : played ? 'text-slate-400' : 'text-slate-800'}`}>
            <TeamName name={home?.name} size={22} reverse />
          </div>
          <div className="match-card-score font-bold text-xl sm:text-2xl">
            {played ? (
              <div>
                <span className="text-slate-800">{m.home_score} – {m.away_score}</span>
                {hasPenalties && (
                  <div className="text-xs text-yellow-600 font-normal">({m.home_penalties}–{m.away_penalties} n.s.)</div>
                )}
              </div>
            ) : <span className="text-slate-400 text-sm sm:text-base">vs</span>}
          </div>
          <div className={`match-card-team font-bold text-base sm:text-xl ${awayWin ? 'win-text' : played ? 'text-slate-400' : 'text-slate-800'}`}>
            <TeamName name={away?.name} size={22} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

      {/* LEFT — Poulestanden + Topscorers */}
      <div className="xl:col-span-2 space-y-5">
        <h2 className="text-2xl font-bold text-slate-800 tracking-wide">Poulestanden</h2>
        {standingsPerGroup.length === 0 ? (
          <p className="text-slate-400 text-lg">Nog geen poules.</p>
        ) : standingsPerGroup.map(({ group, standings }) => (
          <div key={group.id} className="card">
            <h3 className="text-xl font-bold section-title mb-3">{group.name}</h3>
            <table className="w-full table-fixed">
              <thead>
                <tr className="table-header text-sm">
                  <th className="pb-2 text-left w-7">#</th>
                  <th className="pb-2 text-left">Team</th>
                  <th className="pb-2 text-center w-10">S</th>
                  <th className="pb-2 text-center w-10">W</th>
                  <th className="pb-2 text-center w-10">G</th>
                  <th className="pb-2 text-center w-10">V</th>
                  <th className="pb-2 text-center w-14">Pnt</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team.id} className={`table-row ${i < 2 && s.pts > 0 ? 'text-green-700' : ''}`}>
                    <td className="py-2 text-slate-500 text-base">{i + 1}</td>
                    <td className="py-2 font-bold text-xl overflow-hidden"><TeamName name={s.team.name} size={24} /></td>
                    <td className="py-2 text-center text-base">{s.p}</td>
                    <td className="py-2 text-center text-base">{s.w}</td>
                    <td className="py-2 text-center text-base">{s.d}</td>
                    <td className="py-2 text-center text-base">{s.l}</td>
                    <td className="py-2 text-center font-bold text-2xl col-pts">{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-600 mt-2">Groen = door naar kruis finales</p>
          </div>
        ))}
        <TopScorers players={players} />
        <QRCodeWidget />
      </div>

      {/* RIGHT — Speelschema */}
      <div className="xl:col-span-3 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold text-slate-800 tracking-wide">Speelschema &amp; Uitslagen</h2>
          {matches.length > 0 && (() => {
            const poolMatchCount = poolMatches.length;
            const playedCount    = poolMatches.filter(m => m.status === 'played').length;
            const allDone        = playedCount === poolMatchCount && poolMatchCount > 0;
            return (
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${allDone ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                {allDone ? '✓ Poulefase afgerond' : `${playedCount} / ${poolMatchCount} gespeeld`}
              </span>
            );
          })()}
        </div>

        {/* Pool matches per time slot */}
        {matchesBySlot.length === 0 && sfMatches.length === 0 && finMatches.length === 0 && (
          <p className="text-slate-400 text-lg">Nog geen wedstrijden gepland.</p>
        )}

        {(() => {
          const nextSlotTime = matchesBySlot.find(([time, slotMatches]) => {
            const allPlayed = slotMatches.every(m => m.status === 'played');
            return !allPlayed && now < new Date(time);
          })?.[0] ?? null;

          return matchesBySlot.map(([time, slotMatches]) => {
            const allPlayed  = slotMatches.every(m => m.status === 'played');
            const slotTime   = new Date(time);
            const isLive     = !allPlayed && now >= slotTime;
            const isNext     = !allPlayed && !isLive && time === nextSlotTime;

            const minsUntil  = isNext ? Math.round((slotTime - now) / 60000) : 0;
            const untilLabel = minsUntil <= 1 ? 'zo meteen' : `over ${minsUntil} min`;

            return (
              <div key={time} className={`card ${allPlayed ? 'opacity-60' : ''} ${isNext ? 'border-2 border-yellow-400' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-lg font-bold font-mono ${isNext ? 'text-yellow-600' : 'text-slate-700'}`}>{formatTime(time)}</span>
                  {isLive && (
                    <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded font-bold tracking-wider">LIVE</span>
                  )}
                  {isNext && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">Volgende ronde · {untilLabel}</span>
                  )}
                  {allPlayed && (
                    <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded">Gespeeld</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {slotMatches.map(m => <MatchRow key={m.id} m={m} />)}
                </div>
              </div>
            );
          });
        })()}

        {/* Halve finales */}
        {sfMatches.length > 0 && (
          <div className="card border border-blue-800">
            <h3 className="text-xl font-bold text-blue-400 mb-3">Halve Finales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sfMatches.map(m => <MatchRow key={m.id} m={m} labelOverride="HF" />)}
            </div>
          </div>
        )}

        {/* Finale */}
        {finMatches.length > 0 && (
          <div className="card border border-yellow-800">
            <h3 className="text-xl font-bold text-yellow-400 mb-3">Finale</h3>
            <div className="space-y-1">
              {finMatches.map((m, i) => <MatchRow key={m.id} m={m} labelOverride={i === 0 ? '🥇 Finale' : '🥉 3e Plek'} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Teams publiek ───────────────────────────────────────────

function PublicTeams({ teams, players }) {
  if (teams.length === 0) {
    return <div className="card empty-state">Teams zijn nog niet ingedeeld.</div>;
  }

  const playersByTeam = {};
  teams.forEach(t => { playersByTeam[t.id] = []; });
  players.forEach(p => { if (p.team_id && playersByTeam[p.team_id]) playersByTeam[p.team_id].push(p); });

  const posOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map(team => {
        const members = [...(playersByTeam[team.id] || [])].sort(
          (a, b) => (posOrder[a.position] ?? 9) - (posOrder[b.position] ?? 9)
        );
        return (
          <div key={team.id} className="card">
            <div className="flex items-center gap-2 mb-3">
              <ClubBadge name={team.name} size={32} />
              <span className="font-bold text-lg">{team.name}</span>
            </div>
            {members.length === 0 ? (
              <p className="text-slate-400 text-sm">Nog geen spelers</p>
            ) : (
              <div className="space-y-1">
                {members.map(p => (
                  <div key={p.id} className="text-sm font-medium py-0.5">{p.name}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Spelregels publiek ──────────────────────────────────────

function PublicRules() {
  const sections = [
    {
      icon: 'ℹ️',
      title: 'Belangrijkste regels',
      items: [
        'Over het algemeen gelden de reguliere voetbalregels.' ,
        'Inschieten of indribbelen bij een uitbal. De tegenstander moet op minimaal 3 meter afstand blijven.' ,
        'De keeper mag een opzettelijke terugspeelbal niet oppakken' ,
        'Het is niet toegestaan om slidings te maken. Als dit toch gebeurd, krijgt de tegenstander een vrije trap.',
        'Bij twijfel beslist de toernooiorganisatie — hun beslissing is bindend.',
      ],
    },
    {
      icon: '👥',
      title: 'Teams & Spelers',
      items: [
        'Elk team speelt met 4 veldspelers en 1 keeper (5 vs 5).',
        'Er mag doorlopend gewisseld worden waarbij de speler die erin komt, op de plek het veld in gaat waar de speler die eruit gaat het veld verlaat.',
      ],
    },
    {
      icon: '⏱️',
      title: 'Wedstrijdduur',
      items: [
        'Alle wedstrijden duren 15 minuten.',
        'Tussen de wedstrijden is er een pauze van 5 minuten.',
        'Zorg dat je op tijd klaar staat op het veld om de wedstrijd te starten.',
      ],
    },
    {
      icon: '🏆',
      title: 'Poulefase & Puntentelling',
      items: [
        'Winst = 3 punten · Gelijkspel = 1 punt · Verlies = 0 punten.',
        'Bij gelijk puntenaantal geldt achtereenvolgens: doelsaldo, meeste doelpunten voor, onderlinge stand.',
        'De top 2 van elke poule plaatst zich voor de kruis finales.',
        'De overige teams spelen een wedstrijd voor de overige plaatsen.',
      ],
    },
    {
      icon: '🏅',
      title: 'Kruis Finales',
      items: [
        'Halve finale: 1e Poule A vs 2e Poule B én 1e Poule B vs 2e Poule A.',
        'De winnaars spelen de finale; de verliezers spelen om de 3e plaats.',
        'Bij gelijkspel in de (halve) finale wordt het direct strafschoppen (beide teams nemen 3 penalties, daarna sudden death).',
      ],
    },
    {
      icon: '🦺',
      title: 'Scheidsrechters',
      items: [
        'Elk team fluit wedstrijden van andere poules als zij zelf niet spelen.',
        'Het scheidsrechterteam staat vermeld in het speelschema.',
        'De beslissing van de scheidsrechter is definitief.',
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-xl font-bold section-title mb-1">Spelregels {CONFIG.TOURNAMENT_NAME}</h2>
        <p className="text-sm" style={{color:'var(--text-sub)'}}>Hieronder vind je alle spelregels voor het toernooi. Lees ze goed door vóór aanvang!</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {sections.map((s, i) => (
          <div key={i} className="card">
            <h3 className="font-bold text-base mb-3 section-title flex items-center gap-2">
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </h3>
            <ul className="space-y-2">
              {s.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm" style={{color:'var(--text)'}}>
                  <span className="mt-0.5 flex-shrink-0" style={{color:'var(--accent)'}}>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Uitslagen publiek ────────────────────────────────────────

function PublicResults({ matches, teams, groups }) {
  const played = matches.filter(m => m.status === 'played');

  if (played.length === 0) {
    return <div className="card empty-state">Nog geen uitslagen beschikbaar.</div>;
  }

  const grouped = useMemo(() => {
    const map = {};
    groups.forEach(g => { map[g.id] = { group: g, matches: [] }; });
    played.forEach(m => { if (map[m.group_id]) map[m.group_id].matches.push(m); });
    return Object.values(map).filter(g => g.matches.length > 0);
  }, [played, groups]);

  return (
    <div className="space-y-5">
      {grouped.map(({ group, matches: gMatches }) => (
        <div key={group.id} className="card">
          <h3 className="font-bold section-title mb-3">{group.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {gMatches.map(m => {
              const home = teams.find(t => t.id === m.home_team_id);
              const away = teams.find(t => t.id === m.away_team_id);
              const hasPenalties = m.home_score === m.away_score && m.home_penalties != null && m.away_penalties != null;
              const homeWin = m.home_score > m.away_score || (hasPenalties && m.home_penalties > m.away_penalties);
              const awayWin = m.away_score > m.home_score || (hasPenalties && m.away_penalties > m.home_penalties);
              return (
                <div key={m.id} className="match-card match-card-played">
                  <div className="match-card-meta">
                    <span className="text-slate-500">{formatDateTime(m.scheduled_time)}</span>
                  </div>
                  <div className="match-card-row">
                    <div className={`match-card-team text-right ${homeWin ? 'win-text' : ''}`}><TeamName name={home?.name} size={18} reverse /></div>
                    <div className="match-card-score text-lg">
                      <div>{m.home_score} – {m.away_score}</div>
                    </div>
                    <div className={`match-card-team ${awayWin ? 'win-text' : ''}`}><TeamName name={away?.name} size={18} /></div>
                  </div>
                  {hasPenalties && (
                    <div className="text-center text-xs text-yellow-600 mt-1 font-medium">
                      ({m.home_penalties}–{m.away_penalties} n.s.)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
