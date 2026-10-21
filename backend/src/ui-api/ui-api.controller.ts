import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import {
  type AcknowledgementCall,
  type AppConfigView,
  type CatalogView,
  getAppendixCatalog,
  type IncidentDto,
  type IncidentRecord,
  JSON_MEDIA_TYPE,
  type MessageDto,
  type RawRequest,
  type ResourceRequestActionCall,
  type TokenStatus,
  type TrafficDirection,
  type TrafficEntry,
} from '@ucri/shared';
import { map, Observable } from 'rxjs';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { EventsService } from '../state/events.service.js';
import { IncidentStoreService } from '../state/incident-store.service.js';
import { TrafficLogService } from '../state/traffic-log.service.js';
import { PartnerClientService } from '../ucri-client/partner-client.service.js';
import { APPLICATION_VERSION } from '../version.js';

interface Forceable {
  force?: boolean;
}

/** Interne API für das Angular-Frontend (nicht Teil der UCRI-Spezifikation). */
@Controller('ui-api')
export class UiApiController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly client: PartnerClientService,
    private readonly store: IncidentStoreService,
    private readonly traffic: TrafficLogService,
    private readonly events: EventsService,
  ) {}

  @Get('config')
  getConfig(): AppConfigView {
    const c = this.config;
    return {
      ucriVersion: c.ucriVersion,
      applicationName: c.applicationName,
      applicationVersion: APPLICATION_VERSION,
      ownControlCenterId: c.ownControlCenterId,
      ownControlCenterName: c.ownControlCenterName,
      publicBaseUrl: c.publicBaseUrl,
      strictRequiredAppendices: c.strictRequiredAppendices,
      tokenFieldNames: c.tokenFieldNames,
      partners: c.partners.map((p) => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        clientId: p.clientId,
        controlCenterId: p.controlCenterId ?? p.id,
        contentType: p.contentType ?? JSON_MEDIA_TYPE,
        basicAuthFormat: p.basicAuthFormat ?? 'secret',
      })),
    };
  }

  @Get('catalog')
  getCatalog(): CatalogView {
    return {
      ucriVersion: this.config.ucriVersion,
      appendices: getAppendixCatalog(this.config.ucriVersion),
    };
  }

  @Get('partners/:id/token')
  tokenStatus(@Param('id') id: string): TokenStatus {
    return this.client.tokenStatus(id);
  }

  @Delete('partners/:id/token')
  @HttpCode(204)
  clearToken(@Param('id') id: string): void {
    this.client.clearToken(id);
  }

  @Post('partners/:id/authorize')
  @HttpCode(200)
  authorize(@Param('id') id: string) {
    return this.client.authorize(id);
  }

  @Post('partners/:id/home')
  @HttpCode(200)
  home(@Param('id') id: string) {
    return this.client.home(id);
  }

  @Post('partners/:id/classifications')
  @HttpCode(200)
  classifications(@Param('id') id: string, @Query('etag') etag?: string) {
    return this.client.classifications(id, etag !== 'false');
  }

  @Post('partners/:id/resourceTypes')
  @HttpCode(200)
  resourceTypes(@Param('id') id: string, @Query('etag') etag?: string) {
    return this.client.resourceTypes(id, etag !== 'false');
  }

  @Post('partners/:id/incidents')
  @HttpCode(200)
  sendIncident(
    @Param('id') id: string,
    @Body() body: { incident: IncidentDto } & Forceable,
  ) {
    return this.client.sendIncident(id, body.incident, body.force);
  }

  @Post('partners/:id/messages')
  @HttpCode(200)
  sendMessage(
    @Param('id') id: string,
    @Body()
    body: { message: MessageDto; direction?: TrafficDirection } & Forceable,
  ) {
    return this.client.sendMessage(
      id,
      body.message,
      body.force,
      body.direction,
    );
  }

  @Post('partners/:id/acknowledgements')
  @HttpCode(200)
  sendAcknowledgement(
    @Param('id') id: string,
    @Body() body: AcknowledgementCall & Forceable,
  ) {
    return this.client.sendAcknowledgement(id, body, body.force);
  }

  @Post('partners/:id/resource-requests')
  @HttpCode(200)
  sendResourceRequestAction(
    @Param('id') id: string,
    @Body() body: ResourceRequestActionCall & Forceable,
  ) {
    return this.client.sendResourceRequestAction(id, body, body.force);
  }

  @Post('partners/:id/raw')
  @HttpCode(200)
  raw(@Param('id') id: string, @Body() body: RawRequest) {
    return this.client.raw(id, body);
  }

  @Get('incidents')
  incidents(): IncidentRecord[] {
    return this.store.list();
  }

  @Delete('incidents')
  @HttpCode(204)
  clearIncidents(): void {
    this.store.clear();
  }

  @Get('traffic')
  trafficLog(): TrafficEntry[] {
    return this.traffic.list();
  }

  @Delete('traffic')
  @HttpCode(204)
  clearTraffic(): void {
    this.traffic.clear();
  }

  @Sse('events')
  stream(): Observable<MessageEvent> {
    return this.events.events$.pipe(map((event) => ({ data: event })));
  }
}
