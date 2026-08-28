import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  farmId: string | null;
  orgId: string;
}

export function requireFarmId(user: AuthenticatedUser): string {
  if (!user.farmId) {
    throw new ForbiddenException('يجب ربط حساب المستخدم بمزرعة قبل تنفيذ هذه العملية');
  }

  return user.farmId;
}
