import { IsIn, IsString } from 'class-validator';

// ENCRYPTION_KEY cannot be rotated safely until persisted ciphertext carries a
// key version and a re-encryption migration exists. Reject it at the boundary.
export const ROTATABLE_SECRET_NAMES = ['JWT_SECRET'] as const;

export class RotateSecretDto {
  @IsString()
  @IsIn(ROTATABLE_SECRET_NAMES)
  keyName: (typeof ROTATABLE_SECRET_NAMES)[number];
}
