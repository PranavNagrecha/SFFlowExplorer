/**
 * Integration tests for all four quality improvements.
 * Runs the full pipeline on tests/fixtures/lead-qualification.flow-meta.xml
 * and validates all improvements end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlow } from '../src/parser/flow-parser.js';
import { computeLayout } from '../src/layout/layout-engine.js';
import { generateDrawio } from '../src/generator/drawio-generator.js';
import type { FlowGraph } from '../src/model/flow-graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function pipeline(fixtureName: string, flowName: string): { graph: FlowGraph; output: string } {
  const xml = loadFixture(fixtureName);
  const graph = parseFlow(xml, flowName);
  const laid = computeLayout(graph);
  const output = generateDrawio(laid);
  return { graph: laid, output };
}

const dimensionMap: Record<string, { width: number; height: number }> = {
  start: { width: 120, height: 60 },
  decision: { width: 200, height: 100 },
  assignment: { width: 200, height: 60 },
  loop: { width: 200, height: 80 },
  recordCreate: { width: 200, height: 70 },
  recordUpdate: { width: 200, height: 70 },
  recordDelete: { width: 200, height: 70 },
  recordLookup: { width: 200, height: 70 },
  screen: { width: 200, height: 70 },
  actionCall: { width: 200, height: 60 },
  subflow: { width: 200, height: 60 },
  collectionProcessor: { width: 200, height: 60 },
  end: { width: 120, height: 60 },
};

function assertNoOverlap(graph: FlowGraph): void {
  const nodes = [...graph.nodes.values()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const { width: aw, height: ah } = dimensionMap[a.type] ?? { width: 200, height: 60 };
      const { width: bw, height: bh } = dimensionMap[b.type] ?? { width: 200, height: 60 };

      const overlapX = a.locationX < b.locationX + bw && a.locationX + aw > b.locationX;
      const overlapY = a.locationY < b.locationY + bh && a.locationY + ah > b.locationY;

      if (overlapX && overlapY) {
        throw new Error(
          `Nodes overlap: "${a.id}" (${a.locationX},${a.locationY}) and ` +
            `"${b.id}" (${b.locationX},${b.locationY})`,
        );
      }
    }
  }
}

describe('Quality Improvements — Integration Tests (lead-qualification)', () => {
  // ── Improvement 1: Variable Legend ───────────────────────────────────────
  it('output contains a Variables legend (the flow has variables)', () => {
    const { output } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toContain('id="legend__container"');
    expect(output).toContain('value="Variables"');
  });

  it('legend has exactly 4 rows (one per variable)', () => {
    const { output } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    const rows = [...output.matchAll(/id="legend__row__/g)];
    expect(rows.length).toBe(4);
  });

  // ── Improvement 2: Fault Path Segregation ────────────────────────────────
  it('fault-path: Screen_Error has higher locationX than Update_Contact', () => {
    const { graph } = pipeline('fault-path.flow-meta.xml', 'Fault_Flow');

    const screenError = graph.nodes.get('Screen_Error')!;
    const updateContact = graph.nodes.get('Update_Contact')!;

    expect(screenError.locationX).toBeGreaterThan(
      updateContact.locationX + 200,
    );
  });

  // ── Improvement 3: Richer Node Labels ────────────────────────────────────
  it('Get_Lead_Source_Config label contains Lead_Source_Config__c (enriched recordLookup)', () => {
    const { output } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toContain('Lead_Source_Config__c');
    // The cell for Get_Lead_Source_Config specifically
    expect(output).toMatch(/id="Get_Lead_Source_Config"[^>]*value="[^"]*Lead_Source_Config__c/);
  });

  it('Notify_Sales_Rep label contains emailSimple (enriched actionCall)', () => {
    const { output } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toMatch(/id="Notify_Sales_Rep"[^>]*value="[^"]*emailSimple/);
  });

  it('Update_Lead_Score label contains ✎ (enriched recordUpdate)', () => {
    const { output } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toMatch(/id="Update_Lead_Score"[^>]*value="[^"]*✎/);
  });

  // ── Improvement 4: Fan-out equalization ──────────────────────────────────
  it('Assign_High_Score, Assign_Medium_Score, Assign_Low_Score have equal horizontal spacing (within 10px)', () => {
    const { graph } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');

    const high = graph.nodes.get('Assign_High_Score')!.locationX;
    const mid = graph.nodes.get('Assign_Medium_Score')!.locationX;
    const low = graph.nodes.get('Assign_Low_Score')!.locationX;

    const xs = [high, mid, low].sort((a, b) => a - b);
    const spacing1 = xs[1]! - xs[0]!;
    const spacing2 = xs[2]! - xs[1]!;

    expect(Math.abs(spacing1 - spacing2)).toBeLessThanOrEqual(10);
  });

  // ── All-in: no overlaps ────────────────────────────────────────────────
  it('no two nodes overlap in lead-qualification layout', () => {
    const { graph } = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(() => assertNoOverlap(graph)).not.toThrow();
  });
});

describe('Quality Improvements — Existing tests still pass (regression guard)', () => {
  it('simple-linear pipeline produces valid XML skeleton', () => {
    const { output } = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(output).toContain('<mxGraphModel');
    expect(output).toContain('</mxGraphModel>');
  });

  it('fault-path pipeline renders dashed fault edges', () => {
    const { output } = pipeline('fault-path.flow-meta.xml', 'Fault_Flow');
    expect(output).toContain('dashed=1');
    expect(output).toContain('strokeColor=#B85450');
  });

  it('decision-with-rules pipeline renders rule labels', () => {
    const { output } = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    expect(output).toContain('value="Is Gold"');
    expect(output).toContain('value="Is Silver"');
  });

  it('loop-with-subflow pipeline includes back-edge waypoints', () => {
    const { output } = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    expect(output).toContain('<Array as="points">');
  });
});
