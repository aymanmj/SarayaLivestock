import { Module } from '@nestjs/common';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FarmsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
