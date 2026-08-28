import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNLICENSED_WRITE_KEY = 'allowUnlicensedWrite';
export const AllowUnlicensedWrite = () => SetMetadata(ALLOW_UNLICENSED_WRITE_KEY, true);
