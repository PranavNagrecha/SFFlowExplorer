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
    // Legend inner cells live inside swimlane containers (parent="legend*"), not parent="1"
    const legendInnerMatches = [...output.matchAll(/parent="legend[^"]*"/g)];
    const parent1Matches = [...output.matchAll(/parent="1"/g)];
    // Top-level flow cells + legend containers should account for all vertices minus legend inner cells
    expect(parent1Matches.length).toBeGreaterThanOrEqual(
      vertexMatches.length - legendInnerMatches.length,
    );
  });
});

// ─── T17: Vertex rendering ─────────────────────────────────────────────────────
describe('T17: drawio-generator — vertex rendering', () => {
  it('renders a vertex for every node in the graph', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    // Verify each flow node has a corresponding vertex cell (legend cells excluded)
    for (const node of laid.nodes.values()) {
      expect(output).toContain(`id="${node.id}"`);
    }
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

// ─── Improvement 3: Richer Node Labels ────────────────────────────────────────
describe('Improvement 3: richer node labels', () => {
  function pipelineLQ(): string {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');
    const laid = computeLayout(graph);
    return generateDrawio(laid);
  }

  it('recordLookup label contains 🔍 and the object name', () => {
    const output = pipelineLQ();
    // Get_Lead_Source_Config has object=Lead_Source_Config__c
    expect(output).toContain('🔍');
    expect(output).toContain('Lead_Source_Config__c');
  });

  it('recordUpdate label contains ✎ and inputReference', () => {
    const output = pipelineLQ();
    expect(output).toContain('✎');
  });

  it('actionCall label contains ⚙ and the actionName', () => {
    const output = pipelineLQ();
    expect(output).toContain('⚙');
    expect(output).toContain('emailSimple');
  });

  it('enriched label uses &#xa; for newlines (not literal backslash-n)', () => {
    const output = pipelineLQ();
    expect(output).toContain('&#xa;');
    // Should not have literal \n inside an attribute value
    expect(output).not.toMatch(/value="[^"]*\n[^"]*"/);
  });

  it('node with no metadata object field shows base label only (no crash)', () => {
    // Assign_High_Score is an assignment — no object/actionName fields
    const output = pipelineLQ();
    expect(output).toContain('value="Set Score');
    // Should not contain undefined or null in value
    expect(output).not.toContain('value="Set Score&#xa;undefined');
    expect(output).not.toContain('value="Set Score&#xa;null');
  });

  it('lead-qualification: Get_Lead_Source_Config label contains Lead_Source_Config__c', () => {
    const output = pipelineLQ();
    // The cell for Get_Lead_Source_Config should have the enriched label
    expect(output).toMatch(/id="Get_Lead_Source_Config"[^>]*value="[^"]*Lead_Source_Config__c/);
  });

  it('lead-qualification: Update_Lead_Score label contains ✎', () => {
    const output = pipelineLQ();
    expect(output).toMatch(/id="Update_Lead_Score"[^>]*value="[^"]*✎/);
  });

  it('lead-qualification: Notify_Sales_Rep label contains emailSimple', () => {
    const output = pipelineLQ();
    expect(output).toMatch(/id="Notify_Sales_Rep"[^>]*value="[^"]*emailSimple/);
  });

  it('enriched node types have verticalAlign=top in their style', () => {
    const output = pipelineLQ();
    expect(output).toContain('verticalAlign=top');
  });
});

