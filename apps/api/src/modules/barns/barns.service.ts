import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BarnsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(farmId: string) {
    return this.prisma.barn.findMany({
      where: { farmId },
      select: {
        id: true,
        name: true,
        sectorType: true,
        capacity: true,
        _count: { select: { animals: true } },
      },
      orderBy: [{ sectorType: 'asc' }, { name: 'asc' }],
    });
  }
}
