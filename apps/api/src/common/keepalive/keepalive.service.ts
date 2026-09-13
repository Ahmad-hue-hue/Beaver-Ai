import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';

/**
 * Render free-tier web services spin down after ~15 minutes without inbound
 * traffic, so the first request of an idle session (login, refresh, etc.) hit a
 * cold start that surfaced as a generic network error in the app. Once the
 * instance is up it taps its own public /health/ready endpoint on an interval,
 * which counts as inbound traffic and stops the scale-to-zero entirely.
 *
 * Health probes are already filtered out of the request logs, so this stays
 * silent. Runs only when the API boots in production.
 */
@Injectable()
export class KeepAlive implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('KeepAlive');
  private timer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const env = this.config.get<AppConfig['env']>('env');
    if (env !== 'production') return;

    const { publicBaseUrl, intervalMs } = this.config.get<AppConfig['keepalive']>('keepalive')!;
    const url = `${publicBaseUrl.replace(/\/$/, '')}/api/v1/health/ready`;

    const ping = (): void => {
      fetch(url, { signal: AbortSignal.timeout(20_000) })
        .then((r) => {
          if (!r.ok) this.logger.warn(`warm probe returned ${r.status}`);
        })
        .catch((err) => this.logger.warn(`warm probe failed: ${String(err)}`));
    };

    // Start pinging after the port is fully bound, then every intervalMs.
    this.timer = setInterval(ping, intervalMs);
    setTimeout(ping, 15_000);
    this.logger.log(`keeping instance warm via ${url} every ${intervalMs}ms`);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}