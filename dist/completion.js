// Shell completion script generation for ChadGI
// Supports Bash, Zsh, and Fish shells
// All ChadGI commands with their descriptions
const COMMANDS = [
    { name: 'init', description: 'Initialize ChadGI in the current directory' },
    { name: 'setup', description: 'Interactive configuration wizard' },
    { name: 'start', description: 'Start the ChadGI automation loop' },
    { name: 'setup-project', description: 'Create a GitHub Project v2' },
    { name: 'validate', description: 'Validate dependencies and configuration' },
    { name: 'stats', description: 'View historical session statistics' },
    { name: 'history', description: 'View task execution history' },
    { name: 'insights', description: 'Display performance analytics' },
    { name: 'pause', description: 'Pause ChadGI after current task' },
    { name: 'resume', description: 'Resume a paused ChadGI session' },
    { name: 'status', description: 'Show current ChadGI session state' },
    { name: 'watch', description: 'Monitor a running session in real-time' },
    { name: 'doctor', description: 'Run comprehensive health checks' },
    { name: 'cleanup', description: 'Clean up stale branches and files' },
    { name: 'estimate', description: 'Estimate API costs for tasks' },
    { name: 'queue', description: 'View and manage the task queue' },
    { name: 'config', description: 'Manage ChadGI configuration' },
    { name: 'completion', description: 'Generate shell completion scripts' },
];
// Queue subcommands
const QUEUE_SUBCOMMANDS = [
    { name: 'list', description: 'List tasks in the Ready column' },
    { name: 'skip', description: 'Move a task back to Backlog' },
    { name: 'promote', description: 'Move a task to the front of the queue' },
];
// Config subcommands
const CONFIG_SUBCOMMANDS = [
    { name: 'export', description: 'Export configuration to a portable format' },
    { name: 'import', description: 'Import configuration from an exported bundle' },
];
// Completion subcommands
const COMPLETION_SUBCOMMANDS = [
    { name: 'bash', description: 'Generate Bash completion script' },
    { name: 'zsh', description: 'Generate Zsh completion script' },
    { name: 'fish', description: 'Generate Fish completion script' },
];
// Common options used across multiple commands
const COMMON_OPTIONS = [
    { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
    { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
    { short: '-h', long: '--help', description: 'Display help information', hasArg: false },
];
// Command-specific options
const COMMAND_OPTIONS = {
    init: [
        { short: '-f', long: '--force', description: 'Overwrite existing configuration files', hasArg: false },
    ],
    setup: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-n', long: '--non-interactive', description: 'Use sensible defaults for CI', hasArg: false },
        { short: '-r', long: '--reconfigure', description: 'Reconfigure a specific section', hasArg: true, values: ['github', 'branch', 'budget', 'notifications'] },
    ],
    start: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-d', long: '--dry-run', description: 'Run in dry-run mode', hasArg: false },
        { short: '-t', long: '--timeout', description: 'Override task timeout in minutes', hasArg: true },
        { long: '--debug', description: 'Enable debug log level', hasArg: false },
        { long: '--ignore-deps', description: 'Process tasks regardless of dependency status', hasArg: false },
    ],
    'setup-project': [
        { short: '-r', long: '--repo', description: 'Repository (owner/repo)', hasArg: true },
        { short: '-n', long: '--name', description: 'Project name', hasArg: true },
    ],
    validate: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { long: '--notify-test', description: 'Test webhook connectivity', hasArg: false },
        { long: '--strict', description: 'Treat unknown template variables as errors', hasArg: false },
        { long: '--show-merged', description: 'Display final merged config', hasArg: false },
    ],
    stats: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-l', long: '--last', description: 'Show only the last N sessions', hasArg: true },
        { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
    ],
    history: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-l', long: '--limit', description: 'Number of entries to show', hasArg: true },
        { short: '-s', long: '--since', description: 'Show tasks since (e.g., 7d, 2w, 1m)', hasArg: true },
        { long: '--status', description: 'Filter by outcome', hasArg: true, values: ['success', 'failed', 'skipped'] },
        { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
    ],
    insights: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
        { short: '-e', long: '--export', description: 'Export metrics data to file', hasArg: true },
        { short: '-d', long: '--days', description: 'Show only data from the last N days', hasArg: true },
        { long: '--category', description: 'Filter by task category', hasArg: true, values: ['bug', 'feature', 'refactor', 'docs', 'test'] },
    ],
    pause: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-f', long: '--for', description: 'Auto-resume after duration (e.g., 30m, 2h)', hasArg: true },
        { short: '-r', long: '--reason', description: 'Reason for pausing', hasArg: true },
    ],
    resume: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { long: '--restart', description: 'Start ChadGI if not currently running', hasArg: false },
    ],
    status: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
    ],
    watch: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output as JSON (requires --once)', hasArg: false },
        { short: '-o', long: '--once', description: 'Show current status once', hasArg: false },
        { short: '-i', long: '--interval', description: 'Refresh interval in milliseconds', hasArg: true },
    ],
    doctor: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output health report as JSON', hasArg: false },
        { long: '--fix', description: 'Auto-remediate simple issues', hasArg: false },
    ],
    cleanup: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { long: '--branches', description: 'Delete orphaned feature branches', hasArg: false },
        { long: '--diagnostics', description: 'Remove old diagnostic artifacts', hasArg: false },
        { long: '--logs', description: 'Remove rotated log files', hasArg: false },
        { long: '--all', description: 'Run all cleanup operations', hasArg: false },
        { long: '--dry-run', description: 'Preview without making changes', hasArg: false },
        { long: '--yes', description: 'Skip confirmation prompts', hasArg: false },
        { long: '--days', description: 'Retention days for diagnostics', hasArg: true },
        { short: '-j', long: '--json', description: 'Output results as JSON', hasArg: false },
    ],
    estimate: [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
        { short: '-b', long: '--budget', description: 'Show how many tasks fit within budget', hasArg: true },
        { short: '-d', long: '--days', description: 'Use only historical data from last N days', hasArg: true },
        { long: '--category', description: 'Filter by task category', hasArg: true, values: ['bug', 'feature', 'refactor', 'docs', 'test'] },
    ],
    'queue list': [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output as JSON', hasArg: false },
        { short: '-l', long: '--limit', description: 'Show only the first N tasks', hasArg: true },
    ],
    'queue skip': [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output result as JSON', hasArg: false },
    ],
    'queue promote': [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-j', long: '--json', description: 'Output result as JSON', hasArg: false },
    ],
    'config export': [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-e', long: '--exclude-secrets', description: 'Strip sensitive data from export', hasArg: false },
        { short: '-o', long: '--output', description: 'Output file path', hasArg: true },
        { short: '-f', long: '--format', description: 'Output format', hasArg: true, values: ['json', 'yaml'] },
    ],
    'config import': [
        { short: '-c', long: '--config', description: 'Path to config file', hasArg: true },
        { short: '-m', long: '--merge', description: 'Merge with existing config', hasArg: false },
        { short: '-d', long: '--dry-run', description: 'Preview changes without writing', hasArg: false },
    ],
};
// Generate Bash completion script
function generateBashCompletion() {
    const commandNames = COMMANDS.map(c => c.name).join(' ');
    const queueSubcommands = QUEUE_SUBCOMMANDS.map(c => c.name).join(' ');
    const configSubcommands = CONFIG_SUBCOMMANDS.map(c => c.name).join(' ');
    const completionSubcommands = COMPLETION_SUBCOMMANDS.map(c => c.name).join(' ');
    // Build option lists for each command
    const commandOptionsStr = [];
    for (const [cmd, opts] of Object.entries(COMMAND_OPTIONS)) {
        const optNames = opts.map(o => o.short ? `${o.short} ${o.long}` : o.long).join(' ');
        commandOptionsStr.push(`      ${cmd.replace(' ', '_')}) opts="${optNames}" ;;`);
    }
    return `# ChadGI Bash completion script
# Generated by chadgi completion bash
#
# Installation:
#   eval "$(chadgi completion bash)"
# Or add to ~/.bashrc:
#   source <(chadgi completion bash)
# Or save to a file:
#   chadgi completion bash > /etc/bash_completion.d/chadgi

_chadgi_completions() {
    local cur prev words cword
    _get_comp_words_by_ref -n : cur prev words cword 2>/dev/null || {
        cur="\${COMP_WORDS[COMP_CWORD]}"
        prev="\${COMP_WORDS[COMP_CWORD-1]}"
        words=("\${COMP_WORDS[@]}")
        cword=$COMP_CWORD
    }

    local commands="${commandNames}"
    local queue_subcommands="${queueSubcommands}"
    local config_subcommands="${configSubcommands}"
    local completion_subcommands="${completionSubcommands}"

    # Handle subcommand completions
    if [[ \${cword} -ge 2 ]]; then
        local main_cmd="\${words[1]}"

        case "\$main_cmd" in
            queue)
                if [[ \${cword} -eq 2 ]]; then
                    COMPREPLY=( \$(compgen -W "\${queue_subcommands}" -- "\${cur}") )
                    return 0
                fi
                ;;
            config)
                if [[ \${cword} -eq 2 ]]; then
                    COMPREPLY=( \$(compgen -W "\${config_subcommands}" -- "\${cur}") )
                    return 0
                fi
                ;;
            completion)
                if [[ \${cword} -eq 2 ]]; then
                    COMPREPLY=( \$(compgen -W "\${completion_subcommands}" -- "\${cur}") )
                    return 0
                fi
                ;;
        esac
    fi

    # Complete option values
    case "\${prev}" in
        -c|--config)
            # Complete file paths for config option
            COMPREPLY=( \$(compgen -f -- "\${cur}") )
            return 0
            ;;
        -o|--output)
            # Complete file paths for output option
            COMPREPLY=( \$(compgen -f -- "\${cur}") )
            return 0
            ;;
        -e|--export)
            # Complete file paths for export option
            COMPREPLY=( \$(compgen -f -- "\${cur}") )
            return 0
            ;;
        -f|--format)
            COMPREPLY=( \$(compgen -W "json yaml" -- "\${cur}") )
            return 0
            ;;
        --status)
            COMPREPLY=( \$(compgen -W "success failed skipped" -- "\${cur}") )
            return 0
            ;;
        --category)
            COMPREPLY=( \$(compgen -W "bug feature refactor docs test" -- "\${cur}") )
            return 0
            ;;
        -r|--reconfigure)
            COMPREPLY=( \$(compgen -W "github branch budget notifications" -- "\${cur}") )
            return 0
            ;;
    esac

    # Complete options for commands
    if [[ "\${cur}" == -* ]]; then
        local opts=""
        local cmd_key=""

        if [[ \${cword} -ge 2 ]]; then
            local main_cmd="\${words[1]}"
            local sub_cmd="\${words[2]:-}"

            # Check for subcommand first
            if [[ "\$main_cmd" == "queue" && -n "\$sub_cmd" && "\$sub_cmd" != -* ]]; then
                cmd_key="queue_\$sub_cmd"
            elif [[ "\$main_cmd" == "config" && -n "\$sub_cmd" && "\$sub_cmd" != -* ]]; then
                cmd_key="config_\$sub_cmd"
            else
                cmd_key="\$main_cmd"
            fi
        fi

        case "\$cmd_key" in
${commandOptionsStr.join('\n')}
        esac

        COMPREPLY=( \$(compgen -W "\${opts}" -- "\${cur}") )
        return 0
    fi

    # Complete main commands at position 1
    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=( \$(compgen -W "\${commands}" -- "\${cur}") )
        return 0
    fi
}

complete -F _chadgi_completions chadgi
`;
}
// Generate Zsh completion script
function generateZshCompletion() {
    // Build command descriptions
    const commandDescs = COMMANDS.map(c => `'${c.name}:${c.description}'`).join('\n        ');
    const queueSubDescs = QUEUE_SUBCOMMANDS.map(c => `'${c.name}:${c.description}'`).join('\n            ');
    const configSubDescs = CONFIG_SUBCOMMANDS.map(c => `'${c.name}:${c.description}'`).join('\n            ');
    const completionSubDescs = COMPLETION_SUBCOMMANDS.map(c => `'${c.name}:${c.description}'`).join('\n            ');
    // Build option specs for each command
    const buildZshOptions = (opts) => {
        return opts.map(opt => {
            const shortPart = opt.short ? `${opt.short}` : '';
            const longPart = opt.long;
            const argPart = opt.hasArg ? (opt.values ? `:(${opt.values.join(' ')})` : ':file:_files') : '';
            if (shortPart && longPart) {
                return `'(${shortPart} ${longPart})'{${shortPart},${longPart}}'[${opt.description}]${argPart}'`;
            }
            else if (longPart) {
                return `'${longPart}[${opt.description}]${argPart}'`;
            }
            return '';
        }).filter(Boolean).join('\n            ');
    };
    return `#compdef chadgi
# ChadGI Zsh completion script
# Generated by chadgi completion zsh
#
# Installation:
#   eval "$(chadgi completion zsh)"
# Or add to ~/.zshrc:
#   source <(chadgi completion zsh)
# Or save to a file:
#   chadgi completion zsh > ~/.zsh/completions/_chadgi
#   (Make sure ~/.zsh/completions is in your $fpath)

_chadgi() {
    local -a commands
    local -a queue_commands
    local -a config_commands
    local -a completion_commands

    commands=(
        ${commandDescs}
    )

    queue_commands=(
            ${queueSubDescs}
    )

    config_commands=(
            ${configSubDescs}
    )

    completion_commands=(
            ${completionSubDescs}
    )

    _arguments -C \\
        '1: :->command' \\
        '*: :->args'

    case \$state in
        command)
            _describe -t commands 'chadgi command' commands
            ;;
        args)
            case \$words[2] in
                init)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['init'])}
                    ;;
                setup)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['setup'])}
                    ;;
                start)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['start'])}
                    ;;
                setup-project)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['setup-project'])}
                    ;;
                validate)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['validate'])}
                    ;;
                stats)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['stats'])}
                    ;;
                history)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['history'])}
                    ;;
                insights)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['insights'])}
                    ;;
                pause)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['pause'])}
                    ;;
                resume)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['resume'])}
                    ;;
                status)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['status'])}
                    ;;
                watch)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['watch'])}
                    ;;
                doctor)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['doctor'])}
                    ;;
                cleanup)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['cleanup'])}
                    ;;
                estimate)
                    _arguments \\
                        ${buildZshOptions(COMMAND_OPTIONS['estimate'])}
                    ;;
                queue)
                    if (( CURRENT == 3 )); then
                        _describe -t queue-commands 'queue command' queue_commands
                    else
                        case \$words[3] in
                            list)
                                _arguments \\
                                    ${buildZshOptions(COMMAND_OPTIONS['queue list'])}
                                ;;
                            skip|promote)
                                _arguments \\
                                    ${buildZshOptions(COMMAND_OPTIONS['queue skip'])} \\
                                    '1:issue number:'
                                ;;
                        esac
                    fi
                    ;;
                config)
                    if (( CURRENT == 3 )); then
                        _describe -t config-commands 'config command' config_commands
                    else
                        case \$words[3] in
                            export)
                                _arguments \\
                                    ${buildZshOptions(COMMAND_OPTIONS['config export'])}
                                ;;
                            import)
                                _arguments \\
                                    ${buildZshOptions(COMMAND_OPTIONS['config import'])} \\
                                    '1:config file:_files'
                                ;;
                        esac
                    fi
                    ;;
                completion)
                    if (( CURRENT == 3 )); then
                        _describe -t completion-commands 'shell' completion_commands
                    fi
                    ;;
            esac
            ;;
    esac
}

_chadgi "\$@"
`;
}
// Generate Fish completion script
function generateFishCompletion() {
    // Build command completions
    const commandCompletions = COMMANDS.map(c => `complete -c chadgi -n "__fish_use_subcommand" -a "${c.name}" -d "${c.description}"`).join('\n');
    // Build queue subcommand completions
    const queueCompletions = QUEUE_SUBCOMMANDS.map(c => `complete -c chadgi -n "__fish_seen_subcommand_from queue; and not __fish_seen_subcommand_from ${QUEUE_SUBCOMMANDS.map(s => s.name).join(' ')}" -a "${c.name}" -d "${c.description}"`).join('\n');
    // Build config subcommand completions
    const configCompletions = CONFIG_SUBCOMMANDS.map(c => `complete -c chadgi -n "__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from ${CONFIG_SUBCOMMANDS.map(s => s.name).join(' ')}" -a "${c.name}" -d "${c.description}"`).join('\n');
    // Build completion subcommand completions
    const completionCompletions = COMPLETION_SUBCOMMANDS.map(c => `complete -c chadgi -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from ${COMPLETION_SUBCOMMANDS.map(s => s.name).join(' ')}" -a "${c.name}" -d "${c.description}"`).join('\n');
    // Build option completions for each command
    const buildFishOptions = (cmd, opts) => {
        return opts.map(opt => {
            const parts = [`complete -c chadgi -n "__fish_seen_subcommand_from ${cmd.split(' ')[0]}"`];
            if (opt.short)
                parts.push(`-s ${opt.short.replace('-', '')}`);
            parts.push(`-l ${opt.long.replace(/^--/, '')}`);
            parts.push(`-d "${opt.description}"`);
            if (opt.hasArg) {
                if (opt.values) {
                    parts.push(`-xa "${opt.values.join(' ')}"`);
                }
                else if (opt.long === '--config' || opt.long === '--output' || opt.long === '--export') {
                    parts.push(`-rF`); // Require argument, complete files
                }
                else {
                    parts.push(`-r`); // Require argument
                }
            }
            return parts.join(' ');
        }).join('\n');
    };
    const optionCompletions = Object.entries(COMMAND_OPTIONS)
        .filter(([cmd]) => !cmd.includes(' ')) // Main commands only
        .map(([cmd, opts]) => buildFishOptions(cmd, opts))
        .join('\n\n');
    return `# ChadGI Fish completion script
# Generated by chadgi completion fish
#
# Installation:
#   chadgi completion fish > ~/.config/fish/completions/chadgi.fish

# Disable default file completion
complete -c chadgi -f

# Main commands
${commandCompletions}

# Queue subcommands
${queueCompletions}

# Config subcommands
${configCompletions}

# Completion subcommands
${completionCompletions}

# Option completions
${optionCompletions}

# Value completions for specific options
complete -c chadgi -n "__fish_seen_subcommand_from history" -l status -xa "success failed skipped" -d "Filter by outcome"
complete -c chadgi -n "__fish_seen_subcommand_from insights estimate" -l category -xa "bug feature refactor docs test" -d "Filter by category"
complete -c chadgi -n "__fish_seen_subcommand_from config" -l format -xa "json yaml" -d "Output format"
complete -c chadgi -n "__fish_seen_subcommand_from setup" -l reconfigure -xa "github branch budget notifications" -d "Section to reconfigure"
`;
}
// Print installation instructions
function printInstallInstructions(shell) {
    console.log(`# ChadGI ${shell.charAt(0).toUpperCase() + shell.slice(1)} Completion`);
    console.log('#');
    console.log('# Installation:');
    switch (shell) {
        case 'bash':
            console.log('#   Option 1: Add to ~/.bashrc (recommended)');
            console.log('#     eval "$(chadgi completion bash)"');
            console.log('#');
            console.log('#   Option 2: Source from a file');
            console.log('#     chadgi completion bash > ~/.local/share/bash-completion/completions/chadgi');
            console.log('#');
            console.log('#   Option 3: System-wide installation (requires root)');
            console.log('#     sudo chadgi completion bash > /etc/bash_completion.d/chadgi');
            break;
        case 'zsh':
            console.log('#   Option 1: Add to ~/.zshrc (recommended)');
            console.log('#     eval "$(chadgi completion zsh)"');
            console.log('#');
            console.log('#   Option 2: Save to completions directory');
            console.log('#     mkdir -p ~/.zsh/completions');
            console.log('#     chadgi completion zsh > ~/.zsh/completions/_chadgi');
            console.log('#     # Add to ~/.zshrc: fpath=(~/.zsh/completions $fpath)');
            break;
        case 'fish':
            console.log('#   Save to Fish completions directory:');
            console.log('#     chadgi completion fish > ~/.config/fish/completions/chadgi.fish');
            break;
    }
    console.log('#');
}
export async function completion(shell) {
    const shellLower = shell.toLowerCase();
    switch (shellLower) {
        case 'bash':
            console.log(generateBashCompletion());
            break;
        case 'zsh':
            console.log(generateZshCompletion());
            break;
        case 'fish':
            console.log(generateFishCompletion());
            break;
        default:
            console.error(`Error: Unknown shell "${shell}"`);
            console.error('Supported shells: bash, zsh, fish');
            console.error('');
            console.error('Usage:');
            console.error('  chadgi completion bash   # Generate Bash completions');
            console.error('  chadgi completion zsh    # Generate Zsh completions');
            console.error('  chadgi completion fish   # Generate Fish completions');
            console.error('');
            console.error('Installation:');
            console.error('  # Bash (add to ~/.bashrc)');
            console.error('  eval "$(chadgi completion bash)"');
            console.error('');
            console.error('  # Zsh (add to ~/.zshrc)');
            console.error('  eval "$(chadgi completion zsh)"');
            console.error('');
            console.error('  # Fish');
            console.error('  chadgi completion fish > ~/.config/fish/completions/chadgi.fish');
            process.exit(1);
    }
}
export function getInstallationInstructions() {
    return `Shell Completion Installation
=============================

ChadGI supports shell completions for Bash, Zsh, and Fish.

Bash
----
Add to ~/.bashrc:
  eval "$(chadgi completion bash)"

Or save to a file:
  chadgi completion bash > ~/.local/share/bash-completion/completions/chadgi

Zsh
---
Add to ~/.zshrc:
  eval "$(chadgi completion zsh)"

Or save to completions directory:
  mkdir -p ~/.zsh/completions
  chadgi completion zsh > ~/.zsh/completions/_chadgi
  # Then add to ~/.zshrc: fpath=(~/.zsh/completions $fpath)

Fish
----
Save to Fish completions directory:
  chadgi completion fish > ~/.config/fish/completions/chadgi.fish

After installation, restart your shell or source your shell config file.
`;
}
//# sourceMappingURL=completion.js.map