/**
 * OpenTelemetry integration for ChadGI.
 *
 * Provides distributed tracing and metrics export capabilities.
 * Supports multiple exporters: console, OTLP, and Prometheus.
 *
 * Usage:
 * - Configure via chadgi-config.yaml telemetry section
 * - Or via OTEL_* environment variables
 * - Traces capture task lifecycle, GitHub operations, and Claude invocations
 * - Metrics track task counts, durations, and costs
 */

import {
  trace,
  metrics,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Meter,
  Counter,
  Histogram,
  Attributes,
} from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';

import type {
  TelemetryConfig,
  TelemetryExporter,
  TelemetryHealthCheck,
  TaskSpanAttributes,
  GitHubSpanAttributes,
  ClaudeSpanAttributes,
} from '../types/index.js';

/**
 * Default telemetry configuration
 */
const DEFAULT_CONFIG: Required<TelemetryConfig> = {
  enabled: false,
  trace_exporter: 'none',
  metrics_exporter: 'none',
  otlp_endpoint: 'http://localhost:4318',
  otlp_headers: {},
  prometheus_port: 9464,
  service_name: 'chadgi',
  resource_attributes: {},
  log_correlation: false,
  sampling_ratio: 1.0,
};

/**
 * Global telemetry state
 */
let sdk: NodeSDK | null = null;
let tracer: Tracer | null = null;
let meter: Meter | null = null;
let currentConfig: Required<TelemetryConfig> = { ...DEFAULT_CONFIG };
let isInitialized = false;
let prometheusExporter: PrometheusExporter | null = null;

// Metrics instruments
let taskCounter: Counter | null = null;
let taskDurationHistogram: Histogram | null = null;
let taskCostHistogram: Histogram | null = null;
let claudeInvocationCounter: Counter | null = null;
let githubOperationCounter: Counter | null = null;

/**
 * Environment variables for OpenTelemetry configuration.
 * These follow the OpenTelemetry specification and override config file settings.
 */
const OTEL_ENV_VARS = {
  OTEL_SERVICE_NAME: 'service_name',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'otlp_endpoint',
  OTEL_EXPORTER_OTLP_HEADERS: 'otlp_headers',
  OTEL_TRACES_SAMPLER_ARG: 'sampling_ratio',
  // ChadGI-specific
  CHADGI_TELEMETRY_ENABLED: 'enabled',
  CHADGI_TELEMETRY_TRACE_EXPORTER: 'trace_exporter',
  CHADGI_TELEMETRY_METRICS_EXPORTER: 'metrics_exporter',
  CHADGI_TELEMETRY_PROMETHEUS_PORT: 'prometheus_port',
  CHADGI_TELEMETRY_LOG_CORRELATION: 'log_correlation',
} as const;

/**
 * Parse environment variables and merge with config
 */
