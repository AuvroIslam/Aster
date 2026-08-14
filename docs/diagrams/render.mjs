/**
 * Renders each .mmd to a light and a dark PNG at 2x.
 *
 * The sources hold structure only; the theme is injected here, so both
 * variants stay in step and the diagrams never drift apart.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9251;
const DIR = 'd:/Aster/docs/diagrams';

/**
 * Bloom yellow is the brand's single accent, so it stays the accent in both
 * variants — darkened on white, where the site's yellow would be unreadable.
 */
const THEMES = {
  light: {
    bg: '#ffffff',
    line: '#71717a',
    edgeText: '#3f3f46',
    vars: { primaryColor: '#ffffff', primaryTextColor: '#18181b', primaryBorderColor: '#a1a1aa' },
    classes: `
      classDef primary fill:#ffffff,stroke:#71717a,stroke-width:2px,color:#18181b
      classDef accent fill:#fef9c3,stroke:#a16207,stroke-width:3px,color:#713f12
      classDef muted fill:#f4f4f5,stroke:#a1a1aa,stroke-width:2px,color:#3f3f46
      classDef strong fill:#18181b,stroke:#18181b,stroke-width:2px,color:#ffffff
      classDef container fill:#fafafa,stroke:#d4d4d8,stroke-width:2px,color:#52525b
    `,
  },
  dark: {
    bg: '#0d0d0d',
    line: '#9a9a9a',
    edgeText: '#d4d4d4',
    vars: { primaryColor: '#242424', primaryTextColor: '#ffffff', primaryBorderColor: '#8a8a8a' },
    classes: `
      classDef primary fill:#282828,stroke:#9a9a9a,stroke-width:2px,color:#ffffff
      classDef accent fill:#3d310c,stroke:#f5cf16,stroke-width:3px,color:#ffe45c
      classDef muted fill:#1c1c1c,stroke:#7a7a7a,stroke-width:2px,color:#d4d4d4
      classDef strong fill:#f5f5f5,stroke:#ffffff,stroke-width:2px,color:#0d0d0d
      classDef container fill:#161616,stroke:#5c5c5c,stroke-width:2px,color:#c9c9c9
    `,
  },
};

const init = (t) =>
  `%%{init: {"theme":"base","themeVariables":{"background":"${t.bg}","fontFamily":"Segoe UI, system-ui, sans-serif","fontSize":"15px","lineColor":"${t.line}",` +
  `"primaryColor":"${t.vars.primaryColor}","primaryTextColor":"${t.vars.primaryTextColor}","primaryBorderColor":"${t.vars.primaryBorderColor}"}} }%%\n`;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mmd')).sort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aster-mmd2-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--window-size=2400,2000', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null;
for (let i = 0; i < 40; i += 1) {
  try {
    const l = await (await fetch(`http://localhost:${PORT}/json`)).json();
    target = l.find((t) => t.type === 'page');
    if (target) break;
  } catch {}
  await sleep(500);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 1;
const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}) => new Promise((r) => { const i = id++; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');

const shell = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;} #wrap{display:inline-block;padding:40px;}
svg{display:block;} .cluster-label,.nodeLabel,.edgeLabel{font-family:'Segoe UI',system-ui,sans-serif !important;}
</style></head><body><div id="wrap"></div><script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({startOnLoad:false, securityLevel:'loose'});
window.__render = async (src, bg, edgeText) => {
  document.body.style.background = bg;
  document.getElementById('wrap').style.background = bg;
  const { svg } = await mermaid.render('g' + Math.random().toString(36).slice(2), src);
  const wrap = document.getElementById('wrap');
  wrap.innerHTML = svg;
  const el = wrap.querySelector('svg');
  el.removeAttribute('style');
  const vb = (el.getAttribute('viewBox') || '').split(/[\\s,]+/).map(Number);
  if (vb.length === 4) { el.setAttribute('width', vb[2]); el.setAttribute('height', vb[3]); el.style.width = vb[2]+'px'; el.style.height = vb[3]+'px'; }
  el.style.display = 'block';
  // Edge labels default to a white chip; match the page and the text colour.
  wrap.querySelectorAll('.edgeLabel, .edgeLabel p, .edgeLabel span').forEach(n => {
    n.style.background = bg; n.style.backgroundColor = bg; n.style.color = edgeText; n.style.fill = edgeText;
  });
  return true;
};
window.__ready = true;
</script></body></html>`;

await send('Page.navigate', { url: `data:text/html,${encodeURIComponent(shell)}` });
for (let i = 0; i < 60; i += 1) {
  if (await ev('window.__ready === true').catch(() => false)) break;
  await sleep(500);
}

for (const file of files) {
  const body = fs.readFileSync(path.join(DIR, file), 'utf8');
  for (const [name, theme] of Object.entries(THEMES)) {
    const src = init(theme) + body + '\n' + theme.classes;
    try {
      await ev(`window.__render(${JSON.stringify(src)}, ${JSON.stringify(theme.bg)}, ${JSON.stringify(theme.edgeText)})`);
    } catch (err) {
      console.log(`  x ${file} [${name}]: ${String(err.message).slice(0, 200)}`);
      continue;
    }
    await sleep(700);
    const box = await ev(`(() => { const r=document.getElementById('wrap').getBoundingClientRect(); return {x:0,y:0,width:Math.ceil(r.width),height:Math.ceil(r.height)}; })()`);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 2 }, captureBeyondViewport: true });
    const out = path.join(DIR, file.replace(/\.mmd$/, `-${name}.png`));
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log(`  ok ${path.basename(out).padEnd(34)} ${box.width}x${box.height} @2x`);
  }
}

ws.close();
chrome.kill();
