<div align="center">

# 🚨 UCRI 1.x Test-Client

**Testwerkzeug für die _Universal Control Room Interface_ (UCRI): die Schnittstelle Leitstelle ↔ Leitstelle**

Einsätze senden, empfangen, quittieren und den kompletten Datenverkehr mitlesen, mit UCRI **1.0** und **1.1**.

[![Docker Image](https://github.com/KirschbaumP/UCRI1-Test-Client/actions/workflows/docker.yml/badge.svg)](https://github.com/KirschbaumP/UCRI1-Test-Client/actions/workflows/docker.yml)
[![ghcr.io](https://img.shields.io/badge/ghcr.io-ucri1--test--client-2496ED?logo=docker&logoColor=white)](https://github.com/KirschbaumP/UCRI1-Test-Client/pkgs/container/ucri1-test-client)
[![UCRI](https://img.shields.io/badge/UCRI-1.0%20%7C%201.1-orange)](specs)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

[Quickstart](#-quickstart) · [Funktionen](#-funktionen) · [Konfiguration](#%EF%B8%8F-konfiguration) · [Entwicklung](#%EF%B8%8F-entwicklung)

</div>

---

## ✨ Überblick

Der Test-Client spielt eine vollständige Leitstelle: Er stellt eine **eigene, spec-konforme UCRI-Schnittstelle** bereit und spricht gleichzeitig als **Client** mit beliebigen Partner-Leitstellen. Alles läuft in einer Anwendung, einem Prozess und auf einem Port:

| Pfad      | Inhalt                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------ |
| `/`       | Web-Oberfläche (Angular + ng-zorro)                                                              |
| `/api`    | eigene UCRI-Schnittstelle (Empfangs-Server): Einsätze, Nachrichten, Quittierungen                |
| `/ui-api` | interne API für das Frontend inkl. ausgehendem UCRI-Client zu den Partnern                       |

Die Spezifikationen V1.0 und V1.1 liegen im Ordner [`specs/`](specs).

## 🚀 Quickstart

Du brauchst nur Docker. Das fertige Image wird automatisch gebaut und in der GitHub Container Registry veröffentlicht.

### 1. Eine Leitstelle starten

```bash
docker run --rm -p 3000:3000 ghcr.io/kirschbaump/ucri1-test-client:latest
```

Öffne **<http://localhost:3000>**. Fertig.

Der vorkonfigurierte Partner **`self`** zeigt auf die eigene Schnittstelle (Loopback). Damit kannst du den kompletten Ablauf ohne Gegenstelle durchspielen:

1. **Verbindung**: Partner `self` wählen, *Authorize* und *Home* ausführen
2. **Einsatz senden**: Spec-Beispiel laden und abschicken
3. **Einsätze**: den empfangenen Einsatz quittieren und Einsatzmittelanforderungen beantworten
4. **Traffic-Log**: alle Requests und Responses im Detail ansehen

Mit UCRI 1.0 statt 1.1:

```bash
docker run --rm -p 3000:3000 -e UCRI_VERSION=1.0 ghcr.io/kirschbaump/ucri1-test-client:latest
```

### 2. Zwei Leitstellen, die miteinander sprechen

Mit Docker Compose laufen Leitstelle A und B nebeneinander und kennen sich gegenseitig als Partner:

```bash
git clone https://github.com/KirschbaumP/UCRI1-Test-Client.git
cd UCRI1-Test-Client
docker compose up
```

| Leitstelle | Frontend                  | Adresse für den Partner (im Compose-Netz) | Konfiguration                     |
| ---------- | ------------------------- | ----------------------------------------- | --------------------------------- |
| A          | <http://localhost:3001>   | `http://leitstelle-a:3000/api`            | `config/leitstelle-a.config.json` |
| B          | <http://localhost:3002>   | `http://leitstelle-b:3000/api`            | `config/leitstelle-b.config.json` |

Jede Leitstelle hat zusätzlich den Loopback-Partner `self`. Mit `docker compose pull` holst du das neueste Image. Wer das Image lieber lokal aus dem Quellcode baut, nimmt `docker compose up --build`.

### 3. Mit eigener Konfiguration gegen echte Partner

```bash
docker run --rm -p 3000:3000 \
  -e PUBLIC_BASE_URL=http://mein-host:3000/api \
  -e JWT_SECRET=ein-langes-geheimnis \
  -v "$PWD/my-config.json:/app/config/ucri.config.json:ro" \
  ghcr.io/kirschbaump/ucri1-test-client:latest
```

Als Vorlage dient [`config/ucri.config.json`](config/ucri.config.json), siehe [Konfiguration](#%EF%B8%8F-konfiguration).

> [!TIP]
> - `PUBLIC_BASE_URL` ist die Adresse, unter der Partner die eigene `/api` erreichen.
> - Partner auf dem Docker-Host erreichst du aus dem Container über `http://host.docker.internal:<port>/api`.
> - Der Loopback-Partner `self` zeigt auf `http://localhost:3000/api` im Container. Wenn du `PORT` änderst, musst du die Partner-Konfiguration anpassen.

### Image-Tags

| Tag                       | Inhalt                                    |
| ------------------------- | ----------------------------------------- |
| `latest`                  | letztes Release (Git-Tag)                 |
| `v1.2.3`, `1.2.3`, `1.2`  | ein bestimmtes Release                    |
| `main`                    | aktueller Stand des `main`-Branches       |
| `sha-<commit>`            | ein bestimmter Commit auf `main`          |

Die Images werden für `linux/amd64` und `linux/arm64` gebaut (also auch für Apple Silicon), laufen ohne Root-Rechte und haben einen Healthcheck. Pull Requests werden nur gebaut, nicht veröffentlicht ([Workflow](.github/workflows/docker.yml)).

## 🧰 Funktionen

| Bereich                         | Was du damit machen kannst                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Verbindung**                  | Authorize (5.2), Token-Status mit Ablauf, Home (5.1) mit Versionsabgleich                                                        |
| **Einsatz senden** (5.3)        | Formular- und JSON-Editor für das Incident-DTO, versionsabhängiger Appendix-Editor, Live-Validierung, Spec-Beispiele, „trotzdem senden“ für Negativtests |
| **Einsätze & Quittierungen**    | gesendete und empfangene Einsätze live (SSE), retrieved/confirm quittieren (5.5), Einsatzmittelanforderungen beantworten mit accept, reject, acceptTemporary oder confirmTurnOut (5.6) |
| **Nachrichten** (5.4)           | Nachrichten zu Einsätzen senden und empfangen                                                                                    |
| **Stammdaten** (5.7/5.8)        | Klassifikationen und Einsatzmitteltypen mit ETag/If-None-Match                                                                   |
| **Traffic-Log**                 | alle ein- und ausgehenden Requests mit Headern (Secrets maskiert), Bodies und Hinweisen, Export als JSON                         |
| **Freier Request**              | beliebige Requests, ohne oder mit ungültigem Token, mit Vorlagen für Negativtests                                                |

<details>
<summary><b>Toleranzen gegenüber Unschärfen der Spezifikation</b></summary>

Diese Abweichungen werden akzeptiert und als Warnung protokolliert:

- Zeitstempel wie in den Beispielen zusätzlich in Anführungszeichen
- Pfade `acknowlegements` und `resourceRequest`
- Basic-Auth als `base64(id:secret)`
- `expires_in` als Dauer oder als Unix-Timestamp

</details>

## 🔀 UCRI-Version wählen

Die Version wird **beim Start** festgelegt, entweder in der Konfiguration (`"ucriVersion": "1.0" | "1.1"`) oder per Umgebungsvariable `UCRI_VERSION`.

Die Version wirkt sich aus auf:

- `ucriVersion` im Home-DTO der eigenen Schnittstelle,
- den Appendix-Katalog (Vorschläge im Editor, Seite „Appendix-Katalog“),
- die Validierung gesendeter und empfangener Daten (Appendices aus 1.1 erzeugen unter 1.0 eine Warnung),
- die Confirmation-Appendices (4.2.4.5), die es erst ab 1.1 gibt.

Endpunkte und DTOs sind in 1.0 und 1.1 identisch.

## ⚙️ Konfiguration

### Umgebungsvariablen

| Variable          | Bedeutung                                                        | Standard                       |
| ----------------- | ---------------------------------------------------------------- | ------------------------------ |
| `UCRI_VERSION`    | `1.0` oder `1.1`                                                 | aus der Konfiguration (`1.1`)  |
| `PORT`            | HTTP-Port                                                        | `3000`                         |
| `PUBLIC_BASE_URL` | öffentliche Base-Url der eigenen `/api`                          | `http://localhost:3000/api`    |
| `JWT_SECRET`      | Signatur-Secret der ausgestellten Tokens                         | `bitte-aendern`                |
| `CONFIG_PATH`     | Pfad zu einer anderen Konfigurationsdatei                        | `config/ucri.config.json`      |

> [!WARNING]
> Setze `JWT_SECRET` immer, sobald die Instanz von anderen erreichbar ist.

### Konfigurationsdatei (`config/ucri.config.json`)

| Schlüssel                          | Bedeutung                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `ucriVersion`                      | `1.0` oder `1.1`                                                                            |
| `port`                             | HTTP-Port (ENV `PORT`)                                                                      |
| `ownControlCenterId/Name`          | eigene Leitstellenkennung (sender)                                                          |
| `publicBaseUrl`                    | öffentliche Base-Url der eigenen `/api` (für Links), ENV `PUBLIC_BASE_URL`                  |
| `jwtSecret`                        | Signatur-Secret der ausgestellten Tokens (ENV `JWT_SECRET`)                                 |
| `tokenLifetimeSec`                 | Gültigkeit ausgestellter Tokens                                                             |
| `tokenExpiresInFormat`             | `seconds` (wie im Spec-Beispiel) oder `unixTimestamp` (wie im Spec-Text)                    |
| `strictRequiredAppendices`         | fehlende Pflicht-Appendices als Fehler (400) statt Warnung                                  |
| `inboundClients`                   | Client-Id/Secret, mit denen sich Partner bei uns autorisieren dürfen                        |
| `partners`                         | Partner-Schnittstellen: `id`, `name`, `baseUrl` (inkl. `/api`), `clientId`, `clientSecret`, `controlCenterId` |
| `classifications`, `resourceTypes` | Stammdaten, die unsere Schnittstelle ausliefert (5.7/5.8)                                   |

Eine ungültige Konfiguration bricht den Start mit einer Fehlermeldung ab.

## 🛠️ Entwicklung

Voraussetzung: Node.js ≥ 20.19 (getestet mit 24.12).

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

| Befehl          | Zweck                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `npm run dev`   | Watch-Modus (Nest liefert weiterhin das Frontend aus)                       |
| `npm test`      | shared (Validierung), Backend Unit + e2e (inkl. Loopback), Frontend         |
| `UCRI_VERSION=1.0 npm start` | Start mit UCRI 1.0                                             |

Image lokal bauen:

```bash
docker build -t ucri-test-client .
docker run --rm -p 3000:3000 ucri-test-client
```

### Projektstruktur

```
shared/    DTO-Typen, Appendix-Katalog (Kap. 4.2.4), Validierung, Beispiel-Einsatz
backend/   NestJS: config/, ucri-server/ (eigene /api), ucri-client/ (Partner), ui-api/, state/
frontend/  Angular + ng-zorro
config/    ucri.config.json, leitstelle-{a,b}.config.json (Docker-Compose-Beispiel)
specs/     UCRI-Spezifikationen V1.0 und V1.1
```

## 📄 Lizenz

[GNU Affero General Public License v3.0](LICENSE)
