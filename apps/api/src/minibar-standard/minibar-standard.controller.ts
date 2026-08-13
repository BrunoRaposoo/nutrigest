import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VALID_ROOMS } from '@nutrigest/shared';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AddMinibarItemDto } from './dto/add-minibar-item.dto';
import { UpdateMinibarItemDto } from './dto/update-minibar-item.dto';
import { MinibarStandardService } from './minibar-standard.service';

@ApiTags('Minibar Standard')
@Controller('minibar-standard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class MinibarStandardController {
  constructor(private minibarStandardService: MinibarStandardService) {}

  @Get('rooms')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'List available room numbers (101-110)' })
  async listRooms() {
    return VALID_ROOMS;
  }

  @Get(':room')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'Get minibar standard for a room' })
  async findAll(@Param('room', ParseIntPipe) room: number) {
    return this.minibarStandardService.findAll(room);
  }

  @Post(':room')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({
    summary: 'Add or replace a product in room standard (upsert)',
  })
  async add(
    @Param('room', ParseIntPipe) room: number,
    @Body() dto: AddMinibarItemDto,
  ) {
    return this.minibarStandardService.add(room, dto);
  }

  @Patch(':room/:productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Update standard quantity for a product in room' })
  async update(
    @Param('room', ParseIntPipe) room: number,
    @Param('productId') productId: string,
    @Body() dto: UpdateMinibarItemDto,
  ) {
    return this.minibarStandardService.update(room, productId, dto);
  }

  @Delete(':room/:productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a product from room standard' })
  async remove(
    @Param('room', ParseIntPipe) room: number,
    @Param('productId') productId: string,
  ) {
    await this.minibarStandardService.remove(room, productId);
  }
}
