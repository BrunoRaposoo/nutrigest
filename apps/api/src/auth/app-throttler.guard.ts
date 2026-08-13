import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = req.ips;
    const tracker =
      Array.isArray(ips) && ips.length > 0
        ? (ips[0] as string)
        : ((req.ip as string | undefined) ?? '');
    return Promise.resolve(tracker);
  }

  override async canActivate(
    context: Parameters<ThrottlerGuard['canActivate']>[0],
  ): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}
