import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { products } from '../db/schema/products';
import { stockMovements } from '../db/schema/stock-movements';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, DbService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  describe('findAll', () => {
    it('should return array of users', async () => {
      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('email');
        expect(result[0]).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      const created = await service.create({
        name: 'FindOne Test',
        email: `findone-${Date.now()}@example.com`,
        password: 'password123',
        role: 'OPERATOR',
      });

      const result = await service.findOne(created.id);

      expect(result.id).toBe(created.id);
      expect(result.email).toBe(created.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const result = await service.create({
        name: 'Create Test',
        email: `create-${Date.now()}@example.com`,
        password: 'password123',
        role: 'TECHNICIAN',
      });

      expect(result).toHaveProperty('id');
      expect(result.email).toContain('create-');
      expect(result.role).toBe('TECHNICIAN');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email', async () => {
      const email = `create-dup-${Date.now()}@example.com`;

      await service.create({
        name: 'First',
        email,
        password: 'password123',
      });

      await expect(
        service.create({
          name: 'Second',
          email,
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      const created = await service.create({
        name: 'Original Name',
        email: `update-${Date.now()}@example.com`,
        password: 'password123',
      });

      const result = await service.update(created.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.email).toBe(created.email);
    });

    it('should update user password', async () => {
      const email = `update-pw-${Date.now()}@example.com`;

      const created = await service.create({
        name: 'Password Update',
        email,
        password: 'password123',
      });

      const result = await service.update(created.id, {
        password: 'newpassword456',
      });

      expect(result.id).toBe(created.id);
      expect(result.email).toBe(email);
    });

    it('should reject email conflict on update', async () => {
      const email1 = `update-conflict-${Date.now()}@example.com`;
      const email2 = `update-conflict-${Date.now() + 1}@example.com`;

      await service.create({
        name: 'User One',
        email: email1,
        password: 'password123',
      });

      const user2 = await service.create({
        name: 'User Two',
        email: email2,
        password: 'password123',
      });

      await expect(service.update(user2.id, { email: email1 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', {
          name: 'Ghost',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      const created = await service.create({
        name: 'Delete Test',
        email: `delete-${Date.now()}@example.com`,
        password: 'password123',
      });

      const result = await service.remove(created.id, 'some-other-user-id');
      expect(result).toHaveProperty('message');

      await expect(service.findOne(created.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject deleting the current user', async () => {
      const created = await service.create({
        name: 'Self Delete',
        email: `self-delete-${Date.now()}@example.com`,
        password: 'password123',
      });

      await expect(service.remove(created.id, created.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject deleting a user with stock movements', async () => {
      const created = await service.create({
        name: 'Has Movements',
        email: `has-movements-${Date.now()}@example.com`,
        password: 'password123',
      });

      const [product] = await db.db
        .insert(products)
        .values({ name: 'Mov Product', category: 'BEVERAGE' })
        .returning({ id: products.id });

      await db.db.insert(stockMovements).values({
        type: 'IN',
        productId: product.id,
        quantity: 10,
        userId: created.id,
      });

      await expect(
        service.remove(created.id, 'some-other-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.remove(
          '00000000-0000-0000-0000-000000000000',
          'some-other-user-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
