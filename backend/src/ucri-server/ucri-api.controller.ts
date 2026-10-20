import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type AcknowledgementType,
  type ClassificationDto,
  type ConfirmationDto,
  type HomeDto,
  type IncidentDto,
  type JwtDto,
  type Link,
  type MessageDto,
  RESOURCE_REQUEST_ACTIONS,
  type ResourceRequestAction,
  type ResourceRequestConfirmationDto,
  type ResourceTypeDto,
  validateConfirmation,
  validateIncident,
  validateMessage,
  validateResourceRequestConfirmation,
  type ValidationIssue,
  type ValidationResult,
} from '@ucri/shared';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { APPLICATION_VERSION } from '../version.js';
import { IncidentStoreService } from '../state/incident-store.service.js';
import { JwtBearerGuard } from './jwt-bearer.guard.js';
import { TokenService } from './token.service.js';
import {
  SIMPLEMEDIA_TYPE,
  type UcriRequest,
  wantsSimplemedia,
} from './ucri-request.js';

const ACK_TYPES: AcknowledgementType[] = ['retrieved', 'confirm'];

/**
 * Eigene UCRI-Schnittstelle (Kap. 5) – empfängt Einsätze, Nachrichten und Quittierungen der Partner.
 */
@Controller('api')
export class UcriApiController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly tokens: TokenService,
    private readonly store: IncidentStoreService,
  ) {}

  /** 5.2 Authorize */
  @Get('authorize')
  authorize(
    @Req() req: UcriRequest,
    @Headers('authorization') authorization?: string,
    @Headers('clientid') clientId?: string,
  ): JwtDto {
    const result = this.tokens.authorize(authorization, clientId);
    if (!result.ok)
      throw new HttpException({ message: result.message }, result.status);
    req.ucriClientId = result.client.clientId;
    if (result.notes.length)
      req.ucriIssues = result.notes.map((message) => ({
        severity: 'warning',
        path: 'headers',
        message,
      }));
    return result.token;
  }

  /** 5.1 Home */
  @Get('home')
  @UseGuards(JwtBearerGuard)
  home(): HomeDto {
    return {
      version: {
        ucriVersion: this.config.ucriVersion,
        version: APPLICATION_VERSION,
        applicationName: this.config.applicationName,
      },
      links: [
        this.tokens.apiLink('incidents', 'incidents/'),
        this.tokens.apiLink('classifications', 'classifications/'),
        this.tokens.apiLink('resourceTypes', 'resourceTypes/'),
      ],
    };
  }

  /** 5.7 Stichworte abfragen */
  @Get('classifications')
  @UseGuards(JwtBearerGuard)
  classifications(
    @Req() req: UcriRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.collection(
      req,
      res,
      this.config.classifications,
      'classifications/',
    );
  }

  /** 5.8 Einsatzmitteltypen abfragen */
  @Get('resourceTypes')
  @UseGuards(JwtBearerGuard)
  resourceTypes(
    @Req() req: UcriRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.collection(
      req,
      res,
      this.config.resourceTypes,
      'resourceTypes/',
    );
  }

  /** 5.3 Einsatzdaten entgegennehmen */
  @Post('incidents')
  @HttpCode(201)
  @UseGuards(JwtBearerGuard)
  receiveIncident(@Req() req: UcriRequest, @Body() body: IncidentDto): void {
    const result = this.check(
      req,
      validateIncident(body, this.config.ucriVersion, this.config),
      'Incident is invalid',
    );
    const partner = this.config.partners.find(
      (p) =>
        (p.controlCenterId ?? p.id) === body.sender ||
        p.clientId === req.ucriClientId,
    );
    this.store.upsert('inbound', body, {
      partnerId: partner?.id,
      fromClientId: req.ucriClientId,
      issues: result.issues,
    });
  }

  /** 5.4 Nachricht zum Einsatz */
  @Post('incidents/:sharedIncidentId/messages')
  @HttpCode(200)
  @UseGuards(JwtBearerGuard)
  receiveMessage(
    @Req() req: UcriRequest,
    @Param('sharedIncidentId') sharedIncidentId: string,
    @Body() body: MessageDto,
  ): void {
    this.check(req, validateMessage(body), 'Bad Request');
    // bevorzugt der von uns gesendete Einsatz – beim Loopback die "Gegenseite" des Chats
    const record = this.store.find(sharedIncidentId, 'outbound');
    if (!record) throw this.unknownIncident(sharedIncidentId);
    if (body.sharedIncidentId && body.sharedIncidentId !== sharedIncidentId) {
      this.addIssue(
        req,
        'warning',
        'sharedIncidentId',
        'sharedIncidentId im Body weicht von der URL ab',
      );
    }
    this.store.addMessage(record, {
      direction: 'inbound',
      at: new Date().toISOString(),
      peer: req.ucriClientId,
      body,
    });
  }

  /** 5.5 Quittierung Einsatzübergabe (retrieved | confirm) */
  @Put([
    'incidents/:sharedIncidentId/acknowledgements/:type',
    // Schreibweise aus den Links des Incident-DTO-Beispiels der Spezifikation
    'incidents/:sharedIncidentId/acknowlegements/:type',
  ])
  @HttpCode(200)
  @UseGuards(JwtBearerGuard)
  receiveAcknowledgement(
    @Req() req: UcriRequest,
    @Param('sharedIncidentId') sharedIncidentId: string,
    @Param('type') type: string,
    @Body() body: ConfirmationDto,
  ): void {
    if (!ACK_TYPES.includes(type as AcknowledgementType))
      throw new NotFoundException({ message: 'Not Found' });
    if (req.originalUrl.includes('/acknowlegements/')) {
      this.addIssue(
        req,
        'warning',
        'url',
        'Pfad "acknowlegements" (Tippfehler aus Spec-Beispiel) statt "acknowledgements" verwendet',
      );
    }
    this.check(
      req,
      validateConfirmation(body, this.config.ucriVersion),
      'The request was incomplete.',
    );
    const record = this.store.get('outbound', sharedIncidentId);
    if (!record) throw this.unknownIncident(sharedIncidentId);
    this.store.addConfirmation(record, {
      direction: 'inbound',
      type: type as AcknowledgementType,
      at: new Date().toISOString(),
      peer: req.ucriClientId,
      body,
      issues: req.ucriIssues ?? [],
    });
  }

  /** 5.6 Quittierung Einsatzmittelanforderung */
  @Post([
    'incidents/:sharedIncidentId/resourceRequests/:requestId/:action',
    // Schreibweise aus Kap. 5.6.4 der Spezifikation
    'incidents/:sharedIncidentId/resourceRequest/:requestId/:action',
  ])
  @HttpCode(202)
  @UseGuards(JwtBearerGuard)
  receiveResourceRequestConfirmation(
    @Req() req: UcriRequest,
    @Param('sharedIncidentId') sharedIncidentId: string,
    @Param('requestId') requestId: string,
    @Param('action') action: string,
    @Body() body: ResourceRequestConfirmationDto,
  ): void {
    if (!RESOURCE_REQUEST_ACTIONS.includes(action as ResourceRequestAction)) {
      throw new NotFoundException({ message: 'Not Found' });
    }
    this.check(
      req,
      validateResourceRequestConfirmation(
        body,
        action as ResourceRequestAction,
      ),
      'The request body is invalid or incomplete',
    );
    if (body.requestId && body.requestId !== requestId) {
      this.addIssue(
        req,
        'warning',
        'requestId',
        'requestId im Body weicht von der URL ab',
      );
    }
    const record = this.store.get('outbound', sharedIncidentId);
    if (!record) throw this.unknownIncident(sharedIncidentId);
    if (
      !record.incident.requestedResources?.some(
        (r) => r.requestId === requestId,
      )
    ) {
      this.addIssue(
        req,
        'warning',
        'requestId',
        `Einsatz enthält keine Einsatzmittelanforderung mit requestId "${requestId}"`,
      );
    }
    this.store.addResourceRequestConfirmation(record, {
      direction: 'inbound',
      requestId,
      action: action as ResourceRequestAction,
      at: new Date().toISOString(),
      peer: req.ucriClientId,
      body,
      issues: req.ucriIssues ?? [],
    });
  }

  private collection<T extends ClassificationDto | ResourceTypeDto>(
    req: UcriRequest,
    res: Response,
    items: T[],
    path: string,
  ) {
    if (!wantsSimplemedia(req)) return items;
    res.type(SIMPLEMEDIA_TYPE);
    const self = (href: string): Link[] => [
      { rel: 'self', href, label: null, name: null },
    ];
    const base = this.tokens.apiLink('self', path).href;
    return {
      itemcollection: items.map((item) => ({
        item,
        links: self(`${base}${encodeURIComponent(item.abbreviation)}/`),
      })),
      links: self(base),
    };
  }

  private check(
    req: UcriRequest,
    result: ValidationResult,
    message: string,
  ): ValidationResult {
    req.ucriIssues = [...(req.ucriIssues ?? []), ...result.issues];
    if (!result.valid)
      throw new BadRequestException({ message, issues: result.issues });
    return result;
  }

  private addIssue(
    req: UcriRequest,
    severity: ValidationIssue['severity'],
    path: string,
    message: string,
  ) {
    req.ucriIssues = [...(req.ucriIssues ?? []), { severity, path, message }];
  }

  private unknownIncident(sharedIncidentId: string) {
    return new NotFoundException({
      message: `Not Found – unbekannter Einsatz ${sharedIncidentId}`,
    });
  }
}
