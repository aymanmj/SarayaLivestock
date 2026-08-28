import { Module } from '@nestjs/common';
import { NutritionController } from './nutrition.controller';
import { RationService } from './ration.service';

@Module({
  controllers: [NutritionController],
  providers: [RationService],
  exports: [RationService],
})
export class NutritionModule {}
