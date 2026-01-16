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
import { Span, Tracer, Meter, Attributes } from '@opentelemetry/api';
import type { TelemetryConfig, TelemetryHealthCheck, TaskSpanAttributes, GitHubSpanAttributes, ClaudeSpanAttributes } from '../types/index.js';
/**
 * Initialize OpenTelemetry SDK with the given configuration.
 *
 * @param config - Telemetry configuration from chadgi-config.yaml
 * @returns true if initialization succeeded
 */
export declare function initTelemetry(config?: TelemetryConfig): boolean;
/**
 * Shutdown telemetry gracefully
 */
export declare function shutdownTelemetry(): Promise<void>;
/**
 * Check if telemetry is enabled and initialized
 */
export declare function isTelemetryEnabled(): boolean;
/**
 * Get the current telemetry configuration
 */
export declare function getTelemetryConfig(): Readonly<Required<TelemetryConfig>>;
/**
 * Get the active tracer, or a no-op tracer if telemetry is disabled
 */
export declare function getTracer(): Tracer;
/**
 * Get the active meter, or a no-op meter if telemetry is disabled
 */
export declare function getMeter(): Meter;
/**
 * Get the current trace ID for log correlation
 */
export declare function getCurrentTraceId(): string | undefined;
/**
 * Get the current span ID for log correlation
 */
export declare function getCurrentSpanId(): string | undefined;
/**
 * Start a new span for a task operation
 */
export declare function startTaskSpan(name: string, attributes?: TaskSpanAttributes): Span;
/**
 * Start a new span for a GitHub operation
 */
export declare function startGitHubSpan(operation: string, attributes?: GitHubSpanAttributes): Span;
/**
 * Start a new span for a Claude CLI invocation
 */
export declare function startClaudeSpan(phase: string, attributes?: ClaudeSpanAttributes): Span;
/**
 * End a span with success status
 */
export declare function endSpanSuccess(span: Span, attributes?: Attributes): void;
/**
 * End a span with error status
 */
export declare function endSpanError(span: Span, error: Error | string, attributes?: Attributes): void;
/**
 * Run a function within a span context
 */
export declare function withSpan<T>(name: string, fn: (span: Span) => T, attributes?: Attributes): T;
/**
 * Run an async function within a span context
 */
export declare function withSpanAsync<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Attributes): Promise<T>;
/**
 * Record a task completion metric
 */
export declare function recordTaskCompletion(status: 'completed' | 'failed' | 'skipped', durationSecs: number, costUsd: number, attributes?: Attributes): void;
/**
 * Record a Claude invocation metric
 */
export declare function recordClaudeInvocation(phase: string, iteration: number, attributes?: Attributes): void;
/**
 * Record a GitHub operation metric
 */
export declare function recordGitHubOperation(operation: string, success: boolean, attributes?: Attributes): void;
/**
 * Check telemetry health and connectivity
 */
export declare function checkTelemetryHealth(): Promise<TelemetryHealthCheck>;
/**
 * Get the Prometheus metrics endpoint URL if enabled
 */
export declare function getPrometheusEndpoint(): string | null;
//# sourceMappingURL=telemetry.d.ts.map