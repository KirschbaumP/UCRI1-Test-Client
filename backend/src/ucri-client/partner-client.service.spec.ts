import type { AppConfig } from '../config/app-config.js';
import { EventsService } from '../state/events.service.js';
import { IncidentStoreService } from '../state/incident-store.service.js';
import { TrafficLogService } from '../state/traffic-log.service.js';
import { PartnerClientService } from './partner-client.service.js';

const config = {
  ucriVersion: '1.1',
  requestTimeoutMs: 1000,
  strictRequiredAppendices: false,
  partners: [
    {
      id: 'p',
      name: 'Partner',
      baseUrl: 'https://partner.example/api/',
      clientId: 'id',
      clientSecret: 'secret',
    },
  ],
} as unknown as AppConfig;

function json(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('PartnerClientService', () => {
  let client: PartnerClientService;
  let traffic: TrafficLogService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const events = new EventsService();
    traffic = new TrafficLogService(events);
    client = new PartnerClientService(config, traffic, new IncidentStoreService(events));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('authorisiert mit Base64-kodiertem Secret und ClientId (5.2)', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { access_token: 't1', expires_in: 3600, token_type: 'Bearer' }));
    const r = await client.authorize('p');

    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://partner.example/api/authorize');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('secret').toString('base64')}`);
    expect(headers.ClientId).toBe(Buffer.from('id').toString('base64'));
    expect(client.tokenStatus('p').hasToken).toBe(true);
    // Secrets erscheinen nicht im Traffic-Log
    expect(JSON.stringify(traffic.list())).not.toContain(Buffer.from('secret').toString('base64'));
  });

  it('holt bei 401 ein neues Token und wiederholt den Request einmal (3.3)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 't1', expires_in: 3600, token_type: 'Bearer' }))
      .mockResolvedValueOnce(json(401, { message: 'expired' }))
      .mockResolvedValueOnce(json(200, { access_token: 't2', expires_in: 3600, token_type: 'Bearer' }))
      .mockResolvedValueOnce(json(200, { version: { ucriVersion: '1.1' }, links: [] }));

    const r = await client.home('p');

    expect(r.ok).toBe(true);
    expect(r.traffic).toHaveLength(4);
    const auths = fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers.Authorization);
    expect(auths[1]).toBe('Bearer t1');
    expect(auths[3]).toBe('Bearer t2');
  });

  it('verwendet den gecachten Token weiter, solange er gültig ist', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 't1', expires_in: 3600 }))
      .mockResolvedValue(json(200, []));
    await client.classifications('p', false);
    await client.resourceTypes('p', false);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/authorize'))).toHaveLength(1);
  });

  it('interpretiert expires_in als Unix-Timestamp, wenn der Wert groß ist', async () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    fetchMock.mockResolvedValueOnce(json(200, { access_token: 't', expires_in: exp }));
    const r = await client.authorize('p');
    expect(Date.parse(client.tokenStatus('p').expiresAt!)).toBe(exp * 1000);
    expect(r.traffic[0].issues?.[0].message).toContain('Unix-Timestamp');
  });

  it('sendet If-None-Match und liefert bei 304 die gecachten Daten (2.4.2)', async () => {
    const data = [{ abbreviation: 'B1', description: 'kleiner Brand' }];
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 't', expires_in: 3600 }))
      .mockResolvedValueOnce(json(200, data, { etag: '"abc"' }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    await client.classifications('p');
    const second = await client.classifications('p');

    const headers = (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<string, string>;
    expect(headers['If-None-Match']).toBe('"abc"');
    expect(headers['Cache-Control']).toBe('max-age=0');
    expect(second.ok).toBe(true);
    expect(second.status).toBe(304);
    expect(second.body).toEqual(data);
  });

  it('sendet ungültige Einsätze nur mit force', async () => {
    const blocked = await client.sendIncident('p', { id: '1' } as never);
    expect(blocked.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 't', expires_in: 3600 }))
      .mockResolvedValueOnce(json(400, { message: 'Incident is invalid' }));
    const forced = await client.sendIncident('p', { id: '1' } as never, true);
    expect(forced.status).toBe(400);
  });

  it('meldet Verbindungsfehler ohne Exception', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: new Error('ECONNREFUSED') }));
    const r = await client.authorize('p');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ECONNREFUSED');
  });
});
