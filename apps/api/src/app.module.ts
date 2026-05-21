import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [DbModule, AuthModule, UsersModule],
})
export class AppModule {}
