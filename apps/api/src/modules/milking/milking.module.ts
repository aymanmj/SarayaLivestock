import { Module } from '@nestjs/common';
import { MilkingService } from './milking.service';
import { MilkingController } from './milking.controller';

@Module({
  controllers: [MilkingController],
  providers: [MilkingService],
  exports: [MilkingService],
})
export class MilkingModule {}
