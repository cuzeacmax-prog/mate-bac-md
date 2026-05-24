/**
 * probabilityTree.ts — Probability tree diagram (horizontal, left → right).
 * Supports multi-level trees with probability labels on edges.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface TreeNode {
  label: string;
  probability?: number;      // probability of reaching this node from parent
  children?: TreeNode[];
  outcome_label?: string;    // shown at leaf nodes
}

export interface ProbabilityTreeInput {
  root_label?: string;
  branches: TreeNode[];
  show_final_probabilities?: boolean; // multiply along path
  title?: string;
}

interface LayoutNode {
  label: string;
  probability?: number;
  outcome_label?: string;
  x: number;
  y: number;
  children: LayoutNode[];
  cumulative_prob: number;
}

function layoutTree(
  nodes: TreeNode[],
  depth: number,
  xStep: number,
  yStart: number,
  ySpread: number,
  parentProb: number,
): LayoutNode[] {
  const result: LayoutNode[] = [];
  const count = nodes.length;
  for (let i = 0; i < count; i++) {
    const n = nodes[i];
    const prob = n.probability ?? (1 / count);
    const y = yStart + (i - (count - 1) / 2) * ySpread;
    const x = depth * xStep;
    const childSpread = ySpread * 0.55;
    const children = n.children
      ? layoutTree(n.children, depth + 1, xStep, y, childSpread, parentProb * prob)
      : [];
    result.push({ label: n.label, probability: prob, outcome_label: n.outcome_label, x, y, children, cumulative_prob: parentProb * prob });
  }
  return result;
}

function renderNode(
  node: LayoutNode,
  parentX: number | null,
  parentY: number | null,
  showFinal: boolean,
): string {
  let tikz = '';

  // Edge from parent
  if (parentX !== null && parentY !== null && node.probability !== undefined) {
    const midX = (parentX + node.x) / 2;
    const midY = (parentY + node.y) / 2;
    tikz += `  \\draw[->] (${fmt(parentX)},${fmt(parentY)}) -- (${fmt(node.x)},${fmt(node.y)});\n`;
    // Probability label above edge
    const labelY = midY + 0.15;
    tikz += `  \\node[font=\\small, above] at (${fmt(midX)},${fmt(labelY)}) {$${fmtLabel(node.probability)}$};\n`;
  }

  // Node circle/label
  if (node.children.length > 0) {
    tikz += `  \\filldraw[fill=blue!10, draw=blue!60] (${fmt(node.x)},${fmt(node.y)}) circle (0.25);\n`;
    tikz += `  \\node[font=\\small, align=center] at (${fmt(node.x)},${fmt(node.y)}) {$${node.label}$};\n`;
  } else {
    // Leaf node — rectangle
    tikz += `  \\node[draw, rounded corners, fill=green!10, font=\\small, inner sep=2pt] at (${fmt(node.x)},${fmt(node.y)}) {$${node.label}$};\n`;
    if (node.outcome_label) {
      tikz += `  \\node[right, font=\\footnotesize, gray] at (${fmt(node.x + 0.5)},${fmt(node.y)}) {${node.outcome_label}};\n`;
    }
    if (showFinal) {
      tikz += `  \\node[right, font=\\footnotesize, blue!70] at (${fmt(node.x + 0.5)},${fmt(node.y - 0.3)}) {$P=${fmtLabel(node.cumulative_prob)}$};\n`;
    }
  }

  // Recurse
  for (const child of node.children) {
    tikz += renderNode(child, node.x, node.y, showFinal);
  }

  return tikz;
}

export function generateProbabilityTree(input: ProbabilityTreeInput): GraphOutput {
  // Determine depth for x scaling
  function maxDepth(nodes: TreeNode[], d = 0): number {
    if (!nodes.length) return d;
    return Math.max(...nodes.map(n => maxDepth(n.children ?? [], d + 1)));
  }
  const depth = maxDepth(input.branches);
  const xStep = 3.0;
  const initialSpread = Math.max(2.0, input.branches.length * 1.2);

  const layout = layoutTree(input.branches, 1, xStep, 0, initialSpread, 1);

  let tikz = `\\begin{tikzpicture}[scale=0.9, >=stealth]\n`;

  if (input.title) {
    tikz += `  \\node[above, font=\\bfseries] at (${fmt((depth * xStep) / 2)},${fmt(initialSpread * 0.7)}) {${input.title}};\n`;
  }

  // Root node
  const rootLabel = input.root_label ?? '';
  tikz += `  \\filldraw[fill=blue!10, draw=blue!60] (0,0) circle (0.25);\n`;
  tikz += `  \\node[font=\\small] at (0,0) {$${rootLabel}$};\n`;

  const showFinal = input.show_final_probabilities !== false;

  for (const node of layout) {
    tikz += renderNode(node, 0, 0, showFinal);
  }

  tikz += `\\end{tikzpicture}`;

  // Compute leaf probabilities
  function collectLeafs(nodes: LayoutNode[]): { label: string; prob: number }[] {
    const res: { label: string; prob: number }[] = [];
    for (const n of nodes) {
      if (n.children.length === 0) res.push({ label: n.label, prob: n.cumulative_prob });
      else res.push(...collectLeafs(n.children));
    }
    return res;
  }
  const leafs = collectLeafs(layout);
  const totalProb = leafs.reduce((s, l) => s + l.prob, 0);

  return {
    tikz,
    computed: {
      leaf_probabilities: leafs.map(l => ({ label: l.label, probability: parseFloat(l.prob.toFixed(6)) })),
      total_probability: parseFloat(totalProb.toFixed(6)),
    },
  };
}
