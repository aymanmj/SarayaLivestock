import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(farmId: string, dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: {
        farmId_employeeCode: { farmId, employeeCode: dto.employeeCode },
      },
    });

    if (existing) {
      throw new ConflictException('الرقم الوظيفي موجود بالفعل في هذه المزرعة');
    }

    return this.prisma.employee.create({
      data: {
        ...dto,
        farmId,
        hireDate: new Date(dto.hireDate),
      },
    });
  }

  async findAll(farmId: string) {
    return this.prisma.employee.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(farmId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, farmId },
    });
    if (!employee) throw new NotFoundException('الموظف غير موجود');
    return employee;
  }

  async update(farmId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(farmId, id); // Ensure exists

    if (dto.employeeCode) {
      const existing = await this.prisma.employee.findUnique({
        where: {
          farmId_employeeCode: { farmId, employeeCode: dto.employeeCode },
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('الرقم الوظيفي مسجل لموظف آخر');
      }
    }

    return this.prisma.employee.update({
      where: { id },
      data: dto,
    });
  }

  async remove(farmId: string, id: string) {
    await this.findOne(farmId, id);
    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