function parseEnvConfig(): Partial<TelemetryConfig> {
  const envConfig: Partial<TelemetryConfig> = {};

  // OTEL_SERVICE_NAME
  if (process.env.OTEL_SERVICE_NAME) {
    envConfig.service_name = process.env.OTEL_SERVICE_NAME;
  }

  // OTEL_EXPORTER_OTLP_ENDPOINT
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    envConfig.otlp_endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  }

  // OTEL_EXPORTER_OTLP_HEADERS (format: key=value,key2=value2)
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    const headers: Record<string, string> = {};
    const pairs = process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',');
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join('=').trim();
      }
    }
    envConfig.otlp_headers = headers;
  }

  // OTEL_TRACES_SAMPLER_ARG
  if (process.env.OTEL_TRACES_SAMPLER_ARG) {
    const ratio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG);
    if (!isNaN(ratio) && ratio >= 0 && ratio <= 1) {
      envConfig.sampling_ratio = ratio;
    }
  }

  // CHADGI_TELEMETRY_ENABLED
  if (process.env.CHADGI_TELEMETRY_ENABLED) {
    envConfig.enabled = process.env.CHADGI_TELEMETRY_ENABLED === 'true' || process.env.CHADGI_TELEMETRY_ENABLED === '1';
  }

  // CHADGI_TELEMETRY_TRACE_EXPORTER
  if (process.env.CHADGI_TELEMETRY_TRACE_EXPORTER) {
    const exporter = process.env.CHADGI_TELEMETRY_TRACE_EXPORTER as TelemetryExporter;
    if (['console', 'otlp', 'prometheus', 'none'].includes(exporter)) {
      envConfig.trace_exporter = exporter;
    }
  }

  // CHADGI_TELEMETRY_METRICS_EXPORTER
  if (process.env.CHADGI_TELEMETRY_METRICS_EXPORTER) {
    const exporter = process.env.CHADGI_TELEMETRY_METRICS_EXPORTER as TelemetryExporter;
    if (['console', 'otlp', 'prometheus', 'none'].includes(exporter)) {
      envConfig.metrics_exporter = exporter;
    }
  }

  // CHADGI_TELEMETRY_PROMETHEUS_PORT
  if (process.env.CHADGI_TELEMETRY_PROMETHEUS_PORT) {
    const port = parseInt(process.env.CHADGI_TELEMETRY_PROMETHEUS_PORT, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      envConfig.prometheus_port = port;
    }
  }

  // CHADGI_TELEMETRY_LOG_CORRELATION
  if (process.env.CHADGI_TELEMETRY_LOG_CORRELATION) {
    envConfig.log_correlation = process.env.CHADGI_TELEMETRY_LOG_CORRELATION === 'true' || process.env.CHADGI_TELEMETRY_LOG_CORRELATION === '1';
  }

  return envConfig;
}

/**
 * Get the package version from package.json
 */
