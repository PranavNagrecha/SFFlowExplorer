import type { FlowGraph, FlowNode, FlowEdge, FlowNodeType } from '../model/flow-graph.js';

const STYLE_MAP: Record<FlowNodeType, string> = {
  start:
    'ellipse;whiteSpace=wrap;html=1;fillColor=#D5E8D4;strokeColor=#82B366;fontStyle=1;fontSize=12;',
  decision:
    'rhombus;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;fontStyle=1;fontSize=11;',
  assignment:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF2CC;strokeColor=#D6B656;',
  loop:
    'shape=mxgraph.flowchart.or;whiteSpace=wrap;html=1;fillColor=#E1D5E7;strokeColor=#9673A6;',
  recordCreate:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#F8CECC;strokeColor=#B85450;boundedLbl=1;backgroundOutline=1;size=10;',
  recordUpdate:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;boundedLbl=1;backgroundOutline=1;size=10;',
  recordDelete:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#F8CECC;strokeColor=#B85450;boundedLbl=1;backgroundOutline=1;size=10;',
  recordLookup:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;boundedLbl=1;backgroundOutline=1;size=10;',
  screen:
    'shape=mxgraph.flowchart.display;whiteSpace=wrap;html=1;fillColor=#E6F3FF;strokeColor=#0075DB;',
  actionCall:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#F5F5F5;strokeColor=#666666;fontColor=#333333;',
  subflow:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#E8DEF8;strokeColor=#6750A4;fontColor=#6750A4;fontStyle=1;',
  collectionProcessor:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F57F17;',
  end:
    'ellipse;whiteSpace=wrap;html=1;fillColor=#F8CECC;strokeColor=#B85450;fontStyle=1;fontSize=12;',
};

const NODE_DIMENSIONS: Record<FlowNodeType, { width: number; height: number }> = {
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function computePageDimensions(nodeCount: number): { width: number; height: number } {
  if (nodeCount <= 20) return { width: 1169, height: 827 };   // A4 landscape
  if (nodeCount <= 40) return { width: 1654, height: 1169 };  // A3 landscape
  return { width: 2338, height: 1654 };                        // A2 landscape
}

function renderVertex(node: FlowNode): string {
  const { width, height } = NODE_DIMENSIONS[node.type];
  const style = STYLE_MAP[node.type];
  return `    <mxCell id="${escapeXml(node.id)}" value="${escapeXml(node.label)}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${Math.round(node.locationX)}" y="${Math.round(node.locationY)}" width="${width}" height="${height}" as="geometry" />
    </mxCell>`;
}

function renderEdge(edge: FlowEdge): string {
  const baseStyle =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=0.5;exitY=1;exitDx=0;exitDy=0;';
  const faultStyle =
    'dashed=1;strokeColor=#B85450;fontColor=#B85450;strokeWidth=2;';
  const backEdgeStyle = 'curved=1;';

  let style = baseStyle;
  if (edge.isFault) style += faultStyle;
  if (edge.isBackEdge) style += backEdgeStyle;

  const geometryContent =
    edge.waypoints && edge.waypoints.length > 0
      ? `\n      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          ${edge.waypoints.map((p) => `<mxPoint x="${Math.round(p.x)}" y="${Math.round(p.y)}" />`).join('\n          ')}
        </Array>
      </mxGeometry>`
      : '\n      <mxGeometry relative="1" as="geometry" />';

  return `    <mxCell id="${escapeXml(edge.id)}" value="${escapeXml(edge.label ?? '')}"
      style="${style}" edge="1"
      source="${escapeXml(edge.sourceId)}" target="${escapeXml(edge.targetId)}" parent="1">${geometryContent}
    </mxCell>`;
}

export function generateDrawio(graph: FlowGraph): string {
  const { width, height } = computePageDimensions(graph.nodes.size);
  const pageScale = graph.nodes.size > 40 ? '0.75' : '1';

  const vertices = [...graph.nodes.values()].map(renderVertex).join('\n');
  const edges = graph.edges.map(renderEdge).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1"
              tooltips="1" connect="1" arrows="1" fold="1"
              page="1" pageScale="${pageScale}" pageWidth="${width}" pageHeight="${height}"
              math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
${vertices}
${edges}
  </root>
</mxGraphModel>`;
}
