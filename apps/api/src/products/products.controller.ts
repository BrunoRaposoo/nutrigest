import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

  @Post(':id/image')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Upload product image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpeg, png, webp)',
        },
      },
    },
  })
  async uploadImage(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    const file = await req.file();

    if (!file) {
      throw new UnprocessableEntityException('File is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(
        `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const buffer = await file.toBuffer();

    return this.productsService.uploadImage(
      id,
      buffer,
      file.filename,
      file.mimetype,
    );
  }

  @Delete(':id/image')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Remove product image' })
  async deleteImage(@Param('id') id: string) {
    return this.productsService.deleteImage(id);
  }
}
