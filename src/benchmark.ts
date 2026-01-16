import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { colors } from './utils/colors.js';
import { createProgressBar, ProgressBar } from './utils/progress.js';
import { resolveChadgiDir } from './utils/config.js';

// Import shared types
import type { BaseCommandOptions } from './types/index.js';

// Benchmark task definition
interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  category: 'code-review' | 'bug-fix' | 'refactor' | 'feature' | 'test' | 'docs' | 'custom';
  prompt: string;
  expectedOutcome?: string;
  maxDuration?: number; // seconds
  complexity: 'simple' | 'medium' | 'complex';
}

// Benchmark run configuration
interface BenchmarkConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  iterations?: number;
}

// Result of a single benchmark task run
interface TaskRunResult {
  taskId: string;
  taskName: string;
  category: string;
  status: 'success' | 'failure' | 'timeout' | 'error';
  durationSecs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  iterationCount: number;
  error?: string;
  startedAt: string;
  completedAt: string;
}

// Result of a full benchmark run
interface BenchmarkRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  config: BenchmarkConfig;
  mode: 'quick' | 'full' | 'custom';
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  successRate: number;
  totalDurationSecs: number;
  avgDurationSecs: number;
  totalTokens: number;
  avgTokensPerTask: number;
  totalCostUsd: number;
  avgCostPerTask: number;
  taskResults: TaskRunResult[];
  categoryBreakdown: Record<string, CategoryMetrics>;
}

// Category-level metrics
interface CategoryMetrics {
  tasks: number;
  successful: number;
  failed: number;
  successRate: number;
  avgDuration: number;
  avgTokens: number;
  avgCost: number;
}

// Historical benchmark data
interface BenchmarkHistory {
  version: string;
  lastUpdated: string;
  runs: BenchmarkRunResult[];
}

// Comparison result between two runs
interface ComparisonResult {
  baseline: BenchmarkRunResult;
  comparison: BenchmarkRunResult;
  successRateDelta: number;
  durationDelta: number;
  durationDeltaPct: number;
  tokenDelta: number;
  tokenDeltaPct: number;
  costDelta: number;
  costDeltaPct: number;
  improved: boolean;
  categoryComparison: Record<string, {
    successRateDelta: number;
    durationDelta: number;
    costDelta: number;
  }>;
}

interface BenchmarkOptions extends BaseCommandOptions {
  quick?: boolean;
  full?: boolean;
  model?: string;
  tasks?: string;
  output?: string;
  compare?: string;
  list?: boolean;
  iterations?: number;
  timeout?: number;
  dryRun?: boolean;
}


// Standard benchmark tasks for quick mode
const QUICK_BENCHMARK_TASKS: BenchmarkTask[] = [
  {
    id: 'quick-code-review',
    name: 'Simple Code Review',
    description: 'Review a small function for potential issues',
    category: 'code-review',
    complexity: 'simple',
    prompt: `Review the following function and identify any issues:

\`\`\`javascript
function calculateTotal(items) {
  var total = 0;
  for (i = 0; i < items.length; i++) {
    total += items[i].price * items[i].qty;
  }
  return total;
}
\`\`\`

List any bugs, style issues, or improvements needed.`,
    expectedOutcome: 'Should identify: missing var/let/const for i, use of var instead of const/let',
    maxDuration: 30,
  },
  {
    id: 'quick-bug-fix',
    name: 'Simple Bug Fix',
    description: 'Fix an off-by-one error in a loop',
    category: 'bug-fix',
    complexity: 'simple',
    prompt: `Fix the bug in this function that causes it to skip the last element:

\`\`\`javascript
function sumArray(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    sum += arr[i];
  }
  return sum;
}
\`\`\`

Provide the corrected code.`,
    expectedOutcome: 'Should change arr.length - 1 to arr.length',
    maxDuration: 30,
  },
  {
    id: 'quick-refactor',
    name: 'Simple Refactor',
    description: 'Convert a callback to async/await',
    category: 'refactor',
    complexity: 'simple',
    prompt: `Refactor this callback-based code to use async/await:

\`\`\`javascript
function fetchUserData(userId, callback) {
  fetchUser(userId, function(err, user) {
    if (err) {
      callback(err, null);
      return;
    }
    fetchProfile(user.profileId, function(err, profile) {
      if (err) {
        callback(err, null);
        return;
      }
      callback(null, { user, profile });
    });
  });
}
\`\`\`

Provide the refactored async/await version.`,
    expectedOutcome: 'Should use async function with try/catch and await',
    maxDuration: 45,
  },
];

