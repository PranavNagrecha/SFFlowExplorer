import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlow } from '../src/parser/flow-parser.js';
import { generateDrawio } from '../src/generator/drawio-generator.js';
import { computeLayout } from '../src/layout/layout-engine.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');

// ─── Wait Element ───────────────────────────────────────────────

describe('waits element parsing', () => {
  const xml = readFileSync(join(fixturesDir, 'wait-element.flow-meta.xml'), 'utf-8');
  const graph = parseFlow(xml, 'WaitTest');

  it('creates a wait node', () => {
    const node = graph.nodes.get('Wait_for_Approval_or_Timeout');
    expect(node).toBeDefined();
    expect(node!.type).toBe('wait');
    expect(node!.label).toBe('Wait for Approval or Timeout');
  });

  it('extracts locationX/Y', () => {
    const node = graph.nodes.get('Wait_for_Approval_or_Timeout')!;
    expect(node.locationX).toBe(327);
    expect(node.locationY).toBe(200);
  });

  it('creates edges for each waitEvent (like decision rules)', () => {
    const waitEdges = graph.edges.filter(e => e.sourceId === 'Wait_for_Approval_or_Timeout' && !e.isFault);
    // 2 waitEvent edges + 1 default = 3
    expect(waitEdges.length).toBe(3);
  });

  it('labels waitEvent edges with their label', () => {
    const approvalEdge = graph.edges.find(
      e => e.sourceId === 'Wait_for_Approval_or_Timeout' && e.targetId === 'Process_Approved'
    );
    expect(approvalEdge).toBeDefined();
    expect(approvalEdge!.label).toBe('Approval Received');
  });

  it('creates a default connector edge', () => {
    const defaultEdge = graph.edges.find(
      e => e.sourceId === 'Wait_for_Approval_or_Timeout' && e.targetId === 'Send_Reminder'
    );
    expect(defaultEdge).toBeDefined();
    expect(defaultEdge!.label).toBe('Default Path');
  });

  it('creates a fault connector edge', () => {
    const faultEdge = graph.edges.find(
      e => e.sourceId === 'Wait_for_Approval_or_Timeout' && e.isFault
    );
    expect(faultEdge).toBeDefined();
    expect(faultEdge!.targetId).toBe('Log_Wait_Error');
    expect(faultEdge!.label).toBe('Fault');
  });

  it('stores metadata including elementSubtype', () => {
    const node = graph.nodes.get('Wait_for_Approval_or_Timeout')!;
    expect(node.metadata['elementSubtype']).toBe('WaitDuration');
  });
});

// ─── Custom Error Element ───────────────────────────────────────

describe('customErrors element parsing', () => {
  const xml = readFileSync(join(fixturesDir, 'custom-error-element.flow-meta.xml'), 'utf-8');
  const graph = parseFlow(xml, 'CustomErrorTest');

  it('creates customError nodes', () => {
    const node1 = graph.nodes.get('Block_Record_Save');
    const node2 = graph.nodes.get('Field_Level_Error');
    expect(node1).toBeDefined();
    expect(node2).toBeDefined();
    expect(node1!.type).toBe('customError');
    expect(node2!.type).toBe('customError');
  });

  it('parses terminal customError (no user-defined connector, only synthesised End)', () => {
    const outgoing = graph.edges.filter(e => e.sourceId === 'Block_Record_Save');
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].targetId).toBe('end__Block_Record_Save');
  });

  it('parses customError with connector', () => {
    const outgoing = graph.edges.filter(e => e.sourceId === 'Field_Level_Error');
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].targetId).toBe('Log_Error');
  });

  it('stores customErrorMessages in metadata', () => {
    const node = graph.nodes.get('Block_Record_Save')!;
    const messages = node.metadata['customErrorMessages'] as Record<string, unknown>;
    expect(messages).toBeDefined();
  });

  it('extracts label and coordinates', () => {
    const node = graph.nodes.get('Block_Record_Save')!;
    expect(node.label).toBe('Block Record Save');
    expect(node.locationX).toBe(100);
    expect(node.locationY).toBe(400);
  });
});

// ─── Transform Element ──────────────────────────────────────────

describe('transforms element parsing', () => {
  const xml = readFileSync(join(fixturesDir, 'transform-element.flow-meta.xml'), 'utf-8');
  const graph = parseFlow(xml, 'TransformTest');

  it('creates transform nodes', () => {
    const node1 = graph.nodes.get('Map_Request_To_Lead');
    const node2 = graph.nodes.get('Count_Line_Items');
    expect(node1).toBeDefined();
    expect(node2).toBeDefined();
    expect(node1!.type).toBe('transform');
    expect(node2!.type).toBe('transform');
  });

  it('parses transform with connector', () => {
    const outgoing = graph.edges.filter(e => e.sourceId === 'Map_Request_To_Lead');
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].targetId).toBe('Create_Lead');
  });

  it('parses transform without connector (terminal, gets synthesised End)', () => {
    const outgoing = graph.edges.filter(e => e.sourceId === 'Count_Line_Items');
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].targetId).toBe('end__Count_Line_Items');
  });

  it('stores objectType in metadata', () => {
    const node = graph.nodes.get('Map_Request_To_Lead')!;
    expect(node.metadata['objectType']).toBe('Lead');
  });

  it('extracts label and coordinates', () => {
    const node = graph.nodes.get('Map_Request_To_Lead')!;
    expect(node.label).toBe('Map Request to Lead');
    expect(node.locationX).toBe(300);
    expect(node.locationY).toBe(200);
  });
});

