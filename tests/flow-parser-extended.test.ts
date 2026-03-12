import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlow } from '../src/parser/flow-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

// ─── T04: Decisions ────────────────────────────────────────────────────────────
describe('T04: flow-parser — decisions', () => {
  it('parses a decision node with correct type', () => {
    const xml = loadFixture('decision-with-rules.flow-meta.xml');
    const graph = parseFlow(xml, 'Decision_Flow');

    expect(graph.nodes.get('Check_Account_Type')?.type).toBe('decision');
  });

  it('produces one edge per rule in declaration order', () => {
    const xml = loadFixture('decision-with-rules.flow-meta.xml');
    const graph = parseFlow(xml, 'Decision_Flow');

    const decisionEdges = graph.edges.filter(
      (e) => e.sourceId === 'Check_Account_Type',
    );
    // 3 rules + 1 default
    expect(decisionEdges).toHaveLength(4);
  });

  it('labels rule edges with rule.label', () => {
    const xml = loadFixture('decision-with-rules.flow-meta.xml');
    const graph = parseFlow(xml, 'Decision_Flow');

    const goldEdge = graph.edges.find(
      (e) => e.sourceId === 'Check_Account_Type' && e.targetId === 'Assign_Gold',
    );
    expect(goldEdge?.label).toBe('Is Gold');
  });

  it('produces a default connector edge labelled with defaultConnectorLabel', () => {
    const xml = loadFixture('decision-with-rules.flow-meta.xml');
    const graph = parseFlow(xml, 'Decision_Flow');

    const defaultEdge = graph.edges.find(
      (e) => e.sourceId === 'Check_Account_Type' && e.targetId === 'Assign_Default',
    );
    expect(defaultEdge).toBeDefined();
    expect(defaultEdge?.label).toBe('Other');
    expect(defaultEdge?.isFault).toBe(false);
  });

  it('falls back to "Default" label when defaultConnectorLabel is absent', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <connector><targetReference>Dec</targetReference></connector>
  </start>
  <decisions>
    <name>Dec</name>
    <label>Decision</label>
    <locationX>100</locationX>
    <locationY>100</locationY>
    <defaultConnector>
      <targetReference>Assign1</targetReference>
    </defaultConnector>
    <rules>
      <name>Rule1</name>
      <label>Rule One</label>
      <connector><targetReference>Assign2</targetReference></connector>
    </rules>
  </decisions>
  <assignments>
    <name>Assign1</name><label>A1</label><locationX>0</locationX><locationY>0</locationY>
  </assignments>
  <assignments>
    <name>Assign2</name><label>A2</label><locationX>0</locationX><locationY>0</locationY>
  </assignments>
</Flow>`;
    const graph = parseFlow(xml, 'Test');

    const defaultEdge = graph.edges.find(
      (e) => e.sourceId === 'Dec' && e.targetId === 'Assign1',
    );
    expect(defaultEdge?.label).toBe('Default');
  });

  it('decision edges point to the correct target nodes', () => {
    const xml = loadFixture('decision-with-rules.flow-meta.xml');
    const graph = parseFlow(xml, 'Decision_Flow');

    const targets = graph.edges
      .filter((e) => e.sourceId === 'Check_Account_Type')
      .map((e) => e.targetId);

    expect(targets).toContain('Assign_Gold');
    expect(targets).toContain('Assign_Silver');
    expect(targets).toContain('Assign_Bronze');
    expect(targets).toContain('Assign_Default');
  });
});

// ─── T06: Loops ────────────────────────────────────────────────────────────────
describe('T06: flow-parser — loops', () => {
  it('parses a loop node with correct type', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    expect(graph.nodes.get('Loop_Over_Contacts')?.type).toBe('loop');
  });

  it('produces a "For Each" edge from the loop to the next element', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const forEachEdge = graph.edges.find(
      (e) => e.sourceId === 'Loop_Over_Contacts' && e.label === 'For Each',
    );
    expect(forEachEdge).toBeDefined();
    expect(forEachEdge?.targetId).toBe('Call_Update_Subflow');
    expect(forEachEdge?.isFault).toBe(false);
  });

  it('produces an "After Last" edge from the loop to the exit element', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const afterLastEdge = graph.edges.find(
      (e) => e.sourceId === 'Loop_Over_Contacts' && e.label === 'After Last',
    );
    expect(afterLastEdge).toBeDefined();
    expect(afterLastEdge?.targetId).toBe('Screen_Done');
  });

  it('produces exactly two outgoing edges from the loop node', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const loopEdges = graph.edges.filter(
      (e) => e.sourceId === 'Loop_Over_Contacts',
    );
    expect(loopEdges).toHaveLength(2);
  });
});

// ─── T07: Record elements ──────────────────────────────────────────────────────
describe('T07: flow-parser — record operations', () => {
  it('parses a recordLookup node with correct type', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    expect(graph.nodes.get('Get_Contacts')?.type).toBe('recordLookup');
  });

  it('parses a recordUpdate node with correct type', () => {
    const xml = loadFixture('fault-path.flow-meta.xml');
    const graph = parseFlow(xml, 'Fault_Flow');

    expect(graph.nodes.get('Update_Contact')?.type).toBe('recordUpdate');
  });

  it('parses recordCreate, recordDelete types correctly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <connector><targetReference>CreateRec</targetReference></connector>
  </start>
  <recordCreates>
    <name>CreateRec</name>
    <label>Create Record</label>
    <locationX>100</locationX>
    <locationY>100</locationY>
    <connector><targetReference>DeleteRec</targetReference></connector>
    <inputReference>newContact</inputReference>
  </recordCreates>
  <recordDeletes>
    <name>DeleteRec</name>
    <label>Delete Record</label>
    <locationX>100</locationX>
    <locationY>220</locationY>
    <inputReference>oldContact</inputReference>
  </recordDeletes>
</Flow>`;
    const graph = parseFlow(xml, 'CrudFlow');

    expect(graph.nodes.get('CreateRec')?.type).toBe('recordCreate');
    expect(graph.nodes.get('DeleteRec')?.type).toBe('recordDelete');
  });
});

