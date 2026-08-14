import type { Description, LearnerQuestion, PracticeItem, PracticeReason } from './types';

/**
 * Gap-driven retrieval.
 *
 * The teaching method in one function. Aster does not quiz the lesson — it
 * quizzes the *gap between what the lesson showed and what the learner could
 * take in*. Two signals feed it, and nothing else:
 *
 *   1. Every audio description is a concept that reached the learner through
 *      the ear rather than the eye. Second-hand, single pass, nothing to glance
 *      back at. Structurally the most fragile thing in the lesson.
 *
 *   2. Every question the learner asked is a self-reported confidence gap, at a
 *      timestamp, about a named concept.
 *
 * A concept carrying both signals is the highest priority in the set. A concept
 * the instructor narrated fully is never tested — the learner received it on
 * equal terms with a sighted student, so there is no gap to close.
 */

const PRIORITY = {
  /** Asked about AND described — the learner heard it second-hand and still stalled. */
  both: 100,
  /** Asked about — an explicit admission of uncertainty. */
  asked: 70,
  /** Described — delivered by ear, so unverified. */
  described: 40,
} as const;

/** A long full explanation cost the learner more effort to absorb than a pointer. */
const MODE_WEIGHT = { explain: 12, brief: 0 } as const;

/**
 * Low confidence means Aster itself was unsure, so the learner may have received
 * a hedged or incomplete picture. Worth checking.
 */
function confidenceWeight(confidence: number) {
  return Math.round((1 - confidence) * 20);
}

/**
 * Per-concept teaching material. In production this comes back from the model
 * alongside the description; here it is supplied by the fixture.
 */
export interface ConceptNote {
  /** Points a correct explanation must touch. */
  expects: string[];
  /** A second route to the same idea, used when the learner misses it. */
  reexplain: string;
}

export function buildPracticeSet(
  descriptions: Description[],
  questions: LearnerQuestion[],
  notes: Record<string, ConceptNote> = {},
  limit = 6
): PracticeItem[] {
  const byConcept = new Map<
    string,
    { description?: Description; question?: LearnerQuestion }
  >();

  for (const description of descriptions) {
    const entry = byConcept.get(description.concept) ?? {};
    // Keep the fullest description of a concept if it was described twice.
    if (!entry.description || description.mode === 'explain') {
      entry.description = description;
    }
    byConcept.set(description.concept, entry);
  }

  for (const question of questions) {
    const entry = byConcept.get(question.concept) ?? {};
    entry.question = question;
    byConcept.set(question.concept, entry);
  }

  const items: PracticeItem[] = [];

  for (const [concept, { description, question }] of byConcept) {
    let reason: PracticeReason;
    if (description && question) reason = 'both';
    else if (question) reason = 'asked';
    else reason = 'described';

    let priority = PRIORITY[reason];
    if (description) {
      priority += MODE_WEIGHT[description.mode];
      priority += confidenceWeight(description.confidence);
    }
    // Aster hedging on an answer is a strong signal the learner is still short.
    if (question && !question.grounded) priority += 15;

    const sourceTime = question?.time ?? description?.time ?? 0;

    items.push({
      id: `practice-${concept.replace(/\s+/g, '-').toLowerCase()}`,
      concept,
      reason,
      sourceTime,
      prompt: buildPrompt(concept, reason, sourceTime),
      // Whatever the learner actually received about this concept: the
      // description they heard, or failing that the answer they were given.
      reference: description?.text ?? question?.answer ?? concept,
      expects: notes[concept]?.expects ?? [],
      reexplain: notes[concept]?.reexplain ?? '',
      priority,
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

/**
 * Prompts name where the concept came from, so the learner can place it. Open
 * response throughout: a list of options cannot be held in working memory when
 * it arrives through a speaker.
 */
function buildPrompt(concept: string, reason: PracticeReason, time: number) {
  const stamp = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

  switch (reason) {
    case 'both':
      return `You asked me about ${concept} at ${stamp}, and it was something I had to describe rather than something you could see. In your own words — what is it doing?`;
    case 'asked':
      return `At ${stamp} you stopped to ask about ${concept}. Explain it back to me now.`;
    case 'described':
      return `I described ${concept} at ${stamp} — you heard it rather than saw it. What was it showing?`;
  }
}

/** Human-readable justification, shown next to each question. */
export function explainReason(reason: PracticeReason) {
  switch (reason) {
    case 'both':
      return 'Described by Aster, and you asked about it';
    case 'asked':
      return 'You asked about this';
    case 'described':
      return 'Reached you by ear, not by eye';
  }
}
