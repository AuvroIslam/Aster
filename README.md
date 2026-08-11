<h1 align="center">Aster</h1>

<p align="center"><strong>Audio-first learning for blind and low-vision students.</strong></p>

Aster turns visual learning content — YouTube lessons, PDFs, lecture notes — into an
interactive, audio-first experience. It describes what the instructor never says out loud,
answers questions about the exact thing on screen, and then practises you on the parts you
had to take on trust.

```
Watch  →  Understand  →  Ask  →  Practice
```

## The problem

Most learning content is deeply visual: code on screen, a diagram, a graph, a formula. For a
blind or low-vision learner, both existing options fail. Screen readers and captions read the
*words* and miss everything the instructor points at — "as you can see here…" becomes a dead
end. Describe-everything tools narrate every frame and talk over the instructor, turning a
lesson into noise.

## What Aster does differently

**It decides before it describes.** For each candidate moment the question is not *"what is on
screen?"* but *"can the learner follow this without seeing it?"* Only when the answer is no does
Aster speak — and it speaks into a natural pause, so it never overlaps the instructor.

> The rule behind everything: silence is better than a wrong description.

**It practises the gap, not the lesson.** This is the teaching method, and it is what separates
Aster from a generic quiz generator. Two signals drive every practice question:

| Signal | Why it matters |
|---|---|
| A visual Aster had to describe | The concept reached the learner through the ear rather than the eye — second-hand, single pass, nothing to glance back at |
| A question the learner asked | An explicit, timestamped admission of uncertainty |

A concept carrying both is the highest priority in the set. A concept the instructor narrated
fully is **never tested** — the learner received it on equal terms with a sighted student, so
there is no gap to close. The logic lives in [`src/lib/practice.ts`](src/lib/practice.ts).

Miss a question and the concept is re-explained from a different angle — never the same words
again — then asked later.

## Surfaces

| Route | What it is |
|---|---|
| `/` | Landing page — the problem, the loop, the teaching method |
| `/learn` | Lesson surface: player, description timeline, tutor, practice |
| `/study` | Notes and PDFs: upload, described figures and tables, document Q&A, quizzes |

## Accessibility

Accessibility is the product, not a later pass.

- Every action has a single-key shortcut; press <kbd>?</kbd> for the full list.
- ARIA live regions announce state changes; every control is a native element.
- Visible 3px focus rings, WCAG-AA contrast, and a high-contrast mode.
- Adjustable speech rate and language.
- **`prefers-reduced-motion` is honoured throughout** — every animation in the app checks it,
  because motion here is decoration and never information.

## Running it

### 1. Prerequisites

| Requirement | Check | Install |
|---|---|---|
| Node.js 20+ | `node --version` | <https://nodejs.org> |
| yt-dlp | `yt-dlp --version` | `pip install yt-dlp` |
| ffmpeg + ffprobe | `ffmpeg -version` | `winget install Gyan.FFmpeg` · `brew install ffmpeg` |
| Gemma API key | — | <https://aistudio.google.com/apikey> (free) |

### 2. Configure

```bash
cp .env.example .env                 # add GEMMA_API_KEY
cp .env.local.example .env.local     # points the web app at the API
```

### 3. Verify, then run

```bash
npm install
npm run doctor      # checks binaries, key, a real Gemma vision call, YouTube access
npm run dev         # API on :5174, web app on :3000
```

**Do not skip the doctor.** It checks every assumption the pipeline rests on and tells you
exactly which one is missing.

## Layout

```
server/                 Express API — the whole model pipeline
  src/services/
    gemma.js            the only model client
    youtube.js          id parsing, metadata, download, subtitles
    transcript.js       caption parsing, language, context windows
    gaps.js             speech intervals, natural pauses, candidate moments
    frames.js           ffmpeg frame extraction
    comprehension.js    understand-the-whole-video pass
    timeline.js         decide-then-describe orchestration + confidence rules
    pdf.js              PDF text, table, formula and figure extraction
  src/routes/           meta, video, describe, search, doc
src/                    Next.js app
  lib/practice.ts       the gap-driven teaching method
  components/learn/     player, speech, scheduler, tutor, practice, search
  components/study/     upload, reader, document Q&A, quiz
  components/motion/    parallax, reveal, blur-in text, tilt, magnetic
```

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Motion · Express. No AI SDKs — Gemma and
Whisper are called over plain HTTPS.

## Status

| Area | State |
|---|---|
| Speech synthesis, voice selection, rate/volume | Real |
| YouTube player, transport, scheduling | Real |
| Description pipeline, frame Q&A, video search | Real — needs `GEMMA_API_KEY` |
| PDF text, table, formula, figure extraction | Real |
| Figure *description* and document quizzes | Needs the key |
| Gap-driven practice logic | Real, runs on whatever data it is given |

Both surfaces fall back to a sample lesson and sample chapter when no server is reachable, so
the interface is explorable without a key.
