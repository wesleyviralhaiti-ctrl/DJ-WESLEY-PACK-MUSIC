import JSZip from 'jszip';
import {
  FolderColorConfig,
  FolderCuesConfig,
  MusicPack,
  getFolderColorConfig,
  getFolderCuesConfig,
  resolveTrackColor,
  resolveTrackHotCues,
} from '../data/musicPacks';
import { getUploadedAudioExt, getUploadedMp3Buffer } from './audioAnalyzer';

function encodeUtf16LeWithBom(text: string): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

function createId3TextFrame(frameId: string, value: string): Uint8Array {
  const textBytes = encodeUtf16LeWithBom(value);
  const payloadSize = 1 + textBytes.length;
  const frame = new Uint8Array(10 + payloadSize);

  for (let i = 0; i < 4; i++) {
    frame[i] = frameId.charCodeAt(i);
  }
  const view = new DataView(frame.buffer);
  view.setUint32(4, payloadSize, false);
  view.setUint16(8, 0, false);
  frame[10] = 0x01;
  frame.set(textBytes, 11);
  return frame;
}

function createId3TxxxFrame(description: string, value: string): Uint8Array {
  const descBytes = encodeUtf16LeWithBom(description);
  const valBytes = encodeUtf16LeWithBom(value);
  const payloadSize = 1 + descBytes.length + 2 + valBytes.length;
  const frame = new Uint8Array(10 + payloadSize);

  frame[0] = 'T'.charCodeAt(0);
  frame[1] = 'X'.charCodeAt(0);
  frame[2] = 'X'.charCodeAt(0);
  frame[3] = 'X'.charCodeAt(0);

  const view = new DataView(frame.buffer);
  view.setUint32(4, payloadSize, false);
  view.setUint16(8, 0, false);
  frame[10] = 0x01;
  frame.set(descBytes, 11);
  frame[11 + descBytes.length] = 0x00;
  frame[12 + descBytes.length] = 0x00;
  frame.set(valBytes, 13 + descBytes.length);
  return frame;
}

function createId3CommFrame(language: string, shortDesc: string, commentText: string): Uint8Array {
  const descBytes = encodeUtf16LeWithBom(shortDesc);
  const textBytes = encodeUtf16LeWithBom(commentText);
  const payloadSize = 1 + 3 + descBytes.length + 2 + textBytes.length;
  const frame = new Uint8Array(10 + payloadSize);

  frame[0] = 'C'.charCodeAt(0);
  frame[1] = 'O'.charCodeAt(0);
  frame[2] = 'M'.charCodeAt(0);
  frame[3] = 'M'.charCodeAt(0);

  const view = new DataView(frame.buffer);
  view.setUint32(4, payloadSize, false);
  view.setUint16(8, 0, false);
  frame[10] = 0x01;
  frame[11] = language.charCodeAt(0) || 101;
  frame[12] = language.charCodeAt(1) || 110;
  frame[13] = language.charCodeAt(2) || 103;
  frame.set(descBytes, 14);
  frame[14 + descBytes.length] = 0x00;
  frame[15 + descBytes.length] = 0x00;
  frame.set(textBytes, 16 + descBytes.length);
  return frame;
}

function writeSyncsafeInt(value: number, target: Uint8Array, offset: number): void {
  target[offset] = (value >> 21) & 0x7f;
  target[offset + 1] = (value >> 14) & 0x7f;
  target[offset + 2] = (value >> 7) & 0x7f;
  target[offset + 3] = value & 0x7f;
}

function stripExistingId3v2Tag(rawBytes: Uint8Array): Uint8Array {
  if (
    rawBytes.length >= 10 &&
    rawBytes[0] === 0x49 && // 'I'
    rawBytes[1] === 0x44 && // 'D'
    rawBytes[2] === 0x33 // '3'
  ) {
    const size =
      ((rawBytes[6] & 0x7f) << 21) |
      ((rawBytes[7] & 0x7f) << 14) |
      ((rawBytes[8] & 0x7f) << 7) |
      (rawBytes[9] & 0x7f);
    const totalTagBytes = 10 + size;
    if (totalTagBytes < rawBytes.length) {
      return rawBytes.subarray(totalTagBytes);
    }
  }
  return rawBytes;
}

