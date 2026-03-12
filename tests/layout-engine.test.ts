import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlow } from '../src/parser/flow-parser.js';
import { computeLayout } from '../src/layout/layout-engine.js';
import type { FlowGraph } from '../src/model/flow-graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function assertNoOverlap(graph: FlowGraph): void {
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

  const nodes = [...graph.nodes.values()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const { width: aw, height: ah } = dimensionMap[a.type] ?? { width: 200, height: 60 };
      const { width: bw, height: bh } = dimensionMap[b.type] ?? { width: 200, height: 60 };

      const overlapX =
        a.locationX < b.locationX + bw && a.locationX + aw > b.locationX;
      const overlapY =
        a.locationY < b.locationY + bh && a.locationY + ah > b.locationY;

      if (overlapX && overlapY) {
        throw new Error(
          `Nodes overlap: "${a.id}" (${a.locationX},${a.locationY}) and ` +
            `"${b.id}" (${b.locationX},${b.locationY})`,
        );
      }
    }
  }
}

// ─── T14: dagre integration ────────────────────────────────────────────────────
describe('T14: layout-engine — dagre integration', () => {
  it('returns a FlowGraph (same flowName, all nodes present)', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear_Flow');
    const laid = computeLayout(graph);

    expect(laid.flowName).toBe('Simple_Linear_Flow');
    expect(laid.nodes.size).toBe(graph.nodes.size);
  });

  it('all nodes have positive coordinates after layout', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear_Flow');
    const laid = computeLayout(graph);

    for (const node of laid.nodes.values()) {
      expect(node.locationX).toBeGreaterThanOrEqual(0);
      expect(node.locationY).toBeGreaterThanOrEqual(0);
    }
  });

  it('top-left node is at approximately (40, 40) after normalisation', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear_Flow');
    const laid = computeLayout(graph);

    const minX = Math.min(...[...laid.nodes.values()].map((n) => n.locationX));
    const minY = Math.min(...[...laid.nodes.values()].map((n) => n.locationY));

    expect(minX).toBe(40);
    expect(minY).toBe(40);
  });

  it('no two nodes overlap after layout (simple linear flow)', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear_Flow');
    const laid = computeLayout(graph);

    expect(() => assertNoOverlap(laid)).not.toThrow();
  });

  it('no two nodes overlap after layout (decision flow)', () => {
    const xml = loadFixture('decision-with-rules.flow-meta.xml');
    const graph = parseFlow(xml, 'Decision_Flow');
    const laid = computeLayout(graph);

    expect(() => assertNoOverlap(laid)).not.toThrow();
  });

  it('dagre centers nodes within their rank (start and assignment have same centerX)', () => {
    // dagre computes center coordinates; top-left x differs for nodes of different widths.
    // start (120px wide) and Assign_Set_Name (200px wide) should share the same center x.
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear_Flow');
    const laid = computeLayout(graph);

    const startNode = laid.nodes.get('start');
    const assignNode = laid.nodes.get('Assign_Set_Name');

    expect(startNode).toBeDefined();
    expect(assignNode).toBeDefined();

    // Center x = locationX + width/2
    const startCenterX = (startNode?.locationX ?? 0) + 120 / 2;
    const assignCenterX = (assignNode?.locationX ?? 0) + 200 / 2;

    // Allow ±1px rounding from dagre
    expect(Math.abs(startCenterX - assignCenterX)).toBeLessThanOrEqual(1);
  });

  it('handles a minimal flow (single start node) without crashing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <locationX>176</locationX>
    <locationY>48</locationY>
  </start>
</Flow>`;
    const graph = parseFlow(xml, 'Minimal');
    const laid = computeLayout(graph);

    expect(laid.nodes.size).toBe(1);
    const start = laid.nodes.get('start');
    expect(start?.locationX).toBe(40);
    expect(start?.locationY).toBe(40);
  });
});

// ─── T15: back-edge routing ────────────────────────────────────────────────────
describe('T15: layout-engine — back-edge routing', () => {
  it('attaches waypoints to back-edges', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');
    const laid = computeLayout(graph);

    const backEdge = laid.edges.find((e) => e.isBackEdge);
    expect(backEdge).toBeDefined();
    expect(backEdge?.waypoints).toBeDefined();
    expect(backEdge?.waypoints?.length).toBeGreaterThanOrEqual(2);
  });

  it('non-back-edges have no waypoints', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Linear_Flow');
    const laid = computeLayout(graph);

    for (const edge of laid.edges) {
      expect(edge.waypoints).toBeUndefined();
    }
  });

  it('no two nodes overlap after layout in a loop flow', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');
    const laid = computeLayout(graph);

    expect(() => assertNoOverlap(laid)).not.toThrow();
  });

  it('layout completes in under 500ms for the loop flow', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const start = Date.now();
    computeLayout(graph);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});
