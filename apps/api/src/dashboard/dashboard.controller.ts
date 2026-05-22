import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { ChartsQueryDto } from './dto/charts-query.dto';
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

  @Get('consumption-by-room/csv')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Export consumption by room as CSV' })
  async getConsumptionByRoomCsv(
    @Query() dto: ConsumptionReportDto,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.dashboardService.getConsumptionByRoomCsv(dto);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      'attachment; filename="consumption-by-room.csv"',
    );
    return res.send(csv);
  }

  @Get('meal-ranking')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get meal products ranking by consumption' })
  async getMealRanking(@Query() dto: MealRankingDto) {
    return this.dashboardService.getMealRanking(dto);
  }

  @Get('meal-ranking/csv')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Export meal ranking as CSV' })
  async getMealRankingCsv(
    @Query() dto: MealRankingDto,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.dashboardService.getMealRankingCsv(dto);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      'attachment; filename="meal-ranking.csv"',
    );
    return res.send(csv);
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

  @Get('stock-history/:productId/csv')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Export stock history as CSV' })
  async getStockHistoryCsv(
    @Param('productId') productId: string,
    @Query() dto: StockHistoryDto,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.dashboardService.getStockHistoryCsv(productId, dto);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      'attachment; filename="stock-history.csv"',
    );
    return res.send(csv);
  }

  // -- Charts --

  @Get('charts/monthly-consumption')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({
    summary: 'Get monthly consumption trend (REPLENISH vs MEAL_OUT)',
  })
  async getMonthlyConsumption(@Query() dto: ChartsQueryDto) {
    return this.dashboardService.getMonthlyConsumption(dto);
  }

  @Get('charts/room-comparison')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get consumption comparison by room' })
  async getRoomComparison(@Query() dto: ChartsQueryDto) {
    return this.dashboardService.getRoomComparison(dto);
  }

  @Get('charts/category-distribution')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get stock distribution by product category' })
  async getCategoryDistribution() {
    return this.dashboardService.getCategoryDistribution();
  }

  @Get('charts/stock-evolution/:productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get stock quantity evolution over time' })
  async getStockEvolution(
    @Param('productId') productId: string,
    @Query() dto: ChartsQueryDto,
  ) {
    return this.dashboardService.getStockEvolution(productId, dto);
  }
}
