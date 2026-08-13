import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Controller('low')
class LowController {
  @Get()
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  low() {
    return { ok: true };
  }
}

class TestThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = req.ips;
    const tracker =
      Array.isArray(ips) && ips.length > 0
        ? (ips[ips.length - 1] as string)
        : ((req.ip as string | undefined) ?? '');
    return Promise.resolve(tracker);
  }
}

describe('Rate limiting (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 3 }],
        }),
      ],
      controllers: [PingController, LowController],
      providers: [{ provide: APP_GUARD, useClass: TestThrottlerGuard }],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ trustProxy: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 for requests within the limit and 429 beyond it', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'GET', url: '/ping' });
      expect(res.statusCode).toBe(200);
    }

    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('should throttle requests per client IP from x-forwarded-for', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.10' };

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'GET', url: '/ping', headers });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: 'GET',
      url: '/ping',
      headers,
    });
    expect(blocked.statusCode).toBe(429);

    const otherIp = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });
    expect(otherIp.statusCode).toBe(200);
  });

  it('should apply per-route @Throttle overrides on top of the global fallback', async () => {
    const first = await app.inject({ method: 'GET', url: '/low' });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'GET', url: '/low' });
    expect(second.statusCode).toBe(429);
  });
});
