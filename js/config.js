// ================================================================
// ⚙️  CONFIGURATIE — pas dit aan vóór gebruik
// ================================================================
const CONFIG = {
  SUPABASE_URL:      'https://daummfrmrkemzivzbokq.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhdW1tZnJtcmtlbXppdnpib2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTg1NTYsImV4cCI6MjA5NjMzNDU1Nn0.nvgcQtnKLPlnAreSw7Tj3-0VkUfmgQNr2GLBVUNnFhs',
  ADMIN_PASSWORD:    'JokeMeerman2026!',
  TOURNAMENT_NAME:   'Joke Meerman Toernooi 2026',
};
// ================================================================

const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// ─── Posities ─────────────────────────────────────────────────
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const POS_LABELS = { GK: 'Keeper', DEF: 'Verdediger', MID: 'Middenvelder', FWD: 'Aanvaller' };

// ─── Clubs per land ────────────────────────────────────────────
const CLUBS_VS     = ['Appalachian FC', 'Providence City', 'Detroit City FC', 'Oakland Roots'];
const CLUBS_CANADA = ['TSS Rovers FC', 'Scrosoppi FC', 'Simcoe County Rovers FC'];
const CLUBS_MEXICO = ['Artesanos Metepec FC', 'Aguacateros Club Deportivo Uruapan', 'Faraones de Texcoco', 'Sporting Canamy'];
const ALLE_CLUBS   = [...CLUBS_VS, ...CLUBS_CANADA, ...CLUBS_MEXICO]; // 11 clubs totaal

const CLUB_DATA = {
  // logo: bestandsnaam van het logo in dezelfde map als index.html (optioneel — valt terug op schildbadge)
  'Appalachian FC':                     { abbr: 'AFC',  bg: '#1a3a1a', fg: '#f0f0f0', logo: 'img/logo-appalachian-fc.png' },
  'Providence City':                    { abbr: 'PC',   bg: '#8b0000', fg: '#ffffff', logo: 'img/logo-providence-city.png' },
  'Detroit City FC':                    { abbr: 'DCFC', bg: '#c8102e', fg: '#ffffff', logo: 'img/logo-detroit-city-fc.png' },
  'Oakland Roots':                      { abbr: 'OR',   bg: '#006341', fg: '#ffffff', logo: 'img/logo-oakland-roots.png' },
  'TSS Rovers FC':                      { abbr: 'TSS',  bg: '#005f86', fg: '#ffffff', logo: 'img/logo-tss-rovers-fc.png' },
  'Scrosoppi FC':                       { abbr: 'SFC',  bg: '#003087', fg: '#ffd700', logo: 'img/logo-scrosoppi-fc.png' },
  'Simcoe County Rovers FC':            { abbr: 'SCR',  bg: '#002147', fg: '#ffc72c', logo: 'img/logo-simcoe-county-rovers.png' },
  'Artesanos Metepec FC':               { abbr: 'AMF',  bg: '#7b2d8b', fg: '#ffffff', logo: 'img/logo-artesanos-metepec-fc.png' },
  'Aguacateros Club Deportivo Uruapan': { abbr: 'AGU',  bg: '#2d7a2d', fg: '#ffffff', logo: 'img/logo-aguacateros-uruapan.png' },
  'Faraones de Texcoco':                { abbr: 'FDT',  bg: '#8b6914', fg: '#ffffff', logo: 'img/logo-faraones-de-texcoco.png' },
  'Sporting Canamy':                    { abbr: 'SC',   bg: '#1a1a1a', fg: '#00c851', logo: 'img/logo-sporting-canamy.png' },
};
