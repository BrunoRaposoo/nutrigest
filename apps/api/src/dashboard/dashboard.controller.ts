import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { ConsumptionReportDto } from './dto/consumption-report.dto';
import { MealRankingDto } from './dto/meal-ranking.dto';
import { StockHistoryDto } from './dto/stock-history.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get dashboard summary (totals, alerts, recent)' })
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('consumption-by-room')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get consumption grouped by room' })
  async getConsumptionByRoom(@Query() dto: ConsumptionReportDto) {
    return this.dashboardService.getConsumptionByRoom(dto);
  }

  @Get('meal-ranking')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get meal products ranking by consumption' })
  async getMealRanking(@Query() dto: MealRankingDto) {
    return this.dashboardService.getMealRanking(dto);
  }

  @Get('stock-history/:productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get stock movement history for a product' })
  async getStockHistory(
    @Param('productId') productId: string,
    @Query() dto: StockHistoryDto,
  ) {
    return this.dashboardService.getStockHistory(productId, dto);
  }
}
