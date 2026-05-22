import { Module } from '@nestjs/common';
import { MinibarStandardController } from './minibar-standard.controller';
import { MinibarStandardService } from './minibar-standard.service';

@Module({
  controllers: [MinibarStandardController],
  providers: [MinibarStandardService],
  exports: [MinibarStandardService],
})
export class MinibarStandardModule {}
