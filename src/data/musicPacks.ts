import customDefaultFoldersJson from './customDefaultFolders.json';

export interface TrackItem {
  number: number;
  title: string;
  artist: string;
  bpm: number;
  duration: string;
  mixType: string;
}

export interface MusicPack {
  id: string;
  slug: string;
  title: string;
  filename?: string;
  subtitle: string;
  genre: string;
  trackCount: number;
  fileSize: string;
  bitrate: string;
  bpmRange: string;
  coverImage: string;
  tracks: TrackItem[];
  isCustomUpload?: boolean;
  isComingSoon?: boolean;
  colorConfig?: FolderColorConfig;
  cuesConfig?: FolderCuesConfig;
}

export type FolderColorMode = 'rainbow' | 'solid';

export interface DjColorPreset {
  hex: string;
  name: string;
  label: string;
}

export interface FolderColorConfig {
  packId: string;
  mode: FolderColorMode;
  solidColor: string;
  trackColors: Record<number, string>;
}

export const DJ_RAINBOW_COLORS: DjColorPreset[] = [
  { hex: '#EF4444', name: 'Red', label: 'Wouj (Rabòday)' },
  { hex: '#3B82F6', name: 'Blue', label: 'Ble (Konpa)' },
  { hex: '#22C55E', name: 'Green', label: 'Vèt (Afrobeat)' },
  { hex: '#F59E0B', name: 'Gold', label: 'Lò (VIP Hits)' },
  { hex: '#A855F7', name: 'Purple', label: 'Vyolèt (Drill)' },
  { hex: '#06B6D4', name: 'Cyan', label: 'Syàn (Club)' },
];

export const FOLDER_COLORS_STORAGE_KEY = 'wesley_folder_color_configs_v1';

const DEFAULT_SOLID_COLORS_BY_PACK: Record<string, { mode: FolderColorMode; hex: string }> = {
  'konpa-gouyad-vip-2026': { mode: 'solid', hex: '#3B82F6' },
  'raboday-kanaval-2026': { mode: 'solid', hex: '#EF4444' },
  'rap-kreyol-trap-2026': { mode: 'solid', hex: '#A855F7' },
  'afrobeat-amapiano-2026': { mode: 'solid', hex: '#22C55E' },
  'konpa-love-douceur-vip': { mode: 'solid', hex: '#06B6D4' },
  'raboday-rara-lajan': { mode: 'solid', hex: '#EF4444' },
  'rap-kreyol-drill-vip': { mode: 'solid', hex: '#A855F7' },
  'afrobeat-dancehall-fusion': { mode: 'solid', hex: '#22C55E' },
  'konpa-classic-retro': { mode: 'solid', hex: '#F59E0B' },
  'wesley-mega-club-transitions': { mode: 'rainbow', hex: '#F59E0B' },
};

