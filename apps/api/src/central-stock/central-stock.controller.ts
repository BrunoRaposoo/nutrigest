import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CentralStockService } from './central-stock.service';
import { UpdateStockDto } from './dto/update-stock.dto';

@ApiTags('Central Stock')
@Controller('central-stock')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class CentralStockController {
  constructor(private centralStockService: CentralStockService) {}

  @Get()
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'List all stock entries with product details' })
  async findAll() {
    return this.centralStockService.findAll();
  }

  @Get(':productId')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'Get stock entry by product ID' })
  async findOne(@Param('productId') productId: string) {
    return this.centralStockService.findOne(productId);
  }

  @Patch(':productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Adjust stock quantity (absolute value)' })
  async update(
    @Param('productId') productId: string,
    @Body() dto: UpdateStockDto,
  ) {
    return this.centralStockService.update(productId, dto);
  }
}
