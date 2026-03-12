---
name: drawio-generator
description: >
  Use this skill for ANY task involving generating, writing, modifying, or testing Draw.io XML output.
  Triggers include: converting FlowGraph to mxGraph XML, building mxCell elements, applying shape styles,
  constructing edge connectors, outputting .drawio files. Use this skill even if the user says
  "write the output" or "generate the diagram" — it contains the canonical style strings and XML
  structure that must be used consistently across the codebase.
---

# Draw.io Generator Skill

## Purpose

Convert the internal `FlowGraph` model into valid, uncompressed Draw.io XML that opens
correctly in diagrams.net. All generator implementation tasks must follow this skill.

---

## Output Format Decision

**Always output UNCOMPRESSED mxGraphModel XML.**

Never output the compressed format (base64 + deflate inside `<mxfile compressed="true">`).
Reason: compressed output is a binary blob — not diffable, not reviewable in git, not
debuggable without a tool.

The correct root structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1"
              tooltips="1" connect="1" arrows="1" fold="1"
              page="1" pageScale="1" pageWidth="1169" pageHeight="827"
              math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <!-- vertices and edges here -->
  </root>
</mxGraphModel>
```

The two seed `mxCell` elements (`id="0"` and `id="1"`) are REQUIRED by Draw.io.
All other cells must have `parent="1"`.

---

## Vertex Style Strings (Metadata Mapping Matrix)

Use these exact style strings. Copy verbatim — style syntax is whitespace-sensitive.

```typescript
export const STYLE_MAP: Record<FlowNodeType, string> = {
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
```

---

## Standard Node Dimensions

```typescript
export const NODE_DIMENSIONS: Record<FlowNodeType, { width: number; height: number }> = {
  start:               { width: 120, height: 60  },
  decision:            { width: 200, height: 100 },
  assignment:          { width: 200, height: 60  },
  loop:                { width: 200, height: 80  },
  recordCreate:        { width: 200, height: 70  },
  recordUpdate:        { width: 200, height: 70  },
  recordDelete:        { width: 200, height: 70  },
  recordLookup:        { width: 200, height: 70  },
  screen:              { width: 200, height: 70  },
  actionCall:          { width: 200, height: 60  },
  subflow:             { width: 200, height: 60  },
  collectionProcessor: { width: 200, height: 60  },
  end:                 { width: 120, height: 60  },
};
```

---

## Vertex XML Template

```typescript
function renderVertex(node: FlowNode): string {
  const { width, height } = NODE_DIMENSIONS[node.type];
  const style = STYLE_MAP[node.type];
  return `    <mxCell id="${escapeXml(node.id)}" value="${escapeXml(node.label)}"
      style="${style}" vertex="1" parent="1">
      <mxGeometry x="${node.locationX}" y="${node.locationY}"
                  width="${width}" height="${height}" as="geometry" />
    </mxCell>`;
}
```

---

## Edge XML Template

```typescript
function renderEdge(edge: FlowEdge): string {
  const baseStyle = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=0.5;exitY=1;exitDx=0;exitDy=0;';
  const faultStyle = 'dashed=1;strokeColor=#B85450;fontColor=#B85450;strokeWidth=2;';
  const backEdgeStyle = 'curved=1;';

  let style = baseStyle;
  if (edge.isFault) style += faultStyle;
  if (edge.isBackEdge) style += backEdgeStyle;

  return `    <mxCell id="${escapeXml(edge.id)}" value="${escapeXml(edge.label ?? '')}"
      style="${style}" edge="1"
      source="${escapeXml(edge.sourceId)}" target="${escapeXml(edge.targetId)}" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>`;
}
```

---

## XML Escaping (Required)

```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

Never skip XML escaping. Flow API names can contain characters that break XML (e.g. `&` in labels).

---

## Large Flow Handling

For graphs with more than 40 nodes, adjust page dimensions:

```typescript
function computePageDimensions(nodeCount: number): { width: number; height: number } {
  if (nodeCount <= 20) return { width: 1169, height: 827 };   // A4 landscape
  if (nodeCount <= 40) return { width: 1654, height: 1169 };  // A3 landscape
  return { width: 2338, height: 1654 };                        // A2 landscape
}
```

Also add `pageScale="0.75"` for flows > 40 nodes.

---

## Generator Pipeline

```typescript
export function generateDrawio(graph: FlowGraph): string {
  const { width, height } = computePageDimensions(graph.nodes.size);
  const vertices = [...graph.nodes.values()].map(renderVertex).join('\n');
  const edges = graph.edges.map(renderEdge).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1"
              tooltips="1" connect="1" arrows="1" fold="1"
              page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}"
              math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
${vertices}
${edges}
  </root>
</mxGraphModel>`;
}
```

---

## Definition of Done (Generator)

- [ ] Output XML parses without errors in `xml-lint`
- [ ] Output opens in draw.io desktop or diagrams.net without import errors
- [ ] All node types render with correct shapes and colours
- [ ] Fault edges are dashed and red
- [ ] Subflow nodes render in the purple colour family
- [ ] Labels are not truncated (test with a 60-character label)
- [ ] XML special characters in labels are escaped
- [ ] Large flow test (25 nodes) produces a readable, non-overlapping diagram
