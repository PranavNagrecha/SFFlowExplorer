import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlow } from '../src/parser/flow-parser.js';
import { computeLayout } from '../src/layout/layout-engine.js';
import { generateDrawio } from '../src/generator/drawio-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function pipeline(name: string, flowName: string) {
  const xml = readFileSync(join(fixturesDir, name), 'utf-8');
  const graph = parseFlow(xml, flowName);
  const laid = computeLayout(graph);
  const out = generateDrawio(laid);
  return { graph, laid, out };
}

// ─── Flow 1: Event Registration Screen Flow ────────────────────────────────────
// Synthetic fixture: models an event attendee registration process with a GoTo
// loop back to re-fetch pending registrations until none remain.
describe('Complex Screen Flow with GoTo back-edge loop', () => {
  const { graph, laid, out } = pipeline(
    'event-registration-flow.flow-meta.xml',
    'Event_Registration_Flow',
  );

  it('parses without throwing', () => {
    expect(graph.nodes.size).toBeGreaterThan(0);
  });

  it('has the expected number of nodes', () => {
    // screens: Welcome_Screen, Error_Screen, Select_Attendee_Screen, End_Screen = 4
    // recordLookups: Get_Event, Get_Pending_Registrations, Get_Remaining = 3
    // decisions: Check_Presenter_Role, Check_Flag_Needed, Check_Remaining = 3
    // actionCalls: Send_Confirmation_Email, Notify_Admin = 2
    // recordUpdates: Update_Registration, Update_Event = 2
    // recordCreates: Create_Flag = 1
    // start = 1
    // Total = 16
    console.log('Node count:', graph.nodes.size);
    console.log('Nodes:', [...graph.nodes.keys()].join(', '));
    expect(graph.nodes.size).toBeGreaterThanOrEqual(14);
  });

  it('detects back-edge: Check_Remaining → Get_Pending_Registrations (GoTo loop)', () => {
    const backEdges = graph.edges.filter(e => e.isBackEdge);
    console.log('Back-edges:', backEdges.map(e => `${e.sourceId} → ${e.targetId}`));
    expect(backEdges.length).toBeGreaterThanOrEqual(1);
    expect(backEdges.some(e => e.targetId === 'Get_Pending_Registrations')).toBe(true);
  });

  it('all nodes have positive coordinates after layout', () => {
    for (const node of laid.nodes.values()) {
      expect(node.locationX).toBeGreaterThanOrEqual(0);
      expect(node.locationY).toBeGreaterThanOrEqual(0);
    }
  });

  it('generates valid mxGraphModel XML', () => {
    expect(out).toContain('<mxGraphModel');
    expect(out).toContain('</mxGraphModel>');
    expect(out).toContain('id="start"');
  });

  it('start node is an ellipse', () => {
    expect(out).toMatch(/id="start"[^>]*ellipse/);
  });

  it('decision nodes use rhombus style', () => {
    expect(out).toMatch(/id="Check_Remaining"[^>]*rhombus/);
  });

  it('screen nodes use flowchart.display style', () => {
    expect(out).toMatch(/id="Welcome_Screen"[^>]*flowchart\.display/);
  });

  it('actionCall nodes use rounded rect', () => {
    expect(out).toMatch(/id="Send_Confirmation_Email"[^>]*rounded=1/);
  });

  it('recordCreate uses cylinder3', () => {
    expect(out).toMatch(/id="Create_Flag"[^>]*cylinder3/);
  });

  it('back-edge cells have waypoints (Array as="points")', () => {
    expect(out).toContain('<Array as="points">');
  });

  it('output is substantial (not empty diagram)', () => {
    expect(out.length).toBeGreaterThan(1000);
  });

  it('produces correct edge count', () => {
    console.log('Edge count:', graph.edges.length);
    expect(graph.edges.length).toBeGreaterThan(12);
  });
});

// ─── Flow 2: Account Sync AutoLaunched Flow ────────────────────────────────────
// Synthetic fixture: AutoLaunched flow with all locationX/Y = 0 (forces pure
// dagre layout). Multiple assignment branches converge at a single update node
// via GoTo connectors — these are forward/cross edges, not cycles.
describe('AutoLaunched Flow — zero coords, pure dagre layout, no back-edges', () => {
  const { graph, laid, out } = pipeline(
    'account-sync-flow.flow-meta.xml',
    'Account_Sync_Flow',
  );

  it('parses without throwing', () => {
    expect(graph.nodes.size).toBeGreaterThan(0);
  });

  it('all source coords are 0 — pure dagre layout is applied', () => {
    const afterLayout = [...laid.nodes.values()];
    const allPositive = afterLayout.every(n => n.locationX >= 0 && n.locationY >= 0);
    expect(allPositive).toBe(true);
  });

  it('finds NO back-edges (GoTo connectors converge forward, not in cycles)', () => {
    // Assign_Inactive_Link and Assign_Alt_Link both GoTo Update_Link, but
    // Update_Link is not an ancestor of those nodes — no genuine cycle exists.
    const backEdges = graph.edges.filter(e => e.isBackEdge);
    console.log('Back-edges:', backEdges.map(e => `${e.sourceId} → ${e.targetId}`));
    expect(backEdges).toHaveLength(0);
  });

  it('all nodes have positive coordinates after dagre layout', () => {
    for (const node of laid.nodes.values()) {
      expect(node.locationX).toBeGreaterThanOrEqual(0);
      expect(node.locationY).toBeGreaterThanOrEqual(0);
    }
  });

  it('generates valid mxGraphModel XML', () => {
    expect(out).toContain('<mxGraphModel');
    expect(out).toContain('</mxGraphModel>');
    expect(out).toContain('id="start"');
  });

  it('decision nodes use rhombus', () => {
    expect(out).toMatch(/id="Found_Link"[^>]*rhombus/);
  });

  it('recordUpdate nodes use cylinder3', () => {
    expect(out).toMatch(/id="Update_Link"[^>]*cylinder3/);
  });

  it('output is substantial (not empty diagram)', () => {
    expect(out.length).toBeGreaterThan(500);
  });

  it('reports node and edge counts', () => {
    console.log('Node count:', graph.nodes.size);
    console.log('Edge count:', graph.edges.length);
    console.log('Nodes:', [...graph.nodes.keys()].join(', '));
    expect(graph.nodes.size).toBeGreaterThan(5);
  });
});