// ─── Generator: new types produce valid Draw.io XML ─────────────

describe('generator renders new element types', () => {
  it('renders wait node with teal style', () => {
    const xml = readFileSync(join(fixturesDir, 'wait-element.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'WaitTest'));
    const drawio = generateDrawio(graph);
    expect(drawio).toContain('Wait for Approval or Timeout');
    expect(drawio).toContain('#E0F2F1'); // teal fill
    expect(drawio).toContain('#00897B'); // teal border
  });

  it('renders customError node with red style', () => {
    const xml = readFileSync(join(fixturesDir, 'custom-error-element.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'CustomErrorTest'));
    const drawio = generateDrawio(graph);
    expect(drawio).toContain('Block Record Save');
    expect(drawio).toContain('#F8CECC'); // red fill (shared with recordDelete)
    // Check fault edge styling is NOT present for customError node edges (they're not fault paths)
  });

  it('renders transform node with indigo style', () => {
    const xml = readFileSync(join(fixturesDir, 'transform-element.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'TransformTest'));
    const drawio = generateDrawio(graph);
    expect(drawio).toContain('Map Request to Lead');
    expect(drawio).toContain('#E8EAF6'); // indigo fill
    expect(drawio).toContain('#3F51B5'); // indigo border
  });

  it('enriches transform label with objectType', () => {
    const xml = readFileSync(join(fixturesDir, 'transform-element.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'TransformTest'));
    const drawio = generateDrawio(graph);
    // Should show "Map Request to Lead\n⇄ Lead"
    expect(drawio).toContain('⇄ Lead');
  });

  it('enriches customError label with error message', () => {
    const xml = readFileSync(join(fixturesDir, 'custom-error-element.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'CustomErrorTest'));
    const drawio = generateDrawio(graph);
    // Should show error message as sublabel
    expect(drawio).toContain('⚠');
  });

  it('produces valid mxGraphModel XML for all new types', () => {
    for (const fixture of ['wait-element', 'custom-error-element', 'transform-element']) {
      const xml = readFileSync(join(fixturesDir, `${fixture}.flow-meta.xml`), 'utf-8');
      const graph = computeLayout(parseFlow(xml, fixture));
      const drawio = generateDrawio(graph);
      expect(drawio).toContain('<mxGraphModel');
      expect(drawio).toContain('</mxGraphModel>');
      expect(drawio).toContain('<root>');
    }
  });
});

// ─── Integration: full pipeline with real org flow ──────────────

describe('real-world flow with waits (Sample_Status_Subflow)', () => {
  const realFlowPath = '/Users/user/VS Code/PRD/ExampleOrgPrd/force-app/main/default/flows/Sample_Status_Subflow.flow-meta.xml';
  let graph: ReturnType<typeof parseFlow>;

  it('parses without throwing', () => {
    const xml = readFileSync(realFlowPath, 'utf-8');
    expect(() => {
      graph = parseFlow(xml, 'Sample_Status_Subflow');
    }).not.toThrow();
  });

  it('finds wait nodes in real flow', () => {
    const xml = readFileSync(realFlowPath, 'utf-8');
    graph = parseFlow(xml, 'Sample_Status_Subflow');
    const waitNodes = [...graph.nodes.values()].filter(n => n.type === 'wait');
    expect(waitNodes.length).toBeGreaterThan(0);
  });

  it('generates Draw.io XML without throwing', () => {
    const xml = readFileSync(realFlowPath, 'utf-8');
    graph = parseFlow(xml, 'Sample_Status_Subflow');
    const laid = computeLayout(graph);
    expect(() => generateDrawio(laid)).not.toThrow();
  });
});

describe('real-world flow with customErrors', () => {
  const realFlowPath = '/Users/user/VS Code/PRD/ExampleOrgPrd/force-app/main/default/flows/Sample_Opportunity_Update_Flow.flow-meta.xml';

  it('parses and finds customError nodes', () => {
    const xml = readFileSync(realFlowPath, 'utf-8');
    const graph = parseFlow(xml, 'Sample_Opportunity_Update_Flow');
    const errorNodes = [...graph.nodes.values()].filter(n => n.type === 'customError');
    expect(errorNodes.length).toBeGreaterThan(0);
  });

  it('generates Draw.io XML without throwing', () => {
    const xml = readFileSync(realFlowPath, 'utf-8');
    const graph = parseFlow(xml, 'Sample_Opportunity_Update_Flow');
    const laid = computeLayout(graph);
    expect(() => generateDrawio(laid)).not.toThrow();
  });
});
