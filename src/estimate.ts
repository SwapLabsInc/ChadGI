import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { colors } from './utils/colors.js';
import { parseYamlNested, parseModelsByCategory } from './utils/config.js';

// Import shared types
import type {
  BaseCommandOptions,
  SessionStats,
  TaskResult,
  TaskMetrics,
  MetricsData,
} from './types/index.js';

interface EstimateOptions extends BaseCommandOptions {
  budget?: number;
  days?: number;
  category?: string;
}

// Ready task from GitHub project board
interface ReadyTask {
  number: number;
  title: string;
  url: string;
  category?: string;
  bodyLength?: number;
  model?: string;  // Selected model for this task
}

// Category statistics for estimation
interface CategoryEstimate {
  category: string;
  avgCost: number;
  minCost: number;
  maxCost: number;
  avgDuration: number;
  sampleSize: number;
  stdDevCost: number;
}

// Per-task estimate result
interface TaskEstimate {
  issueNumber: number;
  title: string;
  category: string;
  model?: string;  // Selected model for this task
  minCost: number;
  maxCost: number;
  expectedCost: number;
  minDuration: number;
  maxDuration: number;
  expectedDuration: number;
  confidence: 'high' | 'medium' | 'low';
}

// Overall estimate result
interface EstimateResult {
  tasksInQueue: number;
  totalMinCost: number;
  totalMaxCost: number;
  totalExpectedCost: number;
  totalMinDuration: number;
  totalMaxDuration: number;
  totalExpectedDuration: number;
  historicalSampleSize: number;
  confidenceLevel: number;
  taskEstimates: TaskEstimate[];
  categoryBreakdown: Record<string, { count: number; minCost: number; maxCost: number; expectedCost: number }>;
  tasksWithinBudget?: number;
  budgetLimit?: number;
}

// Default estimates when no historical data is available
const DEFAULT_ESTIMATES = {
  feature: { avgCost: 0.25, minCost: 0.10, maxCost: 0.50 },
  bug: { avgCost: 0.12, minCost: 0.05, maxCost: 0.25 },
  refactor: { avgCost: 0.30, minCost: 0.15, maxCost: 0.60 },
  docs: { avgCost: 0.08, minCost: 0.03, maxCost: 0.15 },
  test: { avgCost: 0.15, minCost: 0.08, maxCost: 0.30 },
  uncategorized: { avgCost: 0.20, minCost: 0.08, maxCost: 0.40 },
};

