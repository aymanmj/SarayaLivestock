import { Global, Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { VaultService } from './vault.service';

@Global()
@Module({
  controllers: [SecurityController],
  providers: [VaultService],
  exports: [VaultService],
})
export class SecurityModule {}
