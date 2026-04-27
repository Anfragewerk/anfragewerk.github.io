# Handwerk-AnfrageWerk

KI-gestützte Anfrage- & Angebotsvorbereitung für Handwerksbetriebe

Moderne Landingpage auf GitHub Pages + echte Antwortgenerierung über einen kleinen Backend-Layer.

## Ziel dieser Version

- Landingpage auf der Main-Page
- `/beispiel/` als Live-Demo
- `/horst/` als Beispiel-Kundenportal
- echte Generierung über Cloudflare Worker + OpenAI
- Copy-to-Clipboard für Kundenantwort, Rückfragen und Angebotsbasis

## Architektur

- **Frontend:** GitHub Pages
- **Portal-Unterseiten:** `/beispiel/`, `/horst/`, später weitere Kunden
- **Backend:** Cloudflare Worker unter `/worker/`
- **Modellaufruf:** OpenAI Responses API mit strukturiertem JSON-Output

## Ordnerstruktur

- `/index.html` – Landingpage
- `/beispiel/` – Demo-Portal
- `/horst/` – Beispiel-Kundenportal
- `/assets/` – CSS/JS
- `/worker/` – Cloudflare Worker für Live-Generierung
- `/.github/workflows/pages.yml` – GitHub-Pages-Deployment

## Wichtige Dateien je Kundenordner

- `config.json` – Branding, Farben, Felder, `apiBaseUrl`
- `business-knowledge.json` – sichtbares, unkritisches Betriebswissen
- `cases.json` – Beispielanfragen für den Schnellstart
- `ui-text.json` – Texte für die Oberfläche

## Wichtig vor dem ersten Deploy

Diese Repo-Version nutzt **relative Pfade**. Dadurch läuft sie sauber als GitHub-Project-Page unter:

`https://<github-user>.github.io/<repo-name>/`

Du musst also nicht zuerst eine eigene Domain haben. Eine eigene Domain kann später sauber darübergelegt werden.

## Setup in sinnvoller Reihenfolge

### 1. GitHub vorbereiten

1. Neue neutrale E-Mail anlegen
2. GitHub-Account anlegen
3. Neues Repository erstellen, z. B. `anfragewerk-portal`
4. Repo-Inhalt hochladen
5. Unter **Settings → Pages** die Auslieferung über GitHub Actions aktivieren

### 2. Frontend-URL festlegen

Wenn dein GitHub-User z. B. `maxmustermann` heißt und das Repo `anfragewerk-portal`, dann ist deine Frontend-Basis:

`https://maxmustermann.github.io/anfragewerk-portal`

Diese URL brauchst du später auch im Worker.

### 3. Cloudflare Worker deployen

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npm run deploy
```

Danach erhältst du typischerweise eine Worker-URL in der Art:

`https://anfragewerk-api.<dein-subdomain>.workers.dev`

### 4. `worker/wrangler.toml` anpassen

Setze dort:

- `FRONTEND_BASE_URL = "https://<github-user>.github.io/<repo-name>"`
- `ALLOWED_ORIGINS = "https://<github-user>.github.io,https://app.deinedomain.de"`

Wenn du noch **keine eigene Domain** nutzt, reicht für den Start auch nur die GitHub-Origin:

```toml
ALLOWED_ORIGINS = "https://<github-user>.github.io"
```

### 5. Kunden-Config verbinden

In jeder `config.json` den Wert `apiBaseUrl` auf deine Worker-URL setzen, z. B.:

```json
"apiBaseUrl": "https://anfragewerk-api.<dein-subdomain>.workers.dev"
```

### 6. Testen

- Landingpage öffnen
- `/beispiel/` öffnen
- Beispiel laden
- Antwort erstellen klicken
- Copy-to-Clipboard testen
- `/horst/` öffnen und denselben Ablauf prüfen

## Neue Kunden anlegen

1. Einen bestehenden Kundenordner kopieren, z. B. `horst/`
2. Ordnernamen ändern, z. B. `mueller-elektro/`
3. Diese 4 Dateien anpassen:
   - `config.json`
   - `business-knowledge.json`
   - `cases.json`
   - `ui-text.json`
4. pushen

Danach ist die neue Kunden-Unterseite direkt live.

## Was öffentlich bleiben darf

- Branding
- Leistungen
- unkritische Regeln
- Demo-Fälle
- sichtbare Portaltexte

## Was **nicht** in GitHub Pages gehört

- sensible Kundendaten
- Preislogiken
- Sonderkonditionen
- interne Schwächen
- API-Keys
- vertrauliche Prozessregeln

## Nächste sinnvolle Ausbaustufen

- eigene Domain aufschalten
- Contact/Lead-Formular anbinden
- private Wissensbasis ins Backend verschieben
- Login und Historie ergänzen
- kundenindividuelle Module je Gewerk
