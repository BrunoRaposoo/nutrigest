import { FastifyAdapter } from '@nestjs/platform-fastify';

export class NutrigestFastifyAdapter extends FastifyAdapter {
  override setNotFoundHandler(
    _handler: Parameters<FastifyAdapter['setNotFoundHandler']>[0],
  ): ReturnType<FastifyAdapter['setNotFoundHandler']> {
    // Prevent NestJS from registering its own not-found handler
    // We manage the SPA fallback manually in bootstrap()
    return undefined as unknown as ReturnType<
      FastifyAdapter['setNotFoundHandler']
    >;
  }
}
