import type { ConceptNote } from './practice';
import type { Description, DocBlock, LearnerQuestion, Lesson, StudyDoc } from './types';

/**
 * A realistic processed lesson. The shape here is the contract the Gemma
 * pipeline will fill in later — the UI is built against it, not against the
 * pipeline, so swapping fixtures for the real thing changes no components.
 */

export const descriptions: Description[] = [
  {
    id: 'd1',
    time: 92,
    mode: 'brief',
    kind: 'slide',
    confidence: 0.94,
    concept: 'binary search tree definition',
    text: 'A slide titled "Binary Search Tree" shows a node with two children, the left child smaller and the right child larger than the parent.',
  },
  {
    id: 'd2',
    time: 191,
    mode: 'explain',
    kind: 'code',
    confidence: 0.96,
    concept: 'the insert method',
    text: 'A Python method named insert takes a value, compares it to the current node, and recurses into node.left when the value is smaller or node.right when it is larger. The base case creates a new Node and returns it.',
  },
  {
    id: 'd3',
    time: 225,
    mode: 'brief',
    kind: 'terminal',
    confidence: 0.91,
    concept: 'in-order traversal output',
    text: 'The terminal prints [3, 7, 10, 14, 20] — the tree read left to right, in sorted order.',
  },
  {
    id: 'd4',
    time: 268,
    mode: 'explain',
    kind: 'diagram',
    confidence: 0.72,
    concept: 'the right-skewed tree',
    text: 'A right-skewed tree is drawn as a diagonal line of nodes descending to the right, labelled 10, 20, 30, 40 and 50 in sequence — resembling a linked list rather than a branching tree.',
  },
  {
    id: 'd5',
    time: 301,
    mode: 'explain',
    kind: 'graph',
    confidence: 0.88,
    concept: 'lookup cost against tree height',
    text: 'A graph plots operations against the number of nodes. A straight diagonal line is labelled O of n for the skewed tree; a shallow curve flattening near the bottom is labelled O of log n for the balanced one.',
  },
  {
    id: 'd6',
    time: 344,
    mode: 'explain',
    kind: 'formula',
    confidence: 0.79,
    concept: 'the balance factor',
    text: 'The formula on the board reads: balance factor equals height of the left subtree minus height of the right subtree. A note beside it says the result must stay between minus one and plus one.',
  },
  {
    id: 'd7',
    time: 402,
    mode: 'brief',
    kind: 'diagram',
    confidence: 0.9,
    concept: 'the right rotation',
    text: 'An arrow curves anticlockwise around the top node. The left child rises to become the new root, and the old root drops to become its right child.',
  },
  {
    id: 'd8',
    time: 455,
    mode: 'brief',
    kind: 'terminal',
    confidence: 0.86,
    concept: 'the right rotation',
    text: 'The terminal shows the tree height dropping from 5 to 3 after the rotation runs.',
  },
];

export const questions: LearnerQuestion[] = [
  {
    id: 'q1',
    time: 274,
    question: 'Why is a skewed tree bad if it still holds every value?',
    answer:
      'Because lookup follows the shape, not the contents. In a skewed tree every node has one child, so finding a value walks the whole chain — n steps. A balanced tree halves the remaining nodes at every step, so it takes about log n.',
    grounded: true,
    concept: 'the right-skewed tree',
  },
  {
    id: 'q2',
    time: 351,
    question: 'Read the formula again, slower.',
    answer:
      'Balance factor equals height of left subtree minus height of right subtree. If that number is less than minus one or greater than plus one, the node is unbalanced and needs a rotation.',
    grounded: true,
    concept: 'the balance factor',
  },
  {
    id: 'q3',
    time: 358,
    question: 'What counts as the height of an empty subtree?',
    answer:
      'The slide does not state it. Most implementations use minus one for an empty subtree so a leaf comes out as height zero — but I cannot confirm that from this frame.',
    grounded: false,
    concept: 'the balance factor',
  },
];

