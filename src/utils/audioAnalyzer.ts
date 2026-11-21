// Web Audio API (decodeAudioData) energy & onset scanner for VirtualDJ Hot Cues
// Cue 1 (Green #22C55E): "1: KÒMANSMAN" — first clean beat/percussion start (skipping intro silence)
// Cue 2 (Red #EF4444): "2: PI GOU / DROP" — peak energy section where chorus/bassline/drop hits hardest

export interface AnalyzedAudioResult {
  cue1Seconds: number;
  cue2Seconds: number;
  durationSeconds: number;
  durationFormatted: string;
  peakRms: number;
  titleGuess: string;
  artistGuess: string;
}

// In-memory store for uploaded audio raw ArrayBuffers keyed by `${packId}:${trackNumber}`
const uploadedMp3Registry = new Map<string, ArrayBuffer>();
const uploadedExtRegistry = new Map<string, string>();

export function storeUploadedMp3Buffer(
  packId: string,
  trackNumber: number,
  buffer: ArrayBuffer,
  fileExt: string = 'mp3'
): void {
  const key = `${packId}:${trackNumber}`;
  uploadedMp3Registry.set(key, buffer);
  uploadedExtRegistry.set(key, fileExt.toLowerCase());
}

export function getUploadedMp3Buffer(
  packId: string,
  trackNumber: number
): ArrayBuffer | undefined {
  return uploadedMp3Registry.get(`${packId}:${trackNumber}`);
}

export function getUploadedAudioExt(packId: string, trackNumber: number): string {
  return uploadedExtRegistry.get(`${packId}:${trackNumber}`) || 'mp3';
}

export function hasUploadedMp3Buffer(packId: string, trackNumber: number): boolean {
  return uploadedMp3Registry.has(`${packId}:${trackNumber}`);
}

export function countUploadedMp3sForPack(packId: string): number {
  let count = 0;
  const prefix = `${packId}:`;
  uploadedMp3Registry.forEach((_, key) => {
    if (key.startsWith(prefix)) count += 1;
  });
  return count;
}

export function clearUploadedMp3sForPack(packId: string): void {
  const prefix = `${packId}:`;
  Array.from(uploadedMp3Registry.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      uploadedMp3Registry.delete(key);
      uploadedExtRegistry.delete(key);
    }
  });
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.wma', '.opus'];

export function isAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) {
    return true;
  }
  const lower = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function getFileExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : 'mp3';
}

export function sortAudioFilesSequentially(files: File[]): File[] {
  return [...files].sort((a, b) => {
    const pathA = (a as File & { relativePathOverride?: string }).relativePathOverride || a.webkitRelativePath || a.name;
    const pathB = (b as File & { relativePathOverride?: string }).relativePathOverride || b.webkitRelativePath || b.name;
    return pathA.localeCompare(pathB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function extractFolderNameFromFileList(files: File[]): string | null {
  for (const file of files) {
    const rel =
      (file as File & { relativePathOverride?: string }).relativePathOverride ||
      file.webkitRelativePath ||
      '';
    if (rel.includes('/')) {
      const top = rel.split('/')[0]?.trim();
      if (top) return top;
    }
  }
  return null;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (success: (f: File) => void, error?: (err: unknown) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (err: unknown) => void) => void;
  };
}

function readAllDirectoryEntries(dirEntry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    if (!dirEntry.createReader) {
      resolve([]);
      return;
    }
    const reader = dirEntry.createReader();
    const collected: FileSystemEntryLike[] = [];

    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch || batch.length === 0) {
            resolve(collected);
          } else {
            collected.push(...batch);
            readBatch();
          }
        },
        () => resolve(collected)
      );
    };

    readBatch();
  });
}

