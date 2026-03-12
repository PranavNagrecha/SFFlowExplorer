import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlow } from '../src/parser/flow-parser.js';
import { computeLayout } from '../src/layout/layout-engine.js';
import { generateDrawio } from '../src/generator/drawio-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function pipeline(fixtureName: string, flowName: string): string {
  const xml = loadFixture(fixtureName);
  const graph = parseFlow(xml, flowName);
  const laid = computeLayout(graph);
  return generateDrawio(laid);
}

// ─── T16: mxGraphModel XML skeleton ───────────────────────────────────────────
describe('T16: drawio-generator — XML skeleton', () => {
  it('outputs a valid XML declaration', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('contains mxGraphModel root element', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('<mxGraphModel');
    expect(output).toContain('</mxGraphModel>');
  });

  it('contains the required seed mxCell elements (id=0 and id=1)', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('id="0"');
    expect(output).toContain('id="1"');
    expect(output).toContain('parent="0"');
  });

  it('wraps all cells in a <root> element', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('<root>');
    expect(output).toContain('</root>');
  });

  it('all vertex cells have parent="1"', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    const vertexMatches = [...output.matchAll(/vertex="1"/g)];
    const parent1Matches = [...output.matchAll(/parent="1"/g)];
    // All vertices + edges should have parent="1" (minus the 2 seed cells)
    expect(parent1Matches.length).toBeGreaterThanOrEqual(vertexMatches.length);
  });
});

// ─── T17: Vertex rendering ─────────────────────────────────────────────────────
describe('T17: drawio-generator — vertex rendering', () => {
  it('renders a vertex for every node in the graph', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    const vertexCount = [...output.matchAll(/vertex="1"/g)].length;
    expect(vertexCount).toBe(laid.nodes.size);
  });

  it('start node uses ellipse style', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toMatch(/id="start"[^>]*ellipse/);
  });

  it('start node has correct fill colour #D5E8D4', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    const startMatch = output.match(/id="start"[^>]*/);
    expect(startMatch?.[0]).toContain('D5E8D4');
  });

  it('assignment nodes use rounded rect style', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    // Assign_Set_Name should have rounded=1
    const assignMatch = output.match(/id="Assign_Set_Name"[^>]*/);
    expect(assignMatch?.[0]).toContain('rounded=1');
  });

  it('decision node uses rhombus style', () => {
    const output = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    const decMatch = output.match(/id="Check_Account_Type"[^>]*/);
    expect(decMatch?.[0]).toContain('rhombus');
  });

  it('decision node has correct fill colour #DAE8FC', () => {
    const output = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    const decMatch = output.match(/id="Check_Account_Type"[^>]*/);
    expect(decMatch?.[0]).toContain('DAE8FC');
  });

  it('screen node uses flowchart.display style', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    const screenMatch = output.match(/id="Screen_Confirm"[^>]*/);
    expect(screenMatch?.[0]).toContain('flowchart.display');
  });

  it('subflow node uses purple fill colour #E8DEF8', () => {
    const output = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    const subflowMatch = output.match(/id="Call_Update_Subflow"[^>]*/);
    expect(subflowMatch?.[0]).toContain('E8DEF8');
  });

  it('recordLookup node uses cylinder3 style', () => {
    const output = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    const lookupMatch = output.match(/id="Get_Contacts"[^>]*/);
    expect(lookupMatch?.[0]).toContain('cylinder3');
  });

  it('vertex has mxGeometry with x, y, width, height', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toMatch(/<mxGeometry x="\d+" y="\d+" width="\d+" height="\d+"/);
  });

  it('vertex labels are included as value attribute', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('value="Start"');
    expect(output).toContain('value="Set Name"');
    expect(output).toContain('value="Confirm Details"');
  });
});

// ─── T18: Edge rendering ───────────────────────────────────────────────────────
describe('T18: drawio-generator — edge rendering', () => {
  it('renders an edge cell for every edge in the graph', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    const edgeCount = [...output.matchAll(/edge="1"/g)].length;
    expect(edgeCount).toBe(laid.edges.length);
  });

  it('edges reference correct source and target ids', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('source="start"');
    expect(output).toContain('target="Assign_Set_Name"');
  });

  it('fault edges have dashed=1 style', () => {
    const output = pipeline('fault-path.flow-meta.xml', 'Fault_Flow');
    expect(output).toContain('dashed=1');
  });

  it('fault edges have strokeColor=#B85450', () => {
    const output = pipeline('fault-path.flow-meta.xml', 'Fault_Flow');
    expect(output).toContain('strokeColor=#B85450');
  });

  it('fault edge is labelled "Fault"', () => {
    const output = pipeline('fault-path.flow-meta.xml', 'Fault_Flow');
    expect(output).toContain('value="Fault"');
  });

  it('back-edge has curved style', () => {
    const output = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    expect(output).toContain('curved=1');
  });

  it('back-edge has Array waypoints in mxGeometry', () => {
    const output = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    expect(output).toContain('<Array as="points">');
    expect(output).toContain('<mxPoint x=');
  });

  it('decision rule edges include rule label', () => {
    const output = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    expect(output).toContain('value="Is Gold"');
    expect(output).toContain('value="Is Silver"');
  });

  it('default connector edge has "Other" label (from fixture)', () => {
    const output = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    expect(output).toContain('value="Other"');
  });

  it('all edge cells have edge="1"', () => {
    const xml = loadFixture('fault-path.flow-meta.xml');
    const graph = parseFlow(xml, 'Fault_Flow');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    const edgeCells = [...output.matchAll(/edge="1"/g)];
    expect(edgeCells.length).toBe(laid.edges.length);
  });
});

// ─── T19: Page scaling ─────────────────────────────────────────────────────────
describe('T19: drawio-generator — page scaling', () => {
  it('uses A4 dimensions for small flows (≤20 nodes)', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('pageWidth="1169"');
    expect(output).toContain('pageHeight="827"');
  });

  it('XML escapes special characters in labels', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <locationX>0</locationX>
    <locationY>0</locationY>
  </start>
  <assignments>
    <name>Assign_Special</name>
    <label>Set &amp; Update &lt;value&gt;</label>
    <locationX>0</locationX>
    <locationY>120</locationY>
  </assignments>
</Flow>`;
    const graph = parseFlow(xml, 'Special_Chars');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    // The label text in XML attribute should be escaped
    expect(output).toContain('&amp;');
    expect(output).toContain('&lt;');
    expect(output).toContain('&gt;');
  });
});
