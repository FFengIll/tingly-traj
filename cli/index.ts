#!/usr/bin/env node
// CLI for extracting and rendering rounds from Claude Code session data
import { readSessionFile, extractRounds, listRounds, extractRound } from './round-extractor.ts';
import { renderRoundToHtml, getHtmlFilename, renderFileToHtml, getFileHtmlFilename } from './html-renderer.ts';
import type { RoundListOutput } from './types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const USAGE = `
Usage: cc-pick-cli <command> [options]

Commands:
  list <file>                    List all rounds in a session file
  extract <file> <round>         Extract a specific round to stdout
  extract-all <file> [options]   Extract all rounds to JSONL files
  render <file> <round>          Render a specific round to HTML
  render-all <file> [options]    Render all rounds to separate HTML files
  render-file <file> [options]   Render entire file to a single HTML
  help                           Show this help message

Options for extract-all/render-all/render-file:
  -o, --output <dir>             Output directory (default: ./output)

Options for render/render-all/render-file:
  --theme <theme>                Theme: light or dark (default: light)

Examples:
  # List all rounds
  pnpm cli list traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl

  # Extract a specific round
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl 0 > round-0.jsonl

  # Extract all rounds to files
  pnpm cli extract-all traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -o ./output

  # Render a specific round to HTML
  pnpm cli render traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl 0 -o ./output

  # Render all rounds to separate HTML files
  pnpm cli render-all traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -o ./html --theme dark

  # Render entire file to a single HTML
  pnpm cli render-file traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -o ./html --theme dark
`;

function printRoundList(output: RoundListOutput): void {
  console.log(`\n📁 File: ${output.filePath}`);
  console.log(`📊 Total rounds: ${output.totalRounds}\n`);
  console.log('─'.repeat(80));

  for (const round of output.rounds) {
    const date = new Date(round.startTimestamp).toLocaleString();
    console.log(`\n  Round #${round.number}`);
    console.log(`  📅 ${date}`);
    console.log(`  📝 ${round.summary}`);
    console.log(`  📦 Entries: ${round.entryCount}`);
  }
  console.log('\n' + '─'.repeat(80));
}

