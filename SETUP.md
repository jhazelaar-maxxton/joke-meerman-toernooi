# ⚽ Voetbal Toernooi App — Setup instructies

## Wat je nodig hebt
- Een gratis [Supabase](https://supabase.com) account
- Een teksteditor (Notepad, VS Code, etc.)
- Een browser

---

## Stap 1 — Supabase project aanmaken

1. Ga naar [supabase.com](https://supabase.com) en maak een gratis account aan
2. Klik op **"New project"**
3. Kies een naam (bijv. `voetbal-toernooi`) en een wachtwoord voor de database
4. Wacht tot het project aangemaakt is (~1 minuut)

---

## Stap 2 — Database tabellen aanmaken

1. Ga in je Supabase project naar **SQL Editor** (linkermenu)
2. Klik op **"New query"**
3. Open het bestand `supabase_schema.sql` en kopieer de volledige inhoud
4. Plak dit in de SQL Editor en klik op **"Run"**
5. Je ziet onderaan "Success" als alles goed gaat

---

## Stap 3 — Je gegevens ophalen

1. Ga in Supabase naar **Project Settings → API** (tandwiel-icoon onderaan)
2. Noteer:
   - **Project URL** → bijv. `https://abcdefgh.supabase.co`
   - **anon public key** → lange string die begint met `eyJ...`

---

## Stap 4 — App configureren

1. Open `index.html` in een teksteditor
2. Zoek bovenaan de `CONFIG` sectie (regel ~20):

```javascript
const CONFIG = {
  SUPABASE_URL:      'JOUW_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'JOUW_SUPABASE_ANON_KEY',
  ADMIN_PASSWORD:    'admin123',
  TOURNAMENT_NAME:   'Voetbal Toernooi 2025',
};
```

3. Vervang:
   - `JOUW_SUPABASE_URL` → jouw Project URL
   - `JOUW_SUPABASE_ANON_KEY` → jouw anon public key
   - `admin123` → een wachtwoord naar keuze
   - `Voetbal Toernooi 2025` → naam van jouw toernooi

4. Sla het bestand op

---

## Stap 5 — App openen en gebruiken

Open `index.html` in je browser. De app werkt direct.

### Werkflow voor de admin:

1. **Klik op het kleine ⚙ icoontje** rechtsonder in de header om naar het admin-paneel te gaan
2. **Spelers** — Voeg alle spelers in met naam, positie en niveau (1–5)
3. **Teams** — Genereer gebalanceerde teams (snake draft op positie + niveau), bekijk de preview en sla op
4. **Poules** — Genereer poules (kies aantal), teams worden random verdeeld
5. **Schema** — Stel datum, starttijd, wedstrijdduur en aantal velden in, genereer het schema
6. **Uitslagen** — Voer scores in na elke wedstrijd

### Wat bezoekers zien:
- **Speelschema** — alle wedstrijden met tijden en veldnummer
- **Standen** — live poulestanden (automatisch bijgewerkt)
- **Uitslagen** — gespeelde wedstrijden met scores

---

## App delen

Je kunt `index.html` op verschillende manieren beschikbaar stellen:

**Optie A — Lokaal (alleen voor jezelf):**
Gewoon het bestand openen in de browser. Anderen zien de data ook via Supabase zolang ze dezelfde URL hebben, maar ze moeten het bestand dan ook hebben.

**Optie B — Gratis hosting via Netlify (aanbevolen):**
1. Ga naar [netlify.com](https://netlify.com) en maak een gratis account
2. Sleep het `index.html` bestand naar het Netlify drop zone
3. Je krijgt een publieke URL (bijv. `https://jouw-toernooi.netlify.app`)
4. Deel die link met alle deelnemers

**Optie C — GitHub Pages:**
Als je GitHub kent, kun je het bestand in een repository zetten en GitHub Pages inschakelen.

---

## Niveaus & posities

| Niveau | Betekenis |
|--------|-----------|
| 1 | Beginner |
| 2 | Onder gemiddeld |
| 3 | Gemiddeld |
| 4 | Boven gemiddeld |
| 5 | Gevorderd |

| Positie | Label |
|---------|-------|
| GK | Keeper |
| DEF | Verdediger |
| MID | Middenvelder |
| FWD | Aanvaller |

---

## Tips

- Voeg alle spelers in vóórdat je teams genereert
- Teams aanpassen? Gebruik de "Preview genereren" knop meerdere keren en kies de mooiste indeling
- Schema wijzigen? Genereer het schema opnieuw — dit overschrijft het oude schema
- De app werkt op mobiel, ideaal om aan de zijlijn te gebruiken
