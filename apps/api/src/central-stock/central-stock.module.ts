import { Module } from '@nestjs/common';
import { CentralStockController } from './central-stock.controller';
import { CentralStockService } from './central-stock.service';

@Module({
  controllers: [CentralStockController],
  providers: [CentralStockService],
  exports: [CentralStockService],
})
export class CentralStockModule {}