function getPackageVersion(): string {
  try {
    // In ES modules, we need to read the package.json file
    const { readFileSync } = require('fs');
    const { join, dirname } = require('path');
    const { fileURLToPath } = require('url');

    // Try to find package.json relative to this module
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Initialize OpenTelemetry SDK with the given configuration.
 *
 * @param config - Telemetry configuration from chadgi-config.yaml
 * @returns true if initialization succeeded
 */
export function initTelemetry(config?: TelemetryConfig): boolean {
  if (isInitialized) {
    return true;
  }

  // Merge configurations: defaults < config file < environment variables
  const envConfig = parseEnvConfig();
  currentConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    ...envConfig,
  };

  // Don't initialize if telemetry is disabled
  if (!currentConfig.enabled) {
    return false;
  }

  try {
    // Build resource with service info
    const resourceAttributes: Attributes = {
      [ATTR_SERVICE_NAME]: currentConfig.service_name,
      [ATTR_SERVICE_VERSION]: getPackageVersion(),
      ...currentConfig.resource_attributes,
    };

    // Add deployment environment if available
    if (process.env.NODE_ENV) {
      resourceAttributes['deployment.environment'] = process.env.NODE_ENV;
    }

    const resource = new Resource(resourceAttributes);

    // Configure trace exporter
    let traceExporter;
    switch (currentConfig.trace_exporter) {
      case 'console':
        traceExporter = new ConsoleSpanExporter();
        break;
      case 'otlp':
        traceExporter = new OTLPTraceExporter({
          url: `${currentConfig.otlp_endpoint}/v1/traces`,
          headers: currentConfig.otlp_headers,
        });
        break;
      case 'none':
      default:
        traceExporter = undefined;
    }

    // Configure metrics exporter/reader
    let metricReader;
    switch (currentConfig.metrics_exporter) {
      case 'console':
        metricReader = new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: 60000, // Export every minute
        });
        break;
      case 'otlp':
        metricReader = new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${currentConfig.otlp_endpoint}/v1/metrics`,
            headers: currentConfig.otlp_headers,
          }),
          exportIntervalMillis: 60000,
        });
        break;
      case 'prometheus':
        prometheusExporter = new PrometheusExporter({
          port: currentConfig.prometheus_port,
        });
        metricReader = prometheusExporter;
        break;
      case 'none':
      default:
        metricReader = undefined;
    }

    // Initialize SDK
    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
    });

    sdk.start();

    // Get tracer and meter
    tracer = trace.getTracer(currentConfig.service_name, getPackageVersion());
    meter = metrics.getMeter(currentConfig.service_name, getPackageVersion());

    // Initialize metrics instruments
    initMetrics();

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[Telemetry] Failed to initialize OpenTelemetry:', (error as Error).message);
    return false;
  }
}

/**
 * Initialize metrics instruments
 */
function initMetrics(): void {
  if (!meter) return;

  // Task counters
  taskCounter = meter.createCounter('chadgi.tasks.total', {
    description: 'Total number of tasks processed',
    unit: '{task}',
  });

  // Task duration histogram
  taskDurationHistogram = meter.createHistogram('chadgi.task.duration', {
    description: 'Task execution duration in seconds',
    unit: 's',
  });

  // Task cost histogram
  taskCostHistogram = meter.createHistogram('chadgi.task.cost', {
    description: 'Task execution cost in USD',
    unit: 'USD',
  });

  // Claude invocation counter
  claudeInvocationCounter = meter.createCounter('chadgi.claude.invocations', {
    description: 'Number of Claude CLI invocations',
    unit: '{invocation}',
  });

  // GitHub operation counter
  githubOperationCounter = meter.createCounter('chadgi.github.operations', {
    description: 'Number of GitHub API operations',
    unit: '{operation}',
  });
}

/**
 * Shutdown telemetry gracefully
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
    } catch (error) {
      console.error('[Telemetry] Error during shutdown:', (error as Error).message);
    }
  }
  // Reset all state
  sdk = null;
  tracer = null;
  meter = null;
  prometheusExporter = null;
  taskCounter = null;
  taskDurationHistogram = null;
  taskCostHistogram = null;
  claudeInvocationCounter = null;
  githubOperationCounter = null;
  isInitialized = false;
  currentConfig = { ...DEFAULT_CONFIG };
}

/**
 * Check if telemetry is enabled and initialized
 */
export function isTelemetryEnabled(): boolean {
  return isInitialized && currentConfig.enabled;
}

/**
 * Get the current telemetry configuration
 */
export function getTelemetryConfig(): Readonly<Required<TelemetryConfig>> {
  return { ...currentConfig };
}

/**
 * Get the active tracer, or a no-op tracer if telemetry is disabled
 */
export function getTracer(): Tracer {
  return tracer || trace.getTracer('chadgi-noop');
}

/**
 * Get the active meter, or a no-op meter if telemetry is disabled
 */
export function getMeter(): Meter {
  return meter || metrics.getMeter('chadgi-noop');
}

/**
 * Get the current trace ID for log correlation
 */
export function getCurrentTraceId(): string | undefined {
  if (!currentConfig.log_correlation) {
    return undefined;
  }
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().traceId;
  }
  return undefined;
}

/**
 * Get the current span ID for log correlation
 */
export function getCurrentSpanId(): string | undefined {
  if (!currentConfig.log_correlation) {
    return undefined;
  }
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().spanId;
  }
  return undefined;
}

// ============================================================================
// Span Creation Helpers
// ============================================================================

/**
 * Start a new span for a task operation
 */
export function startTaskSpan(
  name: string,
  attributes?: TaskSpanAttributes
): Span {
  const t = getTracer();
  return t.startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes: attributes as Attributes,
  });
}

/**
 * Start a new span for a GitHub operation
 */
export function startGitHubSpan(
  operation: string,
  attributes?: GitHubSpanAttributes
): Span {
  const t = getTracer();
  return t.startSpan(`github.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'chadgi.github.operation': operation,
      ...attributes,
    } as Attributes,
  });
}

/**
 * Start a new span for a Claude CLI invocation
 */
