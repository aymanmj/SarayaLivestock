import { Module } from '@nestjs/common';
import { FatteningService } from './fattening.service';
import { FatteningController } from './fattening.controller';

@Module({
  controllers: [FatteningController],
  providers: [FatteningService],
  exports: [FatteningService],
})
export class FatteningModule {}
