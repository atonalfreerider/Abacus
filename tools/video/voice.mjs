// ElevenLabs narration with word timings. Every line is cached by a hash of its text,
// voice and settings, so re-rendering a video (or its other format) costs nothing.
// Key: ELEVENLABS_API_KEY, or a file named by ELEVENLABS_KEY_FILE (default ~/Desktop/eleven-key.txt).
// Voice: ELEVENLABS_VOICE (a voice name or id, default JohnV4).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const API = 'https://api.elevenlabs.io';
export const RATE = 48000;
const CACHE = path.resolve('.cache/voice');
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const SETTINGS = {stability: .55, similarity_boost: .8, style: .15, use_speaker_boost: true, speed: .95};

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const file = process.env.ELEVENLABS_KEY_FILE || path.join(os.homedir(), 'Desktop', 'eleven-key.txt');
  if (!fs.existsSync(file)) throw Error(`No ElevenLabs key: set ELEVENLABS_API_KEY or ELEVENLABS_KEY_FILE (looked for ${file}).`);
  return fs.readFileSync(file, 'utf8').trim();
}

async function request(route, options = {}) {
  const response = await fetch(API + route, {...options, headers: {'xi-api-key': apiKey(), 'content-type': 'application/json', ...options.headers}});
  if (!response.ok) throw Error(`ElevenLabs ${route.split('?')[0]}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

let voiceId = null;
function resolveVoice() { return voiceId ||= lookupVoice(); }
async function lookupVoice() {
  const wanted = process.env.ELEVENLABS_VOICE || 'JohnV4';
  fs.mkdirSync(CACHE, {recursive: true});
  const memo = path.join(CACHE, `voice-${wanted.replace(/\W/g, '_')}.txt`);
  if (fs.existsSync(memo)) return fs.readFileSync(memo, 'utf8').trim();
  const {voices} = await request(`/v2/voices?search=${encodeURIComponent(wanted)}&page_size=100`);
  const match = voices.find(v => v.name === wanted || v.voice_id === wanted);
  if (!match) throw Error(`ElevenLabs voice "${wanted}" not found; available: ${voices.map(v => v.name).join(', ') || 'none'}.`);
  fs.writeFileSync(memo, match.voice_id);
  return match.voice_id;
}

// Characters with start/end times grouped into words (punctuation stays attached).
function words(alignment) {
  const out = [];let current = null;
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { current = null; return; }
    if (!current) out.push(current = {text: '', start: alignment.character_start_times_seconds[i]});
    current.text += ch; current.end = alignment.character_end_times_seconds[i];
  });
  return out;
}

// Returns {pcm: Int16Array at RATE Hz mono, duration, words: [{text, start, end}]}.
// Concurrent recordings share one request per line.
const pending = new Map();
export function speak(text) {
  if (!pending.has(text)) pending.set(text, synthesize(text).catch(error => { pending.delete(text); throw error; }));
  return pending.get(text);
}
async function synthesize(text) {
  const voice = await resolveVoice();
  const hash = crypto.createHash('sha256').update(JSON.stringify({text, voice, MODEL, SETTINGS})).digest('hex').slice(0, 20);
  const base = path.join(CACHE, hash), mp3 = base + '.mp3', json = base + '.json', raw = base + '.pcm';
  if (!fs.existsSync(json)) {
    const result = await request(`/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {method: 'POST', body: JSON.stringify({text, model_id: MODEL, voice_settings: SETTINGS})});
    fs.writeFileSync(mp3, Buffer.from(result.audio_base64, 'base64'));
    fs.writeFileSync(json, JSON.stringify({text, words: words(result.alignment)}, null, 1));
  }
  if (!fs.existsSync(raw)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-f', 's16le', '-ac', '1', '-ar', String(RATE), raw]);
  const bytes = fs.readFileSync(raw), pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
  return {pcm, duration: pcm.length / RATE, words: JSON.parse(fs.readFileSync(json, 'utf8')).words};
}

// Mix clips placed at their start times into one mono 16-bit WAV of the given length.
export function mixWav(clips, seconds, file) {
  const total = Math.ceil(seconds * RATE), mix = new Float32Array(total);
  for (const {start, pcm} of clips) { const offset = Math.round(start * RATE); for (let i = 0; i < pcm.length && offset + i < total; i++) mix[offset + i] += pcm[i]; }
  const data = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[i]))), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}
