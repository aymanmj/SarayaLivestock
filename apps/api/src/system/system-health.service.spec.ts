import { ServiceUnavailableException } from '@nestjs/common';
import { SystemHealthService } from './system-health.service';

describe('SystemHealthService', () => {
  it('reports readiness only after the database schema check passes', async () => {
    const prisma = { assertRequiredSchema: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new SystemHealthService(prisma);
    await expect(service.readiness()).resolves.toEqual(expect.objectContaining({
      status: 'ready', database: 'connected', requiredMigration: '0005_operational_idempotency',
    }));
  });

  it('returns a sanitized service-unavailable response when readiness fails', async () => {
    const prisma = { assertRequiredSchema: jest.fn().mockRejectedValue(new Error('secret connection details')) } as any;
    const service = new SystemHealthService(prisma);
    await expect(service.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.readiness()).rejects.not.toThrow('secret connection details');
  });
});