// Standard benchmark tasks for full mode
const FULL_BENCHMARK_TASKS: BenchmarkTask[] = [
  ...QUICK_BENCHMARK_TASKS,
  {
    id: 'full-code-review-complex',
    name: 'Complex Code Review',
    description: 'Review a class with multiple methods for architectural issues',
    category: 'code-review',
    complexity: 'complex',
    prompt: `Review this class for architectural issues, code smells, and potential bugs:

\`\`\`typescript
class UserManager {
  private db: any;
  private cache: any;

  constructor() {
    this.db = new Database();
    this.cache = new Cache();
  }

  async getUser(id: string) {
    let user = this.cache.get(id);
    if (!user) {
      user = await this.db.query('SELECT * FROM users WHERE id = ' + id);
      this.cache.set(id, user);
    }
    return user;
  }

  async createUser(data: any) {
    const user = await this.db.query('INSERT INTO users VALUES (' + data.name + ', ' + data.email + ')');
    this.sendWelcomeEmail(data.email);
    this.cache.invalidate();
    return user;
  }

  sendWelcomeEmail(email: string) {
    // Email sending logic
    fetch('https://api.email.com/send', {
      method: 'POST',
      body: JSON.stringify({ to: email, template: 'welcome' })
    });
  }
}
\`\`\`

Identify all issues and suggest improvements.`,
    expectedOutcome: 'Should identify: SQL injection, missing dependency injection, sync email call, cache invalidation issues',
    maxDuration: 90,
  },
  {
    id: 'full-bug-fix-complex',
    name: 'Complex Bug Fix',
    description: 'Fix a race condition in async code',
    category: 'bug-fix',
    complexity: 'complex',
    prompt: `This code has a race condition that causes incorrect results. Fix it:

\`\`\`javascript
class Counter {
  constructor() {
    this.count = 0;
  }

  async increment() {
    const current = this.count;
    await this.save(current + 1);
    this.count = current + 1;
  }

  async save(value) {
    // Simulated async save
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Saved:', value);
  }
}

// Usage causing race condition:
const counter = new Counter();
await Promise.all([
  counter.increment(),
  counter.increment(),
  counter.increment()
]);
console.log(counter.count); // Expected: 3, Actual: 1
\`\`\`

Provide the corrected implementation.`,
    expectedOutcome: 'Should use mutex/lock or atomic operations',
    maxDuration: 90,
  },
  {
    id: 'full-feature',
    name: 'Feature Implementation',
    description: 'Implement a simple caching decorator',
    category: 'feature',
    complexity: 'medium',
    prompt: `Implement a TypeScript decorator that caches function results:

Requirements:
1. Cache results based on function arguments
2. Support TTL (time-to-live) configuration
3. Handle async functions
4. Allow cache invalidation

Provide the complete implementation with usage examples.`,
    expectedOutcome: 'Should implement @Cache decorator with TTL support',
    maxDuration: 120,
  },
  {
    id: 'full-test',
    name: 'Test Generation',
    description: 'Generate unit tests for a function',
    category: 'test',
    complexity: 'medium',
    prompt: `Write comprehensive unit tests for this function:

\`\`\`typescript
function parseQueryString(queryString: string): Record<string, string | string[]> {
  if (!queryString || queryString === '?') return {};

  const query = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  const pairs = query.split('&');
  const result: Record<string, string | string[]> = {};

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    const decodedKey = decodeURIComponent(key);
    const decodedValue = value ? decodeURIComponent(value) : '';

    if (result[decodedKey]) {
      if (Array.isArray(result[decodedKey])) {
        (result[decodedKey] as string[]).push(decodedValue);
      } else {
        result[decodedKey] = [result[decodedKey] as string, decodedValue];
      }
    } else {
      result[decodedKey] = decodedValue;
    }
  }

  return result;
}
\`\`\`

Include edge cases and use Jest or similar testing framework.`,
    expectedOutcome: 'Should include tests for empty input, special chars, arrays, encoding',
    maxDuration: 90,
  },
  {
    id: 'full-docs',
    name: 'Documentation Generation',
    description: 'Generate API documentation for a module',
    category: 'docs',
    complexity: 'medium',
    prompt: `Generate comprehensive JSDoc documentation for this module:

\`\`\`typescript
export class EventEmitter<T extends Record<string, any>> {
  private listeners: Map<keyof T, Set<Function>> = new Map();

  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(data));
  }

  once<K extends keyof T>(event: K, listener: (data: T[K]) => void): () => void {
    const wrapper = (data: T[K]) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}
\`\`\`

Include class description, method documentation, type parameters, and usage examples.`,
    expectedOutcome: 'Should include complete JSDoc with @param, @returns, @example tags',
    maxDuration: 60,
  },
  {
    id: 'full-refactor-complex',
    name: 'Complex Refactor',
    description: 'Refactor a god class into smaller components',
    category: 'refactor',
    complexity: 'complex',
    prompt: `Refactor this monolithic class into smaller, focused components following SOLID principles:

\`\`\`typescript
class OrderProcessor {
  private db: any;

  async processOrder(orderData: any) {
    // Validate
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('No items');
    }
    if (!orderData.customer.email) {
      throw new Error('No email');
    }

    // Calculate
    let subtotal = 0;
    for (const item of orderData.items) {
      subtotal += item.price * item.quantity;
    }
    const tax = subtotal * 0.1;
    const shipping = subtotal > 100 ? 0 : 10;
    const total = subtotal + tax + shipping;

    // Save
    const order = await this.db.insert('orders', {
      ...orderData,
      subtotal,
      tax,
      shipping,
      total,
      status: 'pending'
    });

    // Notify
    await fetch('https://api.email.com/send', {
      method: 'POST',
      body: JSON.stringify({
        to: orderData.customer.email,
        subject: 'Order Confirmation',
        body: 'Your order #' + order.id + ' has been received.'
      })
    });

    // Log
    console.log('Order processed:', order.id);
    await this.db.insert('audit_log', {
      action: 'order_created',
      orderId: order.id,
      timestamp: new Date()
    });

    return order;
  }
}
\`\`\`

Provide the refactored code with separate classes/modules for validation, calculation, persistence, notification, and logging.`,
    expectedOutcome: 'Should create separate validator, calculator, repository, notifier, and logger classes',
    maxDuration: 180,
  },
];

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

