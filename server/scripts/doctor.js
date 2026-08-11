#!/usr/bin/env node
/** Phase 0 — Viability Check. */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config, validateConfig } from '../src/config.js';
import { cachePath, ensureCacheDirs } from '../src/lib/cache.js';
import { ffmpegPath, probeBinaries, run } from '../src/lib/binaries.js';
import { generate, listModels, resolveModel } from '../src/services/gemma.js';
import { getTranscript } from '../src/services/transcript.js';
import { downloadVideo, getVideoInfo } from '../src/services/youtube.js';
import { extractFrame } from '../src/services/frames.js';

const full = process.argv.includes('--full');
const TEST_VIDEO = process.env.DOCTOR_VIDEO_ID || 'aircAruvnKk'; // 3Blue1Brown, captioned

const results = [];
let failures = 0;

const symbols = { pass: '✓', fail: '✗', warn: '!', skip: '-' };

async function check(name, fn, { optional = false } = {}) {
  process.stdout.write(`  ${name} ... `);
  try {
    const detail = await fn();
    results.push({ name, status: 'pass', detail });
    console.log(`${symbols.pass} ${detail || 'ok'}`);
    return true;
  } catch (err) {
    const status = optional ? 'warn' : 'fail';
    if (!optional) failures += 1;
    results.push({ name, status, detail: err.message });
    console.log(`${symbols[status === 'warn' ? 'warn' : 'fail']} ${err.message}`);
    return false;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function main() {
  console.log('VisionBridge — Phase 0 viability check\n');

  section('Configuration');
  await check('Environment configuration', async () => {
    const problems = validateConfig();
    if (problems.length) throw new Error(problems.join('; '));
    return `model "${config.gemma.model}", cache ${config.cacheDir}`;
  });
  await check('Cache directories writable', async () => {
    await ensureCacheDirs();
    const probe = cachePath('tmp', 'doctor.txt');
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe);
    return config.cacheDir;
  });

  section('External binaries');
  const binaries = await probeBinaries();
  await check('yt-dlp installed', async () => {
    if (!binaries['yt-dlp'].available) {
      throw new Error('not found — install with `pip install yt-dlp` or set YTDLP_PATH');
    }
    return binaries['yt-dlp'].version;
  });
  await check('ffmpeg installed', async () => {
    if (!binaries.ffmpeg.available) {
      throw new Error('not found — install ffmpeg or set FFMPEG_PATH');
    }
    return binaries.ffmpeg.version;
  });
  await check(
    'ffprobe installed',
    async () => {
      if (!binaries.ffprobe.available) throw new Error('not found (optional)');
      return binaries.ffprobe.version;
    },
    { optional: true },
  );

  section('Gemma');
  let modelOk = false;
  await check('API key reaches the model list', async () => {
    const models = await listModels();
    const gemma = models.filter((m) => /^gemma/i.test(m.id));
    if (!gemma.length) throw new Error('the key can see no Gemma models at all');
    return `${gemma.length} Gemma models visible`;
  });
  await check('Gemma model resolves', async () => {
    const { model, source, requested } = await resolveModel({ force: true });
    modelOk = true;
    return `${model} (requested "${requested}", ${source})`;
  });

  await check('Gemma vision works on a synthetic image', async () => {
    if (!modelOk) throw new Error('skipped — no model resolved');
    const test = await makeTestImage();

    const { text } = await generate({
      prompt: test.prompt,
      images: [{ data: test.data, mimeType: 'image/jpeg' }],
      // Gemma 4 reasons before answering and those tokens count here, so a
      // one-word answer still needs real headroom.
      maxOutputTokens: 1000,
      temperature: 0,
    });

    const answer = text.trim().toUpperCase();
    if (!answer.includes(test.expect)) {
      throw new Error(
        `model did not read the ${test.kind} test image correctly ` +
          `(expected "${test.expect}", said "${text.trim()}")`,
      );
    }
    return `${test.kind} test image read correctly ("${text.trim()}")`;
  });

  section('YouTube pipeline');
  await check('Video metadata', async () => {
    const info = await getVideoInfo(TEST_VIDEO);
    return `${info.title.slice(0, 48)} (${info.duration}s)`;
  });
  await check('Transcript extraction', async () => {
    const transcript = await getTranscript(TEST_VIDEO);
    return `${transcript.cues.length} cues, ${transcript.wordCount} words`;
  });

  if (full) {
    await check('Video download', async () => {
      const file = await downloadVideo(TEST_VIDEO);
      const stat = await fs.stat(file);
      return `${path.basename(file)} (${(stat.size / 1e6).toFixed(1)} MB)`;
    });
    await check('Frame extraction', async () => {
      const frame = await extractFrame(TEST_VIDEO, 30);
      const stat = await fs.stat(frame);
      return `${path.basename(frame)} (${(stat.size / 1024).toFixed(0)} KB)`;
    });
  } else {
    console.log(`  Video download ${symbols.skip} skipped (run with --full)`);
    console.log(`  Frame extraction ${symbols.skip} skipped (run with --full)`);
  }

  section('Result');
  const passed = results.filter((r) => r.status === 'pass').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  console.log(`  ${passed} passed, ${failures} failed, ${warned} warnings`);

  if (failures) {
    console.log('\n  Phase 0 has NOT passed. Do not continue until every check above passes.');
    process.exit(1);
  }
  console.log('\n  Phase 0 passed. The core assumptions hold.');
}

/** Fonts to try for the text test, in order, per platform. */
function findFont() {
  const windowsFonts = path.join(process.env.SystemRoot || 'C:\\Windows', 'Fonts');
  const candidates = {
    win32: ['arial.ttf', 'segoeui.ttf', 'calibri.ttf', 'consola.ttf'].map((f) =>
      path.join(windowsFonts, f),
    ),
    darwin: [
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Helvetica.ttc',
    ],
    linux: [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
      path.join(os.homedir(), '.local/share/fonts/DejaVuSans.ttf'),
    ],
  };
  return (candidates[process.platform] || candidates.linux).find((file) => existsSync(file)) || null;
}

/** ffmpeg filter arguments are colon-delimited, so a Windows drive letter has to be escaped or the. */
function escapeFontPath(file) {
  return file.replace(/\\/g, '/').replace(/:/g, '\\:');
}

/** Builds the image used to prove Gemma's vision works, and the question to ask about it. */
async function makeTestImage() {
  const bin = ffmpegPath();
  if (!bin) throw new Error('ffmpeg is required to build the vision test image');
  await ensureCacheDirs();

  const target = cachePath('tmp', 'doctor-vision-test.jpg');
  const font = findFont();

  if (font) {
    try {
      await run(
        bin,
        [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-f', 'lavfi', '-i', 'color=c=white:s=512x256',
          '-vf',
          `drawtext=fontfile='${escapeFontPath(font)}':text='VISION':fontcolor=black:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2`,
          '-frames:v', '1', target,
        ],
        { timeoutMs: 30_000 },
      );
      return {
        data: (await fs.readFile(target)).toString('base64'),
        prompt:
          'This image contains one large word in the centre. Reply with that word only, in uppercase, nothing else.',
        expect: 'VISION',
        kind: 'text',
      };
    } catch (err) {
      console.log(`\n    (text rendering unavailable: ${err.message.split('\n')[0]})`);
    }
  }

  // Font-free fallback.
  await run(
    bin,
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=red:s=512x256',
      '-frames:v', '1', target,
    ],
    { timeoutMs: 30_000 },
  );
  return {
    data: (await fs.readFile(target)).toString('base64'),
    prompt: 'What single colour fills this image? Reply with the colour name only, in uppercase.',
    expect: 'RED',
    kind: 'colour',
  };
}

main().catch((err) => {
  console.error(`\nDoctor crashed: ${err.stack || err.message}`);
  process.exit(1);
});
