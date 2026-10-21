import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createSampleIncident, itemsOf, nowUtc } from '@ucri/shared';
import { AppModule } from '../src/app.module.js';
import { type AppConfig } from '../src/config/app-config.js';
import { configureApp } from '../src/setup.js';
import { IncidentStoreService } from '../src/state/incident-store.service.js';
import { PartnerClientService } from '../src/ucri-client/partner-client.service.js';

const b64 = (s: string) => Buffer.from(s).toString('base64');

function testConfig(ucriVersion: '1.0' | '1.1'): AppConfig {
  return {
    port: 0,
    ucriVersion,
    applicationName: 'UCRI Test-Client',
    ownControlCenterId: 'els-test',
    ownControlCenterName: 'Test',
    publicBaseUrl: 'http://localhost/api',
    jwtSecret: 'test',
    tokenLifetimeSec: 3600,
    tokenExpiresInFormat: 'seconds',
    tokenFieldNames: 'both',
    strictRequiredAppendices: false,
    requestTimeoutMs: 5000,
    inboundClients: [{ clientId: 'els-test', clientSecret: 'geheim' }],
    // baseUrl wird nach dem Start auf den tatsächlichen Port gesetzt (Loopback)
    partners: [{ id: 'self', name: 'Loopback', baseUrl: '', clientId: 'els-test', clientSecret: 'geheim' }],
    classifications: [{ abbreviation: 'B1', description: 'kleiner Brand', classificationGroup: 'fw' }],
    resourceTypes: [{ abbreviation: 'RTW', description: 'Rettungswagen' }],
  };
}

async function startApp(ucriVersion: '1.0' | '1.1') {
  const config = testConfig(ucriVersion);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot({ config, serveFrontend: false })],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  config.partners[0].baseUrl = `http://127.0.0.1:${port}/api`;
  return { app, config };
}

async function token(server: App): Promise<string> {
  const res = await request(server)
    .get('/api/authorize')
    .set('Authorization', `Basic ${b64('geheim')}`)
    .set('ClientId', b64('els-test'))
    .expect(200);
  return res.body.accessToken as string;
}

