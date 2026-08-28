import { Prisma } from '@prisma/client';

export const DOMAIN_AUDIT_KEY = 'saraya:domain-audited';

export interface AuditActor {
  id: string;
  orgId: string;
  farmId?: string | null;
}

export interface DomainAuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  farmId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export function appendDomainAudit(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  event: DomainAuditEvent,
) {
  return tx.auditEvent.create({
    data: {
      orgId: actor.orgId,
      farmId: event.farmId ?? actor.farmId,
      actorUserId: actor.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      httpMethod: 'DOMAIN',
      path: event.action,
      statusCode: 200,
      metadata: event.metadata,
    },
  });
}
