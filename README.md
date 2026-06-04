# Cloak Detect

Narzędzie webowe do wykrywania cloakingu: odwiedza podany URL jako zwykła przeglądarka (Chrome) i jako Googlebot, a następnie pokazuje zrzuty ekranu obok siebie wraz z metadanymi (status HTTP, docelowy URL, tytuł).

## Wymagania (development)

- Node.js 20+
- Chromium dla Playwright

## Uruchomienie lokalne

```bash
npm install
npx playwright install chromium
npm run dev
```

Aplikacja: [http://localhost:3000](http://localhost:3000)

## Wymagania serwera (produkcja)

| Wymaganie | Uwagi |
|-----------|--------|
| **Linux x86_64** | Ubuntu 22.04/24.04, Debian itp. — Playwright + Chromium na produkcji działają najlepiej na Linuxie |
| **Node.js ≥ 20** | Zob. `engines` w `package.json` |
| **Chromium (Playwright)** | Bez headless Chrome analiza nie zadziała |
| **RAM: min. ~2 GB, zalecane 4 GB+** | Jeden proces Chromium + 2 konteksty na żądanie; przy równoległych skanach zużycie rośnie |
| **CPU: 2 vCPU+** | Render stron + dwie równoległe wizyty na skan |
| **Dysk: ~1–2 GB** | Obraz Docker Playwright ~1 GB + `node_modules` i cache przeglądarki |
| **Wyjście do internetu (HTTP/HTTPS)** | Serwer sam odwiedza podane adresy — outbound musi być dozwolony |
| **Port** | Domyślnie `3000`; ustaw przez zmienną `PORT` |

**Zalecane:** HTTPS (reverse proxy), firewall (wystawione tylko 80/443), restart procesu (systemd / Docker `restart`), ograniczenie dostępu (VPN, Basic Auth, allowlist IP) jeśli narzędzie jest publiczne.

**Nie nadaje się do:** shared hostingu bez Node/Chromium, bardzo małych VPS (512 MB RAM — ryzyko OOM), środowisk z zablokowanym ruchem wychodzącym.

## Deploy — Docker (zalecane)

Obraz [`Dockerfile`](Dockerfile) bazuje na `mcr.microsoft.com/playwright` — Chromium i zależności systemowe są już w obrazie.

```bash
docker build -t cloak-detect .
docker run -d \
  --name cloak-detect \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e NODE_ENV=production \
  cloak-detect
```

Na VPS binduj port tylko na localhost (`127.0.0.1:3000:3000`) i postaw TLS na reverse proxy (nginx, Caddy, Traefik).

Szybki test lokalny (bez `-d`):

```bash
docker run --rm -p 3000:3000 cloak-detect
```

## Deploy — VPS bez Dockera

```bash
# Ubuntu/Debian — przykład
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

cd /opt/cloak-detect
npm ci --omit=dev
npx playwright install chromium
sudo npx playwright install-deps chromium   # biblioteki systemowe (root)
npm run build

PORT=3000 NODE_ENV=production node dist/server.js
```

### systemd (szkic)

```ini
[Unit]
Description=Cloak Detect
After=network.target

[Service]
Type=simple
User=cloak
WorkingDirectory=/opt/cloak-detect
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name cloak.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        client_max_body_size 32k;
    }
}
```

Nagłówek `X-Forwarded-For` jest używany do limitu żądań per IP. Za reverse proxy warto włączyć `trust proxy` w Express (obecnie nie jest skonfigurowane).

## Produkcja (Node bez kontenera)

```bash
npm run build
npm start
```

Zmienne: `PORT` (domyślnie `3000`), `NODE_ENV=production`.

## Obciążenie i limity aplikacji

- Do **~45 s** na jedno żądanie `POST /api/analyze`
- **10 żądań/min/IP** — limit w pamięci procesu; reset po restarcie; przy wielu instancjach każda ma własny licznik
- **Jedna instancja Chromium** na proces — kolejne skany czekają w tym samym procesie

Przy większym ruchu publicznym rozważ kolejkę zadań, osobny worker i wspólny rate limit (np. Redis).

## Bezpieczeństwo aplikacji

- Dozwolone tylko `http` / `https`
- Blokada adresów prywatnych i localhost (w tym po rozwiązaniu DNS) — ochrona przed SSRF
- Limit 10 żądań na minutę na IP
- Timeout żądania: 45 s

### Publiczny deploy

Serwer **celowo** odwiedza dowolne publiczne URL-e z IP hosta. Guard blokuje sieć lokalną, ale nadal można skanować obce strony (obciążenie, reputacja IP). Nie wystawiaj narzędzia jako otwartego proxy bez HTTPS, limitów i — jeśli to narzędzie wewnętrzne — kontroli dostępu.

## Checklist deployu

1. VPS z **4 GB RAM**, Linux, Docker **lub** Node 20 + `playwright install-deps`
2. `docker build` / `npm run build` + `npm start` (lub kontener)
3. Reverse proxy + certyfikat TLS (HTTPS)
4. Opcjonalnie: auth / allowlist przed aplikacją
5. `curl https://twoja-domena/health` → `{"ok":true}`
6. Test w UI: `https://example.com`

## API

`POST /api/analyze`

```json
{ "url": "https://example.com" }
```

Odpowiedź: dwa obiekty `browser` i `googlebot` ze screenshotem (data URL), metadanymi oraz opcjonalnym `cloakingHint`.

## Testy

```bash
npm test
```