// Load custom benchmark tasks from templates/benchmarks/ directory
function loadCustomTasks(chadgiDir: string): BenchmarkTask[] {
  const benchmarksDir = join(chadgiDir, 'benchmarks');
  if (!existsSync(benchmarksDir)) {
    return [];
  }

  const customTasks: BenchmarkTask[] = [];
  const files = readdirSync(benchmarksDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(benchmarksDir, file), 'utf-8');
      const task = JSON.parse(content) as BenchmarkTask;
      task.id = task.id || basename(file, '.json');
      task.category = task.category || 'custom';
      customTasks.push(task);
    } catch {
      // Ignore invalid task files
    }
  }

  return customTasks;
}

// Load benchmark history
function loadBenchmarkHistory(chadgiDir: string): BenchmarkHistory {
  const historyFile = join(chadgiDir, 'benchmark-results.json');
  if (!existsSync(historyFile)) {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      runs: [],
    };
  }

  try {
    const content = readFileSync(historyFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      runs: [],
    };
  }
}

// Save benchmark history
function saveBenchmarkHistory(chadgiDir: string, history: BenchmarkHistory): void {
  const historyFile = join(chadgiDir, 'benchmark-results.json');
  history.lastUpdated = new Date().toISOString();
  writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

// Run a single benchmark task using Claude
async function runBenchmarkTask(
  task: BenchmarkTask,
  config: BenchmarkConfig,
  dryRun: boolean = false
): Promise<TaskRunResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  if (dryRun) {
    // Simulate a run in dry-run mode
    const simulatedDuration = Math.random() * (task.maxDuration || 60) * 0.5 + 5;
    const simulatedTokens = Math.floor(Math.random() * 2000) + 500;

    return {
      taskId: task.id,
      taskName: task.name,
      category: task.category,
      status: 'success',
      durationSecs: simulatedDuration,
      inputTokens: Math.floor(simulatedTokens * 0.3),
      outputTokens: Math.floor(simulatedTokens * 0.7),
      totalTokens: simulatedTokens,
      costUsd: simulatedTokens * 0.00001, // Simulated cost
      iterationCount: 1,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  // Build the claude command
  const args = ['--print', '--output-format', 'json'];

  if (config.model) {
    args.push('--model', config.model);
  }

  if (config.maxTokens) {
    args.push('--max-turns', String(config.maxTokens));
  }

  const timeout = config.timeout || task.maxDuration || 120;

  try {
    // Run claude with the benchmark prompt
    const result = execSync(
      `claude ${args.join(' ')} "${task.prompt.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
        timeout: timeout * 1000,
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    const endTime = Date.now();
    const durationSecs = (endTime - startTime) / 1000;

    // Parse JSON output to extract metrics
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    try {
      const jsonResult = JSON.parse(result);
      inputTokens = jsonResult.usage?.input_tokens || jsonResult.input_tokens || 0;
      outputTokens = jsonResult.usage?.output_tokens || jsonResult.output_tokens || 0;
      costUsd = jsonResult.total_cost_usd || jsonResult.cost_usd || 0;
    } catch {
      // Output wasn't valid JSON, estimate tokens from response length
      const responseLength = result.length;
      outputTokens = Math.ceil(responseLength / 4); // Rough estimate: 4 chars per token
      inputTokens = Math.ceil(task.prompt.length / 4);
    }

    return {
      taskId: task.id,
      taskName: task.name,
      category: task.category,
      status: 'success',
      durationSecs,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      iterationCount: 1,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    const endTime = Date.now();
    const durationSecs = (endTime - startTime) / 1000;
    const errorMessage = (error as Error).message;

    return {
      taskId: task.id,
      taskName: task.name,
      category: task.category,
      status: errorMessage.includes('TIMEOUT') || errorMessage.includes('timed out') ? 'timeout' : 'error',
      durationSecs,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      iterationCount: 1,
      error: errorMessage,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

// Calculate category-level metrics
function calculateCategoryMetrics(results: TaskRunResult[]): Record<string, CategoryMetrics> {
  const categoryMap: Record<string, TaskRunResult[]> = {};

  for (const result of results) {
    if (!categoryMap[result.category]) {
      categoryMap[result.category] = [];
    }
    categoryMap[result.category].push(result);
  }

  const metrics: Record<string, CategoryMetrics> = {};

  for (const [category, categoryResults] of Object.entries(categoryMap)) {
    const successful = categoryResults.filter(r => r.status === 'success');
    const totalDuration = successful.reduce((a, r) => a + r.durationSecs, 0);
    const totalTokens = successful.reduce((a, r) => a + r.totalTokens, 0);
    const totalCost = successful.reduce((a, r) => a + r.costUsd, 0);

    metrics[category] = {
      tasks: categoryResults.length,
      successful: successful.length,
      failed: categoryResults.length - successful.length,
      successRate: (successful.length / categoryResults.length) * 100,
      avgDuration: successful.length > 0 ? totalDuration / successful.length : 0,
      avgTokens: successful.length > 0 ? totalTokens / successful.length : 0,
      avgCost: successful.length > 0 ? totalCost / successful.length : 0,
    };
  }

  return metrics;
}

// Run the full benchmark suite
async function runBenchmark(
  tasks: BenchmarkTask[],
  config: BenchmarkConfig,
  mode: 'quick' | 'full' | 'custom',
  dryRun: boolean = false,
  jsonMode: boolean = false
): Promise<BenchmarkRunResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const taskResults: TaskRunResult[] = [];

  const iterations = config.iterations || 1;
  const totalTaskRuns = tasks.length * iterations;

  // Create progress bar for benchmark runs
  const progress = createProgressBar(totalTaskRuns, { label: 'Benchmarking' }, jsonMode);
  let progressCount = 0;

  if (!jsonMode && !progress) {
    console.log(`${colors.cyan}Running ${tasks.length} benchmark tasks (${iterations} iteration${iterations > 1 ? 's' : ''})...${colors.reset}\n`);
  }

  for (let iter = 0; iter < iterations; iter++) {
    if (!jsonMode && !progress && iterations > 1) {
      console.log(`${colors.bold}Iteration ${iter + 1}/${iterations}${colors.reset}`);
    }

    for (const task of tasks) {
      progressCount++;
      const iterLabel = iterations > 1 ? ` [${iter + 1}/${iterations}]` : '';
      progress?.update(progressCount, `${task.name}${iterLabel}`);

      if (!jsonMode && !progress) {
        process.stdout.write(`  ${task.name}... `);
      }

      const result = await runBenchmarkTask(task, config, dryRun);
      taskResults.push(result);

      if (!jsonMode && !progress) {
        if (result.status === 'success') {
          console.log(`${colors.green}OK${colors.reset} (${formatDuration(result.durationSecs)})`);
        } else if (result.status === 'timeout') {
          console.log(`${colors.yellow}TIMEOUT${colors.reset}`);
        } else {
          console.log(`${colors.red}FAILED${colors.reset}`);
        }
      }
    }
  }

  // Complete the progress bar
  progress?.complete();

  const endTime = Date.now();
  const totalDurationSecs = (endTime - startTime) / 1000;

  const successful = taskResults.filter(r => r.status === 'success');
  const totalTokens = successful.reduce((a, r) => a + r.totalTokens, 0);
  const totalCost = successful.reduce((a, r) => a + r.costUsd, 0);

  return {
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    config,
    mode,
    totalTasks: taskResults.length,
    successfulTasks: successful.length,
    failedTasks: taskResults.length - successful.length,
    successRate: (successful.length / taskResults.length) * 100,
    totalDurationSecs,
    avgDurationSecs: successful.length > 0
      ? successful.reduce((a, r) => a + r.durationSecs, 0) / successful.length
      : 0,
    totalTokens,
    avgTokensPerTask: successful.length > 0 ? totalTokens / successful.length : 0,
    totalCostUsd: totalCost,
    avgCostPerTask: successful.length > 0 ? totalCost / successful.length : 0,
    taskResults,
    categoryBreakdown: calculateCategoryMetrics(taskResults),
  };
}

// Compare two benchmark runs
function compareBenchmarks(baseline: BenchmarkRunResult, comparison: BenchmarkRunResult): ComparisonResult {
  const categoryComparison: Record<string, { successRateDelta: number; durationDelta: number; costDelta: number }> = {};

  // Get all categories from both runs
  const allCategories = new Set([
    ...Object.keys(baseline.categoryBreakdown),
    ...Object.keys(comparison.categoryBreakdown),
  ]);

  for (const category of allCategories) {
    const baselineMetrics = baseline.categoryBreakdown[category];
    const comparisonMetrics = comparison.categoryBreakdown[category];

    categoryComparison[category] = {
      successRateDelta: (comparisonMetrics?.successRate || 0) - (baselineMetrics?.successRate || 0),
      durationDelta: (comparisonMetrics?.avgDuration || 0) - (baselineMetrics?.avgDuration || 0),
      costDelta: (comparisonMetrics?.avgCost || 0) - (baselineMetrics?.avgCost || 0),
    };
  }

  const durationDelta = comparison.avgDurationSecs - baseline.avgDurationSecs;
  const tokenDelta = comparison.avgTokensPerTask - baseline.avgTokensPerTask;
  const costDelta = comparison.avgCostPerTask - baseline.avgCostPerTask;

  return {
    baseline,
    comparison,
    successRateDelta: comparison.successRate - baseline.successRate,
    durationDelta,
    durationDeltaPct: baseline.avgDurationSecs > 0 ? (durationDelta / baseline.avgDurationSecs) * 100 : 0,
    tokenDelta,
    tokenDeltaPct: baseline.avgTokensPerTask > 0 ? (tokenDelta / baseline.avgTokensPerTask) * 100 : 0,
    costDelta,
    costDeltaPct: baseline.avgCostPerTask > 0 ? (costDelta / baseline.avgCostPerTask) * 100 : 0,
    improved: comparison.successRate >= baseline.successRate &&
              comparison.avgDurationSecs <= baseline.avgDurationSecs &&
              comparison.avgCostPerTask <= baseline.avgCostPerTask,
    categoryComparison,
  };
}

// Generate markdown report
function generateMarkdownReport(result: BenchmarkRunResult, comparison?: ComparisonResult): string {
  let report = `# ChadGI Benchmark Report\n\n`;
  report += `**Run ID:** ${result.runId}\n`;
  report += `**Date:** ${new Date(result.startedAt).toLocaleString()}\n`;
  report += `**Mode:** ${result.mode}\n`;
  if (result.config.model) {
    report += `**Model:** ${result.config.model}\n`;
  }
  report += `\n`;

  // Summary table
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Tasks | ${result.totalTasks} |\n`;
  report += `| Successful | ${result.successfulTasks} |\n`;
  report += `| Failed | ${result.failedTasks} |\n`;
  report += `| Success Rate | ${result.successRate.toFixed(1)}% |\n`;
  report += `| Total Duration | ${formatDuration(result.totalDurationSecs)} |\n`;
  report += `| Avg Duration | ${formatDuration(result.avgDurationSecs)} |\n`;
  report += `| Total Tokens | ${result.totalTokens.toLocaleString()} |\n`;
  report += `| Avg Tokens/Task | ${result.avgTokensPerTask.toFixed(0)} |\n`;
  report += `| Total Cost | ${formatCost(result.totalCostUsd)} |\n`;
  report += `| Avg Cost/Task | ${formatCost(result.avgCostPerTask)} |\n`;
  report += `\n`;

  // Category breakdown
  report += `## Category Breakdown\n\n`;
  report += `| Category | Tasks | Success Rate | Avg Duration | Avg Tokens | Avg Cost |\n`;
  report += `|----------|-------|--------------|--------------|------------|----------|\n`;
  for (const [category, metrics] of Object.entries(result.categoryBreakdown)) {
    report += `| ${category} | ${metrics.tasks} | ${metrics.successRate.toFixed(1)}% | ${formatDuration(metrics.avgDuration)} | ${metrics.avgTokens.toFixed(0)} | ${formatCost(metrics.avgCost)} |\n`;
  }
  report += `\n`;

  // Task results
  report += `## Task Results\n\n`;
  report += `| Task | Category | Status | Duration | Tokens | Cost |\n`;
  report += `|------|----------|--------|----------|--------|------|\n`;
  for (const taskResult of result.taskResults) {
    const statusIcon = taskResult.status === 'success' ? ':white_check_mark:' :
                       taskResult.status === 'timeout' ? ':hourglass:' : ':x:';
    report += `| ${taskResult.taskName} | ${taskResult.category} | ${statusIcon} ${taskResult.status} | ${formatDuration(taskResult.durationSecs)} | ${taskResult.totalTokens} | ${formatCost(taskResult.costUsd)} |\n`;
  }
  report += `\n`;

  // Comparison section
  if (comparison) {
    report += `## Comparison with Baseline\n\n`;
    report += `| Metric | Baseline | Current | Delta | % Change |\n`;
    report += `|--------|----------|---------|-------|----------|\n`;
    report += `| Success Rate | ${comparison.baseline.successRate.toFixed(1)}% | ${comparison.comparison.successRate.toFixed(1)}% | ${comparison.successRateDelta >= 0 ? '+' : ''}${comparison.successRateDelta.toFixed(1)}% | - |\n`;
    report += `| Avg Duration | ${formatDuration(comparison.baseline.avgDurationSecs)} | ${formatDuration(comparison.comparison.avgDurationSecs)} | ${comparison.durationDelta >= 0 ? '+' : ''}${comparison.durationDelta.toFixed(1)}s | ${comparison.durationDeltaPct >= 0 ? '+' : ''}${comparison.durationDeltaPct.toFixed(1)}% |\n`;
    report += `| Avg Tokens | ${comparison.baseline.avgTokensPerTask.toFixed(0)} | ${comparison.comparison.avgTokensPerTask.toFixed(0)} | ${comparison.tokenDelta >= 0 ? '+' : ''}${comparison.tokenDelta.toFixed(0)} | ${comparison.tokenDeltaPct >= 0 ? '+' : ''}${comparison.tokenDeltaPct.toFixed(1)}% |\n`;
    report += `| Avg Cost | ${formatCost(comparison.baseline.avgCostPerTask)} | ${formatCost(comparison.comparison.avgCostPerTask)} | ${comparison.costDelta >= 0 ? '+' : ''}${formatCost(comparison.costDelta)} | ${comparison.costDeltaPct >= 0 ? '+' : ''}${comparison.costDeltaPct.toFixed(1)}% |\n`;
    report += `\n`;
    report += `**Overall:** ${comparison.improved ? ':white_check_mark: Improved' : ':warning: Regression detected'}\n`;
  }

  report += `\n---\n`;
  report += `*Generated by ChadGI Benchmark*\n`;

  return report;
}

// Print benchmark results to terminal
function printBenchmarkResults(result: BenchmarkRunResult, comparison?: ComparisonResult): void {
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('               CHADGI BENCHMARK RESULTS                   ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  // Summary
  console.log(`${colors.cyan}${colors.bold}Summary${colors.reset}`);
  console.log(`  Run ID:         ${result.runId.substring(0, 8)}...`);
  console.log(`  Mode:           ${result.mode}`);
  if (result.config.model) {
    console.log(`  Model:          ${result.config.model}`);
  }
  console.log(`  Total Tasks:    ${result.totalTasks}`);
  const successColor = result.successRate >= 80 ? colors.green : result.successRate >= 50 ? colors.yellow : colors.red;
  console.log(`  Success Rate:   ${successColor}${result.successRate.toFixed(1)}%${colors.reset} (${result.successfulTasks}/${result.totalTasks})`);
  console.log(`  Total Duration: ${formatDuration(result.totalDurationSecs)}`);
  console.log(`  Avg Duration:   ${formatDuration(result.avgDurationSecs)}`);
  console.log(`  Total Tokens:   ${result.totalTokens.toLocaleString()}`);
  console.log(`  Total Cost:     ${formatCost(result.totalCostUsd)}`);
  console.log('');

  // Category breakdown
  if (Object.keys(result.categoryBreakdown).length > 0) {
    console.log(`${colors.cyan}${colors.bold}Category Breakdown${colors.reset}`);
    for (const [category, metrics] of Object.entries(result.categoryBreakdown)) {
      const catSuccessColor = metrics.successRate >= 80 ? colors.green : metrics.successRate >= 50 ? colors.yellow : colors.red;
      console.log(`  ${colors.bold}${category}${colors.reset}: ${metrics.tasks} tasks, ${catSuccessColor}${metrics.successRate.toFixed(0)}% success${colors.reset}, avg ${formatDuration(metrics.avgDuration)}`);
    }
    console.log('');
  }

  // Comparison
  if (comparison) {
    console.log(`${colors.cyan}${colors.bold}Comparison with Baseline${colors.reset}`);
    const successDeltaColor = comparison.successRateDelta >= 0 ? colors.green : colors.red;
    const durationDeltaColor = comparison.durationDelta <= 0 ? colors.green : colors.red;
    const costDeltaColor = comparison.costDelta <= 0 ? colors.green : colors.red;

    console.log(`  Success Rate: ${successDeltaColor}${comparison.successRateDelta >= 0 ? '+' : ''}${comparison.successRateDelta.toFixed(1)}%${colors.reset}`);
    console.log(`  Duration:     ${durationDeltaColor}${comparison.durationDelta >= 0 ? '+' : ''}${comparison.durationDelta.toFixed(1)}s (${comparison.durationDeltaPct >= 0 ? '+' : ''}${comparison.durationDeltaPct.toFixed(1)}%)${colors.reset}`);
    console.log(`  Cost:         ${costDeltaColor}${comparison.costDelta >= 0 ? '+' : ''}${formatCost(comparison.costDelta)} (${comparison.costDeltaPct >= 0 ? '+' : ''}${comparison.costDeltaPct.toFixed(1)}%)${colors.reset}`);

    if (comparison.improved) {
      console.log(`\n  ${colors.green}${colors.bold}Overall: Improved${colors.reset}`);
    } else {
      console.log(`\n  ${colors.yellow}${colors.bold}Overall: Regression detected${colors.reset}`);
    }
    console.log('');
  }

  // Failed tasks
  const failedTasks = result.taskResults.filter(r => r.status !== 'success');
  if (failedTasks.length > 0) {
    console.log(`${colors.red}${colors.bold}Failed Tasks${colors.reset}`);
    for (const task of failedTasks) {
      console.log(`  ${task.taskName} (${task.category}): ${task.status}`);
      if (task.error) {
        console.log(`    ${colors.dim}${task.error.substring(0, 80)}${task.error.length > 80 ? '...' : ''}${colors.reset}`);
      }
    }
    console.log('');
  }

  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}

// List available benchmark tasks
function printAvailableTasks(quickTasks: BenchmarkTask[], fullTasks: BenchmarkTask[], customTasks: BenchmarkTask[]): void {
  console.log(`${colors.cyan}${colors.bold}Available Benchmark Tasks${colors.reset}\n`);

  console.log(`${colors.bold}Quick Mode (--quick)${colors.reset}`);
  for (const task of quickTasks) {
    console.log(`  ${colors.green}${task.id}${colors.reset} - ${task.name} (${task.category}, ${task.complexity})`);
    console.log(`    ${colors.dim}${task.description}${colors.reset}`);
  }
  console.log('');

  console.log(`${colors.bold}Full Mode (--full)${colors.reset}`);
  const additionalFullTasks = fullTasks.filter(t => !quickTasks.some(q => q.id === t.id));
  if (additionalFullTasks.length > 0) {
    console.log(`  ${colors.dim}(includes all Quick tasks plus:)${colors.reset}`);
    for (const task of additionalFullTasks) {
      console.log(`  ${colors.green}${task.id}${colors.reset} - ${task.name} (${task.category}, ${task.complexity})`);
      console.log(`    ${colors.dim}${task.description}${colors.reset}`);
    }
  }
  console.log('');

  if (customTasks.length > 0) {
    console.log(`${colors.bold}Custom Tasks${colors.reset}`);
    for (const task of customTasks) {
      console.log(`  ${colors.green}${task.id}${colors.reset} - ${task.name} (${task.category}, ${task.complexity})`);
      console.log(`    ${colors.dim}${task.description}${colors.reset}`);
    }
    console.log('');
  }

  console.log(`${colors.dim}Use --tasks <id1,id2,...> to run specific tasks${colors.reset}`);
}

export async function benchmark(options: BenchmarkOptions = {}): Promise<void> {
  const chadgiDir = resolveChadgiDir(options);

  // Load custom tasks
  const customTasks = loadCustomTasks(chadgiDir);

  // List mode
  if (options.list) {
    printAvailableTasks(QUICK_BENCHMARK_TASKS, FULL_BENCHMARK_TASKS, customTasks);
    return;
  }

  // Determine which tasks to run
  let tasksToRun: BenchmarkTask[];
  let mode: 'quick' | 'full' | 'custom';

  if (options.tasks) {
    // Run specific tasks by ID
    const taskIds = options.tasks.split(',').map(id => id.trim());
    const allTasks = [...FULL_BENCHMARK_TASKS, ...customTasks];
    tasksToRun = allTasks.filter(t => taskIds.includes(t.id));
    mode = 'custom';

    if (tasksToRun.length === 0) {
      console.error(`Error: No matching tasks found for IDs: ${options.tasks}`);
      console.error('Use --list to see available task IDs.');
      process.exit(1);
    }
  } else if (options.full) {
    tasksToRun = [...FULL_BENCHMARK_TASKS, ...customTasks];
    mode = 'full';
  } else {
    // Default to quick mode
    tasksToRun = QUICK_BENCHMARK_TASKS;
    mode = 'quick';
  }

  // Build config
  const config: BenchmarkConfig = {
    model: options.model,
    timeout: options.timeout,
    iterations: options.iterations || 1,
  };

  // Run the benchmark
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('                   CHADGI BENCHMARK                       ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);
  console.log(`Mode: ${mode}`);
  console.log(`Tasks: ${tasksToRun.length}`);
  if (config.model) {
    console.log(`Model: ${config.model}`);
  }
  if (options.dryRun) {
    console.log(`${colors.yellow}(Dry run - simulated results)${colors.reset}`);
  }
  console.log('');

  const result = await runBenchmark(tasksToRun, config, mode, options.dryRun || false, options.json || false);

  // Load history for comparison
  const history = loadBenchmarkHistory(chadgiDir);
  let comparison: ComparisonResult | undefined;

  if (options.compare) {
    // Compare with specific run ID
    const baselineRun = history.runs.find(r => r.runId.startsWith(options.compare!));
    if (baselineRun) {
      comparison = compareBenchmarks(baselineRun, result);
    } else {
      console.log(`${colors.yellow}Warning: Could not find baseline run: ${options.compare}${colors.reset}`);
    }
  } else if (history.runs.length > 0) {
    // Auto-compare with most recent run of the same mode
    const previousRun = history.runs
      .filter(r => r.mode === mode)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
    if (previousRun) {
      comparison = compareBenchmarks(previousRun, result);
    }
  }

  // Save result to history (unless dry-run)
  if (!options.dryRun) {
    history.runs.push(result);
    // Keep only last 50 runs
    if (history.runs.length > 50) {
      history.runs = history.runs.slice(-50);
    }
    saveBenchmarkHistory(chadgiDir, history);
  }

  // Output results
  if (options.json) {
    const output = comparison ? { result, comparison } : result;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Print terminal output
  printBenchmarkResults(result, comparison);

  // Save markdown report if output specified
  if (options.output) {
    const report = generateMarkdownReport(result, comparison);
    writeFileSync(options.output, report);
    console.log(`\n${colors.green}Report saved to: ${options.output}${colors.reset}`);
  }
}

// Initialize benchmarks directory with sample custom task
export function initBenchmarks(chadgiDir: string): void {
  const benchmarksDir = join(chadgiDir, 'benchmarks');
  if (!existsSync(benchmarksDir)) {
    mkdirSync(benchmarksDir, { recursive: true });
  }

  const sampleTask: BenchmarkTask = {
    id: 'custom-sample',
    name: 'Sample Custom Task',
    description: 'A sample custom benchmark task - edit or delete this file',
    category: 'custom',
    complexity: 'simple',
    prompt: 'Write a simple "Hello, World!" function in JavaScript.',
    expectedOutcome: 'A function that returns or logs "Hello, World!"',
    maxDuration: 30,
  };

  const sampleFile = join(benchmarksDir, 'sample.json');
  if (!existsSync(sampleFile)) {
    writeFileSync(sampleFile, JSON.stringify(sampleTask, null, 2));
  }
}