export function startClaudeSpan(
  phase: string,
  attributes?: ClaudeSpanAttributes
): Span {
  const t = getTracer();
  return t.startSpan(`claude.${phase}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'chadgi.claude.phase': phase,
      ...attributes,
    } as Attributes,
  });
}

/**
 * End a span with success status
 */
export function endSpanSuccess(span: Span, attributes?: Attributes): void {
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * End a span with error status
 */
export function endSpanError(span: Span, error: Error | string, attributes?: Attributes): void {
  if (attributes) {
    span.setAttributes(attributes);
  }
  const errorMessage = error instanceof Error ? error.message : error;
  span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
  if (error instanceof Error) {
    span.recordException(error);
  }
  span.end();
}

/**
 * Run a function within a span context
 */
export function withSpan<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: Attributes
): T {
  const t = getTracer();
  return t.startActiveSpan(name, { attributes }, (span) => {
    try {
      const result = fn(span);
      if (result instanceof Promise) {
        return result
          .then((value) => {
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return value;
          })
          .catch((error) => {
            span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
            span.recordException(error as Error);
            span.end();
            throw error;
          }) as T;
      }
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  });
}

/**
 * Run an async function within a span context
 */
export async function withSpanAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const t = getTracer();
  return t.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  });
}

// ============================================================================
// Metrics Recording Helpers
// ============================================================================

/**
 * Record a task completion metric
 */
export function recordTaskCompletion(
  status: 'completed' | 'failed' | 'skipped',
  durationSecs: number,
  costUsd: number,
  attributes?: Attributes
): void {
  if (!isTelemetryEnabled()) return;

  const baseAttrs = { status, ...attributes };

  taskCounter?.add(1, baseAttrs);
  taskDurationHistogram?.record(durationSecs, baseAttrs);
  taskCostHistogram?.record(costUsd, baseAttrs);
}

/**
 * Record a Claude invocation metric
 */
export function recordClaudeInvocation(
  phase: string,
  iteration: number,
  attributes?: Attributes
): void {
  if (!isTelemetryEnabled()) return;

  claudeInvocationCounter?.add(1, {
    phase,
    iteration: String(iteration),
    ...attributes,
  });
}

/**
 * Record a GitHub operation metric
 */
export function recordGitHubOperation(
  operation: string,
  success: boolean,
  attributes?: Attributes
): void {
  if (!isTelemetryEnabled()) return;

  githubOperationCounter?.add(1, {
    operation,
    success: String(success),
    ...attributes,
  });
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check telemetry health and connectivity
 */
export async function checkTelemetryHealth(): Promise<TelemetryHealthCheck> {
  const result: TelemetryHealthCheck = {
    enabled: currentConfig.enabled,
    trace_exporter_status: 'disabled',
    metrics_exporter_status: 'disabled',
  };

  if (!currentConfig.enabled) {
    return result;
  }

  // Check trace exporter
  if (currentConfig.trace_exporter !== 'none') {
    result.trace_exporter_status = isInitialized ? 'ok' : 'error';
    if (!isInitialized) {
      result.errors = result.errors || [];
      result.errors.push('Trace exporter not initialized');
    }
  }

  // Check metrics exporter
  if (currentConfig.metrics_exporter !== 'none') {
    result.metrics_exporter_status = isInitialized ? 'ok' : 'error';
    if (!isInitialized) {
      result.errors = result.errors || [];
      result.errors.push('Metrics exporter not initialized');
    }
  }

  // Add endpoint info
  result.endpoints = {};
  if (currentConfig.trace_exporter === 'otlp' || currentConfig.metrics_exporter === 'otlp') {
    result.endpoints.otlp = currentConfig.otlp_endpoint;
  }
  if (currentConfig.metrics_exporter === 'prometheus') {
    result.endpoints.prometheus = `http://localhost:${currentConfig.prometheus_port}/metrics`;
  }

  return result;
}

/**
 * Get the Prometheus metrics endpoint URL if enabled
 */
export function getPrometheusEndpoint(): string | null {
  if (currentConfig.metrics_exporter === 'prometheus' && prometheusExporter) {
    return `http://localhost:${currentConfig.prometheus_port}/metrics`;
  }
  return null;
}
