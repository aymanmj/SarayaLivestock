import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateFarmDto } from './dto/update-farm.dto';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async update(id: string, dto: UpdateFarmDto) {
    const farm = await this.prisma.farm.findUnique({ where: { id } });
    if (!farm) throw new NotFoundException('المزرعة غير موجودة');

    return this.prisma.farm.update({
      where: { id },
      data: dto,
    });
  }
}
