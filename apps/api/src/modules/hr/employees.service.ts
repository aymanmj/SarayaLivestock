import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { AuditActor, appendDomainAudit } from '../../common/audit/domain-audit';
import { Money } from '../../common/utils/money.util';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(farmId: string, dto: CreateEmployeeDto, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.employee.findUnique({
        where: {
          farmId_employeeCode: { farmId, employeeCode: dto.employeeCode },
        },
      });

      if (existing) {
        throw new ConflictException('الرقم الوظيفي موجود بالفعل في هذه المزرعة');
      }

      const employee = await tx.employee.create({
        data: {
          ...dto,
          baseSalary: Money.toDb(dto.baseSalary),
          farmId,
          hireDate: new Date(dto.hireDate),
        },
      });

      // S3 fix: Domain audit inside the transaction
      await appendDomainAudit(tx, actor, {
        action: 'hr.employee.created',
        entityType: 'employee',
        entityId: employee.id,
        farmId,
      });

      return employee;
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

  async update(farmId: string, id: string, dto: UpdateEmployeeDto, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      const emp = await tx.employee.findFirst({ where: { id, farmId } });
      if (!emp) throw new NotFoundException('الموظف غير موجود');

      if (dto.employeeCode) {
        const existing = await tx.employee.findUnique({
          where: {
            farmId_employeeCode: { farmId, employeeCode: dto.employeeCode },
          },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException('الرقم الوظيفي مسجل لموظف آخر');
        }
      }

      const dataToUpdate: any = { ...dto };
      if (dto.baseSalary !== undefined) {
        dataToUpdate.baseSalary = Money.toDb(dto.baseSalary);
      }

      const updated = await tx.employee.update({
        where: { id },
        data: dataToUpdate,
      });

      // S3 fix: Domain audit with changed fields
      await appendDomainAudit(tx, actor, {
        action: 'hr.employee.updated',
        entityType: 'employee',
        entityId: id,
        farmId,
        metadata: { fields: Object.keys(dto) },
      });

      return updated;
    });
  }

  async remove(farmId: string, id: string, actor: AuditActor) {
    return this.prisma.$transaction(async tx => {
      const emp = await tx.employee.findFirst({ where: { id, farmId } });
      if (!emp) throw new NotFoundException('الموظف غير موجود');

      // F4 fix: Check for financial records before deletion
      const hasAdvances = await tx.employeeAdvance.count({ where: { employeeId: id } });
      const hasSlips = await tx.payrollSlip.count({ where: { employeeId: id } });

      if (hasAdvances > 0 || hasSlips > 0) {
        // Soft-delete: terminate instead of physical delete
        const terminated = await tx.employee.update({
          where: { id },
          data: {
            status: 'TERMINATED',
            terminationDate: new Date(),
            terminationReason: 'إنهاء خدمة بواسطة الإدارة',
          },
        });
        await appendDomainAudit(tx, actor, {
          action: 'hr.employee.terminated',
          entityType: 'employee',
          entityId: id,
          farmId,
          metadata: { reason: 'financial_records_exist', advances: hasAdvances, slips: hasSlips },
        });
        return terminated;
      }

      // Hard delete only if no financial records
      await tx.employee.delete({ where: { id } });
      await appendDomainAudit(tx, actor, {
        action: 'hr.employee.deleted',
        entityType: 'employee',
        entityId: id,
        farmId,
      });
      return { deleted: true };
    });
  }
}
