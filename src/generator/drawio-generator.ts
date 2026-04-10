import type { FlowGraph, FlowNode, FlowEdge, FlowNodeType, FlowVariable } from '../model/flow-graph.js';

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
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#F8CECC;strokeColor=#B85450;boundedLbl=1;backgroundOutline=1;size=10;verticalAlign=top;',
  recordUpdate:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;boundedLbl=1;backgroundOutline=1;size=10;verticalAlign=top;',
  recordDelete:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#F8CECC;strokeColor=#B85450;boundedLbl=1;backgroundOutline=1;size=10;verticalAlign=top;',
  recordLookup:
    'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#DAE8FC;strokeColor=#6C8EBF;boundedLbl=1;backgroundOutline=1;size=10;verticalAlign=top;',
  screen:
    'shape=mxgraph.flowchart.display;whiteSpace=wrap;html=1;fillColor=#E6F3FF;strokeColor=#0075DB;',
  actionCall:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#F5F5F5;strokeColor=#666666;fontColor=#333333;verticalAlign=top;',
  subflow:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#E8DEF8;strokeColor=#6750A4;fontColor=#6750A4;fontStyle=1;',
  collectionProcessor:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F57F17;',
  wait:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#E0F2F1;strokeColor=#00897B;fontStyle=1;',
  customError:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#F8CECC;strokeColor=#B85450;fontStyle=1;',
  transform:
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#E8EAF6;strokeColor=#3F51B5;verticalAlign=top;',
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
  wait: { width: 200, height: 70 },
  customError: { width: 200, height: 70 },
  transform: { width: 200, height: 70 },
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

function enrichLabel(node: FlowNode): string {
  const meta = node.metadata;
  switch (node.type) {
    case 'recordCreate': {
      const obj = meta['object'] as string | undefined;
      const ref = meta['inputReference'] as string | undefined;
      const sub = obj ?? ref;
      return sub ? `${node.label}\n+ ${sub}` : node.label;
    }
    case 'recordUpdate': {
      const ref = meta['inputReference'] as string | undefined;
      const obj = meta['object'] as string | undefined;
      const sub = ref ?? obj;
      return sub ? `${node.label}\n✎ ${sub}` : node.label;
    }
    case 'recordDelete': {
      const obj = meta['object'] as string | undefined;
      return obj ? `${node.label}\n− ${obj}` : node.label;
    }
    case 'recordLookup': {
      const obj = meta['object'] as string | undefined;
      return obj ? `${node.label}\n🔍 ${obj}` : node.label;
    }
    case 'actionCall': {
      const actionName = meta['actionName'] as string | undefined;
      return actionName ? `${node.label}\n⚙ ${actionName}` : node.label;
    }
    case 'transform': {
      const objType = meta['objectType'] as string | undefined;
      return objType ? `${node.label}\n⇄ ${objType}` : node.label;
    }
    case 'customError': {
      const msgs = meta['customErrorMessages'] as Record<string, unknown>[] | Record<string, unknown> | undefined;
      if (msgs) {
        const first = Array.isArray(msgs) ? msgs[0] : msgs;
        const errMsg = first?.['errorMessage'] as string | undefined;
        if (errMsg) {
          const truncated = errMsg.length > 40 ? errMsg.slice(0, 37) + '...' : errMsg;
          return `${node.label}\n⚠ ${truncated}`;
        }
      }
      return `${node.label}\n⚠ Error`;
    }
    default:
      return node.label;
  }
}

