import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateInMovementDto } from './dto/create-in-movement.dto';
import { CreateMealOutMovementDto } from './dto/create-meal-out-movement.dto';
import { CreateReplenishMovementDto } from './dto/create-replenish-movement.dto';
import { ListMovementsDto } from './dto/list-movements.dto';
import { StockMovementsService } from './stock-movements.service';

@ApiTags('Stock Movements')
@Controller('stock-movements')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class StockMovementsController {
  constructor(private stockMovementsService: StockMovementsService) {}

  @Get()
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'List stock movements with filters (type, room, date range, pagination)' })
  async findAll(@Query() dto: ListMovementsDto) {
    return this.stockMovementsService.findAll(dto);
  }

  @Post('in')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Register stock entry (batch)' })
  async createIn(@Body() dto: CreateInMovementDto, @Req() req: any) {
    return this.stockMovementsService.createIn(dto, req.user.id);
  }

  @Post('replenish/:room')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'Replenish room minibar' })
  async createReplenish(
    @Param('room', ParseIntPipe) room: number,
    @Body() dto: CreateReplenishMovementDto,
    @Req() req: any,
  ) {
    return this.stockMovementsService.createReplenish(room, dto, req.user.id);
  }

  @Post('meal-out')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'Register meal removal' })
  async createMealOut(@Body() dto: CreateMealOutMovementDto, @Req() req: any) {
    return this.stockMovementsService.createMealOut(dto, req.user.id);
  }
}
