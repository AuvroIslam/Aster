/** Locating and running the external binaries (yt-dlp, ffmpeg, ffprobe). */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';

const isWindows = process.platform === 'win32';
const exe = (name) => (isWindows ? `${name}.exe` : name);

/** Extra directories worth searching when a binary is not on PATH. */
function candidateDirs() {
  const home = os.homedir();
  const dirs = [];
  if (isWindows) {
    dirs.push(
      path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Python'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python'),
      path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'),
      'C:\\ProgramData\\chocolatey\\bin',
      'C:\\ffmpeg\\bin',
    );
  } else {
    dirs.push('/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', path.join(home, '.local', 'bin'));
  }
  return dirs;
}

/** Depth-limited search for `name` beneath `dir`. */
function searchDir(dir, name, depth = 4) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const subdirs = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return full;
    if (entry.isDirectory() && depth > 0) subdirs.push(full);
  }
  for (const sub of subdirs) {
    const hit = searchDir(sub, name, depth - 1);
    if (hit) return hit;
  }
  return null;
}

const resolved = new Map();

/** Resolves a binary to an absolute path (or the bare name if it is on PATH). */
export function resolveBinary(name, override) {
  if (override) return override;
  if (resolved.has(name)) return resolved.get(name);

  const fileName = exe(name);

  // 1. On PATH?
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const full = path.join(dir, fileName);
    try {
      if (fs.statSync(full).isFile()) {
        resolved.set(name, full);
        return full;
      }
    } catch {
      /* not here */
    }
  }

  // 2. Well-known install locations.
  for (const dir of candidateDirs()) {
    const hit = searchDir(dir, fileName);
    if (hit) {
      logger.debug(`resolved ${name} -> ${hit}`);
      resolved.set(name, hit);
      return hit;
    }
  }

  resolved.set(name, null);
  return null;
}

export const ytdlpPath = () => resolveBinary('yt-dlp', config.bin.ytdlp);
export const ffmpegPath = () => resolveBinary('ffmpeg', config.bin.ffmpeg);
export const ffprobePath = () => resolveBinary('ffprobe', config.bin.ffprobe);

/** Runs a command and resolves with its output. */
export function run(command, args, { timeoutMs = 600_000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    if (!command) {
      reject(new Error('Command not found. Run `npm run doctor` to diagnose.'));
      return;
    }
    logger.debug(`exec ${path.basename(command)} ${args.join(' ')}`);
    const child = spawn(command, args, { cwd, windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(command)} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (code === 0) resolve({ stdout, stderr });
      else {
        const tail = stderr.trim().split('\n').slice(-6).join('\n');
        reject(new Error(`${path.basename(command)} exited with code ${code}\n${tail}`));
      }
    });
  });
}

/** Reports which binaries are present, for the doctor script and /api/config. */
export async function probeBinaries() {
  const probes = [
    { name: 'yt-dlp', bin: ytdlpPath(), args: ['--version'] },
    { name: 'ffmpeg', bin: ffmpegPath(), args: ['-version'] },
    { name: 'ffprobe', bin: ffprobePath(), args: ['-version'] },
  ];
  const out = {};
  for (const probe of probes) {
    if (!probe.bin) {
      out[probe.name] = { available: false, path: null, version: null };
      continue;
    }
    try {
      const { stdout } = await run(probe.bin, probe.args, { timeoutMs: 20_000 });
      out[probe.name] = {
        available: true,
        path: probe.bin,
        version: stdout.trim().split('\n')[0].slice(0, 120),
      };
    } catch (err) {
      out[probe.name] = { available: false, path: probe.bin, version: null, error: err.message };
    }
  }
  return out;
}
