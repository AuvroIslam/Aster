export type DescriptionMode = 'brief' | 'explain';

/**
 * `adaptive` lets the creator lead and speaks only into the pauses.
 * `full` explains the whole lesson for someone who cannot see any of it.
 */
export type NarrationMode = 'adaptive' | 'full';

export type VisualKind = 'code' | 'terminal' | 'diagram' | 'graph' | 'formula' | 'slide';

/**
 * One moment where Aster decided the screen carried information the narration
 * left out. `concept` is what makes this more than a caption: it names the idea
 * the visual was carrying, which is what practice is later built from.
 */
export interface Description {
  id: string;
  time: number;
  mode: DescriptionMode;
  kind: VisualKind;
  text: string;
  confidence: number;
  concept: string;
}

/** A question the learner asked, and what Aster answered. */
export interface LearnerQuestion {
  id: string;
  time: number;
  question: string;
  answer: string;
  /** False when Aster could not confirm the answer from the frame. */
  grounded: boolean;
  concept: string;
}

export interface Lesson {
  id: string;
  title: string;
  channel: string;
  duration: number;
  language: string;
  /** Moments Aster considered but chose to stay silent on. */
  consideredMoments: number;
  descriptions: Description[];
}

/** Why a concept ended up in the practice set. This is the whole teaching method. */
export type PracticeReason = 'described' | 'asked' | 'both';

export interface PracticeItem {
  id: string;
  concept: string;
  reason: PracticeReason;
  sourceTime: number;
  /** Open response, because a list of options cannot be held in the ear. */
  prompt: string;
  /**
   * What Aster originally said about this concept. The only ground truth the
   * grader has, and the thing the learner is being asked to recall.
   */
  reference: string;
  /** What a correct answer must contain — used to judge a spoken explanation. */
  expects: string[];
  /** The different-angle re-explanation, used when the learner misses it. */
  reexplain: string;
  priority: number;
}

export type PracticeVerdict = 'unanswered' | 'correct' | 'partial' | 'missed';

/* --- Documents ----------------------------------------------------------- */

export type BlockKind = 'heading' | 'text' | 'figure' | 'table' | 'formula' | 'chart';

/**
 * One block of an uploaded document. `described` marks the blocks a sighted
 * reader takes in visually — figures, tables, charts, formulas — which Aster
 * has to render into words. Exactly the same signal as a video description,
 * so the same practice logic consumes it.
 */
export interface DocBlock {
  id: string;
  page: number;
  kind: BlockKind;
  /** The literal text, or Aster's rendering of a visual block. */
  content: string;
  concept?: string;
  described: boolean;
}

export interface StudyDoc {
  id: string;
  title: string;
  pages: number;
  words: number;
  blocks: DocBlock[];
}
