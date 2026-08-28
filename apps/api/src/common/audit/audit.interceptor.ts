import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, from, map, mergeMap, of } from 'rxjs';
import { AuthenticatedUser } from '../../modules/auth/authenticated-user';
import { AuditService } from './audit.service';
import { Reflector } from '@nestjs/core';
import { DOMAIN_AUDIT_KEY } from './domain-audit';

type AuditedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private readonly mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const response = http.getResponse<Response>();
    const user = request.user;
    const isDomainAudited = this.reflector.getAllAndOverride<boolean>(DOMAIN_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // لا نسجل أجسام الطلبات أو الاستعلامات كي لا تتسرب كلمات المرور أو البيانات الحساسة.
    if (!user || isDomainAudited || !this.mutatingMethods.has(request.method)) return next.handle();

    return next.handle().pipe(
      mergeMap(result => {
        const path = request.originalUrl.split('?')[0];
        const entityType = this.entityTypeFromPath(path);
        const responseEntityId = this.responseEntityId(result);

        return from(this.audit.append({
          orgId: user.orgId,
          farmId: user.farmId,
          actorUserId: user.id,
          action: `${request.method} ${path}`,
          entityType,
          entityId: responseEntityId ?? this.paramEntityId(request),
          httpMethod: request.method,
          path,
          statusCode: response.statusCode,
          ipAddress: request.ip,
          userAgent: request.get('user-agent'),
          metadata: responseEntityId ? { responseEntityId } : undefined,
        })).pipe(
          map(() => result),
          catchError(error => {
            this.logger.error(`تعذر إلحاق حدث التدقيق للمسار ${request.method} ${path}`, error?.stack);
            return of(result);
          }),
        );
      }),
    );
  }

  private entityTypeFromPath(path: string): string {
    const segments = path.split('/').filter(Boolean);
    const versionIndex = segments.findIndex(segment => /^v\d+$/.test(segment));
    return segments[versionIndex + 1] ?? segments.at(-1) ?? 'unknown';
  }

  private responseEntityId(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const id = (result as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }

  private paramEntityId(request: Request): string | undefined {
    const id = request.params?.id;
    return typeof id === 'string' ? id : undefined;
  }
}
