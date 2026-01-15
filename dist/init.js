import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export async function init(options = {}) {
    const cwd = process.cwd();
    const chadgiDir = join(cwd, '.chadgi');
    const templatesDir = join(__dirname, '..', 'templates');
    console.log('Initializing ChadGI...\n');
    // Check if .chadgi directory already exists
    if (existsSync(chadgiDir) && !options.force) {
        console.log('.chadgi/ directory already exists.');
        console.log('Use --force to overwrite existing files.\n');
        return;
    }
    // Create .chadgi directory if it doesn't exist
    if (!existsSync(chadgiDir)) {
        mkdirSync(chadgiDir, { recursive: true });
        console.log('+ Created .chadgi/ directory');
    }
    // Template files to copy
    const templateFiles = [
        'chadgi-config.yaml',
        'chadgi-task.md',
        'chadgi-generate-task.md'
    ];
    for (const file of templateFiles) {
        const srcPath = join(templatesDir, file);
        const destPath = join(chadgiDir, file);
        if (existsSync(destPath) && !options.force) {
            console.log(`  Skipping ${file} (already exists)`);
            continue;
        }
        if (!existsSync(srcPath)) {
            console.log(`  Warning: Template ${file} not found`);
            continue;
        }
        copyFileSync(srcPath, destPath);
        console.log(`+ Copied ${file}`);
    }
    // Create .gitignore for the chadgi directory
    const gitignorePath = join(chadgiDir, '.gitignore');
    if (!existsSync(gitignorePath) || options.force) {
        writeFileSync(gitignorePath, `# ChadGI generated files
chadgi-progress.json
*.log
`);
        console.log('+ Created .gitignore');
    }
    console.log(`
ChadGI initialized successfully!

Next steps:
1. Edit .chadgi/chadgi-config.yaml with your repository settings
2. Run 'chadgi validate' to check your configuration
3. Run 'chadgi setup-project' to create a GitHub Project (or set up manually)
4. Run 'chadgi start' to begin the automation loop

For more information, see the README or run 'chadgi --help'
`);
}
//# sourceMappingURL=init.js.map