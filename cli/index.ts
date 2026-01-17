#!/usr/bin/env node
// CLI for extracting rounds from Claude Code session data
import { readSessionFile, extractRounds, listRounds, extractRound } from './round-extractor.ts';
import type { RoundListOutput } from './types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const USAGE = `
Usage: cc-pick-cli <command> [options]

Commands:
  list <file>                    List all rounds in a session file
  extract <file> <round>         Extract a specific round to stdout
  extract-all <file> [options]   Extract all rounds to files
  help                           Show this help message

Options for extract-all:
  -o, --output <dir>             Output directory (default: ./output)
  --format <name>                File naming format: name, number, or summary (default: number)

Examples:
  # List all rounds
  pnpm cli list traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl

  # Extract a specific round to stdout
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl 1 > round-1.jsonl

  # Extract all rounds to default directory (./output)
  pnpm cli extract-all traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl

  # Extract all rounds to custom directory
  pnpm cli extract-all traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -o ./rounds
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

/**
 * Generate output filename for a round
 * Format: <basename>-<id>.jsonl
 */
function generateOutputFilename(sourceFile: string, roundId: number): string {
  const basename = path.basename(sourceFile, '.jsonl');
  return `${basename}-${roundId}.jsonl`;
}

/**
 * Sanitize summary for use in filename
 */
function sanitizeSummary(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .substring(0, 50); // Limit length
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

    if (isNaN(roundNum) || roundNum < 1) {
      console.error('❌ Error: Round number must be a positive integer');
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

    // Parse options
    let outputDir = './output';
    const argsRest = args.slice(2);
    for (let i = 0; i < argsRest.length; i++) {
      if (argsRest[i] === '-o' || argsRest[i] === '--output') {
        if (i + 1 < argsRest.length) {
          outputDir = argsRest[i + 1];
          i++;
        } else {
          console.error('❌ Error: --output requires a directory path');
          process.exit(1);
        }
      }
    }

    try {
      // Ensure output directory exists
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
  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.log(USAGE);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