// ─── T12: Fault connectors ─────────────────────────────────────────────────────
describe('T12: flow-parser — fault connectors', () => {
  it('creates a fault edge from a recordUpdate with faultConnector', () => {
    const xml = loadFixture('fault-path.flow-meta.xml');
    const graph = parseFlow(xml, 'Fault_Flow');

    const faultEdge = graph.edges.find(
      (e) => e.sourceId === 'Update_Contact' && e.isFault === true,
    );
    expect(faultEdge).toBeDefined();
    expect(faultEdge?.targetId).toBe('Screen_Error');
    expect(faultEdge?.label).toBe('Fault');
  });

  it('creates a fault edge from a recordLookup with faultConnector', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const faultEdge = graph.edges.find(
      (e) => e.sourceId === 'Get_Contacts' && e.isFault === true,
    );
    expect(faultEdge).toBeDefined();
    expect(faultEdge?.targetId).toBe('Screen_Error');
  });

  it('does not produce a fault edge when no faultConnector is present', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Simple_Flow');

    const faultEdges = graph.edges.filter((e) => e.isFault === true);
    expect(faultEdges).toHaveLength(0);
  });

  it('fault edge has isFault=true and isBackEdge=false', () => {
    const xml = loadFixture('fault-path.flow-meta.xml');
    const graph = parseFlow(xml, 'Fault_Flow');

    const faultEdge = graph.edges.find((e) => e.isFault);
    expect(faultEdge?.isFault).toBe(true);
    expect(faultEdge?.isBackEdge).toBe(false);
  });
});

// ─── T10: Subflows ─────────────────────────────────────────────────────────────
describe('T10: flow-parser — subflows', () => {
  it('parses a subflow node with correct type', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    expect(graph.nodes.get('Call_Update_Subflow')?.type).toBe('subflow');
  });

  it('subflow label uses the referenced flowName', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const subflow = graph.nodes.get('Call_Update_Subflow');
    expect(subflow?.label).toContain('Contact_Update_Child');
  });

  it('subflow has a connector edge back to the loop (the back-edge)', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const edge = graph.edges.find(
      (e) =>
        e.sourceId === 'Call_Update_Subflow' &&
        e.targetId === 'Loop_Over_Contacts',
    );
    expect(edge).toBeDefined();
  });
});

// ─── T13: Back-edge detection ──────────────────────────────────────────────────
describe('T13: flow-parser — back-edge detection', () => {
  it('marks the subflow→loop edge as a back-edge', () => {
    const xml = loadFixture('loop-with-subflow.flow-meta.xml');
    const graph = parseFlow(xml, 'Loop_Flow');

    const backEdge = graph.edges.find(
      (e) =>
        e.sourceId === 'Call_Update_Subflow' &&
        e.targetId === 'Loop_Over_Contacts',
    );
    expect(backEdge?.isBackEdge).toBe(true);
  });

  it('does not mark forward edges as back-edges in a linear flow', () => {
    const xml = loadFixture('simple-linear.flow-meta.xml');
    const graph = parseFlow(xml, 'Linear_Flow');

    const backEdges = graph.edges.filter((e) => e.isBackEdge);
    expect(backEdges).toHaveLength(0);
  });

  it('does not mark fault edges as back-edges', () => {
    const xml = loadFixture('fault-path.flow-meta.xml');
    const graph = parseFlow(xml, 'Fault_Flow');

    const faultBackEdges = graph.edges.filter(
      (e) => e.isFault && e.isBackEdge,
    );
    expect(faultBackEdges).toHaveLength(0);
  });

  it('handles an explicit self-referencing loop in XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <connector><targetReference>LoopNode</targetReference></connector>
  </start>
  <loops>
    <name>LoopNode</name>
    <label>My Loop</label>
    <locationX>176</locationX>
    <locationY>168</locationY>
    <collectionReference>myList</collectionReference>
    <nextValueConnector>
      <targetReference>DoWork</targetReference>
    </nextValueConnector>
    <noMoreValuesConnector>
      <targetReference>End</targetReference>
    </noMoreValuesConnector>
  </loops>
  <assignments>
    <name>DoWork</name>
    <label>Do Work</label>
    <locationX>176</locationX>
    <locationY>288</locationY>
    <connector>
      <targetReference>LoopNode</targetReference>
    </connector>
  </assignments>
  <assignments>
    <name>End</name>
    <label>End</label>
    <locationX>176</locationX>
    <locationY>408</locationY>
  </assignments>
</Flow>`;
    const graph = parseFlow(xml, 'Explicit_Loop');

    const backEdge = graph.edges.find(
      (e) => e.sourceId === 'DoWork' && e.targetId === 'LoopNode',
    );
    expect(backEdge?.isBackEdge).toBe(true);
  });
});
