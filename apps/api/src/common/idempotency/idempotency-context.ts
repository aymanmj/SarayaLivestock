import { applyDecorators, BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { createHash } from 'crypto';
import { Request } from 'express';

export interface IdempotencyContext {
  key: string;
  requestHash: string;
  method: string;
  path: string;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function IdempotencyRequired() {
  return applyDecorators(ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 unique to this operational request and reused only for an identical retry',
    schema: { type: 'string', format: 'uuid' },
  }));
}

export const CurrentIdempotency = createParamDecorator(
  (_data: unknown, context: ExecutionContext): IdempotencyContext => {
    const request = context.switchToHttp().getRequest<Request>();
    return buildIdempotencyContext(request);
  },
);

export function buildIdempotencyContext(request: Request): IdempotencyContext {
  const rawKey = request.get('idempotency-key');
  if (!rawKey) throw new BadRequestException('ترويسة Idempotency-Key مطلوبة لهذه العملية');
  const key = rawKey.toLowerCase();
  if (!UUID_V4.test(key)) {
    throw new BadRequestException('ترويسة Idempotency-Key يجب أن تكون UUID v4 صالحاً');
  }

  const method = request.method.toUpperCase();
  const path = request.originalUrl.split('?')[0];
  const canonicalBody = canonicalJson(request.body ?? null);
  const requestHash = createHash('sha256')
    .update(`${method}\n${path}\n${canonicalBody}`)
    .digest('hex');

  return { key, requestHash, method, path };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}