/** What a correct explanation must reach, and a second route if it does not. */
export const conceptNotes: Record<string, ConceptNote> = {
  'the right-skewed tree': {
    expects: ['every node has one child', 'behaves like a linked list', 'lookup becomes O(n)'],
    reexplain:
      'Try it as a filing cabinet. A balanced tree lets you throw away half the drawers with every question you ask. A skewed tree gives you one long row — you open every drawer in turn until you find it.',
  },
  'the balance factor': {
    expects: ['left height minus right height', 'must stay between -1 and +1', 'otherwise rotate'],
    reexplain:
      'Think of it as a see-saw reading at each node. Zero is level. Plus one or minus one is a slight tilt, still fine. Past that and the node has tipped over — a rotation puts it back.',
  },
  'lookup cost against tree height': {
    expects: ['cost follows height, not node count', 'balanced is log n', 'skewed is n'],
    reexplain:
      'The number of nodes is not what costs you — the depth is. Both trees hold the same five values, but one is five levels deep and the other is three.',
  },
  'the insert method': {
    expects: ['compare against the current node', 'recurse left when smaller', 'base case creates the node'],
    reexplain:
      'Insert asks one question per level: bigger or smaller? It walks down until it runs out of tree, and that empty spot is where the new node goes.',
  },
  'the right rotation': {
    expects: ['left child becomes the new root', 'old root becomes the right child', 'height decreases'],
    reexplain:
      'Grab the left child and pull it upward. The old parent has to go somewhere, so it swings down to the right. Nothing about the ordering changes — only the depth.',
  },
  'in-order traversal output': {
    expects: ['left, node, right', 'produces sorted order'],
    reexplain:
      'In-order means: everything smaller first, then me, then everything bigger. Do that all the way down and the values come out sorted for free.',
  },
  'binary search tree definition': {
    expects: ['left child smaller', 'right child larger'],
    reexplain:
      'One rule holds everywhere in the tree: smaller values live to the left of a node, larger ones to the right. That rule is what makes searching possible.',
  },
};

/**
 * An uploaded chapter. Note which blocks are marked `described`: the figure,
 * the table, the formula and the chart. Those are what a sighted reader absorbs
 * at a glance and a blind reader receives only through Aster.
 */
const docBlocks: DocBlock[] = [
  {
    id: 'b1',
    page: 1,
    kind: 'heading',
    content: 'Chapter 7 — Self-Balancing Search Trees',
    described: false,
  },
  {
    id: 'b2',
    page: 1,
    kind: 'text',
    content:
      'A binary search tree gives fast lookup only while it stays shallow. Insert values in sorted order and the structure degenerates, losing every advantage it had over a list.',
    described: false,
  },
  {
    id: 'b3',
    page: 1,
    kind: 'figure',
    concept: 'the right-skewed tree',
    described: true,
    content:
      'Figure 7.1 places two trees side by side. On the left, five nodes descend diagonally to the right in a single unbroken chain, captioned "degenerate". On the right, the same five values form a tree three levels deep with two children under the root, captioned "balanced".',
  },
  {
    id: 'b4',
    page: 2,
    kind: 'formula',
    concept: 'the balance factor',
    described: true,
    content:
      'Equation 7.1 reads: BF of node n equals height of the left subtree of n minus height of the right subtree of n. The text beneath states that a tree is an AVL tree when every node satisfies the absolute value of BF being at most one.',
  },
  {
    id: 'b5',
    page: 2,
    kind: 'table',
    concept: 'rotation cases',
    described: true,
    content:
      'Table 7.1 has four rows and three columns — Case, Condition, Fix. Left-Left: inserted into the left child of the left subtree, fixed by one right rotation. Right-Right: mirror of it, one left rotation. Left-Right: left child then right, fixed by a left rotation followed by a right. Right-Left: the mirror again, right then left.',
  },
  {
    id: 'b6',
    page: 3,
    kind: 'chart',
    concept: 'lookup cost against tree height',
    described: true,
    content:
      'Figure 7.4 plots comparisons against node count for one thousand to one million nodes. The unbalanced series climbs as a straight diagonal off the top of the chart. The AVL series stays almost flat, rising from about ten comparisons to roughly twenty across the whole range.',
  },
  {
    id: 'b7',
    page: 3,
    kind: 'text',
    content:
      'Rotations are local: only the pointers around the unbalanced node change, so rebalancing costs constant time regardless of how large the tree has grown.',
    described: false,
  },
];

export const studyDoc: StudyDoc = {
  id: 'doc-ch7',
  title: 'Data Structures — Chapter 7, Self-Balancing Search Trees.pdf',
  pages: 3,
  words: 2140,
  blocks: docBlocks,
};

/** Notes for the concepts that only appear in the document. */
export const docConceptNotes: Record<string, ConceptNote> = {
  ...conceptNotes,
  'rotation cases': {
    expects: ['four cases', 'left-left needs one right rotation', 'left-right needs two rotations'],
    reexplain:
      'Two of the four cases are straight — the imbalance runs in one direction, so one rotation undoes it. The other two zig-zag, so you straighten them first, then rotate. Four cases, but really two ideas.',
  },
};

export const lesson: Lesson = {
  id: 'E9DOBLNB-aE',
  title: 'Binary Search Trees and AVL Balancing — Full Walkthrough',
  channel: 'Algorithms, Properly Explained',
  duration: 748,
  language: 'English',
  consideredMoments: 31,
  descriptions,
};
