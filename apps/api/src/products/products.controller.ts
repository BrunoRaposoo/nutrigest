import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'List all products' })
  async findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Create a new product' })
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Update a product' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a product (admin only)' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