describe('UCRI-Schnittstelle (e2e)', () => {
  let app: NestExpressApplication;
  let config: AppConfig;
  let server: App;

  beforeAll(async () => {
    ({ app, config } = await startApp('1.1'));
    server = app.getHttpServer();
  });

  afterAll(async () => app.close());

  describe('5.2 Authorize', () => {
    it('liefert ein JWT', async () => {
      const res = await request(server)
        .get('/api/authorize')
        .set('Authorization', `Basic ${b64('geheim')}`)
        .set('ClientId', b64('els-test'))
        .expect(200);
      // Standard "both": camelCase (Tabelle 4.5, OpenAPI) und snake_case (Beispiel)
      expect(res.body).toMatchObject({ expiresIn: 3600, tokenType: 'Bearer', expires_in: 3600, token_type: 'Bearer' });
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.access_token).toBe(res.body.accessToken);
    });

    it.each([
      ['camelCase', ['accessToken', 'expiresIn', 'tokenType']],
      ['snakeCase', ['access_token', 'expires_in', 'token_type']],
    ] as const)('liefert mit tokenFieldNames "%s" nur diese Feldnamen', async (naming, fields) => {
      config.tokenFieldNames = naming;
      try {
        const res = await request(server)
          .get('/api/authorize')
          .set('Authorization', `Basic ${b64('geheim')}`)
          .set('ClientId', b64('els-test'))
          .expect(200);
        expect(Object.keys(res.body).sort()).toEqual([...fields].sort());
      } finally {
        config.tokenFieldNames = 'both';
      }
    });

    it('akzeptiert Basic-Auth als base64(Client-Id:Secret)', () =>
      request(server)
        .get('/api/authorize')
        .set('Authorization', `Basic ${b64('els-test:geheim')}`)
        .set('ClientId', b64('els-test'))
        .expect(200));

    it('400 bei unvollständigem Request', () => request(server).get('/api/authorize').expect(400));

    it('401 bei falschem Secret', () =>
      request(server)
        .get('/api/authorize')
        .set('Authorization', `Basic ${b64('falsch')}`)
        .set('ClientId', b64('els-test'))
        .expect(401));
  });

  describe('Autorisierung', () => {
    it('401 + NotAuthorized-DTO ohne Token', async () => {
      const res = await request(server).get('/api/home').expect(401);
      expect(res.body.authorizeLink).toMatchObject({ rel: 'authorize' });
      expect(typeof res.body.message).toBe('string');
    });

    it('401 bei ungültigem Token', () =>
      request(server).get('/api/home').set('Authorization', 'Bearer kaputt').expect(401));
  });

  it('5.1 Home liefert die konfigurierte UCRI-Version', async () => {
    const res = await request(server)
      .get('/api/home')
      .set('Authorization', `Bearer ${await token(server)}`)
      .expect(200);
    expect(res.body.version.ucriVersion).toBe('1.1');
    expect(res.body.links.map((l: { rel: string }) => l.rel)).toEqual(['incidents', 'classifications', 'resourceTypes']);
  });

  it('5.7 Stichworte mit ETag / 304 und simplemedia+json', async () => {
    const t = await token(server);
    const first = await request(server).get('/api/classifications').set('Authorization', `Bearer ${t}`).expect(200);
    expect(first.body).toEqual([{ abbreviation: 'B1', description: 'kleiner Brand', classificationGroup: 'fw' }]);
    await request(server)
      .get('/api/classifications')
      .set('Authorization', `Bearer ${t}`)
      .set('If-None-Match', first.headers.etag)
      .expect(304);

    const sm = await request(server)
      .get('/api/resourceTypes')
      .set('Authorization', `Bearer ${t}`)
      .set('Accept', 'application/vnd.simplemedia+json')
      .expect(200);
    expect(sm.headers['content-type']).toContain('application/vnd.simplemedia+json');
    expect(sm.body.itemcollection[0].item).toEqual({ abbreviation: 'RTW', description: 'Rettungswagen' });
    expect(sm.body.links[0].rel).toBe('self');
  });

  it('5.3 lehnt ungültige Einsätze mit 400 ab', async () => {
    const res = await request(server)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${await token(server)}`)
      .send({ id: '1', sentByElsAt: '22.10.2018' })
      .expect(400);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it('Quittierung für unbekannten Einsatz → 404', async () => {
    await request(server)
      .put('/api/incidents/unbekannt/acknowledgements/confirm')
      .set('Authorization', `Bearer ${await token(server)}`)
      .send({ sharedIncidentId: 'unbekannt', status: 'Accepted', timestamp: nowUtc() })
      .expect(404);
  });

  it('Loopback: Einsatz senden, quittieren, Einsatzmittel quittieren, Nachricht', async () => {
    const client = app.get(PartnerClientService);
    const store = app.get(IncidentStoreService);
    const incident = createSampleIncident({ version: '1.1', sender: 'els-test', target: 'els-test', withResourceRequest: true });
    const sid = incident.sharedIncidentId;
    const requestId = incident.requestedResources![0].requestId;

    expect((await client.sendIncident('self', incident)).status).toBe(201);
    expect(store.get('inbound', sid)?.incident.id).toBe(incident.id);

    const ack = (type: 'retrieved' | 'confirm') =>
      client.sendAcknowledgement('self', {
        sharedIncidentId: sid,
        type,
        body: { sharedIncidentId: sid, status: 'Accepted', timestamp: nowUtc() },
      });
    expect((await ack('retrieved')).status).toBe(200);
    expect((await ack('confirm')).status).toBe(200);

    const rr = await client.sendResourceRequestAction('self', {
      sharedIncidentId: sid,
      requestId,
      action: 'accept',
      body: { requestId, timestamp: nowUtc(), resourceType: 'RTW', resourceName: 'RTW 1' },
    });
    expect(rr.status).toBe(202);

    const msg = await client.sendMessage('self', { sharedIncidentId: sid, message: 'Hallo' }, false, 'inbound');
    expect(msg.status).toBe(200);

    const outbound = store.get('outbound', sid)!;
    expect(outbound.confirmations.map((c) => c.type)).toEqual(['retrieved', 'confirm']);
    expect(outbound.resourceRequestConfirmations[0]).toMatchObject({ requestId, action: 'accept', direction: 'inbound' });
    expect(outbound.messages[0]).toMatchObject({ direction: 'inbound', body: { message: 'Hallo' } });

    const inbound = store.get('inbound', sid)!;
    expect(inbound.confirmations.map((c) => c.direction)).toEqual(['outbound', 'outbound']);
    expect(inbound.messages[0].direction).toBe('outbound');
  });

  it('Loopback mit simplemedia+json, base64(Client-Id:Secret) und JWT in camelCase', async () => {
    config.partners.push({
      ...config.partners[0],
      id: 'openapi',
      contentType: 'application/vnd.simplemedia+json',
      basicAuthFormat: 'clientIdAndSecret',
    });
    config.tokenFieldNames = 'camelCase';
    try {
      const client = app.get(PartnerClientService);
      const auth = await client.authorize('openapi');
      expect(auth.status).toBe(200);
      expect(auth.traffic[0].issues ?? []).toEqual([]);

      const types = await client.resourceTypes('openapi', false);
      expect(types.status).toBe(200);
      expect(itemsOf(types.body)).toEqual([{ abbreviation: 'RTW', description: 'Rettungswagen' }]);

      const incident = createSampleIncident({ version: '1.1', sender: 'els-test', target: 'els-test' });
      expect((await client.sendIncident('openapi', incident)).status).toBe(201);
    } finally {
      config.partners.pop();
      config.tokenFieldNames = 'both';
    }
  });

  it('akzeptiert die Pfad-Schreibweisen aus den Spec-Beispielen', async () => {
    const client = app.get(PartnerClientService);
    const incident = createSampleIncident({ version: '1.1', sender: 'els-test', target: 'els-test', withResourceRequest: true });
    await client.sendIncident('self', incident);
    const t = await token(server);
    const sid = incident.sharedIncidentId;
    const requestId = incident.requestedResources![0].requestId;
    await request(server)
      .put(`/api/incidents/${sid}/acknowlegements/retrieved`)
      .set('Authorization', `Bearer ${t}`)
      .send({ sharedIncidentId: sid, status: 'Accepted', timestamp: nowUtc() })
      .expect(200);
    await request(server)
      .post(`/api/incidents/${sid}/resourceRequest/${requestId}/reject`)
      .set('Authorization', `Bearer ${t}`)
      .set('Content-Type', 'application/vnd.simplemedia+json')
      .send(JSON.stringify({ requestId, timestamp: nowUtc(), reason: 'nicht verfügbar' }))
      .expect(202);
  });
});

describe('UCRI-Version 1.0 (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await startApp('1.0'));
  });

  afterAll(async () => app.close());

  it('Home meldet 1.0, Einsätze mit 1.1-Appendices werden angenommen, aber mit Warnung gespeichert', async () => {
    const server = app.getHttpServer();
    const t = await token(server);
    const home = await request(server).get('/api/home').set('Authorization', `Bearer ${t}`).expect(200);
    expect(home.body.version.ucriVersion).toBe('1.0');

    const incident = createSampleIncident({ version: '1.1', sender: 'els-x', target: 'els-test' });
    await request(server).post('/api/incidents').set('Authorization', `Bearer ${t}`).send(incident).expect(201);
    const record = app.get(IncidentStoreService).get('inbound', incident.sharedIncidentId)!;
    expect(record.issues.some((i) => i.message.includes('erst ab UCRI 1.1'))).toBe(true);
  });
});
