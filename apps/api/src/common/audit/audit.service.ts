import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';

export interface AppendAuditEvent {
  orgId: string;
  farmId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  httpMethod: string;
  path: string;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  append(event: AppendAuditEvent) {
    return this.prisma.auditEvent.create({
      data: {
        orgId: event.orgId,
        farmId: event.farmId,
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        httpMethod: event.httpMethod,
        path: event.path,
        statusCode: event.statusCode,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
      },
    });
  }

  async list(orgId: string, query: AuditEventsQueryDto) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('بداية نطاق التدقيق يجب ألا تتجاوز نهايته');
    }

    const where: Prisma.AuditEventWhereInput = {
      orgId,
      farmId: query.farmId,
      entityType: query.entityType,
      createdAt: query.from || query.to ? {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      } : undefined,
    };

    if (query.cursor) {
      const ownedCursor = await this.prisma.auditEvent.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      if (!ownedCursor) throw new NotFoundException('مؤشر صفحة سجل التدقيق غير موجود');
    }

    const limit = query.limit ?? 50;
    const events = await this.prisma.auditEvent.findMany({
      where,
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const hasMore = events.length > limit;
    const items = hasMore ? events.slice(0, limit) : events;

    return {
      items,
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  }
}
