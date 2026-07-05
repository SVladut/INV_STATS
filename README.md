# Inventare App - GitHub Pages

Aplicație statică pentru evidența inventarelor, optimizată pentru mobil, cu dark theme, login local, calendar, statistici și istoric.

## Fișiere

```txt
inventare-github-pages/
├── index.html
├── style.css
├── script.js
├── cloudflare-worker.js
└── data/
    └── inventare.json
```

## Varianta simplă: GitHub Pages fără autopush

1. Urcă fișierele în repository.
2. Activează GitHub Pages din Settings > Pages.
3. Deschide site-ul.
4. Creează cont local din aplicație.
5. Datele se salvează local în browser.
6. Pentru backup folosește Setări > Exportă JSON.

Această variantă nu modifică automat fișierul `data/inventare.json` din repository, pentru că GitHub Pages este hosting static.

## Varianta cu autopush în GitHub

Pentru autopush ai nevoie de un proxy/serverless care ține token-ul GitHub ascuns. În proiect este inclus `cloudflare-worker.js`.

Pași generali:

1. Creează un Cloudflare Worker.
2. Copiază codul din `cloudflare-worker.js` în Worker.
3. Adaugă variabilele:
   - `GITHUB_TOKEN` ca Secret.
   - `GITHUB_OWNER`, de exemplu `vladut`.
   - `GITHUB_REPO`, de exemplu `inventare-app`.
   - `GITHUB_BRANCH`, de exemplu `main`.
   - `GITHUB_FILE_PATH`, de exemplu `data/inventare.json`.
   - `ALLOWED_ORIGIN`, de exemplu `https://user.github.io`.
4. Publică Worker-ul.
5. În `script.js`, setează:

```js
const CONFIG = {
  AUTOPUSH_URL: 'https://worker-ul-tau.workers.dev',
  STORAGE_KEY: 'inventare-app-db-v4',
  AUTH_KEY: 'inventare-app-auth-v4',
  SESSION_KEY: 'inventare-app-session-v4'
};
```

6. Urcă din nou fișierul `script.js` pe GitHub.
7. Când salvezi un inventar, aplicația trimite tot JSON-ul către Worker, iar Worker-ul actualizează `data/inventare.json` în repository.

## Structura JSON

```json
{
  "version": 4,
  "updatedAt": "2026-07-06T00:00:00.000Z",
  "users": {
    "vladut": {
      "username": "vladut",
      "createdAt": "2026-07-06T00:00:00.000Z",
      "inventare": []
    },
    "reci": {
      "username": "reci",
      "createdAt": "2026-07-06T00:00:00.000Z",
      "inventare": []
    }
  }
}
```

## Observație importantă de securitate

Dacă repository-ul este public, fișierul `data/inventare.json` este public. Login-ul din frontend ascunde datele în interfață, dar nu este securitate reală împotriva cuiva care deschide direct JSON-ul public.

Pentru date private reale, folosește repository privat și un Worker/API care returnează doar datele utilizatorului autentificat.
