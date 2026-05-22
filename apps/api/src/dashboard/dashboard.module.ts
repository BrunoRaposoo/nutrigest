import { Module } from '@nestjs/common';
import { CentralStockModule } from '../central-stock/central-stock.module';
import { ProductsModule } from '../products/products.module';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProductsModule, CentralStockModule, StockMovementsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
