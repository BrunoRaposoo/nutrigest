import type { ThrottlerOptions } from '@nestjs/throttler';

export const AUTH_THROTTLE_LIMITS = {
  login: { limit: 30, ttl: 60_000 },
  register: { limit: 10, ttl: 60_000 },
  refresh: { limit: 30, ttl: 60_000 },
  forgot: { limit: 5, ttl: 60_000 },
  reset: { limit: 5, ttl: 60_000 },
} satisfies Record<string, ThrottlerOptions>;