function renderVertex(node: FlowNode): string {
  const { width, height } = NODE_DIMENSIONS[node.type];
  const style = STYLE_MAP[node.type];
  const labelValue = escapeXml(enrichLabel(node)).replace(/\n/g, '&#xa;');
  return `    <mxCell id="${escapeXml(node.id)}" value="${labelValue}" style="${style}" vertex="1" parent="1">
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

const LEGEND_ROW_HEIGHT = 24;
const LEGEND_WIDTH = 320;
const LEGEND_HEADER_HEIGHT = 30;

function varPrefix(v: FlowVariable): string {
  if (v.isInput && v.isOutput) return '↔';
  if (v.isInput) return '→';
  if (v.isOutput) return '←';
  return '•';
}

function renderVariableLegend(graph: FlowGraph): string {
  const variables = graph.variables ?? [];
  if (variables.length === 0) return '';

  const dimensionMap: Record<string, number> = {
    start: 60, decision: 100, assignment: 60, loop: 80,
    recordCreate: 70, recordUpdate: 70, recordDelete: 70, recordLookup: 70,
    screen: 70, actionCall: 60, subflow: 60, collectionProcessor: 60, end: 60,
  };

  let maxNodeBottom = 0;
  for (const node of graph.nodes.values()) {
    const h = dimensionMap[node.type] ?? 60;
    const bottom = node.locationY + h;
    if (bottom > maxNodeBottom) maxNodeBottom = bottom;
  }

  const containerX = 40;
  const containerY = maxNodeBottom + 120;
  const containerHeight = LEGEND_HEADER_HEIGHT + variables.length * LEGEND_ROW_HEIGHT + 8;

  const containerStyle =
    'swimlane;startSize=30;fillColor=#F8F9FA;strokeColor=#CCCCCC;fontStyle=1;fontSize=11;';
  const rowStyle =
    'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;fontSize=10;';

  const rows = variables.map((v, i) => {
    const dt = v.isCollection ? `${v.dataType}[]` : v.dataType;
    const prefix = varPrefix(v);
    const fontColor =
      v.isInput && v.isOutput
        ? '#6750A4'
        : v.isInput
          ? '#1E8449'
          : v.isOutput
            ? '#1A5276'
            : '#555555';
    const label = escapeXml(`${prefix} ${v.name} : ${dt}`);
    const rowY = LEGEND_HEADER_HEIGHT + i * LEGEND_ROW_HEIGHT;
    return `    <mxCell id="legend__row__${escapeXml(v.name)}" value="${label}"
      style="${rowStyle}fontColor=${fontColor};" vertex="1" parent="legend__container">
      <mxGeometry x="0" y="${rowY}" width="${LEGEND_WIDTH}" height="${LEGEND_ROW_HEIGHT}" as="geometry" />
    </mxCell>`;
  });

  return `    <mxCell id="legend__container" value="Variables" style="${containerStyle}" vertex="1" parent="1">
      <mxGeometry x="${containerX}" y="${containerY}" width="${LEGEND_WIDTH}" height="${containerHeight}" as="geometry" />
    </mxCell>
${rows.join('\n')}`;
}

// ─── Shape Legend ─────────────────────────────────────────────────────────────

const NODE_TYPE_ORDER: FlowNodeType[] = [
  'start', 'decision', 'assignment', 'loop',
  'recordCreate', 'recordUpdate', 'recordDelete', 'recordLookup',
  'screen', 'actionCall', 'subflow', 'collectionProcessor', 'end',
];

interface NodeDisplayInfo {
  displayName: string;
  description: string;
}

const NODE_DISPLAY_INFO: Record<FlowNodeType, NodeDisplayInfo> = {
  start:               { displayName: 'Start',             description: 'Flow entry point' },
  decision:            { displayName: 'Decision',          description: 'Branches based on conditions' },
  assignment:          { displayName: 'Assignment',        description: 'Sets variable values' },
  loop:                { displayName: 'Loop',              description: 'Iterates over a collection' },
  recordCreate:        { displayName: 'Record Create',     description: 'Creates Salesforce records' },
  recordUpdate:        { displayName: 'Record Update',     description: 'Updates Salesforce records' },
  recordDelete:        { displayName: 'Record Delete',     description: 'Deletes Salesforce records' },
  recordLookup:        { displayName: 'Record Lookup',     description: 'Queries records via SOQL' },
  screen:              { displayName: 'Screen',            description: 'Displays UI to users' },
  actionCall:          { displayName: 'Action',            description: 'Calls Apex or invocable action' },
  subflow:             { displayName: 'Subflow',           description: 'References another flow' },
  collectionProcessor: { displayName: 'Collection',       description: 'Processes a collection' },
  wait:                { displayName: 'Wait',              description: 'Pauses flow until event fires' },
  customError:         { displayName: 'Custom Error',      description: 'Throws a validation error' },
  transform:           { displayName: 'Transform',         description: 'Maps and transforms data' },
  end:                 { displayName: 'End',               description: 'Terminates the flow' },
};

const SHAPE_ROW_HEIGHT = 36;
const SHAPE_PREVIEW_W = 28;
const SHAPE_PREVIEW_H = 24;
const SHAPE_LEGEND_WIDTH = 300;
const SHAPE_HEADER_HEIGHT = 30;
const CONN_ROW_HEIGHT = 28;

function renderShapeLegend(graph: FlowGraph): string {
  // Collect present node types in display order
  const presentTypes = new Set<FlowNodeType>();
  for (const node of graph.nodes.values()) {
    presentTypes.add(node.type);
  }
  const orderedTypes = NODE_TYPE_ORDER.filter((t) => presentTypes.has(t));

  const hasFault = graph.edges.some((e) => e.isFault);
  const hasBack = graph.edges.some((e) => e.isBackEdge);
  const hasEdges = graph.edges.length > 0;

  // Connector rows count
  const connRowCount = (hasEdges ? 1 : 0) + (hasFault ? 1 : 0) + (hasBack ? 1 : 0);
  const connSectionHeight = connRowCount > 0 ? CONN_ROW_HEIGHT * connRowCount + SHAPE_ROW_HEIGHT : 0;

  const containerHeight =
    SHAPE_HEADER_HEIGHT +
    orderedTypes.length * SHAPE_ROW_HEIGHT +
    connSectionHeight +
    8;

  // Position: right of all flow nodes
  const NODE_WIDTHS: Record<FlowNodeType, number> = {
    start: 120, decision: 200, assignment: 200, loop: 200,
    recordCreate: 200, recordUpdate: 200, recordDelete: 200, recordLookup: 200,
    screen: 200, actionCall: 200, subflow: 200, collectionProcessor: 200,
    wait: 200, customError: 200, transform: 200, end: 120,
  };

  let maxNodeRight = 0;
  let maxNodeBottom = 0;
  const NODE_HEIGHTS: Record<string, number> = {
    start: 60, decision: 100, assignment: 60, loop: 80,
    recordCreate: 70, recordUpdate: 70, recordDelete: 70, recordLookup: 70,
    screen: 70, actionCall: 60, subflow: 60, collectionProcessor: 60, end: 60,
  };
  for (const node of graph.nodes.values()) {
    const w = NODE_WIDTHS[node.type] ?? 200;
    const h = NODE_HEIGHTS[node.type] ?? 60;
    const right = node.locationX + w;
    const bottom = node.locationY + h;
    if (right > maxNodeRight) maxNodeRight = right;
    if (bottom > maxNodeBottom) maxNodeBottom = bottom;
  }

  const shapeX = maxNodeRight + 160;
  const shapeY = maxNodeBottom + 120;

  const containerStyle =
    'swimlane;startSize=30;fillColor=#F8F9FA;strokeColor=#CCCCCC;fontStyle=1;fontSize=11;';
  const labelStyle =
    'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;fontSize=9;';

  const cells: string[] = [];

  // Container
  cells.push(`    <mxCell id="legend_container__shapes" value="Legend" style="${containerStyle}" vertex="1" parent="1">
      <mxGeometry x="${shapeX}" y="${shapeY}" width="${SHAPE_LEGEND_WIDTH}" height="${containerHeight}" as="geometry" />
    </mxCell>`);

  // Node type rows
  orderedTypes.forEach((type, i) => {
    const rowY = SHAPE_HEADER_HEIGHT + i * SHAPE_ROW_HEIGHT;
    const previewY = rowY + Math.floor((SHAPE_ROW_HEIGHT - SHAPE_PREVIEW_H) / 2);
    const info = NODE_DISPLAY_INFO[type];
    const previewStyle = STYLE_MAP[type];
    const labelValue = escapeXml(`${info.displayName}&#xa;${info.description}`);

    cells.push(`    <mxCell id="legend_shape__${type}" value="" style="${previewStyle}" vertex="1" parent="legend_container__shapes">
      <mxGeometry x="8" y="${previewY}" width="${SHAPE_PREVIEW_W}" height="${SHAPE_PREVIEW_H}" as="geometry" />
    </mxCell>`);

    cells.push(`    <mxCell id="legend_label__${type}" value="${labelValue}" style="${labelStyle}" vertex="1" parent="legend_container__shapes">
      <mxGeometry x="44" y="${rowY}" width="${SHAPE_LEGEND_WIDTH - 52}" height="${SHAPE_ROW_HEIGHT}" as="geometry" />
    </mxCell>`);
  });

  // Connector section
  if (connRowCount > 0) {
    const sectionHeaderY = SHAPE_HEADER_HEIGHT + orderedTypes.length * SHAPE_ROW_HEIGHT;
    const sectionHeaderStyle =
      'text;html=1;strokeColor=none;fillColor=#EEEEEE;align=left;verticalAlign=middle;spacingLeft=8;fontSize=9;fontStyle=1;';
    cells.push(`    <mxCell id="legend_conn__header" value="Connectors" style="${sectionHeaderStyle}" vertex="1" parent="legend_container__shapes">
      <mxGeometry x="0" y="${sectionHeaderY}" width="${SHAPE_LEGEND_WIDTH}" height="${SHAPE_ROW_HEIGHT}" as="geometry" />
    </mxCell>`);

    let connIdx = 0;
    const addConnRow = (id: string, label: string, color: string, dashed: boolean): void => {
      const rowY = sectionHeaderY + SHAPE_ROW_HEIGHT + connIdx * CONN_ROW_HEIGHT;
      const dashStr = dashed ? 'dashed=1;' : '';
      // Use vertex with line shape to avoid polluting edge count
      const lineStyle = `shape=line;${dashStr}strokeColor=${color};strokeWidth=2;fillColor=none;html=1;`;
      const textStyle = `text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;fontSize=9;fontColor=${color};`;
      cells.push(`    <mxCell id="${id}__line" value="" style="${lineStyle}" vertex="1" parent="legend_container__shapes">
      <mxGeometry x="8" y="${rowY + Math.floor(CONN_ROW_HEIGHT / 2) - 1}" width="32" height="4" as="geometry" />
    </mxCell>`);
      cells.push(`    <mxCell id="${id}" value="${escapeXml(label)}" style="${textStyle}" vertex="1" parent="legend_container__shapes">
      <mxGeometry x="44" y="${rowY}" width="${SHAPE_LEGEND_WIDTH - 52}" height="${CONN_ROW_HEIGHT}" as="geometry" />
    </mxCell>`);
      connIdx++;
    };

    if (hasEdges) addConnRow('legend_conn__standard', 'Standard connector', '#666666', false);
    if (hasFault) addConnRow('legend_conn__fault', 'Fault path', '#B85450', true);
    if (hasBack) addConnRow('legend_conn__back', 'Back-edge (loop)', '#0075DB', false);
  }

  return cells.join('\n');
}

export function generateDrawio(graph: FlowGraph): string {
  const { width, height } = computePageDimensions(graph.nodes.size);
  const pageScale = graph.nodes.size > 40 ? '0.75' : '1';

  const vertices = [...graph.nodes.values()].map(renderVertex).join('\n');
  const edges = graph.edges.map(renderEdge).join('\n');
  const legend = renderVariableLegend(graph);
  const shapeLegend = renderShapeLegend(graph);

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
${legend}
${shapeLegend}
  </root>
</mxGraphModel>`;
}
