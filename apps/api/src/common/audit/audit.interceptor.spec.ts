import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

describe('AuditInterceptor', () => {
  it('records mutation metadata without persisting request bodies', async () => {
    const append = jest.fn().mockResolvedValue({ id: 'audit-a' });
    const interceptor = new AuditInterceptor({ append } as any, {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any);
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/animals?debug=true',
      ip: '127.0.0.1',
      params: {},
      body: { password: 'must-not-be-audited' },
      get: jest.fn().mockReturnValue('test-agent'),
      user: { id: 'user-a', orgId: 'org-a', farmId: 'farm-a' },
    };
    const context = {
      getType: () => 'http',
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: 'animal-a' }) } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toEqual({ id: 'animal-a' });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'POST /api/v1/animals',
      entityType: 'animals',
      entityId: 'animal-a',
      metadata: { responseEntityId: 'animal-a' },
    }));
    expect(JSON.stringify(append.mock.calls[0][0])).not.toContain('must-not-be-audited');
  });

  it('does not audit read-only requests', async () => {
    const append = jest.fn();
    const interceptor = new AuditInterceptor({ append } as any, {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any);
    const context = {
      getType: () => 'http',
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', user: { id: 'user-a' } }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of([]) } as CallHandler));
    expect(append).not.toHaveBeenCalled();
  });

  it('skips the best-effort HTTP event when the domain transaction owns the audit', async () => {
    const append = jest.fn();
    const interceptor = new AuditInterceptor({ append } as any, {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as any);
    const context = {
      getType: () => 'http',
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', user: { id: 'user-a' } }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: 'entity-a' }) } as CallHandler));
    expect(append).not.toHaveBeenCalled();
  });
});
