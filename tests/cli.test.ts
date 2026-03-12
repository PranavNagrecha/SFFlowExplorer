import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGenerate } from '../src/cli/generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const fixturesDir = join(__dirname, 'fixtures');
const outputPath = join(projectRoot, 'test-output.drawio');

describe('T20: CLI — generate command', () => {
  afterEach(() => {
    if (existsSync(outputPath)) unlinkSync(outputPath);
  });

  it('generates a .drawio file from a file path', async () => {
    const inputFile = join(fixturesDir, 'simple-linear.flow-meta.xml');
    await runGenerate({ file: inputFile, output: outputPath });

    expect(existsSync(outputPath)).toBe(true);
  });

  it('generated file contains valid mxGraphModel XML', async () => {
    const inputFile = join(fixturesDir, 'simple-linear.flow-meta.xml');
    await runGenerate({ file: inputFile, output: outputPath });

    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<mxGraphModel');
    expect(content).toContain('</mxGraphModel>');
  });

  it('generated file contains all flow nodes from the fixture', async () => {
    const inputFile = join(fixturesDir, 'simple-linear.flow-meta.xml');
    await runGenerate({ file: inputFile, output: outputPath });

    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('id="start"');
    expect(content).toContain('id="Assign_Set_Name"');
    expect(content).toContain('id="Assign_Set_Email"');
    expect(content).toContain('id="Screen_Confirm"');
  });

  it('defaults output path to <inputDir>/<flowName>.drawio when output is not specified', async () => {
    const inputFile = join(fixturesDir, 'simple-linear.flow-meta.xml');
    const defaultOutput = join(fixturesDir, 'simple-linear.drawio');

    try {
      await runGenerate({ file: inputFile });
      expect(existsSync(defaultOutput)).toBe(true);
    } finally {
      if (existsSync(defaultOutput)) unlinkSync(defaultOutput);
    }
  });

  it('generates a .drawio for decision flow', async () => {
    const inputFile = join(fixturesDir, 'decision-with-rules.flow-meta.xml');
    await runGenerate({ file: inputFile, output: outputPath });

    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('id="Check_Account_Type"');
    expect(content).toContain('value="Is Gold"');
    expect(content).toContain('value="Other"');
  });

  it('generates a .drawio for fault path flow with dashed red fault edge', async () => {
    const inputFile = join(fixturesDir, 'fault-path.flow-meta.xml');
    await runGenerate({ file: inputFile, output: outputPath });

    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('dashed=1');
    expect(content).toContain('strokeColor=#B85450');
  });

  it('generates a .drawio for loop+subflow flow with back-edge waypoints', async () => {
    const inputFile = join(fixturesDir, 'loop-with-subflow.flow-meta.xml');
    await runGenerate({ file: inputFile, output: outputPath });

    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<Array as="points">');
    expect(content).toContain('id="Call_Update_Subflow"');
  });

  it('throws an error when the input file does not exist', async () => {
    await expect(
      runGenerate({ file: '/nonexistent/path/Flow.flow-meta.xml', output: outputPath }),
    ).rejects.toThrow();
  });
});