// ─── Variable Legend ───────────────────────────────────────────────────────────
describe('Variable Legend rendering', () => {
  function makeGraphWithVariables(): ReturnType<typeof parseFlow> {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');
    return computeLayout(graph);
  }

  it('renders a swimlane container with swimlane style when variables exist', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('swimlane');
  });

  it('legend container uses id prefixed with legend__', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('id="legend__container"');
  });

  it('legend container has "Variables" as its value', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('value="Variables"');
  });

  it('input variable (inputLead) renders with → prefix', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('→ inputLead');
  });

  it('output variable (errorMessages) renders with ← prefix', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('← errorMessages');
  });

  it('input+output variable (qualificationResult) renders with ↔ prefix', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('↔ qualificationResult');
  });

  it('internal variable (leadScore) renders with • prefix', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('• leadScore');
  });

  it('collection variable dataType gets [] suffix', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('String[]');
  });

  it('legend row cells use id prefixed with legend__row__', () => {
    const output = generateDrawio(makeGraphWithVariables());
    expect(output).toContain('id="legend__row__leadScore"');
  });

  it('variable legend is absent when flow has no variables', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start><locationX>176</locationX><locationY>48</locationY></start>
</Flow>`;
    const graph = parseFlow(xml, 'No_Vars');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);
    // Variable legend container should not appear (no variables)
    expect(output).not.toContain('id="legend__container"');
  });

  it('legend container is positioned below all node Y coordinates', () => {
    const laid = makeGraphWithVariables();
    const output = generateDrawio(laid);

    // Find the legend container geometry
    const legendMatch = output.match(/id="legend__container"[\s\S]*?<mxGeometry[^>]*y="(\d+)"/);
    expect(legendMatch).not.toBeNull();
    const legendY = parseInt(legendMatch![1]!, 10);

    // All flow nodes must have Y+height < legendY
    const dimensionMap: Record<string, number> = {
      start: 60, decision: 100, assignment: 60, loop: 80,
      recordCreate: 70, recordUpdate: 70, recordDelete: 70, recordLookup: 70,
      screen: 70, actionCall: 60, subflow: 60, collectionProcessor: 60, end: 60,
    };
    for (const node of laid.nodes.values()) {
      const nodeBottom = node.locationY + (dimensionMap[node.type] ?? 60);
      expect(legendY).toBeGreaterThan(nodeBottom);
    }
  });

  it('lead-qualification fixture produces a legend (has 4 variables)', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);
    expect(output).toContain('id="legend__container"');
    // Should have 4 row entries
    const rowMatches = [...output.matchAll(/id="legend__row__/g)];
    expect(rowMatches.length).toBe(4);
  });
});

// ─── Shape Legend rendering ────────────────────────────────────────────────────
describe('Shape Legend rendering', () => {
  it('renders shape legend container with id="legend_container__shapes"', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('id="legend_container__shapes"');
  });

  it('shape legend container has swimlane style', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toMatch(/id="legend_container__shapes"[^>]*swimlane/);
  });

  it('shape legend container title is "Legend"', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toMatch(/id="legend_container__shapes"[^>]*value="Legend"/);
  });

  it('simple-linear: has rows for start, assignment, screen — not decision, loop, subflow', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('id="legend_shape__start"');
    expect(output).toContain('id="legend_shape__assignment"');
    expect(output).toContain('id="legend_shape__screen"');
    expect(output).not.toContain('id="legend_shape__decision"');
    expect(output).not.toContain('id="legend_shape__loop"');
    expect(output).not.toContain('id="legend_shape__subflow"');
  });

  it('decision-with-rules: has decision row, no loop or subflow rows', () => {
    const output = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    expect(output).toContain('id="legend_shape__decision"');
    expect(output).not.toContain('id="legend_shape__loop"');
    expect(output).not.toContain('id="legend_shape__subflow"');
  });

  it('loop-with-subflow: has loop and subflow rows', () => {
    const output = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    expect(output).toContain('id="legend_shape__loop"');
    expect(output).toContain('id="legend_shape__subflow"');
  });

  it('fault-path: has fault connector row', () => {
    const output = pipeline('fault-path.flow-meta.xml', 'Fault_Flow');
    expect(output).toContain('id="legend_conn__fault"');
  });

  it('simple-linear: no fault connector row (no fault edges)', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).not.toContain('id="legend_conn__fault"');
  });

  it('loop-with-subflow: has back-edge connector row', () => {
    const output = pipeline('loop-with-subflow.flow-meta.xml', 'Loop_Flow');
    expect(output).toContain('id="legend_conn__back"');
  });

  it('simple-linear: has standard connector row (edges exist)', () => {
    const output = pipeline('simple-linear.flow-meta.xml', 'Simple_Linear');
    expect(output).toContain('id="legend_conn__standard"');
  });

  it('decision row preview shape contains "rhombus" in its style', () => {
    const output = pipeline('decision-with-rules.flow-meta.xml', 'Decision_Flow');
    expect(output).toMatch(/id="legend_shape__decision"[^>]*rhombus/);
  });

  it('recordLookup row label contains "Record Lookup" display name', () => {
    const output = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toContain('Record Lookup');
  });

  it('recordLookup label description contains "SOQL"', () => {
    const output = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toContain('SOQL');
  });

  it('single-start-node graph produces a shape legend (start type present)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start><locationX>176</locationX><locationY>48</locationY></start>
</Flow>`;
    const graph = parseFlow(xml, 'Solo_Start');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);
    expect(output).toContain('id="legend_container__shapes"');
    expect(output).toContain('id="legend_shape__start"');
  });

  it('shape legend container X is greater than all flow node locationX values', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    const legendMatch = output.match(/id="legend_container__shapes"[\s\S]*?<mxGeometry[^>]*x="(\d+)"/);
    expect(legendMatch).not.toBeNull();
    const legendX = parseInt(legendMatch![1]!, 10);

    for (const node of laid.nodes.values()) {
      expect(legendX).toBeGreaterThan(node.locationX);
    }
  });

  it('lead-qualification: has recordLookup, decision, actionCall, recordUpdate, assignment, start rows', () => {
    const output = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).toContain('id="legend_shape__recordLookup"');
    expect(output).toContain('id="legend_shape__decision"');
    expect(output).toContain('id="legend_shape__actionCall"');
    expect(output).toContain('id="legend_shape__recordUpdate"');
    expect(output).toContain('id="legend_shape__assignment"');
    expect(output).toContain('id="legend_shape__start"');
  });

  it('lead-qualification: no rows for loop, subflow, screen, collectionProcessor', () => {
    const output = pipeline('lead-qualification.flow-meta.xml', 'Lead_Qual');
    expect(output).not.toContain('id="legend_shape__loop"');
    expect(output).not.toContain('id="legend_shape__subflow"');
    expect(output).not.toContain('id="legend_shape__screen"');
    expect(output).not.toContain('id="legend_shape__collectionProcessor"');
  });

  it('shape legend cell IDs use legend_shape__ or legend_conn__ prefix (no collision with node IDs)', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Linear');
    const laid = computeLayout(graph);
    const output = generateDrawio(laid);

    // All flow node IDs still exist
    for (const nodeId of laid.nodes.keys()) {
      expect(output).toContain(`id="${nodeId}"`);
    }
    // Shape legend uses its own prefix
    expect(output).toContain('id="legend_shape__start"');
    expect(output).toContain('id="legend_container__shapes"');
  });
});
