import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AnimalsService } from '../animals/animals.service';
import { MilkingService } from '../milking/milking.service';
import { UsersService } from '../users/users.service';
import { RationService } from '../nutrition/ration.service';
import { AccountingService } from '../accounting/accounting.service';
import { AuthenticatedUser, requireFarmId } from './authenticated-user';

describe('Tenant isolation', () => {
  const farmId = 'farm-a';

  it('rejects farm-scoped operations for a user without an assigned farm', () => {
    const user: AuthenticatedUser = {
      id: 'user-a',
      username: 'admin',
      fullName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      farmId: null,
      orgId: 'org-a',
    };

    expect(() => requireFarmId(user)).toThrow(ForbiddenException);
  });

  it('scopes animal detail lookup by both record id and farm id', async () => {
    const prisma = { animal: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const service = new AnimalsService(prisma);

    await expect(service.findOne('animal-from-another-farm', farmId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.animal.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'animal-from-another-farm', farmId },
    }));
  });

  it('does not resolve an animal outside the farm while logging milk', async () => {
    const tx = { animal: { findFirst: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) } as any;
    const service = new MilkingService(prisma);

    await expect(service.logMilk({ animalId: 'foreign-animal' } as any, farmId)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.animal.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ farmId }),
    });
  });

  it('prevents a super admin from changing a user in another organization', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new UsersService(prisma);

    await expect(service.updateRole('foreign-user', UserRole.WORKER, 'org-a', {
      id: 'admin-a', orgId: 'org-a', farmId,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('prevents stock changes for an ingredient in another farm', async () => {
    const tx = {
      feedIngredient: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new RationService(prisma);

    await expect(service.updateIngredientStock('foreign-ingredient', 10, undefined, farmId)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.feedIngredient.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-ingredient', farmId } });
    expect(tx.feedIngredient.update).not.toHaveBeenCalled();
  });

  it('prevents closing a fiscal period in another farm', async () => {
    const tx = {
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any;
    const service = new AccountingService(prisma);

    await expect(service.closePeriod('foreign-period', farmId)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.fiscalPeriod.updateMany).not.toHaveBeenCalled();
  });
});
