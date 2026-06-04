# Cloak Detect

Narzędzie webowe do wykrywania cloakingu: odwiedza podany URL jako zwykła przeglądarka (Chrome) i jako Googlebot, a następnie pokazuje zrzuty ekranu obok siebie wraz z metadanymi (status HTTP, docelowy URL, tytuł).

## Wymagania

- Node.js 20+
- Chromium dla Playwright

## Uruchomienie lokalne

```bash
npm install
npx playwright install chromium
npm run dev
```

Aplikacja: [http://localhost:3000](http://localhost:3000)

## Produkcja

```bash
npm run build
npm start
```

Zmienna `PORT` (domyślnie `3000`).

## Docker

```bash
docker build -t cloak-detect .
docker run --rm -p 3000:3000 cloak-detect
```

## API

`POST /api/analyze`

```json
{ "url": "https://example.com" }
```

Odpowiedź: dwa obiekty `browser` i `googlebot` ze screenshotem (data URL), metadanymi oraz opcjonalnym `cloakingHint`.

## Bezpieczeństwo

- Dozwolone tylko `http` / `https`
- Blokada adresów prywatnych i localhost (w tym po rozwiązaniu DNS)
- Limit 10 żądań na minutę na IP
- Timeout żądania: 45 s

## Testy

```bash
npm test
```