// Default duration estimates in seconds
const DEFAULT_DURATION_ESTIMATES = {
  feature: { avg: 600, min: 300, max: 1200 },
  bug: { avg: 300, min: 120, max: 600 },
  refactor: { avg: 480, min: 240, max: 900 },
  docs: { avg: 180, min: 60, max: 360 },
  test: { avg: 360, min: 180, max: 600 },
  uncategorized: { avg: 420, min: 180, max: 720 },
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// Load and merge data from both stats and metrics files
function loadHistoricalData(chadgiDir: string, days?: number): {
  sessions: SessionStats[];
  tasks: TaskMetrics[];
} {
  const statsFile = join(chadgiDir, 'chadgi-stats.json');
  const metricsFile = join(chadgiDir, 'chadgi-metrics.json');

  let sessions: SessionStats[] = [];
  let tasks: TaskMetrics[] = [];

  // Load session stats
  if (existsSync(statsFile)) {
    try {
      const content = readFileSync(statsFile, 'utf-8');
      sessions = JSON.parse(content);
    } catch {
      // Ignore parse errors
    }
  }

  // Load detailed metrics
  if (existsSync(metricsFile)) {
    try {
      const content = readFileSync(metricsFile, 'utf-8');
      const metricsData: MetricsData = JSON.parse(content);
      tasks = metricsData.tasks || [];
    } catch {
      // Ignore parse errors
    }
  }

  // Apply retention filter if specified
  if (days && days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    sessions = sessions.filter((s) => s.started_at >= cutoffStr);
    tasks = tasks.filter((t) => t.started_at >= cutoffStr);
  }

  return { sessions, tasks };
}

// Get tasks in the Ready column from GitHub project board
function getReadyTasks(repo: string, projectNumber: string, readyColumn: string): ReadyTask[] {
  const repoOwner = repo.split('/')[0];

  try {
    // Get all project items
    const output = execSync(
      `gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const items = JSON.parse(output);

    const readyTasks: ReadyTask[] = [];

    for (const item of items.items || []) {
      if (item.status === readyColumn && item.content?.type === 'Issue') {
        readyTasks.push({
          number: item.content.number,
          title: item.content.title,
          url: item.content.url,
        });
      }
    }

    // Get additional details for each task (category from labels, body length for complexity)
    for (const task of readyTasks) {
      try {
        const issueOutput = execSync(
          `gh issue view ${task.number} --repo "${repo}" --json labels,body`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const issueData = JSON.parse(issueOutput);

        // Extract category from labels
        const labels: string[] = issueData.labels?.map((l: { name: string }) => l.name.toLowerCase()) || [];
        if (labels.includes('feature') || labels.includes('enhancement')) {
          task.category = 'feature';
        } else if (labels.includes('bug') || labels.includes('fix')) {
          task.category = 'bug';
        } else if (labels.includes('refactor') || labels.includes('refactoring')) {
          task.category = 'refactor';
        } else if (labels.includes('docs') || labels.includes('documentation')) {
          task.category = 'docs';
        } else if (labels.includes('test') || labels.includes('testing')) {
          task.category = 'test';
        }

        // Store body length for complexity estimation
        task.bodyLength = issueData.body?.length || 0;
      } catch {
        // Ignore errors fetching issue details
      }
    }

    return readyTasks;
  } catch (error) {
    console.error(`Warning: Could not fetch tasks from project board: ${(error as Error).message}`);
    return [];
  }
}

// Calculate category-based estimates from historical data
function calculateCategoryEstimates(tasks: TaskMetrics[]): Record<string, CategoryEstimate> {
  const categoryMap: Record<string, { costs: number[]; durations: number[] }> = {};

  // Group tasks by category
  for (const task of tasks) {
    if (task.status !== 'completed') continue;

    const category = task.category || 'uncategorized';
    if (!categoryMap[category]) {
      categoryMap[category] = { costs: [], durations: [] };
    }

    if (task.cost_usd > 0) {
      categoryMap[category].costs.push(task.cost_usd);
    }
    if (task.duration_secs > 0) {
      categoryMap[category].durations.push(task.duration_secs);
    }
  }

  const estimates: Record<string, CategoryEstimate> = {};

  for (const [category, data] of Object.entries(categoryMap)) {
    if (data.costs.length === 0) continue;

    const avgCost = data.costs.reduce((a, b) => a + b, 0) / data.costs.length;
    const minCost = Math.min(...data.costs);
    const maxCost = Math.max(...data.costs);
    const stdDevCost = calculateStdDev(data.costs);

    const avgDuration = data.durations.length > 0
      ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
      : 0;

    estimates[category] = {
      category,
      avgCost,
      minCost,
      maxCost,
      avgDuration,
      sampleSize: data.costs.length,
      stdDevCost,
    };
  }

  return estimates;
}

// Calculate overall average cost from historical data
function calculateOverallEstimate(tasks: TaskMetrics[]): { avgCost: number; avgDuration: number; sampleSize: number; stdDevCost: number } {
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const costs = completedTasks.map((t) => t.cost_usd).filter((c) => c > 0);
  const durations = completedTasks.map((t) => t.duration_secs).filter((d) => d > 0);

  if (costs.length === 0) {
    return { avgCost: 0, avgDuration: 0, sampleSize: 0, stdDevCost: 0 };
  }

  return {
    avgCost: costs.reduce((a, b) => a + b, 0) / costs.length,
    avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    sampleSize: costs.length,
    stdDevCost: calculateStdDev(costs),
  };
}

// Get estimate for a single task
function getTaskEstimate(
  task: ReadyTask,
  categoryEstimates: Record<string, CategoryEstimate>,
  overallEstimate: { avgCost: number; avgDuration: number; sampleSize: number; stdDevCost: number }
): TaskEstimate {
  const category = task.category || 'uncategorized';
  let estimate: CategoryEstimate | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Try to use category-specific estimate
  if (categoryEstimates[category]) {
    estimate = categoryEstimates[category];
    confidence = estimate.sampleSize >= 10 ? 'high' : estimate.sampleSize >= 3 ? 'medium' : 'low';
  }

  // Calculate cost estimates
  let minCost: number, maxCost: number, expectedCost: number;
  let minDuration: number, maxDuration: number, expectedDuration: number;

  if (estimate && estimate.sampleSize >= 3) {
    // Use historical data with confidence intervals
    expectedCost = estimate.avgCost;
    // Use standard deviation to calculate range (1 std dev covers ~68% of data)
    const costRange = Math.max(estimate.stdDevCost, estimate.avgCost * 0.2);
    minCost = Math.max(0.01, estimate.avgCost - costRange);
    maxCost = estimate.avgCost + costRange;

    expectedDuration = estimate.avgDuration;
    minDuration = expectedDuration * 0.6;
    maxDuration = expectedDuration * 1.5;
  } else if (overallEstimate.sampleSize >= 3) {
    // Fall back to overall average
    expectedCost = overallEstimate.avgCost;
    const costRange = Math.max(overallEstimate.stdDevCost, overallEstimate.avgCost * 0.3);
    minCost = Math.max(0.01, overallEstimate.avgCost - costRange);
    maxCost = overallEstimate.avgCost + costRange;
    confidence = overallEstimate.sampleSize >= 10 ? 'medium' : 'low';

    expectedDuration = overallEstimate.avgDuration;
    minDuration = expectedDuration * 0.5;
    maxDuration = expectedDuration * 1.8;
  } else {
    // Use defaults
    const defaultCost = DEFAULT_ESTIMATES[category as keyof typeof DEFAULT_ESTIMATES] || DEFAULT_ESTIMATES.uncategorized;
    const defaultDuration = DEFAULT_DURATION_ESTIMATES[category as keyof typeof DEFAULT_DURATION_ESTIMATES] || DEFAULT_DURATION_ESTIMATES.uncategorized;

    expectedCost = defaultCost.avgCost;
    minCost = defaultCost.minCost;
    maxCost = defaultCost.maxCost;

    expectedDuration = defaultDuration.avg;
    minDuration = defaultDuration.min;
    maxDuration = defaultDuration.max;

    // Adjust based on body length (complexity heuristic)
    if (task.bodyLength && task.bodyLength > 1000) {
      const multiplier = 1 + (task.bodyLength - 1000) / 2000;
      expectedCost *= multiplier;
      minCost *= multiplier;
      maxCost *= multiplier;
      expectedDuration *= multiplier;
      minDuration *= multiplier;
      maxDuration *= multiplier;
    }

    confidence = 'low';
  }

  return {
    issueNumber: task.number,
    title: task.title,
    category,
    model: task.model,
    minCost,
    maxCost,
    expectedCost,
    minDuration,
    maxDuration,
    expectedDuration,
    confidence,
  };
}

// Generate the full estimate
function generateEstimate(
  readyTasks: ReadyTask[],
  categoryEstimates: Record<string, CategoryEstimate>,
  overallEstimate: { avgCost: number; avgDuration: number; sampleSize: number; stdDevCost: number },
  budget?: number
): EstimateResult {
  const taskEstimates: TaskEstimate[] = [];
  const categoryBreakdown: Record<string, { count: number; minCost: number; maxCost: number; expectedCost: number }> = {};

  let totalMinCost = 0;
  let totalMaxCost = 0;
  let totalExpectedCost = 0;
  let totalMinDuration = 0;
  let totalMaxDuration = 0;
  let totalExpectedDuration = 0;
  let highConfidenceCount = 0;

  for (const task of readyTasks) {
    const estimate = getTaskEstimate(task, categoryEstimates, overallEstimate);
    taskEstimates.push(estimate);

    totalMinCost += estimate.minCost;
    totalMaxCost += estimate.maxCost;
    totalExpectedCost += estimate.expectedCost;
    totalMinDuration += estimate.minDuration;
    totalMaxDuration += estimate.maxDuration;
    totalExpectedDuration += estimate.expectedDuration;

    if (estimate.confidence === 'high') highConfidenceCount++;

    // Update category breakdown
    const cat = estimate.category;
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { count: 0, minCost: 0, maxCost: 0, expectedCost: 0 };
    }
    categoryBreakdown[cat].count++;
    categoryBreakdown[cat].minCost += estimate.minCost;
    categoryBreakdown[cat].maxCost += estimate.maxCost;
    categoryBreakdown[cat].expectedCost += estimate.expectedCost;
  }

  // Calculate confidence level (percentage of tasks with high/medium confidence)
  const confidenceLevel = overallEstimate.sampleSize >= 10
    ? 85
    : overallEstimate.sampleSize >= 5
      ? 70
      : overallEstimate.sampleSize >= 3
        ? 50
        : 30;

  const result: EstimateResult = {
    tasksInQueue: readyTasks.length,
    totalMinCost,
    totalMaxCost,
    totalExpectedCost,
    totalMinDuration,
    totalMaxDuration,
    totalExpectedDuration,
    historicalSampleSize: overallEstimate.sampleSize,
    confidenceLevel,
    taskEstimates,
    categoryBreakdown,
  };

  // Calculate tasks within budget if specified
  if (budget !== undefined && budget > 0) {
    let runningCost = 0;
    let tasksWithinBudget = 0;

    // Sort by expected cost to maximize tasks within budget
    const sortedEstimates = [...taskEstimates].sort((a, b) => a.expectedCost - b.expectedCost);

    for (const estimate of sortedEstimates) {
      if (runningCost + estimate.expectedCost <= budget) {
        runningCost += estimate.expectedCost;
        tasksWithinBudget++;
      }
    }

    result.tasksWithinBudget = tasksWithinBudget;
    result.budgetLimit = budget;
  }

  return result;
}

function printEstimate(result: EstimateResult): void {
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('                  CHADGI COST ESTIMATE                     ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  // Overview
  console.log(`${colors.cyan}${colors.bold}Tasks in Ready Queue:${colors.reset} ${result.tasksInQueue}`);
  console.log('');

  if (result.tasksInQueue === 0) {
    console.log(`${colors.yellow}No tasks found in Ready column.${colors.reset}`);
    console.log('Add issues to your project board and move them to "Ready" to estimate costs.');
    return;
  }

  // Per-task estimates
  console.log(`${colors.cyan}${colors.bold}Estimated Costs by Task:${colors.reset}`);
  for (const estimate of result.taskEstimates) {
    const confidenceColor = estimate.confidence === 'high'
      ? colors.green
      : estimate.confidence === 'medium'
        ? colors.yellow
        : colors.dim;
    const categoryStr = estimate.category !== 'uncategorized' ? ` (${estimate.category})` : '';
    const modelStr = estimate.model ? ` [${estimate.model}]` : '';

    console.log(`  Task #${estimate.issueNumber}${categoryStr}${modelStr}:`);
    console.log(`    ${colors.dim}${estimate.title.substring(0, 50)}${estimate.title.length > 50 ? '...' : ''}${colors.reset}`);
    console.log(`    Cost:     ${formatCost(estimate.minCost)} - ${formatCost(estimate.maxCost)}`);
    console.log(`    Duration: ${formatDuration(estimate.minDuration)} - ${formatDuration(estimate.maxDuration)}`);
    console.log(`    ${confidenceColor}Confidence: ${estimate.confidence}${colors.reset}`);
    console.log('');
  }

  // Category breakdown
  const categories = Object.keys(result.categoryBreakdown);
  if (categories.length > 0 && !(categories.length === 1 && categories[0] === 'uncategorized')) {
    console.log(`${colors.cyan}${colors.bold}Breakdown by Category:${colors.reset}`);
    for (const [cat, breakdown] of Object.entries(result.categoryBreakdown)) {
      console.log(`  ${colors.bold}${cat}${colors.reset}: ${breakdown.count} task(s)`);
      console.log(`    Estimated: ${formatCost(breakdown.minCost)} - ${formatCost(breakdown.maxCost)}`);
    }
    console.log('');
  }

  // Total estimates
  console.log(`${colors.cyan}${colors.bold}Total Estimates:${colors.reset}`);
  console.log(`  Cost:     ${colors.green}${formatCost(result.totalMinCost)}${colors.reset} - ${colors.yellow}${formatCost(result.totalMaxCost)}${colors.reset}`);
  console.log(`  Expected: ${colors.bold}${formatCost(result.totalExpectedCost)}${colors.reset}`);
  console.log(`  Duration: ${formatDuration(result.totalMinDuration)} - ${formatDuration(result.totalMaxDuration)}`);
  console.log('');

  // Confidence and basis
  const confidenceColor = result.confidenceLevel >= 70
    ? colors.green
    : result.confidenceLevel >= 50
      ? colors.yellow
      : colors.red;

  if (result.historicalSampleSize > 0) {
    console.log(`${colors.dim}Based on ${result.historicalSampleSize} historical task(s) (${confidenceColor}${result.confidenceLevel}% confidence${colors.reset}${colors.dim})${colors.reset}`);
  } else {
    console.log(`${colors.dim}Based on default estimates (${confidenceColor}${result.confidenceLevel}% confidence${colors.reset}${colors.dim})${colors.reset}`);
    console.log(`${colors.dim}Run more tasks to improve estimate accuracy.${colors.reset}`);
  }

  // Budget info
  if (result.budgetLimit !== undefined && result.tasksWithinBudget !== undefined) {
    console.log('');
    console.log(`${colors.cyan}${colors.bold}Budget Analysis:${colors.reset}`);
    console.log(`  Budget: ${formatCost(result.budgetLimit)}`);
    console.log(`  Tasks within budget: ${colors.green}${result.tasksWithinBudget}${colors.reset} of ${result.tasksInQueue}`);

    if (result.tasksWithinBudget < result.tasksInQueue) {
      const remaining = result.tasksInQueue - result.tasksWithinBudget;
      console.log(`  ${colors.yellow}${remaining} task(s) exceed budget${colors.reset}`);
    }
  }

  console.log('');
  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}

export async function estimate(options: EstimateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  // Check if .chadgi directory exists
  if (!existsSync(chadgiDir)) {
    console.error('Error: .chadgi directory not found.');
    console.error('Run `chadgi init` to initialize ChadGI in this directory.');
    process.exit(1);
  }

  // Load config for GitHub settings and models
  let repo = 'owner/repo';
  let projectNumber = '1';
  let readyColumn = 'Ready';
  let modelsDefault = '';
  let modelsByCategory: Record<string, string> = {};

  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    repo = parseYamlNested(configContent, 'github', 'repo') || repo;
    projectNumber = parseYamlNested(configContent, 'github', 'project_number') || projectNumber;
    readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || readyColumn;
    // Load model configuration
    modelsDefault = parseYamlNested(configContent, 'models', 'default') || '';
    modelsByCategory = parseModelsByCategory(configContent);
  } else {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  // Helper function to get model for a category
  const getModelForCategory = (category?: string): string | undefined => {
    if (category && modelsByCategory[category]) {
      return modelsByCategory[category];
    }
    return modelsDefault || undefined;
  };

  // Validate repo is configured
  if (repo === 'owner/repo') {
    console.error('Error: Repository not configured in chadgi-config.yaml');
    console.error('Please set github.repo in your configuration.');
    process.exit(1);
  }

  // Load historical data
  const { sessions, tasks } = loadHistoricalData(chadgiDir, options.days);

  // Calculate estimates from historical data
  const categoryEstimates = calculateCategoryEstimates(tasks);
  const overallEstimate = calculateOverallEstimate(tasks);

  // Get tasks in Ready column
  const readyTasks = getReadyTasks(repo, projectNumber, readyColumn);

  // Filter by category if specified
  let filteredTasks = readyTasks;
  if (options.category) {
    const categoryFilter = options.category.toLowerCase();
    filteredTasks = readyTasks.filter((t) => t.category?.toLowerCase() === categoryFilter);
    if (filteredTasks.length === 0 && readyTasks.length > 0) {
      console.log(`No tasks found with category: ${options.category}`);
      console.log(`Available tasks (${readyTasks.length}) have categories: ${[...new Set(readyTasks.map((t) => t.category || 'uncategorized'))].join(', ')}`);
      return;
    }
  }

  // Add model information to tasks
  for (const task of filteredTasks) {
    task.model = getModelForCategory(task.category);
  }

  // Generate estimate
  const result = generateEstimate(filteredTasks, categoryEstimates, overallEstimate, options.budget);

  // Output as JSON if requested
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Display formatted estimate
  printEstimate(result);
}
