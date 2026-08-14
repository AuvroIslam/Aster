/**
 * Prompts for spoken retrieval practice and document questions.
 *
 * The learner answers out loud and hears the reply, so feedback has to work in
 * the ear: no markdown, no lists, and short enough to hold. Grading is
 * deliberately generous — this is retrieval practice, not an exam. Someone who
 * has the idea but not the vocabulary has understood it.
 */

const VOICE_RULES = `
- Plain spoken prose. No markdown, no bullet points, no headings.
- Speak directly to the learner as "you".
- Two or three short sentences at most.
- Never say "as you can see" or refer to anything visual — they cannot see it.`;

/**
 * Writes tutor questions about the lesson's actual subject matter.
 *
 * Not "what did I describe at 6:55" — that tests memory of Aster rather than
 * understanding of the topic, and a learner cannot revise from it. A real tutor
 * asks what the difference between two ideas is, or why something is done a
 * certain way. Concepts the learner received only through description, or
 * stopped to ask about, are prioritised — those are the ones they got
 * second-hand — but the question itself is always about the subject.
 */
export function buildQuestionsPrompt({ title, summary, keyConcepts, transcript, focus, count, language }) {
  const focusBlock = focus?.length
    ? `\nPRIORITISE THESE, they reached the learner second-hand or they asked about them:\n${focus
        .map((f) => `- ${f}`)
        .join('\n')}\n`
    : '';

  const conceptBlock = keyConcepts?.length
    ? `\nKEY CONCEPTS IN THIS LESSON:\n${keyConcepts.map((c) => `- ${c}`).join('\n')}\n`
    : '';

  return `You are Aster, setting spoken practice questions on a lesson a blind
learner has just worked through.

LESSON: "${title}"
${summary ? `WHAT IT COVERS: ${summary}\n` : ''}${conceptBlock}${focusBlock}
Write ${count} questions that a good tutor would ask to check the learner has
understood the subject. Good questions ask for a distinction, a reason, a
mechanism, or a consequence — for example "what is the fundamental difference
between the data plane and the control plane?" or "why does a router need a
forwarding table at all?".

Rules:
- Ask about the subject, never about the lesson's presentation. Never mention
  timestamps, slides, figures, diagrams, or anything Aster said or described.
  "What was on screen at 6:55" is exactly what not to write.
- Each question must be answerable from the lesson content below.
- Open response, never multiple choice: a list of options cannot be held in the
  ear.
- One idea per question. Short enough to be spoken and remembered.
- Order them from most central to least.

For each question also write the answer you would accept, in two or three
sentences. That answer is the only thing their spoken reply gets judged
against, so it must be complete and drawn from the lesson.

Write both the questions and the answers in ${language}.

Reply with JSON only:
{"questions":[{"question":"...","concept":"a short name for the idea","answer":"..."}]}

THE LESSON CONTENT FOLLOWS.
---
${transcript}
---`;
}

/**
 * Judges a spoken answer.
 *
 * `reference` is what Aster originally said about the concept, which is the
 * only ground truth available — the learner is being asked to recall exactly
 * that. The model must not mark them down for missing something never said.
 */
export function buildGradePrompt({ concept, question, reference, answer, language }) {
  return `You are Aster, checking a blind learner's spoken recall.

THE CONCEPT: ${concept}
WHAT YOU ASKED: ${question}
WHAT YOU ORIGINALLY TOLD THEM (the only ground truth — do not expect anything beyond this):
"""
${reference}
"""
WHAT THEY SAID BACK:
"""
${answer}
"""

Judge how well their answer recalls the idea. Be generous: they answered out
loud from memory, so award understanding over wording, and never penalise
missing detail you never gave them. Slips of speech and half-sentences are
normal in speech — read past them to the meaning.

Reply with JSON only:
{
  "verdict": "correct" | "partial" | "missed",
  "feedback": "spoken feedback, addressed to the learner"
}

"correct" — they have the idea. Confirm it in one sentence and add one thing
worth knowing. "partial" — they have some of it. Say what they got, then supply
the missing piece. "missed" — they did not recall it, or they said they do not
know. Do not scold; explain the idea again from a different angle than the
original wording, so a second hearing gives them a new way in.

Write the feedback in ${language}.
${VOICE_RULES}`;
}

/** The learner ran out of time or said nothing useful. */
export function buildTimeoutPrompt({ concept, reference, language }) {
  return `You are Aster, helping a blind learner who has gone quiet on a
practice question about "${concept}". They may be stuck, or thinking, or unsure
how to start.

WHAT YOU ORIGINALLY TOLD THEM:
"""
${reference}
"""

Give them a hint — not the whole answer. Point at the first step or the shape
of the idea, enough to unstick them, and invite them to try again.

Write it in ${language}.
${VOICE_RULES}

Reply with the hint only.`;
}

/** A question about the document being read. */
export function buildDocQuestionPrompt({ title, question, context, page, language }) {
  return `You are Aster, answering a blind learner's question about a study
document you are reading aloud to them.

DOCUMENT: "${title}"${page ? `\nTHEY ARE ON PAGE ${page}.` : ''}
THEIR QUESTION, AS SPEECH RECOGNITION HEARD IT: ${question}

THE RELEVANT TEXT FROM THE DOCUMENT:
"""
${context}
"""

The question was spoken aloud and transcribed, so it may contain mishearings —
"in this page" is easily heard as "English page", and technical terms come
through mangled. Work out what they most plausibly meant, in the context of the
page they are on, and answer that. Never quote their wording back at them, and
never open by apologising for, or commenting on, how the question was phrased:
they cannot see the transcript, so a remark about it is confusing noise.

If they are asking broadly what this page is or what it covers — "what is on
this page", "what is this about", "explain this" — just explain the page.

Answer from the text above. Only if it genuinely does not contain the answer,
say so in one short sentence and then say what the page does cover — never
invent an answer.

Write it in ${language}.
${VOICE_RULES.replace('- Two or three short sentences at most.', '- Keep it under about 90 words.')}

Reply with the answer only.`;
}

export default { buildGradePrompt, buildTimeoutPrompt, buildDocQuestionPrompt };
