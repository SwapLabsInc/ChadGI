import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidateOptions {
  config?: string;
  quiet?: boolean;
  notifyTest?: boolean;
  strict?: boolean;
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

function parseYamlValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (match) {
    return match[1].replace(/["']/g, '').replace(/#.*$/, '').trim();
  }
  return null;
}

function parseYamlNested(content: string, parent: string, key: string): string | null {
  const lines = content.split('\n');
  let inParent = false;

  for (const line of lines) {
    if (line.match(new RegExp(`^${parent}:`))) {
      inParent = true;
      continue;
    }
    if (inParent && line.match(/^[a-z]/)) {
      inParent = false;
    }
    if (inParent && line.match(new RegExp(`^\\s+${key}:`))) {
      const value = line.split(':')[1];
      if (value) {
        return value.replace(/["']/g, '').replace(/#.*$/, '').trim();
      }
    }
  }
  return null;
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
  const results: ValidationResult[] = [];
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
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
    console.log('Checking configuration:\n');
  }

  // Check config file exists
  if (existsSync(configPath)) {
    results.push({
      name: 'config file',
      status: 'ok',
      message: configPath
    });
    if (!quiet) {
      console.log(`\x1b[32m+\x1b[0m Config file found: ${configPath}`);
    }

    // Parse and validate config
    const configContent = readFileSync(configPath, 'utf-8');

    // Check required fields
    const repo = parseYamlNested(configContent, 'github', 'repo');
    const projectNumber = parseYamlNested(configContent, 'github', 'project_number');

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

  return errors.length === 0;
}
