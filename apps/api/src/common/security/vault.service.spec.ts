import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { VaultService } from './vault.service';

describe('Vault secret rotation', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalVaultToken = process.env.VAULT_TOKEN;

  beforeEach(() => {
    process.env.JWT_SECRET = 'j'.repeat(64);
    process.env.VAULT_TOKEN = 'test-vault-token';
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalVaultToken === undefined) delete process.env.VAULT_TOKEN;
    else process.env.VAULT_TOKEN = originalVaultToken;
  });

  it('rejects an in-memory-only rotation when durable Vault storage is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Vault unavailable'));
    const service = new VaultService();
    await service.onModuleInit();

    await expect(service.rotateSecret('JWT_SECRET')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.getSecret('JWT_SECRET')).resolves.toBe('j'.repeat(64));
  });

  it('activates a JWT secret only after Vault confirms the durable write', async () => {
    const service = new VaultService();
    (service as any).isVaultOnline = true;
    (service as any).initialization = Promise.resolve();
    (service as any).secretsCache.set('JWT_SECRET', {
      value: 'j'.repeat(64),
      version: 4,
      lastRotated: new Date('2026-08-28T00:00:00Z'),
      source: 'HASHICORP_VAULT',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { version: 5 } }),
    } as Response);

    const metadata = await service.rotateSecret('JWT_SECRET');
    const rotated = await service.getSecret('JWT_SECRET');

    expect(rotated).not.toBe('j'.repeat(64));
    expect(rotated).toHaveLength(64);
    expect(metadata).toEqual(expect.objectContaining({
      keyName: 'JWT_SECRET',
      version: 5,
      source: 'HASHICORP_VAULT',
      rotationAvailable: true,
    }));
  });

  it('keeps the active JWT secret unchanged when Vault rejects the write', async () => {
    const service = new VaultService();
    (service as any).isVaultOnline = true;
    (service as any).initialization = Promise.resolve();
    (service as any).secretsCache.set('JWT_SECRET', {
      value: 'j'.repeat(64),
      version: 4,
      lastRotated: new Date('2026-08-28T00:00:00Z'),
      source: 'HASHICORP_VAULT',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(service.rotateSecret('JWT_SECRET')).rejects.toBeInstanceOf(BadGatewayException);
    await expect(service.getSecret('JWT_SECRET')).resolves.toBe('j'.repeat(64));
  });
});
