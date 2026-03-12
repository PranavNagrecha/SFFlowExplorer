import { describe, it, expect } from 'vitest';
import type {
  FlowNode,
  FlowEdge,
  FlowGraph,
  FlowNodeType,
} from '../src/model/flow-graph.js';

describe('FlowGraph model', () => {
  describe('FlowNode', () => {
    it('accepts all valid FlowNodeType values', () => {
      const validTypes: FlowNodeType[] = [
        'start',
        'decision',
        'assignment',
        'loop',
        'recordCreate',
        'recordUpdate',
        'recordDelete',
        'recordLookup',
        'screen',
        'actionCall',
        'subflow',
        'collectionProcessor',
        'end',
      ];

      for (const type of validTypes) {
        const node: FlowNode = {
          id: `node-${type}`,
          name: `Node_${type}`,
          label: `Node ${type}`,
          type,
          locationX: 100,
          locationY: 200,
          metadata: {},
        };
        expect(node.type).toBe(type);
      }
    });

    it('requires all mandatory fields', () => {
      const node: FlowNode = {
        id: 'start',
        name: 'start',
        label: 'Start',
        type: 'start',
        locationX: 0,
        locationY: 0,
        metadata: {},
      };

      expect(node.id).toBeDefined();
      expect(node.name).toBeDefined();
      expect(node.label).toBeDefined();
      expect(node.type).toBeDefined();
      expect(typeof node.locationX).toBe('number');
      expect(typeof node.locationY).toBe('number');
      expect(node.metadata).toBeDefined();
    });

    it('allows zero coordinates for nodes without location data', () => {
      const node: FlowNode = {
        id: 'assign1',
        name: 'Assign_Something',
        label: 'Assign Something',
        type: 'assignment',
        locationX: 0,
        locationY: 0,
        metadata: { assignmentItems: [] },
      };

      expect(node.locationX).toBe(0);
      expect(node.locationY).toBe(0);
    });
  });

  describe('FlowEdge', () => {
    it('requires all mandatory fields', () => {
      const edge: FlowEdge = {
        id: 'start__to__assign1',
        sourceId: 'start',
        targetId: 'assign1',
        isFault: false,
        isBackEdge: false,
      };

      expect(edge.id).toBeDefined();
      expect(edge.sourceId).toBeDefined();
      expect(edge.targetId).toBeDefined();
      expect(typeof edge.isFault).toBe('boolean');
      expect(typeof edge.isBackEdge).toBe('boolean');
    });

    it('allows optional label', () => {
      const withLabel: FlowEdge = {
        id: 'dec1__rule1',
        sourceId: 'dec1',
        targetId: 'assign1',
        label: 'Is Gold Customer',
        isFault: false,
        isBackEdge: false,
      };
      const withoutLabel: FlowEdge = {
        id: 'assign1__next',
        sourceId: 'assign1',
        targetId: 'screen1',
        isFault: false,
        isBackEdge: false,
      };

      expect(withLabel.label).toBe('Is Gold Customer');
      expect(withoutLabel.label).toBeUndefined();
    });

    it('marks fault edges correctly', () => {
      const faultEdge: FlowEdge = {
        id: 'rec1__fault',
        sourceId: 'rec1',
        targetId: 'screen_error',
        label: 'Fault',
        isFault: true,
        isBackEdge: false,
      };

      expect(faultEdge.isFault).toBe(true);
    });

    it('marks back-edges correctly', () => {
      const backEdge: FlowEdge = {
        id: 'loop1__back',
        sourceId: 'inner_assign',
        targetId: 'loop1',
        isFault: false,
        isBackEdge: true,
        waypoints: [
          { x: 360, y: 200 },
          { x: 360, y: 100 },
        ],
      };

      expect(backEdge.isBackEdge).toBe(true);
      expect(backEdge.waypoints).toHaveLength(2);
    });

    it('allows optional waypoints for back-edge routing', () => {
      const edge: FlowEdge = {
        id: 'e1',
        sourceId: 'a',
        targetId: 'b',
        isFault: false,
        isBackEdge: false,
      };

      expect(edge.waypoints).toBeUndefined();
    });
  });

  describe('FlowGraph', () => {
    it('uses a Map for nodes to enable O(1) lookup by id', () => {
      const nodes = new Map<string, FlowNode>();
      nodes.set('start', {
        id: 'start',
        name: 'start',
        label: 'Start',
        type: 'start',
        locationX: 40,
        locationY: 40,
        metadata: {},
      });

      const graph: FlowGraph = {
        flowName: 'TestFlow',
        nodes,
        edges: [],
      };

      expect(graph.nodes).toBeInstanceOf(Map);
      expect(graph.nodes.get('start')?.type).toBe('start');
    });

    it('stores edges as an array', () => {
      const graph: FlowGraph = {
        flowName: 'TestFlow',
        nodes: new Map(),
        edges: [],
      };

      expect(Array.isArray(graph.edges)).toBe(true);
    });

    it('represents a minimal flow (start node only, no edges)', () => {
      const nodes = new Map<string, FlowNode>();
      nodes.set('start', {
        id: 'start',
        name: 'start',
        label: 'Start',
        type: 'start',
        locationX: 0,
        locationY: 0,
        metadata: {},
      });

      const graph: FlowGraph = {
        flowName: 'MinimalFlow',
        nodes,
        edges: [],
      };

      expect(graph.nodes.size).toBe(1);
      expect(graph.edges).toHaveLength(0);
    });
  });
});
