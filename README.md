# UCRI 1.x Test-Client

Testwerkzeug für die **Universal Control Room Interface (UCRI)** Schnittstelle Leitstelle–Leitstelle
(Spezifikationen V1.0 und V1.1 im Ordner [`specs/`](specs)).

Eine Anwendung, ein Prozess, ein Port:

| Pfad      | Inhalt                                                                                   |
| --------- | ---------------------------------------------------------------------------------------- |
| `/`       | Angular-Frontend (ng-zorro)                                                              |
| `/api`    | eigene, spec-konforme UCRI-Schnittstelle (Empfangs-Server): Einsätze, Nachrichten, Quittierungen |
| `/ui-api` | interne API für das Frontend inkl. ausgehendem UCRI-Client zu den Partnern                |

## Schnellstart

Voraussetzung: Node.js ≥ 20.19 (getestet mit 24.12).

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

Entwicklung mit Watch-Modus (Nest liefert weiterhin das Frontend aus): `npm run dev`.

## Docker

Das Image enthält die gebündelte Anwendung: das Angular-Frontend, die UCRI-API und die UI-API, gestartet als ein Node-Prozess, der ohne Root-Rechte läuft und einen Healthcheck hat.

```bash
docker build -t ucri-test-client .
docker run -p 3000:3000 -e UCRI_VERSION=1.1 ucri-test-client
# oder
docker compose up --build
```

Umgebungsvariablen: `UCRI_VERSION`, `PORT`, `PUBLIC_BASE_URL`, `JWT_SECRET`, `CONFIG_PATH`.
Für eigene Partner und Credentials mountest du eine Konfiguration:

```bash
docker run -p 3000:3000 -v "$PWD/my-config.json:/app/config/ucri.config.json:ro" ucri-test-client
```

Hinweise:

- `PUBLIC_BASE_URL` sollte die Adresse sein, unter der Partner die eigene `/api` erreichen.
- Der Loopback-Partner `self` zeigt auf `http://localhost:3000/api` im Container. Wenn du `PORT` änderst, muss die Partner-Konfiguration angepasst werden.
- Partner auf dem Docker-Host erreichst du aus dem Container über `http://host.docker.internal:<port>/api`.

## UCRI-Version wählen

Die Version wird **beim Start** festgelegt, entweder in `config/ucri.config.json` (`"ucriVersion": "1.0" | "1.1"`)
oder per Umgebungsvariable:

```bash
UCRI_VERSION=1.0 npm start
```

Die Version wirkt sich aus auf:

- `ucriVersion` im Home-DTO der eigenen Schnittstelle,
- den Appendix-Katalog (Vorschläge im Editor, Seite „Appendix-Katalog“),
- die Validierung gesendeter und empfangener Daten (Appendices aus 1.1 erzeugen unter 1.0 eine Warnung),
- die Confirmation-Appendices (4.2.4.5), die es erst ab 1.1 gibt.

Endpunkte und DTOs sind in 1.0 und 1.1 identisch.

## Konfiguration (`config/ucri.config.json`)

| Schlüssel                  | Bedeutung                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `ucriVersion`              | `1.0` oder `1.1`                                                                            |
| `port`                     | HTTP-Port (ENV `PORT`)                                                                      |
| `ownControlCenterId/Name`  | eigene Leitstellenkennung (sender)                                                          |
| `publicBaseUrl`            | öffentliche Base-Url der eigenen `/api` (für Links), ENV `PUBLIC_BASE_URL`                  |
| `jwtSecret`                | Signatur-Secret der ausgestellten Tokens (ENV `JWT_SECRET`)                                 |
| `tokenLifetimeSec`         | Gültigkeit ausgestellter Tokens                                                             |
| `tokenExpiresInFormat`     | `seconds` (wie im Spec-Beispiel) oder `unixTimestamp` (wie im Spec-Text)                    |
| `strictRequiredAppendices` | fehlende Pflicht-Appendices als Fehler (400) statt Warnung                                  |
| `inboundClients`           | Client-Id/Secret, mit denen sich Partner bei uns autorisieren dürfen                        |
| `partners`                 | Partner-Schnittstellen: `id`, `name`, `baseUrl` (inkl. `/api`), `clientId`, `clientSecret`, `controlCenterId` |
| `classifications`, `resourceTypes` | Stammdaten, die unsere Schnittstelle ausliefert (5.7/5.8)                         |

Eine andere Datei lässt sich mit `CONFIG_PATH=/pfad/config.json` laden. Eine ungültige Konfiguration bricht den Start mit einer Fehlermeldung ab.

Der vorkonfigurierte Partner `self` zeigt auf die eigene Schnittstelle (Loopback). So lässt sich der komplette Ablauf ohne Gegenstelle durchspielen.

## Funktionen

- **Verbindung**: Authorize (5.2), Token-Status mit Ablauf, Home (5.1) mit Versionsabgleich
- **Einsatz senden** (5.3): Formular- und JSON-Editor für das Incident-DTO, versionsabhängiger Appendix-Editor, Live-Validierung, Spec-Beispiele, „trotzdem senden“ für Negativtests
- **Einsätze & Quittierungen**: gesendete und empfangene Einsätze live (SSE). Für empfangene Einsätze: retrieved/confirm quittieren (5.5) und Einsatzmittelanforderungen beantworten mit accept, reject, acceptTemporary oder confirmTurnOut (5.6)
- **Nachrichten** (5.4)
- **Stammdaten** (5.7/5.8) mit ETag/If-None-Match
- **Traffic-Log**: alle ein- und ausgehenden Requests mit Headern (Secrets maskiert), Bodies und Hinweisen; Export als JSON
- **Freier Request**: beliebige Requests, ohne oder mit ungültigem Token, mit Vorlagen für Negativtests

Toleranzen gegenüber Unschärfen der Spezifikation (werden als Warnung protokolliert):

- Zeitstempel wie in den Beispielen zusätzlich in Anführungszeichen
- Pfade `acknowlegements` und `resourceRequest`
- Basic-Auth als `base64(id:secret)`
- `expires_in` als Dauer oder als Unix-Timestamp

## Tests

```bash
npm test   # shared (Validierung), Backend Unit + e2e (inkl. Loopback), Frontend
```

## Struktur

```
shared/    DTO-Typen, Appendix-Katalog (Kap. 4.2.4), Validierung, Beispiel-Einsatz
backend/   NestJS: config/, ucri-server/ (eigene /api), ucri-client/ (Partner), ui-api/, state/
frontend/  Angular + ng-zorro
config/    ucri.config.json
```
