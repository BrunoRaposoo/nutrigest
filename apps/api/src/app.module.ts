import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CentralStockModule } from './central-stock/central-stock.module';
import { DbModule } from './db/db.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [DbModule, AuthModule, UsersModule, ProductsModule, CentralStockModule],
})
export class AppModule {}
