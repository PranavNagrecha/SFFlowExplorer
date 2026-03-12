#!/usr/bin/env node
import { Command } from 'commander';
import { runGenerate } from './generate.js';

const program = new Command();

program
  .name('sfflow-explorer')
  .description('Convert Salesforce Flow metadata XML into Draw.io diagrams')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate a Draw.io diagram from a Salesforce Flow metadata file')
  .option('-f, --file <path>', 'Path to the .flow-meta.xml file')
  .option('-o, --output <path>', 'Output path for the .drawio file')
  .action(async (options: { file?: string; output?: string }) => {
    if (!options.file) {
      console.error('Error: --file is required (or use --org with --flow-name)');
      process.exit(1);
    }

    try {
      const generateOpts = options.output !== undefined
        ? { file: options.file, output: options.output }
        : { file: options.file };
      await runGenerate(generateOpts);
      console.log(`Generated: ${options.output ?? options.file.replace(/\.flow-meta\.xml$/i, '.drawio')}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse();
