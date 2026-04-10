export type FlowNodeType =
  | 'start'
  | 'decision'
  | 'assignment'
  | 'loop'
  | 'recordCreate'
  | 'recordUpdate'
  | 'recordDelete'
  | 'recordLookup'
  | 'screen'
  | 'actionCall'
  | 'subflow'
  | 'collectionProcessor'
  | 'wait'
  | 'customError'
  | 'transform'
  | 'end';

export interface FlowNode {
  id: string;
  name: string;
  label: string;
  type: FlowNodeType;
  locationX: number;
  locationY: number;
  metadata: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  isFault: boolean;
  isBackEdge: boolean;
  waypoints?: Array<{ x: number; y: number }>;
}

export interface FlowVariable {
  name: string;
  dataType: string;
  isInput: boolean;
  isOutput: boolean;
  isCollection: boolean;
}

export interface FlowGraph {
  flowName: string;
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
  variables?: FlowVariable[];
}