export function loadAllFolderColorConfigs(): Record<string, FolderColorConfig> {
  try {
    const raw = window.localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FolderColorConfig>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getFolderColorConfig(packId: string): FolderColorConfig {
  const all = loadAllFolderColorConfigs();
  if (all[packId]) {
    return all[packId];
  }
  const liveMatch = (customDefaultFoldersJson as MusicPack[]).find((p) => p.id === packId);
  if (liveMatch?.colorConfig) {
    return liveMatch.colorConfig;
  }
  const def = DEFAULT_SOLID_COLORS_BY_PACK[packId] ?? { mode: 'rainbow', hex: '#3B82F6' };
  return {
    packId,
    mode: def.mode,
    solidColor: def.hex,
    trackColors: {},
  };
}

export function saveFolderColorConfig(config: FolderColorConfig): void {
  const all = loadAllFolderColorConfigs();
  all[config.packId] = config;
  window.localStorage.setItem(FOLDER_COLORS_STORAGE_KEY, JSON.stringify(all));
}

export function resolveTrackColor(
  packId: string,
  trackNumber: number,
  configOverride?: FolderColorConfig
): string {
  const cfg = configOverride ?? getFolderColorConfig(packId);
  const individual = cfg.trackColors?.[trackNumber];
  if (individual) {
    return individual.toUpperCase();
  }
  if (cfg.mode === 'rainbow') {
    return DJ_RAINBOW_COLORS[(trackNumber - 1) % DJ_RAINBOW_COLORS.length].hex;
  }
  return (cfg.solidColor || '#3B82F6').toUpperCase();
}

export interface TrackHotCues {
  cue1Seconds: number; // Green #22C55E - "1: KÒMANSMAN"
  cue2Seconds: number; // Red #EF4444 - "2: PI GOU / DROP"
  source?: 'auto-scan' | 'manual' | 'default';
  customTitle?: string;
  customArtist?: string;
  customBpm?: number;
  customDuration?: string;
}

export interface FolderCuesConfig {
  packId: string;
  tracks: Record<number, TrackHotCues>;
}

export const FOLDER_CUES_STORAGE_KEY = 'wesley_folder_hot_cues_v1';

export function loadAllFolderCuesConfigs(): Record<string, FolderCuesConfig> {
  try {
    const raw = window.localStorage.getItem(FOLDER_CUES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FolderCuesConfig>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getFolderCuesConfig(packId: string): FolderCuesConfig {
  const all = loadAllFolderCuesConfigs();
  if (all[packId]) {
    return all[packId];
  }
  const liveMatch = (customDefaultFoldersJson as MusicPack[]).find((p) => p.id === packId);
  if (liveMatch?.cuesConfig) {
    return liveMatch.cuesConfig;
  }
  return {
    packId,
    tracks: {},
  };
}

export function saveFolderCuesConfig(config: FolderCuesConfig): void {
  const all = loadAllFolderCuesConfigs();
  all[config.packId] = config;
  window.localStorage.setItem(FOLDER_CUES_STORAGE_KEY, JSON.stringify(all));
}

export function computeDefaultHotCues(bpm: number, trackNumber: number): TrackHotCues {
  const beatSec = 60 / Math.max(85, Math.min(160, bpm));
  // Clean beat onset typically after 2–4 beats (skip intro silence), Drop at ~32–64 beats
  const introBeats = 2 + (trackNumber % 3) * 2;
  const dropBeats = 48 + (trackNumber % 4) * 16;
  return {
    cue1Seconds: Number((introBeats * beatSec).toFixed(2)),
    cue2Seconds: Number((dropBeats * beatSec).toFixed(2)),
    source: 'default',
  };
}

export function resolveTrackHotCues(
  packId: string,
  track: TrackItem,
  configOverride?: FolderCuesConfig
): TrackHotCues {
  const cfg = configOverride ?? getFolderCuesConfig(packId);
  const saved = cfg.tracks?.[track.number];
  if (saved) {
    return saved;
  }
  return computeDefaultHotCues(track.bpm, track.number);
}

export interface FolderPlan {
  id: string;
  folders: number;
  label: string;
  shortLabel: string;
  badge?: string;
  subtitle: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

export interface VipKeyRecord {
  code: string;
  totalFolders: number;
  remainingFolders: number;
  downloadedPackIds: string[];
  createdAt: number;
  activatedAt?: number;
  activatedDeviceToken?: string;
  burned?: boolean;
  burnedAt?: number;
  note?: string;
}

export const HERO_IMAGE = '/src/assets/images/hero_studio_console_1795118961756.jpg';

export const ADMIN_KEYS_STORAGE_KEY = 'wesley_vip_keys_db_v1';
export const ACTIVE_KEY_STORAGE_KEY = 'wesley_active_vip_key_v2';
export const DEVICE_TOKEN_STORAGE_KEY = 'wesley_device_token_v1';

export const FOLDER_PLANS: FolderPlan[] = [
  {
    id: '10-folder',
    folders: 10,
    label: '📁 9 + 1 Folder GRATIS (10 Folder Total · 1,000 Mizik)',
    shortLabel: '9 + 1 Folder GRATIS',
    badge: '10 Folder Total',
    subtitle: '1,000 Mizik .ZIP an Lòd',
    description: 'Chwazi nenpòt 10 folder konplè (1,000 mizik) nan katalòg la pou w telechaje.',
    features: [
      '10 Kredi Folder (.ZIP) — 1,000 mizik an lòd',
      'Kalite MP3 320kbps pare pou telefòn ak VirtualDJ',
      'Livrezon Kle VIP otomatik touswit aprè peman',
    ],
  },
  {
    id: '21-folder',
    folders: 21,
    label: '📁 20 + 1 Folder GRATIS (21 Folder Total · 2,100 Mizik)',
    shortLabel: '20 + 1 Folder GRATIS',
    badge: '21 Folder Total',
    subtitle: '2,100 Mizik .ZIP an Lòd',
    description: 'Pi bon chwa POPILÈ a: 21 folder .ZIP konplè (2,100 mizik) nan tout estil.',
    features: [
      '21 Kredi Folder (.ZIP) — 2,100 mizik total',
      'Pa gen dat ekspirasyon tan: itilize kredi yo lè w vle',
      'Koulè VirtualDJ + 2 Hot Cues pare',
    ],
    recommended: true,
  },
  {
    id: '36-folder',
    folders: 36,
    label: '📁 35 + 1 Folder GRATIS (36 Folder Total · 3,600 Mizik)',
    shortLabel: '35 + 1 Folder GRATIS',
    badge: '36 Folder Total',
    subtitle: '3,600 Mizik .ZIP an Lòd',
    description: 'Pou DJ ak amatè ki vle yon gwo baz mizik Karayib ak Entènasyonal.',
    features: [
      '36 Kredi Folder (.ZIP) — 3,600 mizik total',
      'Telechaje 36 gwo pake yo nan pwòp ritm ou',
      'Peman otomatik sekirize (Kat Vityèl / USDT / Kat Bankè)',
    ],
  },
  {
    id: '55-folder',
    folders: 55,
    label: '📁 55 Folder (5,500 Mizik .ZIP an Lòd)',
    shortLabel: '55 Folder',
    subtitle: '5,500 Mizik .ZIP an Lòd',
    description: 'Gwo pakè DJ pwofesyonèl: 55 folder .ZIP (5,500 mizik) nan yon sèl Kle VIP.',
    features: [
      '55 Kredi Folder (.ZIP) — 5,500 mizik total',
      'Aksè pou telechaje tout gwo koleksyon Wesley Music Packs yo',
      'Pi gwo ekonomi pou DJ pwofesyonèl',
    ],
  },
  {
    id: 'unlimited-vip',
    folders: 999,
    label: "👑 KLE VIP ILIMITE (♾️ Folder a L'Infini)",
    shortLabel: '👑 KLE VIP ILIMITE',
    subtitle: "♾️ Telechajman a L'Infini ak tout folder .ZIP yo",
    description: "Aksè konplè a l'infini sou tout folder .ZIP yo + mizik VirtualDJ yo.",
    features: [
      "Telechajman a L'Infini sou tout folder .ZIP yo",
      'Koulè VirtualDJ + 2 Hot Cues pare sou tout pake yo',
      'Telechajman dirèk ak vitès maksimòm sou tout aparèy',
    ],
  },
];

export function getOrCreateDeviceToken(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (existing) return existing;
    const created = `DEV-${Math.random().toString(36).slice(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    window.localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, created);
    return created;
  } catch {
    return 'DEV-SESSION';
  }
}

export function loadAllVipKeys(): VipKeyRecord[] {
  try {
    const raw = window.localStorage.getItem(ADMIN_KEYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VipKeyRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllVipKeys(keys: VipKeyRecord[]): void {
  window.localStorage.setItem(ADMIN_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

const RANDOM_UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I/O for clarity
const RANDOM_DIGIT_CHARS = '23456789'; // Exclude 0/1 for clarity
const RANDOM_SYMBOL_CHARS = '#@$*';
const RANDOM_MIXED_CHARS = `${RANDOM_UPPER_CHARS}${RANDOM_DIGIT_CHARS}`;

function pickRandom(charset: string): string {
  return charset.charAt(Math.floor(Math.random() * charset.length));
}

/**
 * Generates a short, hard-to-guess 6-to-8 char VIP code using an editable prefix/pattern.
 * Example outputs: W#84K2, JW@91X, W$52M9
 */
export function generateShortSecretCode(
  rawPrefix: string = 'W#',
  existingKeys: VipKeyRecord[] = loadAllVipKeys()
): string {
  const cleanPrefix = rawPrefix.trim().toUpperCase().replace(/\s+/g, '');
  const existingSet = new Set(existingKeys.map((k) => k.code.toUpperCase()));

  for (let attempt = 0; attempt < 150; attempt++) {
    let suffix = '';
    if (cleanPrefix) {
      const targetSuffixLen = Math.max(4, Math.min(6, 7 - cleanPrefix.length));
      // Guarantee at least one digit and one uppercase letter in suffix
      const chars: string[] = [pickRandom(RANDOM_DIGIT_CHARS), pickRandom(RANDOM_UPPER_CHARS)];
      while (chars.length < targetSuffixLen) {
        chars.push(pickRandom(RANDOM_MIXED_CHARS));
      }
      // Shuffle chars
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      suffix = chars.join('');
    } else {
      // Full 6-char mixed format like W#84K2
      const chars = [
        pickRandom(RANDOM_UPPER_CHARS),
        pickRandom(RANDOM_SYMBOL_CHARS),
        pickRandom(RANDOM_DIGIT_CHARS),
        pickRandom(RANDOM_DIGIT_CHARS),
        pickRandom(RANDOM_UPPER_CHARS),
        pickRandom(RANDOM_MIXED_CHARS),
      ];
      suffix = chars.join('');
    }

    const candidate = `${cleanPrefix}${suffix}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  return `${cleanPrefix || 'W#'}${Math.floor(1000 + Math.random() * 9000)}`;
}

export function createVipKeyRecord(
  folderQuota: number,
  customCode: string,
  note?: string
): { success: boolean; record?: VipKeyRecord; error?: string } {
  const normalizedCode = customCode.trim().toUpperCase().replace(/\s+/g, '');

  if (normalizedCode.length < 4 || normalizedCode.length > 16) {
    return {
      success: false,
      error: 'Kòd VIP la dwe genyen ant 4 ak 16 karaktè (egzanp: W#84K2 oswa W*94K#).',
    };
  }

  const existing = loadAllVipKeys();
  if (existing.some((k) => k.code.toUpperCase() === normalizedCode)) {
    return {
      success: false,
      error: `Kòd "${normalizedCode}" deja egziste. Chanje kòd la oswa jenere yon lòt.`,
    };
  }

  const record: VipKeyRecord = {
    code: normalizedCode,
    totalFolders: folderQuota,
    remainingFolders: folderQuota,
    downloadedPackIds: [],
    createdAt: Date.now(),
    burned: false,
    note: note?.trim() || undefined,
  };

  saveAllVipKeys([record, ...existing]);
  return { success: true, record };
}

export function getVipKeyByCode(rawCode: string): VipKeyRecord | null {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return null;
  const keys = loadAllVipKeys();
  return keys.find((k) => k.code.toUpperCase() === normalized) || null;
}

export function getVipKeyStatus(record: VipKeyRecord): 'available' | 'in_progress' | 'burned' {
  if (record.burned || record.remainingFolders <= 0) {
    return 'burned';
  }
  if (record.activatedAt || record.downloadedPackIds.length > 0) {
    return 'in_progress';
  }
  return 'available';
}

export function validateVipKeyCode(rawCode: string): {
  status: 'valid' | 'burned' | 'invalid';
  record?: VipKeyRecord;
  error?: string;
} {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) {
    return {
      status: 'invalid',
      error: 'Tanpri antre Kòd VIP ou a anvan ou klike sou bouton an.',
    };
  }

  const keys = loadAllVipKeys();
  const idx = keys.findIndex((k) => k.code.toUpperCase() === normalized);
  if (idx === -1) {
    return {
      status: 'invalid',
      error:
        'Kòd VIP sa a pa egziste nan sistèm nan. Verifye Kòd Prepeye ou a oswa achte yon nouvo Kle VIP otomatik anba a.',
    };
  }

  const record = keys[idx];
  const deviceToken = getOrCreateDeviceToken();

  // Strictly burned or 0 remaining folders -> permanently rejected
  if (record.burned || record.remainingFolders <= 0) {
    return {
      status: 'burned',
      record,
      error: '🚫 KÒD SA A DEJA SÈVI / EKSPIRE',
    };
  }

  // Strictly single-use across devices/sessions: if already activated on another device, reject & burn
  if (record.activatedDeviceToken && record.activatedDeviceToken !== deviceToken) {
    return {
      status: 'burned',
      record,
      error: '🚫 KÒD SA A DEJA SÈVI / EKSPIRE',
    };
  }

  // First activation: bind this single-use code to this device/session
  if (!record.activatedAt || !record.activatedDeviceToken) {
    const activatedRecord: VipKeyRecord = {
      ...record,
      activatedAt: Date.now(),
      activatedDeviceToken: deviceToken,
    };
    keys[idx] = activatedRecord;
    saveAllVipKeys(keys);
    return {
      status: 'valid',
      record: activatedRecord,
    };
  }

  return {
    status: 'valid',
    record,
  };
}

export function consumeFolderCredit(
  code: string,
  packId: string
): {
  allowed: boolean;
  updatedRecord: VipKeyRecord | null;
  wasAlreadyDownloaded: boolean;
  justExhausted: boolean;
} {
  const keys = loadAllVipKeys();
  const idx = keys.findIndex((k) => k.code.toUpperCase() === code.trim().toUpperCase());
  if (idx === -1) {
    return {
      allowed: false,
      updatedRecord: null,
      wasAlreadyDownloaded: false,
      justExhausted: false,
    };
  }

  const current = keys[idx];
  if (current.burned || current.remainingFolders <= 0) {
    return {
      allowed: false,
      updatedRecord: current,
      wasAlreadyDownloaded: current.downloadedPackIds.includes(packId),
      justExhausted: true,
    };
  }

  const isUnlimited = current.totalFolders >= 999;
  const alreadyDownloaded = current.downloadedPackIds.includes(packId);
  const nextRemaining =
    isUnlimited || alreadyDownloaded
      ? current.remainingFolders
      : Math.max(0, current.remainingFolders - 1);
  const nextDownloaded = alreadyDownloaded
    ? current.downloadedPackIds
    : [...current.downloadedPackIds, packId];

  const isNowBurned = !isUnlimited && nextRemaining === 0;

  const updated: VipKeyRecord = {
    ...current,
    remainingFolders: nextRemaining,
    downloadedPackIds: nextDownloaded,
    burned: isNowBurned,
    burnedAt: isNowBurned ? Date.now() : current.burnedAt,
  };

  keys[idx] = updated;
  saveAllVipKeys(keys);

  return {
    allowed: true,
    updatedRecord: updated,
    wasAlreadyDownloaded: alreadyDownloaded,
    justExhausted: !alreadyDownloaded && isNowBurned,
  };
}

function generateHundredTracks(
  seeds: Array<{ artist: string; title: string; bpm: number; duration: string }>,
  mixVariants: string[]
): TrackItem[] {
  const tracks: TrackItem[] = [];
  for (let i = 0; i < 100; i++) {
    const seed = seeds[i % seeds.length];
    const cycle = Math.floor(i / seeds.length);
    const mixType = mixVariants[(i + cycle) % mixVariants.length];
    const titleSuffix = cycle === 0 ? '' : ` (${mixType})`;

    tracks.push({
      number: i + 1,
      title: `${seed.title}${titleSuffix}`,
      artist: seed.artist,
      bpm: seed.bpm + ((cycle % 3) - 1),
      duration: seed.duration,
      mixType,
    });
  }
  return tracks;
}

const KONPA_SEEDS = [
  { artist: 'Klass', title: 'Ret Nan Liy Ou', bpm: 98, duration: '5:12' },
  { artist: 'Nu-Look', title: 'Confirmation', bpm: 94, duration: '5:40' },
  { artist: 'Kai', title: 'Malad', bpm: 96, duration: '4:48' },
  { artist: 'Enposib', title: 'Kamikaze', bpm: 102, duration: '4:35' },
  { artist: 'Vayb', title: 'Lanmou Fasil', bpm: 97, duration: '5:04' },
  { artist: 'Ekip', title: 'Bayo Love', bpm: 100, duration: '4:52' },
  { artist: 'Bedjine & K-Dilak', title: 'Pouki', bpm: 92, duration: '4:28' },
  { artist: 'Joé Dwèt Filé', title: '4 Kampé (Konpa Mix)', bpm: 101, duration: '3:58' },
  { artist: 'Harmonik', title: 'Mesi Bon Dye', bpm: 95, duration: '5:18' },
  { artist: 'T-Vice', title: 'Sa Fè Mal', bpm: 104, duration: '4:44' },
  { artist: 'Kreyòl La', title: 'Viktwa', bpm: 103, duration: '4:56' },
  { artist: 'Djakout #1', title: 'Biznis Pam', bpm: 105, duration: '5:10' },
  { artist: 'Rutshelle Guillaume', title: 'Kite M Kriye', bpm: 91, duration: '4:22' },
  { artist: 'Oswald', title: 'Pati Lwen', bpm: 96, duration: '4:15' },
  { artist: 'Alan Cavé', title: 'Se Pa Pou Dat', bpm: 93, duration: '5:30' },
  { artist: 'J-Perry ft. Shabba', title: 'Gouyad Chòk', bpm: 106, duration: '4:09' },
  { artist: 'Tonymix & Dj Bullet', title: 'Gouyad Minwi', bpm: 104, duration: '3:54' },
  { artist: 'Zenglen', title: '5 Etwal', bpm: 99, duration: '5:21' },
  { artist: 'Carimi', title: 'Bang Bang', bpm: 101, duration: '5:02' },
  { artist: 'Kenny Haiti', title: 'Mwen Pa Kapab Ankò', bpm: 97, duration: '4:39' },
];

const RABODAY_SEEDS = [
  { artist: 'Tony Mix', title: 'Soti Nan Lari A', bpm: 124, duration: '3:42' },
  { artist: 'Wendy', title: 'Dekole', bpm: 122, duration: '3:36' },
  { artist: 'Fantom', title: 'Mwen La Toujou', bpm: 120, duration: '3:50' },
  { artist: 'MechansT', title: 'Kanaval Cho', bpm: 126, duration: '3:28' },
  { artist: 'Roody Roodboy', title: 'Anlè A', bpm: 123, duration: '3:45' },
  { artist: 'T-Joe Zenny & Kreyòl La', title: 'Boulé', bpm: 125, duration: '4:01' },
  { artist: 'Izolan', title: 'Peyi Pa M', bpm: 121, duration: '3:48' },
  { artist: 'Baky', title: 'Chak Jou', bpm: 118, duration: '3:32' },
  { artist: 'Toby Anbakè', title: 'Kouri Dèyè', bpm: 124, duration: '3:39' },
  { artist: 'DJ Stakz', title: 'Rabòday VIP Riddim', bpm: 126, duration: '3:55' },
  { artist: 'Boukman Eksperyans', title: 'Kèm Pa Sote (Club Edit)', bpm: 122, duration: '4:14' },
  { artist: 'Barikad Crew', title: 'Veye Yo', bpm: 120, duration: '4:05' },
  { artist: 'D-Perfect', title: 'Sou Sa', bpm: 125, duration: '3:31' },
  { artist: 'JBeatz', title: 'Pòtoprens An Difé', bpm: 124, duration: '3:49' },
  { artist: 'Mr. Killa & Tony Mix', title: 'Rara Machine', bpm: 128, duration: '3:40' },
  { artist: 'RAM', title: 'Fèy (Carnival Bass)', bpm: 121, duration: '4:12' },
  { artist: 'Brothers Posse', title: 'Alo', bpm: 123, duration: '3:58' },
  { artist: 'T-Micky', title: 'Atò', bpm: 124, duration: '3:44' },
  { artist: 'Boulo', title: 'Vibe Lari', bpm: 125, duration: '3:35' },
  { artist: 'K-Zino', title: 'Gade Jan L Cho', bpm: 122, duration: '3:47' },
];

const AFRO_SEEDS = [
  { artist: 'Burna Boy', title: 'City Boys', bpm: 108, duration: '3:12' },
  { artist: 'Tyla', title: 'Water (Club Extended)', bpm: 112, duration: '3:48' },
  { artist: 'Rema', title: 'Calm Down (DJ Intro)', bpm: 107, duration: '3:56' },
  { artist: 'Asake', title: 'Lonely At The Top', bpm: 114, duration: '3:22' },
  { artist: 'Ayra Starr', title: 'Commas', bpm: 110, duration: '3:08' },
  { artist: 'Wizkid', title: 'Essence (Amapiano Flip)', bpm: 113, duration: '4:11' },
  { artist: 'Davido', title: 'Unavailable', bpm: 115, duration: '3:34' },
  { artist: 'Omah Lay', title: 'Soso', bpm: 106, duration: '3:25' },
  { artist: 'Tems', title: 'Love Me JeJe', bpm: 104, duration: '3:18' },
  { artist: 'Uncle Waffles', title: 'Yahyuppiyah', bpm: 116, duration: '4:20' },
  { artist: 'Vybz Kartel', title: 'Fever (Clean & Dirty)', bpm: 102, duration: '3:40' },
  { artist: 'Shenseea', title: 'Hit & Run', bpm: 105, duration: '3:19' },
  { artist: 'Popcaan', title: 'Family', bpm: 99, duration: '3:44' },
  { artist: 'Skillibeng', title: 'Crocodile Teeth', bpm: 101, duration: '3:15' },
  { artist: 'Kranium', title: 'Nobody Has To Know', bpm: 100, duration: '3:30' },
  { artist: 'Ruger', title: 'Asiwaju', bpm: 109, duration: '3:42' },
  { artist: 'Victony', title: 'Soweto', bpm: 108, duration: '3:17' },
  { artist: 'Kabza De Small', title: 'Imithandazo', bpm: 114, duration: '4:35' },
  { artist: 'CKay', title: 'Love Nwantiti (Amapiano)', bpm: 112, duration: '3:29' },
  { artist: 'YG Marley', title: 'Praise Jah In The Moonlight', bpm: 96, duration: '4:04' },
];

const HIPHOP_SEEDS = [
  { artist: 'Kendrick Lamar', title: 'Not Like Us (DJ Intro)', bpm: 101, duration: '4:34' },
  { artist: 'Future & Metro Boomin', title: 'Like That', bpm: 132, duration: '4:18' },
  { artist: 'Travis Scott', title: 'FE!N (Club Hype Edit)', bpm: 148, duration: '3:35' },
  { artist: 'Drake', title: 'Rich Baby Daddy', bpm: 144, duration: '4:02' },
  { artist: 'GloRilla', title: 'Yeah Glo!', bpm: 138, duration: '2:58' },
  { artist: 'TroubleBoy Hitmaker', title: 'Mwen Pa Pè', bpm: 128, duration: '3:24' },
  { artist: 'K-Lib', title: 'Pòtoprens', bpm: 94, duration: '3:51' },
  { artist: 'Steves J Bryan', title: 'Kote M Soti', bpm: 130, duration: '3:19' },
  { artist: 'Paska', title: 'Bèl Fanm (Trap Mix)', bpm: 126, duration: '3:27' },
  { artist: '21 Savage', title: 'redrum', bpm: 140, duration: '3:44' },
  { artist: 'Gunna', title: 'fukumean', bpm: 130, duration: '2:45' },
  { artist: 'Central Cee', title: 'Doja', bpm: 140, duration: '2:32' },
  { artist: 'Lil Baby', title: 'Freestyle (DJ Transition)', bpm: 136, duration: '3:12' },
  { artist: 'Jack Harlow', title: 'Lovin On Me', bpm: 105, duration: '2:50' },
  { artist: 'Kodak Black', title: 'Super Gremlin (Haitian Remix)', bpm: 142, duration: '3:38' },
  { artist: 'Zoe Osama', title: 'Underrated', bpm: 100, duration: '3:09' },
  { artist: 'Ninho', title: 'Jefe (Club Edit)', bpm: 129, duration: '3:21' },
  { artist: 'Aya Nakamura', title: 'Djadja (Trap Kreyòl Flip)', bpm: 102, duration: '3:14' },
  { artist: 'Wyclef Jean', title: 'Haitian Mafia (2026 Remaster)', bpm: 96, duration: '4:08' },
  { artist: 'DJ Snake & Kodak', title: 'Taki Bass VIP', bpm: 100, duration: '3:40' },
];

const ZOUK_SEEDS = [
  { artist: 'Kassav’', title: 'Sye Bwa (Remastered)', bpm: 108, duration: '4:42' },
  { artist: 'Slaï', title: 'Flamme', bpm: 94, duration: '4:18' },
  { artist: 'Medhy Custos', title: 'Elles Demandent', bpm: 92, duration: '4:09' },
  { artist: 'Fanny J', title: 'Ancrée à Ton Port', bpm: 90, duration: '4:15' },
  { artist: 'Warren', title: 'À Fleur de Peau', bpm: 91, duration: '4:31' },
  { artist: 'Kim', title: 'Je Peux T’Aimer', bpm: 93, duration: '3:58' },
  { artist: 'Nichols', title: 'Décalé', bpm: 95, duration: '4:04' },
  { artist: 'Stony', title: 'Danse Avec Moi', bpm: 94, duration: '3:50' },
  { artist: 'Kaysha', title: 'Diamonds (Kizomba Edit)', bpm: 90, duration: '4:20' },
  { artist: 'Princess Lover', title: 'Mon Soleil', bpm: 92, duration: '4:12' },
];

const KONPA_CLASSIC_SEEDS = [
  { artist: 'Tabou Combo', title: 'New York City', bpm: 110, duration: '6:05' },
  { artist: 'Sweet Micky', title: 'I Don’t Care', bpm: 106, duration: '5:35' },
  { artist: 'System Band', title: 'Anita', bpm: 104, duration: '6:12' },
  { artist: 'Djakout Mizik', title: 'Manniè', bpm: 108, duration: '5:44' },
  { artist: 'Zin', title: 'Kanpe Devan', bpm: 102, duration: '5:19' },
  { artist: 'Top Vice', title: 'Men Tèt La', bpm: 109, duration: '5:28' },
  { artist: 'Magnum Band', title: 'Pèp La', bpm: 103, duration: '5:50' },
  { artist: 'T-Vice', title: 'Tu Me Touches', bpm: 101, duration: '5:14' },
  { artist: 'Nu-Look', title: 'A Qui La Faute', bpm: 98, duration: '5:48' },
  { artist: 'Zenglen', title: 'Grev', bpm: 100, duration: '5:33' },
];

const DANCEHALL_SEEDS = [
  { artist: 'Vybz Kartel', title: 'Clarks (DJ Intro)', bpm: 98, duration: '3:28' },
  { artist: 'Sean Paul', title: 'Temperature (Club Edit)', bpm: 125, duration: '3:40' },
  { artist: 'Popcaan', title: 'Only Man She Want', bpm: 101, duration: '3:32' },
  { artist: 'Alkaline', title: 'Champion Boy', bpm: 100, duration: '3:15' },
  { artist: 'Masicka', title: 'Tyrant', bpm: 97, duration: '3:22' },
  { artist: 'Spice', title: 'So Mi Like It', bpm: 102, duration: '3:18' },
  { artist: 'Byron Messia', title: 'Talibans', bpm: 103, duration: '3:09' },
  { artist: 'Koffee', title: 'Toast (Extended)', bpm: 96, duration: '3:36' },
  { artist: 'Buju Banton', title: 'Champion (Remix)', bpm: 95, duration: '3:54' },
  { artist: 'Beenie Man', title: 'Who Am I (Sim Simma)', bpm: 99, duration: '3:44' },
];

const SOCA_SEEDS = [
  { artist: 'Machel Montano', title: 'Fast Wine', bpm: 134, duration: '3:22' },
  { artist: 'Kes', title: 'Savannah Grass', bpm: 128, duration: '3:48' },
  { artist: 'Bunji Garlin', title: 'Differentology', bpm: 136, duration: '4:02' },
  { artist: 'Patrice Roberts', title: 'Mind My Business', bpm: 130, duration: '3:31' },
  { artist: 'Nailah Blackman', title: 'Sokah', bpm: 126, duration: '3:25' },
  { artist: 'Skinny Fabulous', title: 'Famalay', bpm: 160, duration: '3:40' },
  { artist: 'Destra Garcia', title: 'Lucy', bpm: 132, duration: '3:45' },
  { artist: 'Voice', title: 'Cheers To Life', bpm: 127, duration: '3:38' },
  { artist: 'Kassav’ & Asa Bantan', title: 'Bouyon Carnival Edit', bpm: 158, duration: '3:50' },
  { artist: 'Kevin Lyttle', title: 'Turn Me On (Soca VIP)', bpm: 106, duration: '3:30' },
];

const LATIN_SEEDS = [
  { artist: 'Bad Bunny', title: 'Tití Me Preguntó (DJ Intro)', bpm: 107, duration: '4:04' },
  { artist: 'Karol G', title: 'Si Antes Te Hubiera Conocido', bpm: 128, duration: '3:26' },
  { artist: 'Feid', title: 'Luna (Club Edit)', bpm: 100, duration: '3:22' },
  { artist: 'Daddy Yankee', title: 'Gasolina (2026 Remaster)', bpm: 96, duration: '3:18' },
  { artist: 'El Alfa', title: 'La Mamá de la Mamá', bpm: 118, duration: '3:32' },
  { artist: 'Rauw Alejandro', title: 'Todo De Ti', bpm: 128, duration: '3:30' },
  { artist: 'Myke Towers', title: 'Lala', bpm: 92, duration: '3:20' },
  { artist: 'Tokischa', title: 'Delincuente (Dembow Edit)', bpm: 120, duration: '3:15' },
  { artist: 'J Balvin', title: 'Mi Gente (Festival Edit)', bpm: 105, duration: '3:45' },
  { artist: 'Ozuna', title: 'Baila Baila Baila', bpm: 100, duration: '3:14' },
];

const REMIXES_SEEDS = [
  { artist: 'Wesley VIP', title: 'Konpa To Afrobeats Transition', bpm: 100, duration: '4:18' },
  { artist: 'Wesley VIP', title: 'Rabòday 124BPM Power Mashup', bpm: 124, duration: '3:55' },
  { artist: 'Wesley VIP', title: 'Gouyad Midnight Acapella Blend', bpm: 96, duration: '4:32' },
  { artist: 'Wesley VIP', title: 'Hip-Hop to Dancehall Drop', bpm: 102, duration: '3:48' },
  { artist: 'Wesley VIP', title: 'Soca Carnival Hype Wordplay', bpm: 132, duration: '3:36' },
  { artist: 'Wesley VIP', title: 'Amapiano Konpa Log-Drum Flip', bpm: 112, duration: '4:10' },
  { artist: 'Wesley VIP', title: 'Trap Kreyòl Club Starter', bpm: 130, duration: '3:44' },
  { artist: 'Wesley VIP', title: 'Zouk Love Slow Transition', bpm: 92, duration: '4:15' },
  { artist: 'Wesley VIP', title: '90s Classic Konpa Horn Edit', bpm: 105, duration: '4:50' },
  { artist: 'Wesley VIP', title: 'TikTok Viral Soundpack MegaMix', bpm: 118, duration: '4:22' },
];

export const MUSIC_PACKS: MusicPack[] = [
  // =========================================================================
  // 10 ACTIVE .ZIP FOLDERS (KONPA, RABÒDAY, RAP KREYÒL, AK AFROBEAT)
  // =========================================================================
  {
    id: 'konpa-gouyad-vip-2026',
    slug: 'konpa-direk-gouyad-vip-2026',
    title: 'Konpa Direk & Gouyad VIP 2026',
    subtitle: '100 pi gwo hit Konpa Direk, Gouyad dous ak Live Club Edits pou sware ak machin.',
    genre: 'Konpa / Gouyad',
    trackCount: 100,
    fileSize: '1.18 GB',
    bitrate: 'MP3 320kbps',
    bpmRange: '90–106 BPM',
    coverImage: '/src/assets/images/pack_konpa_gouyad_1795118961470.jpg',
    tracks: generateHundredTracks(KONPA_SEEDS, [
      'Original Master',
      'DJ Intro 8-Bar',
      'Gouyad Extended',
      'Acapella Out',
      'Club Bass Boost',
    ]),
  },
  {
    id: 'raboday-kanaval-2026',
    slug: 'raboday-kanaval-street-mix-2026',
    title: 'Rabòday & Kanaval Street Mix 2026',
    subtitle: '100 mizik Rabòday cho, Rara, ak Kanaval ki pare pou fè nenpòt fèt pran dife.',
    genre: 'Rabòday / Kanaval',
    trackCount: 100,
    fileSize: '980 MB',
    bitrate: 'MP3 320kbps',
    bpmRange: '118–128 BPM',
    coverImage: '/src/assets/images/pack_raboday_street_1795118961602.jpg',
    tracks: generateHundredTracks(RABODAY_SEEDS, [
      'Street Master',
      'DJ Hype Intro',
      'Drum Break Edit',
      'Extended Mix',
      'Clean Radio',
    ]),
  },
  {
    id: 'rap-kreyol-trap-2026',
    slug: 'rap-kreyol-trap-lakay-vip-2026',
    title: 'Rap Kreyòl & Trap Lakay VIP 2026',
    subtitle: '100 mizik Rap Kreyòl, US Trap, ak Redrum Club Transitions ki pare pou mix.',
    genre: 'Rap Kreyòl / Trap',
    trackCount: 100,
    fileSize: '1.02 GB',
    bitrate: 'MP3 320kbps',
    bpmRange: '94–148 BPM',
    coverImage: '/src/assets/images/pack_hiphop_trap_1795118962099.jpg',
    tracks: generateHundredTracks(HIPHOP_SEEDS, [
      'Explicit Master',
      'Clean Radio',
      'DJ 16-Bar Intro',
      'Hype Transition',
      '808 Club Edit',
    ]),
  },
  {
    id: 'afrobeat-amapiano-2026',
    slug: 'afrobeat-amapiano-club-hits-2026',
    title: 'Afrobeat & Amapiano Club Hits 2026',
    subtitle: '100 mizik entènasyonal Afrobeat, Amapiano log drum ak Vibe club cho pou DJ.',
    genre: 'Afrobeat / Amapiano',
    trackCount: 100,
    fileSize: '1.05 GB',
    bitrate: 'MP3 320kbps',
    bpmRange: '96–116 BPM',
    coverImage: '/src/assets/images/pack_afro_dancehall_1795118961254.jpg',
    tracks: generateHundredTracks(AFRO_SEEDS, [
      'Club Master',
      'DJ Quick Hitter',
      'Amapiano Flip',
      'Extended Mix',
      'Clean Edit',
    ]),
  },
  {
    id: 'konpa-love-douceur-vip',
    slug: 'konpa-love-gouyad-minwi-vip',
    title: 'Konpa Love & Gouyad Minwi VIP',
    subtitle: '100 Konpa dous, Gouyad romantik ak Slow Jamz pou sware ak detant.',
    genre: 'Konpa / Gouyad',
    trackCount: 100,
    fileSize: '960 MB',
    bitrate: 'MP3 320kbps',
    bpmRange: '88–102 BPM',
    coverImage: '/src/assets/images/pack_zouk_love_1795119166319.jpg',
    tracks: generateHundredTracks(ZOUK_SEEDS, [
      'Original Master',
      'DJ Soft Intro',
      'Gouyad Extended',
      'Acoustic Blend',
      'Night Lounge Edit',
    ]),
  },
  {
    id: 'raboday-rara-lajan',
    slug: 'raboday-lari-rara-power-pack',
    title: 'Rabòday Lari & Rara Power Pack',
    subtitle: '100 Rabòday lari, bann a pye, ak riddim kanaval gwo bas pou sound system.',
    genre: 'Rabòday / Rara',
    trackCount: 100,
    fileSize: '995 MB',
    bitrate: 'MP3 320kbps',
    bpmRange: '120–130 BPM',
    coverImage: '/src/assets/images/pack_soca_carnival_1795119165054.jpg',
    tracks: generateHundredTracks(SOCA_SEEDS, [
      'Road March Master',
      'DJ Hype Loop',
      'Drum Break Edit',
      'Extended Mix',
      'Festival Edit',
    ]),
  },
  {
    id: 'rap-kreyol-drill-vip',
    slug: 'rap-kreyol-classic-drill-vip',
    title: 'Rap Kreyòl Classic & Drill VIP',
    subtitle: '100 hit Rap Kreyòl klasik ak nouvo Drill Pòtoprens pare pou set DJ.',
    genre: 'Rap Kreyòl / Drill',
    trackCount: 100,
    fileSize: '940 MB',
    bitrate: 'MP3 320kbps',
    bpmRange: '92–142 BPM',
    coverImage: '/src/assets/images/pack_latin_reggaeton_1795119165703.jpg',
    tracks: generateHundredTracks(LATIN_SEEDS, [
      'Club Master',
      'DJ 8-Bar Intro',
      'Drill Transition',
      'Extended Mix',
      'Clean Edit',
    ]),
  },
  {
    id: 'afrobeat-dancehall-fusion',
    slug: 'afrobeat-dancehall-island-mix',
    title: 'Afrobeat & Dancehall Island Mix',
    subtitle: '100 hit Afrobeat melanje ak Dancehall cho pou club, plaj ak party.',
    genre: 'Afrobeat / Dancehall',
    trackCount: 100,
    fileSize: '930 MB',
    bitrate: 'MP3 320kbps',
    bpmRange: '95–120 BPM',
    coverImage: '/src/assets/images/pack_dancehall_reggae_1795119167060.jpg',
    tracks: generateHundredTracks(DANCEHALL_SEEDS, [
      'Bashment Master',
      'DJ Riddim Intro',
      'Clean Radio',
      'Sound System Dub',
      'Quick Hitter',
    ]),
  },
  {
    id: 'konpa-classic-retro',
    slug: 'konpa-retro-classic-90s-2000s',
    title: 'Konpa Retro & Classic 90s–2000s',
    subtitle: '100 klasik Konpa ki fè istwa: Tabou Combo, System Band, Zin, Carimi ak plis.',
    genre: 'Konpa Classic',
    trackCount: 100,
    fileSize: '1.24 GB',
    bitrate: 'MP3 320kbps',
    bpmRange: '98–112 BPM',
    coverImage: '/src/assets/images/pack_konpa_classic_1795119165515.jpg',
    tracks: generateHundredTracks(KONPA_CLASSIC_SEEDS, [
      'Remastered 2026',
      'DJ Beatgrid Intro',
      'Vinyl Clean',
      'Extended Dance',
      'Live Horn Boost',
    ]),
  },
  {
    id: 'wesley-mega-club-transitions',
    slug: 'wesley-konpa-raboday-afro-transitions',
    title: 'Wesley Konpa-Rabòday-Afro Transitions',
    subtitle: '100 tranzisyon BPM, acapella blends ak remix eksklizif pou fè set DJ san koupe.',
    genre: 'Konpa / Rabòday / Afro',
    trackCount: 100,
    fileSize: '1.10 GB',
    bitrate: 'MP3 320kbps',
    bpmRange: '92–135 BPM',
    coverImage: '/src/assets/images/pack_dj_remixes_vip_1795119165693.jpg',
    tracks: generateHundredTracks(REMIXES_SEEDS, [
      'VIP Transition',
      'Wordplay Intro',
      'Acapella In/Out',
      'BPM Ramp Edit',
      'TikTok MegaBlend',
    ]),
  },

  // =========================================================================
  // 8 "AN PREPARASYON" PLACEHOLDER FOLDERS (REVÈY K AP VIRE)
  // =========================================================================
  {
    id: 'coming-konpa-gouyad-vol-18',
    slug: 'konpa-gouyad-vol-18-vip',
    title: 'Konpa_Gouyad_Vol_18_VIP',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Konpa / Gouyad',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-raboday-kanaval-2027',
    slug: 'raboday-kanaval-2027-vip',
    title: 'Rabòday_Kanaval_2027_VIP',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Rabòday / Kanaval',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-rap-kreyol-street-vol-4',
    slug: 'rap-kreyol-street-vol-4',
    title: 'Rap_Kreyòl_Street_Vol_4',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Rap Kreyòl / Trap',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-afrobeat-summer-2026',
    slug: 'afrobeat-summer-club-2026',
    title: 'Afrobeat_Summer_Club_2026',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Afrobeat / Amapiano',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-konpa-live-bal-edition',
    slug: 'konpa-live-bal-edition-vip',
    title: 'Konpa_Live_Bal_Edition_VIP',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Konpa Live',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-raboday-dj-acapella-tools',
    slug: 'raboday-dj-acapella-drops',
    title: 'Rabòday_DJ_Acapella_Drops',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Rabòday / DJ Tools',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-rap-kreyol-freestyle-pack',
    slug: 'rap-kreyol-freestyle-pack-vip',
    title: 'Rap_Kreyòl_Freestyle_Pack_VIP',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Rap Kreyòl / Drill',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
  {
    id: 'coming-afrobeat-konpa-mashups',
    slug: 'afrobeat-konpa-mashups-vip',
    title: 'Afrobeat_Konpa_Mashups_VIP',
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: 'Afrobeat / Konpa',
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isComingSoon: true,
  },
];

export const CUSTOM_PACKS_STORAGE_KEY = 'wesley_custom_uploaded_packs_v1';

export function slugifyPackTitle(title: string): string {
  const cleaned = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'wesley-custom-folder';
}

export function loadCustomPacks(): MusicPack[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_PACKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MusicPack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPacks(packs: MusicPack[]): void {
  try {
    window.localStorage.setItem(CUSTOM_PACKS_STORAGE_KEY, JSON.stringify(packs));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function upsertCustomPack(pack: MusicPack): MusicPack[] {
  const existing = loadCustomPacks().filter((p) => p.id !== pack.id);
  const next = [pack, ...existing];
  saveCustomPacks(next);
  return next;
}

export function renameCustomPack(packId: string, newTitle: string): MusicPack[] {
  const trimmed = newTitle.trim();
  const next = loadCustomPacks().map((p) => {
    if (p.id !== packId) return p;
    const effectiveTitle = trimmed || p.title;
    return {
      ...p,
      title: effectiveTitle,
      slug: slugifyPackTitle(effectiveTitle),
    };
  });
  saveCustomPacks(next);
  return next;
}

export function deleteCustomPack(packId: string): MusicPack[] {
  const next = loadCustomPacks().filter((p) => p.id !== packId);
  saveCustomPacks(next);
  return next;
}

export const DELETED_PACK_IDS_STORAGE_KEY = 'wesley_deleted_pack_ids_v1';

export function loadDeletedPackIds(): string[] {
  try {
    const raw = window.localStorage.getItem(DELETED_PACK_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeletedPackIds(ids: string[]): void {
  try {
    window.localStorage.setItem(DELETED_PACK_IDS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function getLiveDefaultCatalog(): MusicPack[] {
  const parsed = Array.isArray(customDefaultFoldersJson)
    ? (customDefaultFoldersJson as MusicPack[])
    : [];
  return parsed.length > 0 ? parsed : MUSIC_PACKS;
}

export function hasPermanentCustomDefaults(): boolean {
  return Array.isArray(customDefaultFoldersJson) && customDefaultFoldersJson.length > 0;
}

export function deletePackById(packId: string): void {
  const custom = loadCustomPacks();
  if (custom.some((p) => p.id === packId)) {
    saveCustomPacks(custom.filter((p) => p.id !== packId));
  }
  const baseCatalog = getLiveDefaultCatalog();
  if (baseCatalog.some((p) => p.id === packId)) {
    const deleted = loadDeletedPackIds();
    if (!deleted.includes(packId)) {
      saveDeletedPackIds([...deleted, packId]);
    }
  }
}

export function restoreDemoPacks(): void {
  saveDeletedPackIds([]);
}

export function hideBuiltInDemoPacks(): void {
  const deleted = new Set(loadDeletedPackIds());
  for (const p of MUSIC_PACKS) {
    deleted.add(p.id);
  }
  saveDeletedPackIds(Array.from(deleted));
}

export function getAllMusicPacks(): MusicPack[] {
  const deletedSet = new Set(loadDeletedPackIds());
  const customPacks = loadCustomPacks().filter((p) => !deletedSet.has(p.id));
  const customIds = new Set(customPacks.map((p) => p.id));
  const baseCatalog = getLiveDefaultCatalog();
  const builtIn = baseCatalog.filter(
    (p) => !deletedSet.has(p.id) && !customIds.has(p.id)
  );
  return [...customPacks, ...builtIn];
}

export function formatZipFolderFilename(pack: MusicPack): string {
  const cleaned = pack.title
    .replace(/\.zip$/i, '')
    .replace(/[<>:"/\\|?*()]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
  return `${cleaned || pack.slug}.zip`;
}

export interface ExportFoldersResult {
  json: string;
  count: number;
  ownerFolderCount: number;
  totalVisibleCount: number;
  usingOwnerOnly: boolean;
}

export function exportCurrentFoldersJson(options?: {
  includeBuiltInDemos?: boolean;
}): ExportFoldersResult {
  const deletedSet = new Set(loadDeletedPackIds());
  const customPacks = loadCustomPacks().filter((p) => !deletedSet.has(p.id));
  const visibleAll = getAllMusicPacks();
  const hasOwnerFolders = customPacks.length > 0;
  const hasPermanent = hasPermanentCustomDefaults();
  const includeDemos = Boolean(options?.includeBuiltInDemos);

  const selectedPacks =
    !hasPermanent && hasOwnerFolders && !includeDemos ? customPacks : visibleAll;

  const exportPayload = selectedPacks.map((pack) => {
    const colorCfg = getFolderColorConfig(pack.id);
    const cuesCfg = getFolderCuesConfig(pack.id);
    return {
      id: pack.id,
      slug: pack.slug,
      title: pack.title,
      filename: formatZipFolderFilename(pack),
      subtitle: pack.subtitle,
      genre: pack.genre,
      trackCount: pack.trackCount,
      fileSize: pack.fileSize,
      bitrate: pack.bitrate,
      bpmRange: pack.bpmRange,
      coverImage: pack.coverImage,
      isComingSoon: Boolean(pack.isComingSoon),
      isCustomUpload: true,
      tracks: pack.tracks,
      colorConfig: colorCfg,
      ...(Object.keys(cuesCfg.tracks || {}).length > 0 ? { cuesConfig: cuesCfg } : {}),
    };
  });

  return {
    json: JSON.stringify(exportPayload, null, 2),
    count: exportPayload.length,
    ownerFolderCount: customPacks.length,
    totalVisibleCount: visibleAll.length,
    usingOwnerOnly: hasOwnerFolders && !includeDemos,
  };
}

export const COMING_SOON_GENRE_PRESETS = [
  'Konpa / Gouyad',
  'Rabòday / Kanaval',
  'Rap Kreyòl / Trap',
  'Afrobeat / Amapiano',
  'Konpa Live',
  'Rabòday / Rara',
  'Rap Kreyòl / Drill',
  'Afrobeat / Konpa',
];

export function createComingSoonPack(rawTitle: string, rawGenre: string): MusicPack {
  const cleanTitle = rawTitle.replace(/\.zip$/i, '').trim() || 'Nouvo_Folder_VIP';
  const cleanGenre = rawGenre.trim() || 'Konpa / VIP';
  const packSlug = slugifyPackTitle(cleanTitle);
  const packId = `coming-${packSlug}-${Date.now().toString(36)}`;

  const placeholderPack: MusicPack = {
    id: packId,
    slug: packSlug,
    title: cleanTitle,
    subtitle: '⏳ Folder an preparasyon — mizik yo ap disponib byento.',
    genre: cleanGenre,
    trackCount: 0,
    fileSize: 'An Preparasyon',
    bitrate: 'Ap Vini Byento',
    bpmRange: 'An Preparasyon',
    coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
    tracks: [],
    isCustomUpload: true,
    isComingSoon: true,
  };

  upsertCustomPack(placeholderPack);
  return placeholderPack;
}

export function activateComingSoonPack(
  existingPack: MusicPack,
  tracks: TrackItem[],
  fileSizeLabel: string
): MusicPack {
  const updatedPack: MusicPack = {
    ...existingPack,
    subtitle: `${tracks.length} mizik an lòd (001–${String(tracks.length).padStart(
      3,
      '0'
    )}) ak koulè VirtualDJ + 2 Hot Cues.`,
    trackCount: tracks.length,
    fileSize: fileSizeLabel,
    bitrate: 'Audio Original + ID3 Color',
    bpmRange: 'Auto Scan',
    tracks,
    isCustomUpload: true,
    isComingSoon: false,
  };

  upsertCustomPack(updatedPack);
  return updatedPack;
}