function generateOutputFilename(sourceFile: string, roundId: number): string {
  const basename = path.basename(sourceFile, '.jsonl');
  return `${basename}-${roundId}.jsonl`;
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];

  // Common option parsing
  const parseOutputOptions = (argsRest: string[]) => {
    let outputDir = './output';
    let theme: 'light' | 'dark' = 'light';

    for (let i = 0; i < argsRest.length; i++) {
      if (argsRest[i] === '-o' || argsRest[i] === '--output') {
        if (i + 1 < argsRest.length) {
          outputDir = argsRest[i + 1];
          i++;
        } else {
          console.error('❌ Error: --output requires a path');
          process.exit(1);
        }
      } else if (argsRest[i] === '--theme') {
        if (i + 1 < argsRest.length) {
          const t = argsRest[i + 1];
          if (t === 'light' || t === 'dark') {
            theme = t;
          } else {
            console.error('❌ Error: --theme must be "light" or "dark"');
            process.exit(1);
          }
          i++;
        }
      }
    }

    return { outputDir, theme };
  };

  if (command === 'list') {
    if (args.length < 2) {
      console.error('❌ Error: File path required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    try {
      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);
      const output = listRounds(rounds, filePath);
      printRoundList(output);
    } catch (error) {
      console.error(`❌ Error reading file: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'extract') {
    if (args.length < 3) {
      console.error('❌ Error: File path and round number required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    const roundNum = parseInt(args[2], 10);

    if (isNaN(roundNum) || roundNum < 0) {
      console.error('❌ Error: Round number must be a non-negative integer');
      process.exit(1);
    }

    try {
      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);
      const content = extractRound(rounds, roundNum);

      if (content === null) {
        console.error(`❌ Error: Round ${roundNum} not found. Total rounds: ${rounds.length}`);
        process.exit(1);
      }

      console.log(content);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'extract-all') {
    if (args.length < 2) {
      console.error('❌ Error: File path required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    const { outputDir } = parseOutputOptions(args.slice(2));

    try {
      await ensureDir(outputDir);

      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);

      if (rounds.length === 0) {
        console.log('⚠️  No rounds found in file');
        process.exit(0);
      }

      console.log(`\n📁 Extracting ${rounds.length} rounds to: ${outputDir}`);
      console.log('─'.repeat(80));

      let successCount = 0;
      for (const round of rounds) {
        const content = extractRound(rounds, round.roundNumber);
        if (content) {
          const filename = generateOutputFilename(filePath, round.roundNumber);
          const outputPath = path.join(outputDir, filename);
          await fs.writeFile(outputPath, content, 'utf-8');
          successCount++;
          console.log(`  ✅ Round #${round.roundNumber} → ${filename}`);
          console.log(`     ${round.summary.substring(0, 60)}${round.summary.length > 60 ? '...' : ''}`);
        }
      }

      console.log('─'.repeat(80));
      console.log(`\n✅ Successfully extracted ${successCount}/${rounds.length} rounds\n`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'render') {
    if (args.length < 3) {
      console.error('❌ Error: File path and round number required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    const roundNum = parseInt(args[2], 10);
    const { outputDir, theme } = parseOutputOptions(args.slice(3));

    if (isNaN(roundNum) || roundNum < 0) {
      console.error('❌ Error: Round number must be a non-negative integer');
      process.exit(1);
    }

    try {
      await ensureDir(outputDir);

      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);

      const round = rounds.find((r) => r.roundNumber === roundNum);
      if (!round) {
        console.error(`❌ Error: Round ${roundNum} not found. Total rounds: ${rounds.length}`);
        process.exit(1);
      }

      const html = renderRoundToHtml(round, { theme, sourceFile: filePath });
      const filename = getHtmlFilename(filePath, roundNum);
      const outputPath = path.join(outputDir, filename);
      await fs.writeFile(outputPath, html, 'utf-8');

      console.log(`\n✅ Round #${roundNum} rendered to: ${outputPath}`);
      console.log(`   ${round.summary}\n`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'render-all') {
    if (args.length < 2) {
      console.error('❌ Error: File path required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    const { outputDir, theme } = parseOutputOptions(args.slice(2));

    try {
      await ensureDir(outputDir);

      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);

      if (rounds.length === 0) {
        console.log('⚠️  No rounds found in file');
        process.exit(0);
      }

      console.log(`\n📁 Rendering ${rounds.length} rounds to HTML: ${outputDir} (${theme} theme)`);
      console.log('─'.repeat(80));

      let successCount = 0;
      for (const round of rounds) {
        const html = renderRoundToHtml(round, { theme, sourceFile: filePath });
        const filename = getHtmlFilename(filePath, round.roundNumber);
        const outputPath = path.join(outputDir, filename);
        await fs.writeFile(outputPath, html, 'utf-8');
        successCount++;
        console.log(`  ✅ Round #${round.roundNumber} → ${filename}`);
        console.log(`     ${round.summary.substring(0, 60)}${round.summary.length > 60 ? '...' : ''}`);
      }

      console.log('─'.repeat(80));
      console.log(`\n✅ Successfully rendered ${successCount}/${rounds.length} rounds\n`);

      // Create index.html
      const indexHtml = generateIndexHtml(rounds, filePath, theme);
      const indexPath = path.join(outputDir, 'index.html');
      await fs.writeFile(indexPath, indexHtml, 'utf-8');
      console.log(`📑 Index file created: ${indexPath}\n`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'render-file') {
    if (args.length < 2) {
      console.error('❌ Error: File path required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    const { outputDir, theme } = parseOutputOptions(args.slice(2));

    try {
      await ensureDir(outputDir);

      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);

      if (rounds.length === 0) {
        console.log('⚠️  No rounds found in file');
        process.exit(0);
      }

      console.log(`\n📁 Rendering entire file to HTML: ${filePath}`);
      console.log(`   Output: ${outputDir} (${theme} theme)`);
      console.log(`   Rounds: ${rounds.length}`);

      const html = renderFileToHtml(rounds, filePath, { theme });
      const filename = getFileHtmlFilename(filePath);
      const outputPath = path.join(outputDir, filename);
      await fs.writeFile(outputPath, html, 'utf-8');

      console.log(`\n✅ File rendered to: ${outputPath}\n`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.log(USAGE);
    process.exit(1);
  }
}

function generateIndexHtml(rounds: { roundNumber: number; summary: string; entries: unknown[] }[], sourceFile: string, theme: 'light' | 'dark'): string {
  const roundLinks = rounds.map((r) => {
    const filename = getHtmlFilename(sourceFile, r.roundNumber);
    return `
      <div class="round-link">
        <a href="${filename}">
          <span class="round-num">Round #${r.roundNumber}</span>
          <span class="round-summary">${r.summary.substring(0, 80)}${r.summary.length > 80 ? '...' : ''}</span>
          <span class="round-meta">${r.entries.length} entries</span>
        </a>
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Session - ${sourceFile}</title>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f7fa;
      --text-primary: #1a1a1a;
      --text-secondary: #666666;
      --border-color: #e1e8ed;
      --accent-color: #2563eb;
      --accent-hover: #1d4ed8;
    }
    .dark-theme {
      --bg-primary: #1a1a1a;
      --bg-secondary: #2d2d2d;
      --text-primary: #e5e5e5;
      --text-secondary: #a0a0a0;
      --border-color: #404040;
      --accent-color: #3b82f6;
      --accent-hover: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      background: var(--bg-secondary);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2em;
    }
    .header .meta {
      color: var(--text-secondary);
    }
    .round-link {
      margin-bottom: 12px;
    }
    .round-link a {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 16px 20px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      text-decoration: none;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }
    .round-link a:hover {
      border-color: var(--accent-color);
      transform: translateX(4px);
    }
    .round-num {
      font-weight: 700;
      font-size: 1.1em;
      color: var(--accent-color);
    }
    .round-summary {
      flex: 1;
    }
    .round-meta {
      color: var(--text-secondary);
      font-size: 0.9em;
    }
  </style>
</head>
<body class="${theme === 'dark' ? 'dark-theme' : ''}">
  <div class="container">
    <div class="header">
      <h1>📂 Claude Code Session</h1>
      <div class="meta">${sourceFile}</div>
      <div class="meta">${rounds.length} rounds</div>
    </div>
    <div class="rounds">
      ${roundLinks}
    </div>
  </div>
</body>
</html>`;
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
