import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseFlow } from '../parser/flow-parser.js';
import { computeLayout } from '../layout/layout-engine.js';
import { generateDrawio } from '../generator/drawio-generator.js';

export interface GenerateOptions {
  file: string;
  output?: string;
}

function flowNameFromPath(filePath: string): string {
  const base = basename(filePath);
  // Strip .flow-meta.xml or just the extension
  return base.replace(/\.flow-meta\.xml$/i, '').replace(/\.xml$/i, '');
}

export async function runGenerate(options: GenerateOptions): Promise<void> {
  const { file } = options;

  // Read input (throws if file doesn't exist)
  const xml = readFileSync(file, 'utf-8');

  const flowName = flowNameFromPath(file);

  // Pipeline: parse → layout → generate
  const graph = parseFlow(xml, flowName);
  const laid = computeLayout(graph);
  const drawio = generateDrawio(laid);

  // Determine output path — default to same directory as the input file
  const outputPath =
    options.output ?? join(dirname(file), `${flowName}.drawio`);

  writeFileSync(outputPath, drawio, 'utf-8');
}