// Valid MPEG-1 Layer 3 frame (128 kbps, 44.1 kHz, Joint Stereo = 417 bytes)
const VALID_MP3_FRAME = (() => {
  const frame = new Uint8Array(417);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0x64;
  return frame;
})();

export interface Mp3Id3Input {
  title: string;
  artist: string;
  album: string;
  bpm: number;
  trackNumber: number;
  totalTracks: number;
  colorHex: string;
  cue1Seconds: number;
  cue2Seconds: number;
  uploadedRawBuffer?: ArrayBuffer;
}

/**
 * Builds a real binary MP3 file containing a valid ID3v2.3 header with
 * TXXX:COLOR, TXXX:VDJ_CUE_1, TXXX:VDJ_CUE_2, TXXX:HOTCUES, and COMM tags
 * for VirtualDJ 8 / 2021 / 2024+.
 */
export function buildMp3WithId3ColorAndCues(input: Mp3Id3Input): Uint8Array {
  const c1 = input.cue1Seconds.toFixed(2);
  const c2 = input.cue2Seconds.toFixed(2);

  const frames: Uint8Array[] = [
    createId3TextFrame('TIT2', input.title),
    createId3TextFrame('TPE1', input.artist),
    createId3TextFrame('TALB', input.album),
    createId3TextFrame('TRCK', `${input.trackNumber}/${input.totalTracks}`),
    createId3TextFrame('TBPM', String(input.bpm)),
    createId3TxxxFrame('COLOR', input.colorHex),
    createId3TxxxFrame('VDJ_CUE_1', `num=1;name=KÒMANSMAN;color=#22C55E;pos=${c1}`),
    createId3TxxxFrame('VDJ_CUE_2', `num=2;name=PI GOU;color=#EF4444;pos=${c2}`),
    createId3TxxxFrame(
      'HOTCUES',
      `1:KÒMANSMAN@${c1}(#22C55E)|2:PI GOU@${c2}(#EF4444)`
    ),
    createId3CommFrame(
      'eng',
      'VDJ_COLOR_CUES',
      `COLOR=${input.colorHex};CUE1=${c1}(KÒMANSMAN,#22C55E);CUE2=${c2}(PI GOU,#EF4444)`
    ),
  ];

  let framesTotalLength = 0;
  for (const f of frames) {
    framesTotalLength += f.length;
  }

  let audioPayload: Uint8Array;
  if (input.uploadedRawBuffer) {
    audioPayload = stripExistingId3v2Tag(new Uint8Array(input.uploadedRawBuffer));
  } else {
    const audioFramesCount = 4;
    audioPayload = new Uint8Array(VALID_MP3_FRAME.length * audioFramesCount);
    for (let i = 0; i < audioFramesCount; i++) {
      audioPayload.set(VALID_MP3_FRAME, i * VALID_MP3_FRAME.length);
    }
  }

  const output = new Uint8Array(10 + framesTotalLength + audioPayload.length);

  // ID3v2.3 header
  output[0] = 0x49; // 'I'
  output[1] = 0x44; // 'D'
  output[2] = 0x33; // '3'
  output[3] = 0x03; // Version 2.3.0
  output[4] = 0x00;
  output[5] = 0x00;
  writeSyncsafeInt(framesTotalLength, output, 6);

  let cursor = 10;
  for (const f of frames) {
    output.set(f, cursor);
    cursor += f.length;
  }
  output.set(audioPayload, cursor);

  return output;
}

