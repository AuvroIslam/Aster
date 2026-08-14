# Diagrams

Three diagrams, each rendered light and dark from one source.

| Source | What it shows |
|---|---|
| `01-system-architecture.mmd` | Every moving part and how a request travels: browser → API → pipeline → Gemma, with the cache and the three-key fallback ladder |
| `02-how-aster-works.mmd` | The decide-then-describe pipeline, and the confidence rule that keeps Aster quiet |
| `03-solution-overview.mmd` | The ecosystem: what a learner brings, the Watch → Understand → Ask → Practice loop, what they leave with |

**Use the light PNGs for slides, print and submission documents** — they survive a
projector and a greyscale printer. The dark ones match the product's own
interface, for the website or a dark deck.

## Colour

Bloom yellow is the product's single accent — on the site it marks Aster and
nothing else, so here it marks only Aster itself and the moments where Aster
decides. Everything else is neutral. On white the yellow is darkened to
`#a16207`, because the interface yellow is unreadable on a light background.

## Re-rendering

The `.mmd` files hold structure only; the palette lives in `render.mjs`, so both
variants stay in step and cannot drift apart.

```bash
node docs/diagrams/render.mjs
```

It drives the Chrome already installed on the machine, so there is nothing to
install — no `mermaid-cli`, no second Chromium. Output is 2× for crisp text when
scaled. Editing a `.mmd` and re-running regenerates both PNGs for it.
