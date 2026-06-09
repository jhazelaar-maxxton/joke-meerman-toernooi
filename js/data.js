// ─── Data hook ────────────────────────────────────────────────

function useData() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupTeams, setGroupTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, t, g, gt, m] = await Promise.all([
      sb.from('players').select('*').order('name'),
      sb.from('teams').select('*').order('name'),
      sb.from('groups').select('*').order('name'),
      sb.from('group_teams').select('*'),
      sb.from('matches').select('*').order('scheduled_time'),
    ]);
    if (p.data) setPlayers(p.data);
    if (t.data) setTeams(t.data);
    if (g.data) setGroups(g.data);
    if (gt.data) setGroupTeams(gt.data);
    if (m.data) setMatches(m.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Realtime subscriptions
    const channel = sb.channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => refresh())
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [refresh]);

  return { players, teams, groups, groupTeams, matches, loading, refresh };
}
