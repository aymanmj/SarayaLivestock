import { BadRequestException } from '@nestjs/common';
import { buildIdempotencyContext } from './idempotency-context';

describe('Idempotency request context', () => {
  const key = '2f1d5b44-23cf-4f04-8cbe-885dc1cf26ab';

  function request(body: unknown, header?: string, url = '/api/v1/animals?ignored=true') {
    const actualHeader = arguments.length >= 2 ? header : key;
    return {
      get: jest.fn().mockReturnValue(actualHeader),
      method: 'post',
      originalUrl: url,
      body,
    } as any;
  }

  it('creates the same hash for semantically identical JSON bodies', () => {
    const first = buildIdempotencyContext(request({ tag: 'A-1', nested: { b: 2, a: 1 } }));
    const second = buildIdempotencyContext(request({ nested: { a: 1, b: 2 }, tag: 'A-1' }));

    expect(first).toEqual(expect.objectContaining({ key, method: 'POST', path: '/api/v1/animals' }));
    expect(first.requestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.requestHash).toBe(first.requestHash);
  });

  it('changes the hash when the endpoint or payload changes', () => {
    const first = buildIdempotencyContext(request({ tag: 'A-1' }));
    const changedBody = buildIdempotencyContext(request({ tag: 'A-2' }));
    const changedPath = buildIdempotencyContext(request({ tag: 'A-1' }, key, '/api/v1/animals/other'));

    expect(changedBody.requestHash).not.toBe(first.requestHash);
    expect(changedPath.requestHash).not.toBe(first.requestHash);
  });

  it.each([undefined, '', 'not-a-uuid', '2f1d5b44-23cf-1f04-8cbe-885dc1cf26ab'])(
    'rejects a missing or invalid UUID v4 key (%s)',
    header => {
      expect(() => buildIdempotencyContext(request({}, header as any))).toThrow(BadRequestException);
    },
  );
});