async function traverseEntry(entry: FileSystemEntryLike, parentPath: string = ''): Promise<File[]> {
  if (entry.isFile && entry.file) {
    return new Promise((resolve) => {
      entry.file!(
        (file) => {
          if (isAudioFile(file)) {
            const annotated = file as File & { relativePathOverride?: string };
            annotated.relativePathOverride = parentPath ? `${parentPath}/${file.name}` : file.name;
            resolve([annotated]);
          } else {
            resolve([]);
          }
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const dirPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const children = await readAllDirectoryEntries(entry);
    const nested = await Promise.all(children.map((child) => traverseEntry(child, dirPath)));
    return nested.flat();
  }

  return [];
}

/**
 * Extracts all dropped audio files, recursively traversing dropped folders via webkitGetAsEntry()
 * and returning the detected folder name when a directory is dropped.
 */
export async function extractDroppedAudioFiles(
  dataTransfer: DataTransfer
): Promise<{ files: File[]; folderName: string | null }> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries: FileSystemEntryLike[] = [];

  for (const item of items) {
    const withEntry = item as DataTransferItem & {
      webkitGetAsEntry?: () => FileSystemEntryLike | null;
    };
    if (typeof withEntry.webkitGetAsEntry === 'function') {
      const entry = withEntry.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length > 0) {
    const dirEntry = entries.find((e) => e.isDirectory);
    const allFilesNested = await Promise.all(entries.map((entry) => traverseEntry(entry)));
    const audioFiles = sortAudioFilesSequentially(allFilesNested.flat());
    const folderName = dirEntry ? dirEntry.name : extractFolderNameFromFileList(audioFiles);
    return { files: audioFiles, folderName };
  }

  const fallbackFiles = sortAudioFilesSequentially(
    Array.from(dataTransfer.files || []).filter(isAudioFile)
  );
  return {
    files: fallbackFiles,
    folderName: extractFolderNameFromFileList(fallbackFiles),
  };
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function parseFilenameMetadata(filename: string): {
  artistGuess: string;
  titleGuess: string;
} {
  const base = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/^\d{1,3}\s*[-_.]\s*/, '')
    .trim();
  const dashIdx = base.indexOf(' - ');
  if (dashIdx > 0) {
    return {
      artistGuess: base.slice(0, dashIdx).trim(),
      titleGuess: base.slice(dashIdx + 3).trim(),
    };
  }
  return {
    artistGuess: 'Wesley VIP Folder',
    titleGuess: base || 'Track',
  };
}

export async function analyzeMp3FileForHotCues(
  file: File
): Promise<{ analysis: AnalyzedAudioResult; rawBuffer: ArrayBuffer; fileExt: string; decodedOk: boolean }> {
  const rawBuffer = await file.arrayBuffer();
  const fileExt = getFileExtension(file.name);
  const { artistGuess, titleGuess } = parseFilenameMetadata(file.name);

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    return {
      analysis: {
        cue1Seconds: 0.45,
        cue2Seconds: 32.0,
        durationSeconds: 210,
        durationFormatted: '3:30',
        peakRms: 0.25,
        artistGuess,
        titleGuess,
      },
      rawBuffer,
      fileExt,
      decodedOk: false,
    };
  }

  const ctx = new AudioCtx();
  try {
    // Pass a copy because decodeAudioData detaches the ArrayBuffer in browsers
    const bufferCopy = rawBuffer.slice(0);
    const audioBuffer = await ctx.decodeAudioData(bufferCopy);
    const analysis = scanDecodedAudioBuffer(audioBuffer, file.name);
    return { analysis, rawBuffer, fileExt, decodedOk: true };
  } catch {
    return {
      analysis: {
        cue1Seconds: 0.45,
        cue2Seconds: 32.0,
        durationSeconds: 210,
        durationFormatted: '3:30',
        peakRms: 0.25,
        artistGuess,
        titleGuess,
      },
      rawBuffer,
      fileExt,
      decodedOk: false,
    };
  } finally {
    void ctx.close();
  }
}

export function scanDecodedAudioBuffer(
  audioBuffer: AudioBuffer,
  filename: string
): AnalyzedAudioResult {
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const durationSeconds = audioBuffer.duration;
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

  // 1. Compute 20ms RMS windows for precise Cue 1 onset detection
  const frameSamples = Math.max(1, Math.floor(sampleRate * 0.02));
  const totalFrames = Math.floor(length / frameSamples);
  const frameRms = new Float32Array(totalFrames);
  let maxFrameRms = 0;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * frameSamples;
    let sumSq = 0;
    for (let i = 0; i < frameSamples; i++) {
      const idx = start + i;
      const sample = ch1 ? (ch0[idx] + ch1[idx]) * 0.5 : ch0[idx];
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / frameSamples);
    frameRms[f] = rms;
    if (rms > maxFrameRms) maxFrameRms = rms;
  }

  // Hot Cue 1 (Green #22C55E): First clean beat/percussion onset skipping intro silence
  const onsetThreshold = Math.max(0.02, maxFrameRms * 0.22);
  let cue1Frame = 0;
  for (let f = 0; f < totalFrames - 2; f++) {
    if (
      frameRms[f] >= onsetThreshold &&
      frameRms[f + 1] >= onsetThreshold * 0.85
    ) {
      cue1Frame = f;
      break;
    }
  }
  const cue1Seconds = Number((cue1Frame * 0.02).toFixed(2));

  // 2. Compute 1.5s sliding energy windows (0.25s hop) for Cue 2 Drop / Peak Energy
  const hopFrames = Math.max(1, Math.floor(0.25 / 0.02)); // 12 frames = 0.24s
  const windowFrames = Math.max(1, Math.floor(1.5 / 0.02)); // 75 frames = 1.5s
  const minDropTime =
    durationSeconds > 20 ? Math.max(cue1Seconds + 6, durationSeconds * 0.18) : cue1Seconds + 1;
  const minDropFrame = Math.min(
    Math.max(0, totalFrames - windowFrames - 1),
    Math.floor(minDropTime / 0.02)
  );

  let bestEnergy = -1;
  let bestStartFrame = Math.max(cue1Frame, minDropFrame);

  for (let f = Math.max(0, minDropFrame); f < totalFrames - windowFrames; f += hopFrames) {
    let energySum = 0;
    let localPeak = 0;
    for (let k = 0; k < windowFrames; k++) {
      const val = frameRms[f + k];
      energySum += val * val;
      if (val > localPeak) localPeak = val;
    }
    // Weight sustained loudness + transient impact
    const score = energySum / windowFrames + localPeak * localPeak * 0.35;
    if (score > bestEnergy) {
      bestEnergy = score;
      bestStartFrame = f;
    }
  }

  const cue2Seconds = Number(
    Math.min(
      Math.max(cue1Seconds + 0.5, bestStartFrame * 0.02),
      Math.max(0.5, durationSeconds - 0.5)
    ).toFixed(2)
  );

  const { artistGuess, titleGuess } = parseFilenameMetadata(filename);

  return {
    cue1Seconds,
    cue2Seconds,
    durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
    peakRms: Number(maxFrameRms.toFixed(4)),
    artistGuess,
    titleGuess,
  };
}

// Lightweight audition player for uploaded audio buffers at Cue 1 / Cue 2 timestamps
class CueAuditionPlayer {
  private audioEl: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private stopTimer: number | null = null;

  public stop(): void {
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  public playFromTimestamp(rawBuffer: ArrayBuffer, startSeconds: number, ext: string = 'mp3'): void {
    this.stop();
    const mime =
      ext === 'wav'
        ? 'audio/wav'
        : ext === 'ogg'
          ? 'audio/ogg'
          : ext === 'm4a' || ext === 'aac'
            ? 'audio/mp4'
            : ext === 'flac'
              ? 'audio/flac'
              : 'audio/mpeg';
    const blob = new Blob([rawBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    this.objectUrl = url;
    const audio = new Audio(url);
    this.audioEl = audio;
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = Math.min(Math.max(0, startSeconds), Math.max(0, audio.duration - 0.5));
      void audio.play();
    });
    this.stopTimer = window.setTimeout(() => {
      this.stop();
    }, 8000);
  }
}

export const cueAuditionPlayer = new CueAuditionPlayer();
