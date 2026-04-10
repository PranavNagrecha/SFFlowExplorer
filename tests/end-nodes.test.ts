import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlow } from '../src/parser/flow-parser.js';
import { generateDrawio } from '../src/generator/drawio-generator.js';
import { computeLayout } from '../src/layout/layout-engine.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');

describe('End node synthesis', () => {
  it('adds an End node after a terminal node with no outgoing edges', () => {
    // simple-linear: last node has no connector → should get an End node
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    const endNodes = [...graph.nodes.values()].filter(n => n.type === 'end');
    expect(endNodes.length).toBeGreaterThan(0);
  });

  it('creates an edge from each terminal node to its End node', () => {
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    const endNodes = [...graph.nodes.values()].filter(n => n.type === 'end');
    for (const endNode of endNodes) {
      const incomingEdges = graph.edges.filter(e => e.targetId === endNode.id);
      expect(incomingEdges.length).toBeGreaterThan(0);
    }
  });

  it('does not add End nodes for nodes that have outgoing edges', () => {
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    // Start node has an outgoing edge — should NOT have an end node hanging off it
    const startEndEdge = graph.edges.find(e => e.sourceId === 'start' && e.targetId.startsWith('end__'));
    expect(startEndEdge).toBeUndefined();
  });

  it('handles multiple terminal nodes (each gets its own End)', () => {
    // custom-error-element has 2 terminal nodes: Block_Record_Save and Log_Error
    const xml = readFileSync(join(fixturesDir, 'custom-error-element.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    const endNodes = [...graph.nodes.values()].filter(n => n.type === 'end');
    expect(endNodes.length).toBe(2);
  });

  it('handles decision flows where some paths terminate', () => {
    const xml = readFileSync(join(fixturesDir, 'decision-with-rules.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    const endNodes = [...graph.nodes.values()].filter(n => n.type === 'end');
    expect(endNodes.length).toBeGreaterThan(0);
  });

  it('End node label is "End"', () => {
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    const endNode = [...graph.nodes.values()].find(n => n.type === 'end');
    expect(endNode).toBeDefined();
    expect(endNode!.label).toBe('End');
  });

  it('End node edges are not fault edges', () => {
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = parseFlow(xml, 'test');
    const endEdges = graph.edges.filter(e => e.targetId.startsWith('end__'));
    for (const edge of endEdges) {
      expect(edge.isFault).toBe(false);
    }
  });
});

describe('End node rendering in Draw.io', () => {
  it('renders End nodes as red ellipses', () => {
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'test'));
    const drawio = generateDrawio(graph);
    // End node style from STYLE_MAP
    expect(drawio).toContain('fillColor=#F8CECC');
    expect(drawio).toContain('ellipse');
    expect(drawio).toContain('End');
  });

  it('renders edges to End nodes as normal connectors', () => {
    const xml = readFileSync(join(fixturesDir, 'simple-linear.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'test'));
    const drawio = generateDrawio(graph);
    // Should have edge targeting an end__ node
    expect(drawio).toContain('target="end__');
  });

  it('full pipeline produces valid diagram with End nodes', () => {
    const xml = readFileSync(join(fixturesDir, 'lead-qualification.flow-meta.xml'), 'utf-8');
    const graph = computeLayout(parseFlow(xml, 'test'));
    const drawio = generateDrawio(graph);
    expect(drawio).toContain('<mxGraphModel');
    expect(drawio).toContain('</mxGraphModel>');
    expect(drawio).toContain('end__');
  });
});
