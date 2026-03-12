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

describe('flow-parser', () => {
  describe('parseFlow — start node', () => {
    it('produces a FlowGraph with a start node', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      expect(graph.flowName).toBe('Simple_Linear_Flow');
      expect(graph.nodes.has('start')).toBe(true);
    });

    it('sets start node type to "start"', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      const start = graph.nodes.get('start');
      expect(start?.type).toBe('start');
    });

    it('sets start node id to "start"', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      const start = graph.nodes.get('start');
      expect(start?.id).toBe('start');
    });

    it('sets start node label to "Start"', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      const start = graph.nodes.get('start');
      expect(start?.label).toBe('Start');
    });

    it('extracts locationX and locationY from the start element', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      const start = graph.nodes.get('start');
      expect(start?.locationX).toBe(176);
      expect(start?.locationY).toBe(48);
    });

    it('returns locationX=0 and locationY=0 when coordinates are absent', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <connector><targetReference>Next</targetReference></connector>
  </start>
</Flow>`;
      const graph = parseFlow(xml, 'No_Coords_Flow');

      const start = graph.nodes.get('start');
      expect(start?.locationX).toBe(0);
      expect(start?.locationY).toBe(0);
    });

    it('creates an edge from start when a connector is present', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      const startEdge = graph.edges.find(e => e.sourceId === 'start');
      expect(startEdge).toBeDefined();
      expect(startEdge?.targetId).toBe('Assign_Set_Name');
      expect(startEdge?.isFault).toBe(false);
    });

    it('produces no edges from start when no connector is present', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start>
    <locationX>176</locationX>
    <locationY>48</locationY>
  </start>
</Flow>`;
      const graph = parseFlow(xml, 'No_Edge_Flow');

      const startEdges = graph.edges.filter(e => e.sourceId === 'start');
      expect(startEdges).toHaveLength(0);
    });
  });

  describe('parseFlow — simple linear flow (full integration)', () => {
    it('parses all 4 nodes (start + 2 assignments + 1 screen)', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      expect(graph.nodes.size).toBe(4);
    });

    it('assigns correct types to all nodes', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      expect(graph.nodes.get('start')?.type).toBe('start');
      expect(graph.nodes.get('Assign_Set_Name')?.type).toBe('assignment');
      expect(graph.nodes.get('Assign_Set_Email')?.type).toBe('assignment');
      expect(graph.nodes.get('Screen_Confirm')?.type).toBe('screen');
    });

    it('produces 3 edges connecting the linear chain', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      expect(graph.edges).toHaveLength(3);
    });

    it('edges form the correct chain: start→assign1→assign2→screen', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      const chain = [
        { source: 'start', target: 'Assign_Set_Name' },
        { source: 'Assign_Set_Name', target: 'Assign_Set_Email' },
        { source: 'Assign_Set_Email', target: 'Screen_Confirm' },
      ];

      for (const { source, target } of chain) {
        const edge = graph.edges.find(
          e => e.sourceId === source && e.targetId === target,
        );
        expect(edge, `expected edge ${source} → ${target}`).toBeDefined();
      }
    });

    it('all edges in a linear flow have isFault=false and isBackEdge=false', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      for (const edge of graph.edges) {
        expect(edge.isFault).toBe(false);
        expect(edge.isBackEdge).toBe(false);
      }
    });

    it('extracts labels for assignment nodes', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      expect(graph.nodes.get('Assign_Set_Name')?.label).toBe('Set Name');
      expect(graph.nodes.get('Assign_Set_Email')?.label).toBe('Set Email');
    });

    it('extracts label for screen node', () => {
      const xml = loadFixture('simple-linear.flow-meta.xml');
      const graph = parseFlow(xml, 'Simple_Linear_Flow');

      expect(graph.nodes.get('Screen_Confirm')?.label).toBe('Confirm Details');
    });
  });
});

// ─── Variables parsing ──────────────────────────────────────────────────────
describe('flow-parser — variables', () => {
  it('populates variables array from <variables> elements', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');

    expect(graph.variables).toBeDefined();
    expect(graph.variables!.length).toBe(4);
  });

  it('extracts name and dataType from each variable', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');

    const leadScore = graph.variables!.find((v) => v.name === 'leadScore');
    expect(leadScore).toBeDefined();
    expect(leadScore!.dataType).toBe('Number');
  });

  it('isInput defaults to false when element is absent', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start><locationX>0</locationX><locationY>0</locationY></start>
  <variables>
    <name>myVar</name>
    <dataType>String</dataType>
  </variables>
</Flow>`;
    const graph = parseFlow(xml, 'Test');

    expect(graph.variables![0]!.isInput).toBe(false);
    expect(graph.variables![0]!.isOutput).toBe(false);
    expect(graph.variables![0]!.isCollection).toBe(false);
  });

  it('isCollection=true when <isCollection>true</isCollection> is present', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');

    const errMessages = graph.variables!.find((v) => v.name === 'errorMessages');
    expect(errMessages!.isCollection).toBe(true);
  });

  it('isInput=true for inputLead variable', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');

    const inputLead = graph.variables!.find((v) => v.name === 'inputLead');
    expect(inputLead!.isInput).toBe(true);
    expect(inputLead!.isOutput).toBe(false);
  });

  it('isOutput=true for errorMessages variable', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');

    const errMessages = graph.variables!.find((v) => v.name === 'errorMessages');
    expect(errMessages!.isOutput).toBe(true);
  });

  it('both isInput and isOutput are true for qualificationResult', () => {
    const xml = loadFixture('lead-qualification.flow-meta.xml');
    const graph = parseFlow(xml, 'Lead_Qual');

    const qr = graph.variables!.find((v) => v.name === 'qualificationResult');
    expect(qr!.isInput).toBe(true);
    expect(qr!.isOutput).toBe(true);
  });

  it('returns empty variables array for a flow with no variables', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <start><locationX>0</locationX><locationY>0</locationY></start>
</Flow>`;
    const graph = parseFlow(xml, 'No_Vars');

    expect(graph.variables).toEqual([]);
  });
});
