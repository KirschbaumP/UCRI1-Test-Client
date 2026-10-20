import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { UcriRequest } from './ucri-request.js';
import { TokenService } from './token.service.js';

/** Prüft das Bearer-Token (Kap. 2.4.1, 3.2) und antwortet sonst mit 401 + NotAuthorized-DTO. */
@Injectable()
export class JwtBearerGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<UcriRequest>();
    const header = req.headers.authorization;
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException(
        this.tokens.notAuthorized(
          "You are Unauthorized, check if your token is valid or if you didn't send one, follow the AuthorizeLink pls.",
        ),
      );
    }
    try {
      req.ucriClientId = this.tokens.verify(match[1]).sub;
      return true;
    } catch (e) {
      throw new UnauthorizedException(
        this.tokens.notAuthorized(
          `Client is not authorized yet, token is invalid or expired (${(e as Error).message}).`,
        ),
      );
    }
  }
}