function durationToSeconds(duration: string): number {
  const parts = duration.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return 210;
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Packages the entire folder via JSZip with ID3v2.3 tags embedded in MP3s,
 * exact VirtualDJ single-line #EXTVDJ M3U tags in "000 - PLAYLIST_VIRTUALDJ.m3u",
 * full XML database entries in "VIRTUALDJ_IMPORT_DATABASE.xml",
 * and 2-step Haitian Creole instructions in "000 - LI_MWEN_POU_VIRTUALDJ.txt".
 */
export async function buildVirtualDjColorZip(
  pack: MusicPack,
  keyCode: string,
  colorConfigOverride?: FolderColorConfig,
  cuesConfigOverride?: FolderCuesConfig
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(pack.slug) ?? zip;
  const colorConfig = colorConfigOverride ?? getFolderColorConfig(pack.id);
  const cuesConfig = cuesConfigOverride ?? getFolderCuesConfig(pack.id);

  const vdjPlaylistLines: string[] = ['#EXTM3U'];
  const vdjXmlLines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<VirtualDJ_Database Version="8.5">',
  ];
  const tracklistTxtLines: string[] = [
    `WESLEY MUSIC PACKS — ${pack.title}`,
    `Estil: ${pack.genre} | Kalite: ${pack.bitrate} | BPM: ${pack.bpmRange}`,
    `Kòd VIP Itilize: ${keyCode}`,
    `Mòd Koulè VirtualDJ: ${
      colorConfig.mode === 'rainbow'
        ? 'Koulè Otomatik Varye (Multi-Color DJ Rainbow)'
        : `Koulè Siyati (${colorConfig.solidColor})`
    }`,
    'Hot Cues Otomatik: Cue 1 = 1: KÒMANSMAN (#22C55E) | Cue 2 = 2: PI GOU (#EF4444)',
    '========================================================================',
    '',
  ];

  const totalTracks = pack.tracks.length;

  for (const track of pack.tracks) {
    const numStr = String(track.number).padStart(3, '0');
    const colorHex = resolveTrackColor(pack.id, track.number, colorConfig);
    const cues = resolveTrackHotCues(pack.id, track, cuesConfig);

    const effectiveArtist = cues.customArtist || track.artist;
    const effectiveTitle = cues.customTitle || track.title;
    const effectiveBpm = cues.customBpm || track.bpm;
    const effectiveDuration = cues.customDuration || track.duration;
    const uploadedBuffer = getUploadedMp3Buffer(pack.id, track.number);
    const uploadedExt = uploadedBuffer ? getUploadedAudioExt(pack.id, track.number) : 'mp3';
    const isMp3Format = uploadedExt === 'mp3';

    const safeFileName = `${numStr} - ${sanitizeFilename(effectiveArtist)} - ${sanitizeFilename(
      effectiveTitle
    )}.${isMp3Format ? 'mp3' : uploadedExt}`;

    const fileBinary =
      uploadedBuffer && !isMp3Format
        ? new Uint8Array(uploadedBuffer)
        : buildMp3WithId3ColorAndCues({
            title: effectiveTitle,
            artist: effectiveArtist,
            album: pack.title,
            bpm: effectiveBpm,
            trackNumber: track.number,
            totalTracks,
            colorHex,
            cue1Seconds: cues.cue1Seconds,
            cue2Seconds: cues.cue2Seconds,
            uploadedRawBuffer: uploadedBuffer,
          });

    folder.file(safeFileName, fileBinary);

    const fileSizeBytes = fileBinary.byteLength;
    const seconds = durationToSeconds(effectiveDuration);
    const c1 = cues.cue1Seconds.toFixed(2);
    const c2 = cues.cue2Seconds.toFixed(2);

    const xmlArtist = escapeXml(effectiveArtist);
    const xmlTitle = escapeXml(effectiveTitle);
    const xmlAlbum = escapeXml(pack.title);
    const xmlPath = escapeXml(safeFileName);

    // Exact VirtualDJ #EXTVDJ single-line XML tag right above the MP3 filename
    vdjPlaylistLines.push(
      `#EXTVDJ:<filesize>${fileSizeBytes}</filesize><tags author="${xmlArtist}" title="${xmlTitle}" album="${xmlAlbum}" bpm="${effectiveBpm}" color="${colorHex}" /><infos songlength="${seconds}" /><poi pos="${c1}" name="1: KÒMANSMAN" type="cue" num="1" color="#22C55E" /><poi pos="${c2}" name="2: PI GOU" type="cue" num="2" color="#EF4444" />`,
      `#EXTINF:${seconds},${effectiveArtist} - ${effectiveTitle}`,
      safeFileName
    );

    // Real VirtualDJ XML Database <Song> entry
    vdjXmlLines.push(
      `  <Song FilePath="${xmlPath}" FileSize="${fileSizeBytes}">`,
      `    <Tags Author="${xmlArtist}" Title="${xmlTitle}" Album="${xmlAlbum}" TrackNumber="${track.number}" Bpm="${effectiveBpm}" Color="${colorHex}" />`,
      `    <Infos SongLength="${seconds}" />`,
      `    <Poi Pos="${c1}" Name="1: KÒMANSMAN" Type="cue" Num="1" Color="#22C55E" />`,
      `    <Poi Pos="${c2}" Name="2: PI GOU" Type="cue" Num="2" Color="#EF4444" />`,
      '  </Song>'
    );

    tracklistTxtLines.push(
      `${numStr} - ${effectiveArtist} - ${effectiveTitle} [${effectiveBpm} BPM | ${effectiveDuration}] [Color: ${colorHex}] [1: KÒMANSMAN: ${c1}s | 2: PI GOU: ${c2}s]`
    );
  }

  vdjXmlLines.push('</VirtualDJ_Database>');

  folder.file('000 - PLAYLIST_VIRTUALDJ.m3u', vdjPlaylistLines.join('\n'));
  folder.file('VIRTUALDJ_IMPORT_DATABASE.xml', vdjXmlLines.join('\n'));
  folder.file(`00 - LIS_${totalTracks}_MIZIK.txt`, tracklistTxtLines.join('\n'));
  folder.file(
    '000 - LI_MWEN_POU_VIRTUALDJ.txt',
    [
      '========================================================================',
      'WESLEY MUSIC PACKS — KÒMAN POU W CHAJE KOULÈ & 2 HOT CUES NAN VIRTUALDJ',
      '========================================================================',
      `Folder: ${pack.title}`,
      `Kantite Mizik: ${totalTracks} Mizik nimewote an lòd (001 – ${String(totalTracks).padStart(3, '0')})`,
      `Kòd VIP Itilize: ${keyCode}`,
      '',
      'VirtualDJ 8 / 2021 / 2024+ li koulè ak Hot Cues yo dirèkteman nan playlist',
      '#EXTVDJ ak fichye XML la. Swiv 2 etap senp sa yo sèlman:',
      '',
      'ETAP 1 — DEKONPRESE (EXTRACT) FOLDER .ZIP SA A:',
      '  • Fè klik dwat sou fichye .ZIP la epi chwazi "Extract All..." pou w mete',
      '    tout dosye a (MP3 yo + 000 - PLAYLIST_VIRTUALDJ.m3u + VIRTUALDJ_IMPORT_DATABASE.xml)',
      '    nan menm folder la sou òdinatè w la.',
      '',
      'ETAP 2 — GLISE "000 - PLAYLIST_VIRTUALDJ.m3u" ANNDAN VIRTUALDJ:',
      '  • Louvri VirtualDJ epi glise fichye "000 - PLAYLIST_VIRTUALDJ.m3u" la',
      '    dirèkteman anndan browser/lis VirtualDJ la.',
      `  • Tout ${totalTracks} mizik yo ap parèt touswit ak tout KOULÈ DJ yo + 2 Smart Hot Cues yo:`,
      '      - Hot Cue 1 (Vèt #22C55E): 1: KÒMANSMAN',
      '      - Hot Cue 2 (Wouj #EF4444): 2: PI GOU',
      '',
      '(Nòt: Si w prefere enpòte XML dirèkteman, fichye VIRTUALDJ_IMPORT_DATABASE.xml la',
      'gen tout <Song>, <Tags Color="..." />, ak <Poi ... /> pou chak mizik.)',
    ].join('\n')
  );

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
