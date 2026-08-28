import { Module } from '@nestjs/common';
import { BarnsController } from './barns.controller';
import { BarnsService } from './barns.service';

@Module({
  controllers: [BarnsController],
  providers: [BarnsService],
})
export class BarnsModule {}
