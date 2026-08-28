import { Module } from '@nestjs/common';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseCryptoService } from './license-crypto.service';

@Module({
  controllers: [LicenseController],
  providers: [LicenseService, LicenseCryptoService],
  exports: [LicenseService, LicenseCryptoService],
})
export class LicenseModule {}
