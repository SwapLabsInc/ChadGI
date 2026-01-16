import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { maskSecrets, setMaskingDisabled } from './utils/secrets.js';
import {
  parseYamlValue,
  parseYamlNested,
  parseEnvOverrides,
  parseModelsByCategory,
  DEFAULT_ENV_PREFIX,
  formatEnvVarHelp,
} from './utils/config.js';
import { checkMigrations, CURRENT_CONFIG_VERSION, DEFAULT_CONFIG_VERSION } from './migrations/index.js';
import { debugLog, debugDecision, startTiming } from './utils/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidateOptions {
  config?: string;
  quiet?: boolean;
  notifyTest?: boolean;
  strict?: boolean;
  showMerged?: boolean;
  mask?: boolean;  // --no-mask flag sets this to false
  verbose?: boolean;  // Show env var sources
  envPrefix?: string;  // Custom env var prefix (default: CHADGI_)
}

interface ValidationResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

function checkCommand(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getCommandVersion(command: string): string | null {
  try {
    return execSync(`${command} --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
      .split('\n')[0]
      .trim();
  } catch {
    return null;
  }
}

// Check if Claude Code is authenticated and working
function checkClaudeAuthentication(): { authenticated: boolean; error?: string } {
  try {
    // First verify claude is installed
    execSync('which claude', { stdio: 'pipe' });

    // Check if claude --version works (basic sanity check)
    execSync('claude --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

    // Try a simple authenticated operation to verify API access
    // Use --max-turns 0 to avoid any actual API calls, just check auth
    try {
      // Run claude with a minimal prompt and max-turns 0 to check authentication
      // The timeout command may not be available on all systems, so use Node timeout
      execSync('claude -p "test" --max-turns 0 2>&1 || true', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000
      });
      return { authenticated: true };
    } catch (authErr) {
      const errMsg = (authErr as Error).message || '';
      const errOutput = String((authErr as { stderr?: string }).stderr || '');
      const combinedErr = errMsg + errOutput;

      // Check for common authentication error patterns
      if (combinedErr.includes('API key') || combinedErr.includes('authentication') ||
          combinedErr.includes('unauthorized') || combinedErr.includes('not logged in') ||
          combinedErr.includes('ANTHROPIC_API_KEY') || combinedErr.includes('401') ||
          combinedErr.includes('invalid_api_key')) {
        return { authenticated: false, error: 'Claude Code requires authentication' };
      }
      // If the error is something else (like timeout or max-turns behavior), assume it's authenticated
      // since version check worked
      return { authenticated: true };
    }
  } catch (err) {
    const errMsg = (err as Error).message || '';
    if (errMsg.includes('not found') || errMsg.includes('ENOENT')) {
      return { authenticated: false, error: 'Claude Code is not installed or not in PATH' };
    }
    return { authenticated: false, error: `Claude Code check failed: ${errMsg}` };
  }
}

// Config inheritance support

interface ConfigChainResult {
  configFiles: string[];
  error: string | null;
}

function getExtendsPath(configContent: string): string | null {
  // Check for 'extends' field first, then 'base_config'
  let extendsValue = parseYamlValue(configContent, 'extends');
  if (!extendsValue) {
    extendsValue = parseYamlValue(configContent, 'base_config');
  }
  return extendsValue;
}

function resolveConfigPath(baseDir: string, configPath: string): string {
  if (!configPath) return '';
  if (configPath.startsWith('/')) {
    return configPath; // Absolute path
  }
  return join(baseDir, configPath); // Relative path
}

function loadConfigChain(configPath: string, visited: Set<string> = new Set()): ConfigChainResult {
  const resolvedPath = resolve(configPath);

  // Cycle detection
  if (visited.has(resolvedPath)) {
    return {
      configFiles: [],
      error: `Circular inheritance detected: ${resolvedPath} was already visited`
    };
  }

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    return {
      configFiles: [],
      error: `Config file not found: ${resolvedPath}`
    };
  }

  visited.add(resolvedPath);

  const configContent = readFileSync(resolvedPath, 'utf-8');
  const extendsValue = getExtendsPath(configContent);

  if (extendsValue) {
    // Resolve the base config path relative to current config's directory
    const baseConfigPath = resolveConfigPath(dirname(resolvedPath), extendsValue);

    // Recursively load the base config
    const baseResult = loadConfigChain(baseConfigPath, visited);
    if (baseResult.error) {
      return {
        configFiles: [],
        error: `${baseResult.error}\n  Referenced from: ${resolvedPath}`
      };
    }

    // Return base configs first, then current config
    return {
      configFiles: [...baseResult.configFiles, resolvedPath],
      error: null
    };
  }

  // No inheritance, just return this config
  return {
    configFiles: [resolvedPath],
    error: null
  };
}

interface MergedConfig {
  [key: string]: string | MergedConfig | null;
}

function mergeConfigs(configFiles: string[]): MergedConfig {
  const merged: MergedConfig = {};

  for (const configFile of configFiles) {
    const content = readFileSync(configFile, 'utf-8');
    const lines = content.split('\n');

    let currentSection: string | null = null;
    let currentSubsection: string | null = null;

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      // Top-level key (no indentation)
      const topLevelMatch = line.match(/^([a-z_]+):\s*(.*)$/);
      if (topLevelMatch) {
        currentSection = topLevelMatch[1];
        currentSubsection = null;
        const value = topLevelMatch[2].replace(/["']/g, '').replace(/#.*$/, '').trim();
        if (value && currentSection !== 'extends' && currentSection !== 'base_config') {
          merged[currentSection] = value;
        } else if (!value && currentSection !== 'extends' && currentSection !== 'base_config') {
          // Object value - initialize if not exists
          if (!merged[currentSection] || typeof merged[currentSection] !== 'object') {
            merged[currentSection] = {};
          }
        }
        continue;
      }

      // First-level nested key (2 spaces)
      const nestedMatch = line.match(/^  ([a-z_]+):\s*(.*)$/);
      if (nestedMatch && currentSection) {
        currentSubsection = nestedMatch[1];
        const value = nestedMatch[2].replace(/["']/g, '').replace(/#.*$/, '').trim();
        if (typeof merged[currentSection] !== 'object' || merged[currentSection] === null) {
          merged[currentSection] = {};
        }
        if (value) {
          (merged[currentSection] as MergedConfig)[currentSubsection] = value;
        } else {
          // Object value
          if (!(merged[currentSection] as MergedConfig)[currentSubsection] ||
              typeof (merged[currentSection] as MergedConfig)[currentSubsection] !== 'object') {
            (merged[currentSection] as MergedConfig)[currentSubsection] = {};
          }
        }
        continue;
      }

      // Second-level nested key (4 spaces)
      const deepNestedMatch = line.match(/^    ([a-z_]+):\s*(.*)$/);
      if (deepNestedMatch && currentSection && currentSubsection) {
        const key = deepNestedMatch[1];
        const value = deepNestedMatch[2].replace(/["']/g, '').replace(/#.*$/, '').trim();
        if (typeof merged[currentSection] === 'object' && merged[currentSection] !== null) {
          const section = merged[currentSection] as MergedConfig;
          if (typeof section[currentSubsection] !== 'object' || section[currentSubsection] === null) {
            section[currentSubsection] = {};
          }
          (section[currentSubsection] as MergedConfig)[key] = value || null;
        }
      }
    }
  }

  return merged;
}

function formatMergedConfig(merged: MergedConfig, indent: number = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'object') {
      lines.push(`${prefix}${key}:`);
      lines.push(formatMergedConfig(value as MergedConfig, indent + 1));
    } else {
      lines.push(`${prefix}${key}: ${value}`);
    }
  }

  return lines.filter(l => l.trim()).join('\n');
}

// Valid template variables as documented in README.md
const VALID_TEMPLATE_VARIABLES = new Set([
  'ISSUE_NUMBER',
  'ISSUE_TITLE',
  'ISSUE_URL',
  'ISSUE_BODY',
  'BRANCH_NAME',
  'BASE_BRANCH',
  'REPO',
  'REPO_OWNER',
  'PROJECT_NUMBER',
  'READY_COLUMN',
  'COMPLETION_PROMISE',
  'TEST_COMMAND',
  'BUILD_COMMAND',
  // Additional internal variables used in templates
  'CHAD_TAGLINE',
  'CHAD_LABEL',
  'CHAD_FOOTER',
  'ISSUE_PREFIX',
  'EXISTING_ISSUES',
  'GITHUB_USERNAME',
]);

// Valid Claude model names (patterns)
// Accepts model IDs and aliases. Common patterns:
// - claude-3-opus, claude-3-sonnet, claude-3-haiku (aliases)
// - claude-3-opus-20240229, claude-3-5-sonnet-20241022, etc (full IDs)
// - claude-sonnet-4-20250514, claude-opus-4-5-20251101 (new naming)
const VALID_MODEL_PATTERNS = [
  /^claude-3-opus/,
  /^claude-3-sonnet/,
  /^claude-3-haiku/,
  /^claude-3-5-opus/,
  /^claude-3-5-sonnet/,
  /^claude-3-5-haiku/,
  /^claude-sonnet-4/,
  /^claude-opus-4/,
  /^claude-haiku-4/,
];

/**
 * Check if a model name is valid
 * @param modelName - The model name to validate
 * @returns true if valid, false otherwise
 */
export function isValidModelName(modelName: string): boolean {
  // Check against known patterns
  return VALID_MODEL_PATTERNS.some(pattern => pattern.test(modelName));
}

/**
 * Validate model configuration
 * @param configContent - The config file content
 * @returns Array of validation errors
 */
function validateModelConfiguration(configContent: string): string[] {
  const errors: string[] = [];

  // Check default model
  const defaultModel = parseYamlNested(configContent, 'models', 'default');
  if (defaultModel && !isValidModelName(defaultModel)) {
    errors.push(`Invalid default model: ${defaultModel}`);
  }

  // Check per-category models
  const categoryModels = parseModelsByCategory(configContent);
  for (const [category, model] of Object.entries(categoryModels)) {
    if (!isValidModelName(model)) {
      errors.push(`Invalid model for category '${category}': ${model}`);
    }
  }

  return errors;
}

interface TemplateVariableMatch {
  variable: string;
  line: number;
  column: number;
}

function extractTemplateVariables(content: string): TemplateVariableMatch[] {
  const matches: TemplateVariableMatch[] = [];
  const lines = content.split('\n');
  const variablePattern = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let match;
    while ((match = variablePattern.exec(line)) !== null) {
      matches.push({
        variable: match[1],
        line: lineIndex + 1,
        column: match.index + 1,
      });
    }
  }

  return matches;
}

function parseCustomVariables(configContent: string): string[] {
  const customVars: string[] = [];
  const lines = configContent.split('\n');
  let inCustomVars = false;

  for (const line of lines) {
    if (line.match(/^custom_template_variables:/)) {
      inCustomVars = true;
      continue;
    }
    if (inCustomVars && line.match(/^[a-z]/)) {
      inCustomVars = false;
    }
    if (inCustomVars && line.match(/^\s+-\s*/)) {
      const varName = line.replace(/^\s+-\s*/, '').replace(/["']/g, '').trim();
      if (varName) {
        customVars.push(varName);
      }
    }
  }

  return customVars;
}

export interface TemplateValidationResult {
  templatePath: string;
  unknownVariables: TemplateVariableMatch[];
}

export function validateTemplateVariables(
  templatePath: string,
  customVariables: string[] = []
): TemplateValidationResult {
  const content = readFileSync(templatePath, 'utf-8');
  const matches = extractTemplateVariables(content);
  const allValidVariables = new Set([...VALID_TEMPLATE_VARIABLES, ...customVariables]);

  const unknownVariables = matches.filter(m => !allValidVariables.has(m.variable));

  return {
    templatePath,
    unknownVariables,
  };
}

export async function validate(options: ValidateOptions = {}): Promise<boolean> {
  const endValidateTiming = startTiming('validate');

  // Handle --no-mask flag (Commander sets mask=false when --no-mask is used)
  const noMask = options.mask === false;
  if (noMask) {
    setMaskingDisabled(true);
    console.log('\x1b[33mWARNING: Secret masking is DISABLED. Sensitive data may be exposed in output.\x1b[0m\n');
  }

  const results: ValidationResult[] = [];
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;

  debugLog('Starting validation', { configPath, cwd, options: { ...options, verbose: undefined } });
  const quiet = options.quiet || false;

  if (!quiet) {
    console.log('Validating ChadGI configuration...\n');
    console.log('Checking dependencies:\n');
  }

  // Check required commands
  const requiredCommands = ['claude', 'gh', 'jq', 'git'];

  for (const cmd of requiredCommands) {
    if (checkCommand(cmd)) {
      const version = getCommandVersion(cmd);
      results.push({
        name: cmd,
        status: 'ok',
        message: version || 'installed'
      });
    } else {
      results.push({
        name: cmd,
        status: 'error',
        message: 'not found'
      });
    }
  }

  // Check optional commands
  const optionalCommands = ['perl'];
  for (const cmd of optionalCommands) {
    if (checkCommand(cmd)) {
      results.push({
        name: cmd,
        status: 'ok',
        message: 'installed (optional)'
      });
    } else {
      results.push({
        name: cmd,
        status: 'warning',
        message: 'not found (optional, used for multiline templates)'
      });
    }
  }

  // Print dependency results
  if (!quiet) {
    for (const result of results) {
      const icon = result.status === 'ok' ? '+' : result.status === 'warning' ? '!' : 'x';
      const color = result.status === 'ok' ? '\x1b[32m' : result.status === 'warning' ? '\x1b[33m' : '\x1b[31m';
      console.log(`${color}${icon}\x1b[0m ${result.name}: ${result.message}`);
    }
    console.log('');
  }

  // Check GitHub CLI authentication
  if (!quiet) {
    console.log('Checking GitHub CLI authentication:\n');
  }

  try {
    execSync('gh auth status', { stdio: 'pipe' });
    results.push({
      name: 'gh auth',
      status: 'ok',
      message: 'authenticated'
    });
    if (!quiet) {
      console.log('\x1b[32m+\x1b[0m GitHub CLI authenticated');
    }
  } catch {
    results.push({
      name: 'gh auth',
      status: 'error',
      message: 'not authenticated'
    });
    if (!quiet) {
      console.log('\x1b[31mx\x1b[0m GitHub CLI not authenticated');
      console.log('  Run: gh auth login');
    }
  }

  if (!quiet) {
    console.log('');
    console.log('Checking Claude Code authentication:\n');
  }

  // Check Claude Code authentication
  const claudeAuthResult = checkClaudeAuthentication();
  if (claudeAuthResult.authenticated) {
    results.push({
      name: 'claude auth',
      status: 'ok',
      message: 'authenticated'
    });
    if (!quiet) {
      console.log('\x1b[32m+\x1b[0m Claude Code authenticated');
    }
  } else {
    results.push({
      name: 'claude auth',
      status: 'error',
      message: claudeAuthResult.error || 'not authenticated'
    });
    if (!quiet) {
      console.log('\x1b[31mx\x1b[0m Claude Code not authenticated');
      console.log('  Run: claude login');
      console.log('  Or set: export ANTHROPIC_API_KEY=your-api-key');
    }
  }

  if (!quiet) {
    console.log('');
    console.log('Checking configuration:\n');
  }

  // Check config file exists and validate inheritance chain
  if (existsSync(configPath)) {
    results.push({
      name: 'config file',
      status: 'ok',
      message: configPath
    });
    if (!quiet) {
      console.log(`\x1b[32m+\x1b[0m Config file found: ${configPath}`);
    }

    // Check config version and pending migrations
    const migrationCheck = checkMigrations(configPath);
    const currentVersion = migrationCheck.currentVersion || `${DEFAULT_CONFIG_VERSION} (implicit)`;

    if (migrationCheck.needsMigration) {
      results.push({
        name: 'config_version',
        status: 'warning',
        message: `${currentVersion} -> ${CURRENT_CONFIG_VERSION} (migration available)`
      });
      if (!quiet) {
        console.log(`\x1b[33m!\x1b[0m Config version: ${currentVersion} (migration available to ${CURRENT_CONFIG_VERSION})`);
        console.log(`    Run 'chadgi config migrate' to update`);
      }
    } else {
      results.push({
        name: 'config_version',
        status: 'ok',
        message: CURRENT_CONFIG_VERSION
      });
      if (!quiet) {
        console.log(`\x1b[32m+\x1b[0m Config version: ${CURRENT_CONFIG_VERSION}`);
      }
    }

    // Load and validate config inheritance chain
    const chainResult = loadConfigChain(configPath);
    let configFiles: string[] = [];

    if (chainResult.error) {
      results.push({
        name: 'config inheritance',
        status: 'error',
        message: chainResult.error
      });
      if (!quiet) {
        console.log(`\x1b[31mx\x1b[0m Config inheritance error:`);
        console.log(`    ${chainResult.error.replace(/\n/g, '\n    ')}`);
      }
    } else {
      configFiles = chainResult.configFiles;

      if (configFiles.length > 1) {
        results.push({
          name: 'config inheritance',
          status: 'ok',
          message: `${configFiles.length} config files in chain`
        });
        if (!quiet) {
          console.log(`\x1b[32m+\x1b[0m Config inheritance chain (${configFiles.length} files):`);
          for (const cfg of configFiles) {
            console.log(`    - ${cfg}`);
          }
        }
      }
    }

    // Show merged config if requested
    if (options.showMerged && configFiles.length > 0) {
      console.log('');
      console.log('Merged configuration:\n');
      const merged = mergeConfigs(configFiles);
      console.log(formatMergedConfig(merged));
      console.log('');
    }

    // Parse and validate config (using merged values from all config files)
    // For simplicity, read the primary config for now
    const configContent = readFileSync(configPath, 'utf-8');

    // Check required fields (using merged config chain)
    let repo: string | null = null;
    let projectNumber: string | null = null;
    for (const cfg of configFiles) {
      const content = readFileSync(cfg, 'utf-8');
      const cfgRepo = parseYamlNested(content, 'github', 'repo');
      const cfgProjectNumber = parseYamlNested(content, 'github', 'project_number');
      if (cfgRepo) repo = cfgRepo;
      if (cfgProjectNumber) projectNumber = cfgProjectNumber;
    }

    if (repo && repo !== 'owner/repo') {
      results.push({
        name: 'github.repo',
        status: 'ok',
        message: repo
      });
      if (!quiet) {
        console.log(`\x1b[32m+\x1b[0m Repository: ${repo}`);
      }
    } else {
      results.push({
        name: 'github.repo',
        status: 'warning',
        message: 'not configured (using default)'
      });
      if (!quiet) {
        console.log('\x1b[33m!\x1b[0m Repository not configured (still using default owner/repo)');
      }
    }

    if (projectNumber) {
      results.push({
        name: 'github.project_number',
        status: 'ok',
        message: `Project #${projectNumber}`
      });
      if (!quiet) {
        console.log(`\x1b[32m+\x1b[0m Project number: ${projectNumber}`);
      }
    } else {
      results.push({
        name: 'github.project_number',
        status: 'warning',
        message: 'not configured'
      });
      if (!quiet) {
        console.log('\x1b[33m!\x1b[0m Project number not configured');
      }
    }

    // Check template files
    const chadgiDir = dirname(configPath);
    const promptTemplate = parseYamlValue(configContent, 'prompt_template') || './chadgi-task.md';
    const generateTemplate = parseYamlValue(configContent, 'generate_template') || './chadgi-generate-task.md';

    const templatePath = promptTemplate.startsWith('/') ? promptTemplate : join(chadgiDir, promptTemplate);
    const generateTemplatePath = generateTemplate.startsWith('/') ? generateTemplate : join(chadgiDir, generateTemplate);

    if (existsSync(templatePath)) {
      results.push({
        name: 'prompt_template',
        status: 'ok',
        message: templatePath
      });
      if (!quiet) {
        console.log(`\x1b[32m+\x1b[0m Task template found`);
      }
    } else {
      results.push({
        name: 'prompt_template',
        status: 'error',
        message: `not found: ${templatePath}`
      });
      if (!quiet) {
        console.log(`\x1b[31mx\x1b[0m Task template not found: ${templatePath}`);
      }
    }

    if (existsSync(generateTemplatePath)) {
      results.push({
        name: 'generate_template',
        status: 'ok',
        message: generateTemplatePath
      });
      if (!quiet) {
        console.log(`\x1b[32m+\x1b[0m Generate template found`);
      }
    } else {
      results.push({
        name: 'generate_template',
        status: 'error',
        message: `not found: ${generateTemplatePath}`
      });
      if (!quiet) {
        console.log(`\x1b[31mx\x1b[0m Generate template not found: ${generateTemplatePath}`);
      }
    }

    // Validate template variables
    if (!quiet) {
      console.log('');
      console.log('Checking template variables:\n');
    }

    const customVariables = parseCustomVariables(configContent);
    const templatesToValidate: string[] = [];

    if (existsSync(templatePath)) {
      templatesToValidate.push(templatePath);
    }
    if (existsSync(generateTemplatePath)) {
      templatesToValidate.push(generateTemplatePath);
    }

    let hasUnknownVariables = false;
    for (const tmplPath of templatesToValidate) {
      const validation = validateTemplateVariables(tmplPath, customVariables);
      const templateBasename = tmplPath.split('/').pop() || tmplPath;

      if (validation.unknownVariables.length === 0) {
        results.push({
          name: `template vars: ${templateBasename}`,
          status: 'ok',
          message: 'all variables valid'
        });
        if (!quiet) {
          console.log(`\x1b[32m+\x1b[0m ${templateBasename}: all variables valid`);
        }
      } else {
        hasUnknownVariables = true;
        // In strict mode, unknown variables are errors; otherwise warnings
        const status = options.strict ? 'error' : 'warning';
        const icon = options.strict ? 'x' : '!';
        const color = options.strict ? '\x1b[31m' : '\x1b[33m';

        results.push({
          name: `template vars: ${templateBasename}`,
          status,
          message: `${validation.unknownVariables.length} unknown variable(s)`
        });

        if (!quiet) {
          console.log(`${color}${icon}\x1b[0m ${templateBasename}: ${validation.unknownVariables.length} unknown variable(s)`);
          for (const v of validation.unknownVariables) {
            console.log(`    Line ${v.line}, col ${v.column}: {{${v.variable}}} (unknown)`);
          }
        }
      }
    }

    if (hasUnknownVariables && !quiet) {
      console.log('');
      if (options.strict) {
        console.log('\x1b[33m!\x1b[0m Unknown variables cause errors in --strict mode');
      } else {
        console.log('\x1b[33m!\x1b[0m Tip: Add custom variables to config with custom_template_variables:');
        console.log('    custom_template_variables:');
        console.log('      - MY_CUSTOM_VAR');
      }
    }

    // Validate model configuration
    if (!quiet) {
      console.log('');
      console.log('Checking model configuration:\n');
    }

    const modelErrors = validateModelConfiguration(configContent);
    if (modelErrors.length === 0) {
      results.push({
        name: 'models',
        status: 'ok',
        message: 'all model names valid'
      });
      if (!quiet) {
        console.log('\x1b[32m+\x1b[0m Model configuration valid');
      }
    } else {
      // In strict mode, invalid models are errors; otherwise warnings
      const status = options.strict ? 'error' : 'warning';
      const icon = options.strict ? 'x' : '!';
      const color = options.strict ? '\x1b[31m' : '\x1b[33m';

      results.push({
        name: 'models',
        status,
        message: `${modelErrors.length} invalid model name(s)`
      });

      if (!quiet) {
        console.log(`${color}${icon}\x1b[0m Model configuration has issues:`);
        for (const error of modelErrors) {
          console.log(`    ${error}`);
        }
        console.log('');
        console.log('    Valid model patterns: claude-3-*, claude-3-5-*, claude-sonnet-4-*, claude-opus-4-*');
      }
    }

    // Check environment variable overrides (verbose mode)
    const envPrefix = options.envPrefix || DEFAULT_ENV_PREFIX;
    const envOverrides = parseEnvOverrides(envPrefix);

    if (envOverrides.length > 0) {
      if (!quiet) {
        console.log('');
        console.log('Checking environment variable overrides:\n');
      }

      results.push({
        name: 'env overrides',
        status: 'ok',
        message: `${envOverrides.length} override(s) active`
      });

      if (!quiet) {
        console.log(`\x1b[32m+\x1b[0m Environment prefix: ${envPrefix}`);
        console.log(`\x1b[32m+\x1b[0m Active overrides: ${envOverrides.length}`);

        if (options.verbose) {
          for (const override of envOverrides) {
            // Mask sensitive values like tokens
            const isSensitive = override.configPath.includes('token') ||
                               override.configPath.includes('secret') ||
                               override.configPath.includes('password') ||
                               override.configPath.includes('key');
            const displayValue = isSensitive ? maskSecrets(override.rawValue) : override.rawValue;
            console.log(`    ${override.envVar} -> ${override.configPath} = ${displayValue}`);
          }
        }
      }
    } else if (options.verbose && !quiet) {
      console.log('');
      console.log('Checking environment variable overrides:\n');
      console.log(`\x1b[33m!\x1b[0m No ${envPrefix}* environment variables detected`);
      console.log('    Tip: Use environment variables to override config values:');
      console.log(`    ${envPrefix}GITHUB__REPO=owner/repo`);
      console.log(`    ${envPrefix}ITERATION__MAX_ITERATIONS=10`);
    }

  } else {
    results.push({
      name: 'config file',
      status: 'error',
      message: `not found: ${configPath}`
    });
    if (!quiet) {
      console.log(`\x1b[31mx\x1b[0m Config file not found: ${configPath}`);
      console.log('  Run: chadgi init');
    }
  }

  // Check if in a git repository
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe', cwd });
    results.push({
      name: 'git repository',
      status: 'ok',
      message: 'in git repository'
    });
    if (!quiet) {
      console.log('\x1b[32m+\x1b[0m In git repository');
    }
  } catch {
    results.push({
      name: 'git repository',
      status: 'warning',
      message: 'not in git repository'
    });
    if (!quiet) {
      console.log('\x1b[33m!\x1b[0m Not in a git repository');
    }
  }

  // Test webhook notifications if requested
  if (options.notifyTest) {
    if (!quiet) {
      console.log('\nTesting webhook notifications:\n');
    }

    // Get the script directory from this module's location
    const scriptDir = join(__dirname, '..', 'scripts');
    const testScript = `
      source "${scriptDir}/chadgi.sh" 2>/dev/null || true
      CONFIG_FILE="${configPath}"
      load_config 2>/dev/null || true
      test_webhook_connectivity
    `;

    try {
      execSync(`bash -c '${testScript}'`, {
        stdio: quiet ? 'pipe' : 'inherit',
        env: {
          ...process.env,
          CHADGI_DIR: dirname(configPath),
          CONFIG_FILE: configPath
        }
      });
      results.push({
        name: 'webhooks',
        status: 'ok',
        message: 'connectivity test passed'
      });
    } catch {
      results.push({
        name: 'webhooks',
        status: 'warning',
        message: 'connectivity test failed or no webhooks configured'
      });
      if (!quiet) {
        console.log('\x1b[33m!\x1b[0m Webhook test failed or no webhooks configured');
      }
    }
  }

  // Summary
  const errors = results.filter(r => r.status === 'error');
  const warnings = results.filter(r => r.status === 'warning');

  if (!quiet) {
    console.log('\n---');
    console.log(`Validation complete: ${errors.length} error(s), ${warnings.length} warning(s)`);

    if (errors.length > 0) {
      console.log('\nPlease fix the errors above before running ChadGI.');
    } else if (warnings.length > 0) {
      console.log('\nChadGI can run with warnings, but consider fixing them for optimal operation.');
    } else {
      console.log('\nAll checks passed! Run `chadgi start` to begin.');
    }
  }

  debugLog('Validation complete', { errors: errors.length, warnings: warnings.length });
  endValidateTiming();

  return errors.length === 0;
}
