import { execSync } from 'child_process';
import { hyperlink } from './utils/textui.js';

interface SetupProjectOptions {
  repo?: string;
  name?: string;
}

function execCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.stderr || error.message}`);
  }
}

function execCommandSilent(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export async function setupProject(options: SetupProjectOptions = {}): Promise<void> {
  console.log('Setting up GitHub Project v2...\n');

  // Get repository
  let repo = options.repo;
  if (!repo) {
    // Try to detect from git remote
    const remoteUrl = execCommandSilent('git remote get-url origin');
    if (remoteUrl) {
      const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
      if (match) {
        repo = match[1].replace(/\.git$/, '');
      }
    }
  }

  if (!repo) {
    console.error('Error: Could not detect repository. Please specify with --repo owner/repo');
    process.exit(1);
  }

  const [owner, repoName] = repo.split('/');
  const projectName = options.name || 'ChadGI Tasks';

  console.log(`Repository: ${repo}`);
  console.log(`Project Name: ${projectName}`);
  console.log('');

  // Check if gh is authenticated
  try {
    execCommand('gh auth status');
  } catch {
    console.error('Error: GitHub CLI is not authenticated. Run `gh auth login` first.');
    process.exit(1);
  }

  // Check if project scope is available
  const scopes = execCommandSilent('gh auth status 2>&1') || '';
  if (!scopes.includes('project')) {
    console.log('Note: You may need project scope. Run: gh auth refresh -s project');
  }

  console.log('Creating project...');

  // Create the project
  let projectNumber: number;
  try {
    const createResult = execCommand(
      `gh project create --owner "${owner}" --title "${projectName}" --format json`
    );
    const project = JSON.parse(createResult);
    projectNumber = project.number;
    console.log(`+ Created project #${projectNumber}`);
  } catch (error: any) {
    console.error('Failed to create project:', error.message);
    console.log('\nYou may need to enable GitHub Projects for your organization or add project scope:');
    console.log('  gh auth refresh -s project');
    process.exit(1);
  }

  console.log('');
  console.log('Adding Status field options...');

  // Get the project ID
  const projectListJson = execCommand(
    `gh project list --owner "${owner}" --format json`
  );
  const projects = JSON.parse(projectListJson);
  const project = projects.projects.find((p: any) => p.number === projectNumber);

  if (!project) {
    console.error('Error: Could not find the created project');
    process.exit(1);
  }

  // Get field list to find Status field
  const fieldsJson = execCommand(
    `gh project field-list ${projectNumber} --owner "${owner}" --format json`
  );
  const fields = JSON.parse(fieldsJson);
  const statusField = fields.fields.find((f: any) => f.name === 'Status');

  if (!statusField) {
    console.error('Error: Status field not found in project');
    process.exit(1);
  }

  // Check existing options
  const existingOptions = statusField.options?.map((o: any) => o.name) || [];
  const requiredOptions = ['Ready', 'In progress', 'In review'];

  console.log(`Status field ID: ${statusField.id}`);
  console.log(`Existing options: ${existingOptions.join(', ') || 'none'}`);

  // Note: gh CLI doesn't have a direct way to add single-select options
  // The Status field comes pre-populated with some options
  // We'll just report what options are available

  console.log('');
  console.log('Current Status field options:');
  for (const opt of statusField.options || []) {
    const isRequired = requiredOptions.includes(opt.name);
    console.log(`  - ${opt.name}${isRequired ? ' (required by ChadGI)' : ''}`);
  }

  // Check which required options are missing
  const missingOptions = requiredOptions.filter(opt => !existingOptions.includes(opt));

  if (missingOptions.length > 0) {
    console.log('');
    console.log('Missing required options:', missingOptions.join(', '));
    console.log('');
    console.log('To add missing options manually:');
    const settingsUrl = `https://github.com/users/${owner}/projects/${projectNumber}/settings`;
    console.log(`1. Go to ${hyperlink(settingsUrl)}`);
    console.log('2. Click on "Status" field');
    console.log('3. Add the following options:');
    for (const opt of missingOptions) {
      console.log(`   - ${opt}`);
    }
  }

  console.log('');
  console.log('GitHub Project setup complete!');
  console.log('');
  console.log('Next steps:');
  console.log(`1. Update .chadgi/chadgi-config.yaml with:`);
  console.log(`   github:`);
  console.log(`     repo: ${repo}`);
  console.log(`     project_number: ${projectNumber}`);
  if (missingOptions.length > 0) {
    console.log('');
    console.log('2. Add the missing Status options via the GitHub web interface');
  }
  console.log('');
  const projectUrl = `https://github.com/users/${owner}/projects/${projectNumber}`;
  console.log(`Project URL: ${hyperlink(projectUrl)}`);
}
