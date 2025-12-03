/**
 * Health Check Handler
 */

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  agentId?: string;
  agentName?: string;
  version?: string;
  uptime?: number;
  timestamp: string;
  checks?: Record<string, HealthCheckResult>;
}

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration_ms?: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  agentId?: string;
  agentName?: string;
  version?: string;
  checks?: Record<string, () => Promise<HealthCheckResult>>;
}

/**
 * Create a health check handler
 */
export function createHealthCheckHandler(config: HealthCheckConfig = {}) {
  const startTime = Date.now();

  return async (): Promise<Response> => {
    const checks: Record<string, HealthCheckResult> = {};
    let overallStatus: 'ok' | 'degraded' | 'unhealthy' = 'ok';

    // Run custom health checks
    if (config.checks) {
      for (const [name, check] of Object.entries(config.checks)) {
        const startMs = performance.now();
        try {
          const result = await check();
          checks[name] = {
            ...result,
            duration_ms: Math.round(performance.now() - startMs),
          };

          if (result.status === 'fail') {
            overallStatus = 'unhealthy';
          } else if (result.status === 'warn' && overallStatus === 'ok') {
            overallStatus = 'degraded';
          }
        } catch (error) {
          checks[name] = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Check failed',
            duration_ms: Math.round(performance.now() - startMs),
          };
          overallStatus = 'unhealthy';
        }
      }
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startTime) / 1000),
      ...(config.agentId && { agentId: config.agentId }),
      ...(config.agentName && { agentName: config.agentName }),
      ...(config.version && { version: config.version }),
      ...(Object.keys(checks).length > 0 && { checks }),
    };

    const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return Response.json(response, { status: statusCode });
  };
}

/**
 * Simple liveness check (always returns ok if server is running)
 */
export function createLivenessHandler(): () => Response {
  return () => Response.json({ status: 'ok' });
}

/**
 * Readiness check (returns ok when server is ready to accept traffic)
 */
export function createReadinessHandler(isReady: () => boolean): () => Response {
  return () => {
    if (isReady()) {
      return Response.json({ status: 'ok' });
    }
    return Response.json({ status: 'not ready' }, { status: 503 });
  };
}
