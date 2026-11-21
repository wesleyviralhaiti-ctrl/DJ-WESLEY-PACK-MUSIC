import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  AlertCircle,
  Palette,
  KeyRound,
  Search,
  RotateCcw,
  Upload,
  Play,
  Square,
  Activity,
  FolderOpen,
  Download,
  FolderUp,
  CheckCircle2,
  FolderArchive,
  Hourglass,
  Plus,
} from 'lucide-react';
import {
  COMING_SOON_GENRE_PRESETS,
  DJ_RAINBOW_COLORS,
  FOLDER_PLANS,
  FolderColorConfig,
  FolderCuesConfig,
  MusicPack,
  TrackHotCues,
  TrackItem,
  VipKeyRecord,
  activateComingSoonPack,
  computeDefaultHotCues,
  createComingSoonPack,
  createVipKeyRecord,
  deletePackById,
  formatZipFolderFilename,
  generateShortSecretCode,
  getFolderColorConfig,
  getFolderCuesConfig,
  getVipKeyStatus,
  loadAllVipKeys,
  loadDeletedPackIds,
  renameCustomPack,
  resolveTrackColor,
  resolveTrackHotCues,
  restoreDemoPacks,
  saveAllVipKeys,
  saveFolderColorConfig,
  saveFolderCuesConfig,
  slugifyPackTitle,
  upsertCustomPack,
} from '../data/musicPacks';
import {
  analyzeMp3FileForHotCues,
  clearUploadedMp3sForPack,
  countUploadedMp3sForPack,
  cueAuditionPlayer,
  extractDroppedAudioFiles,
  extractFolderNameFromFileList,
  getUploadedAudioExt,
  getUploadedMp3Buffer,
  hasUploadedMp3Buffer,
  isAudioFile,
  sortAudioFilesSequentially,
  storeUploadedMp3Buffer,
} from '../utils/audioAnalyzer';
import { groovePreview } from '../utils/audioPreview';

const ADMIN_PASSWORD = 'DJWESLEY2026#';

interface AdminPanelModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  allPacks: MusicPack[];
  packagingPackId: string | null;
  onAdminAuthenticated: () => void;
  onAdminLogout: () => void;
  onAdminFreeDownloadPack: (pack: MusicPack) => Promise<void>;
  onClose: () => void;
  onKeysChanged: () => void;
  onColorsChanged: () => void;
  onCustomPacksChanged: () => void;
}

const PREFIX_PRESETS = ['W#', 'JW@', 'W$', 'W*'];

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  isAuthenticated,
  allPacks,
  packagingPackId,
  onAdminAuthenticated,
  onAdminLogout,
  onAdminFreeDownloadPack,
  onClose,
  onKeysChanged,
  onColorsChanged,
  onCustomPacksChanged,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'packs' | 'keys' | 'colors'>('packs');

  // Top Full-Folder Dropzone & Coming Soon Creation State
  const [createAsComingSoon, setCreateAsComingSoon] = useState(false);
  const [comingSoonName, setComingSoonName] = useState('');
  const [comingSoonGenre, setComingSoonGenre] = useState('Konpa / Gouyad');
  const [comingSoonError, setComingSoonError] = useState<string | null>(null);
  const [comingSoonSuccess, setComingSoonSuccess] = useState<string | null>(null);

  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [isProcessingFolder, setIsProcessingFolder] = useState(false);
  const [folderProgressText, setFolderProgressText] = useState<string | null>(null);
  const [folderUploadError, setFolderUploadError] = useState<string | null>(null);
  const [importedPackId, setImportedPackId] = useState<string | null>(null);
  const [importedPackNameInput, setImportedPackNameInput] = useState<string>('');
  const [activatingPackId, setActivatingPackId] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const activatePackInputRef = useRef<HTMLInputElement | null>(null);

  // VIP Keys state
  const [selectedQuota, setSelectedQuota] = useState<number>(3);
  const [customQuotaInput, setCustomQuotaInput] = useState<string>('');
  const [patternPrefix, setPatternPrefix] = useState<string>('W#');
  const [customCodeInput, setCustomCodeInput] = useState<string>(() =>
    generateShortSecretCode('W#')
  );
  const [clientNote, setClientNote] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [keys, setKeys] = useState<VipKeyRecord[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  // VirtualDJ Folder Color & Hot Cues state
  const [selectedPackId, setSelectedPackId] = useState<string>(
    () => allPacks[0]?.id || 'konpa-gouyad-vip-2026'
  );
  const [draftColorConfig, setDraftColorConfig] = useState<FolderColorConfig>(() =>
    getFolderColorConfig(allPacks[0]?.id || 'konpa-gouyad-vip-2026')
  );
  const [draftCuesConfig, setDraftCuesConfig] = useState<FolderCuesConfig>(() =>
    getFolderCuesConfig(allPacks[0]?.id || 'konpa-gouyad-vip-2026')
  );
  const [startSlotNumber, setStartSlotNumber] = useState<number>(1);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [uploadedCount, setUploadedCount] = useState<number>(() =>
    countUploadedMp3sForPack(allPacks[0]?.id || 'konpa-gouyad-vip-2026')
  );
  const [playingCueKey, setPlayingCueKey] = useState<string | null>(null);
  const [trackSearch, setTrackSearch] = useState<string>('');
  const [colorSavedBanner, setColorSavedBanner] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      const current = loadAllVipKeys();
      setKeys(current);
      setCustomCodeInput((prev) => prev || generateShortSecretCode(patternPrefix, current));
      setDraftColorConfig(getFolderColorConfig(selectedPackId));
      setDraftCuesConfig(getFolderCuesConfig(selectedPackId));
      setUploadedCount(countUploadedMp3sForPack(selectedPackId));
    }
    if (!isOpen) {
      cueAuditionPlayer.stop();
      groovePreview.stop();
      setPlayingCueKey(null);
      setIsDraggingFolder(false);
    }
  }, [isOpen, isAuthenticated, patternPrefix, selectedPackId]);

  const selectedPack = useMemo(
    () => allPacks.find((p) => p.id === selectedPackId) ?? allPacks[0] ?? null,
    [allPacks, selectedPackId]
  );

  const importedPack = useMemo(
    () => (importedPackId ? allPacks.find((p) => p.id === importedPackId) ?? null : null),
    [allPacks, importedPackId]
  );

  const filteredStudioTracks = useMemo(() => {
    if (!selectedPack) return [];
    const q = trackSearch.trim().toLowerCase();
    if (!q) return selectedPack.tracks;
    return selectedPack.tracks.filter((t) => {
      const cueMeta = draftCuesConfig.tracks?.[t.number];
      const title = (cueMeta?.customTitle || t.title).toLowerCase();
      const artist = (cueMeta?.customArtist || t.artist).toLowerCase();
      return title.includes(q) || artist.includes(q) || String(t.number).includes(q);
    });
  }, [selectedPack, trackSearch, draftCuesConfig]);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthError(null);
      onAdminAuthenticated();
      setPasswordInput('');
      const current = loadAllVipKeys();
      setKeys(current);
      setCustomCodeInput(generateShortSecretCode(patternPrefix, current));
      setDraftColorConfig(getFolderColorConfig(selectedPackId));
      setDraftCuesConfig(getFolderCuesConfig(selectedPackId));
      setUploadedCount(countUploadedMp3sForPack(selectedPackId));
    } else {
      setAuthError('Modpas Admin lan pa kòrèk. Eseye ankò.');
    }
  };

  const activeQuota =
    customQuotaInput.trim() !== ''
      ? Math.max(1, Math.min(999, parseInt(customQuotaInput, 10) || 1))
      : selectedQuota;

  const handleGenerateRandomShortCode = (overridePrefix?: string) => {
    const prefixToUse = overridePrefix !== undefined ? overridePrefix : patternPrefix;
    setCreateError(null);
    setCustomCodeInput(generateShortSecretCode(prefixToUse, keys));
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeQuota < 1) return;

    const codeToSave =
      customCodeInput.trim() !== ''
        ? customCodeInput
        : generateShortSecretCode(patternPrefix, keys);

    const result = createVipKeyRecord(activeQuota, codeToSave, clientNote);
    if (!result.success || !result.record) {
      setCreateError(result.error ?? 'Pa kapab kreye kòd la.');
      return;
    }

    const updated = loadAllVipKeys();
    setKeys(updated);
    setLastCreatedCode(result.record.code);
    setCreateError(null);
    setClientNote('');
    setCustomCodeInput(generateShortSecretCode(patternPrefix, updated));
    onKeysChanged();
  };

  const handleCopyForWhatsapp = async (record: VipKeyRecord) => {
    const msg = `Bonjou! Men Kòd VIP ou a pou WESLEY MUSIC PACKS (${record.totalFolders} Folder / ${record.totalFolders * 100} Mizik):\n\n🔑 Kòd VIP (Yon Sèl Fwa): ${record.code}\n📁 Kredi Folder: ${record.remainingFolders} / ${record.totalFolders} Folder\n⚠️ Kòd sa a fèt pou yon sèl itilizasyon sèlman.`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedCode(record.code);
      window.setTimeout(() => {
        setCopiedCode((curr) => (curr === record.code ? null : curr));
      }, 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = msg;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedCode(record.code);
      window.setTimeout(() => {
        setCopiedCode((curr) => (curr === record.code ? null : curr));
      }, 2500);
    }
  };

  const handleDeleteKey = (code: string) => {
    const updated = loadAllVipKeys().filter((k) => k.code !== code);
    saveAllVipKeys(updated);
    setKeys(updated);
    onKeysChanged();
  };

  const processWholeMusicFolder = async (
    rawFiles: File[],
    detectedFolderName: string | null
  ) => {
    const audioFiles = sortAudioFilesSequentially(rawFiles.filter(isAudioFile));
    if (audioFiles.length === 0) {
      setFolderUploadError(
        'Pa gen okenn fichye mizik (.MP3, .WAV, .M4A, elatriye) yo jwenn nan folder sa a.'
      );
      return;
    }

    const folderTitle =
      (detectedFolderName && detectedFolderName.trim()) ||
      extractFolderNameFromFileList(audioFiles) ||
      `Folder Mizik VIP (${audioFiles.length} Mizik)`;

    const packSlug = slugifyPackTitle(folderTitle);
    const packId = `custom-${packSlug}-${Date.now().toString(36)}`;

    setIsProcessingFolder(true);
    setFolderUploadError(null);
    setFolderProgressText(
      `Ap triye & eskane ${audioFiles.length} mizik nan "${folderTitle}"...`
    );

    const tracks: TrackItem[] = [];
    const cueTracks: Record<number, TrackHotCues> = {};
    let totalBytes = 0;

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const trackNum = i + 1;
      totalBytes += file.size;

      setFolderProgressText(
        `Ap eskane (${trackNum}/${audioFiles.length}): ${file.name} — Cue 1 Kòmansman + Cue 2 Pi Gou...`
      );

      const { analysis, rawBuffer, fileExt, decodedOk } = await analyzeMp3FileForHotCues(file);
      storeUploadedMp3Buffer(packId, trackNum, rawBuffer, fileExt);

      tracks.push({
        number: trackNum,
        title: analysis.titleGuess,
        artist: analysis.artistGuess,
        bpm: 105,
        duration: analysis.durationFormatted,
        mixType: 'Original Audio',
      });

      cueTracks[trackNum] = {
        cue1Seconds: analysis.cue1Seconds,
        cue2Seconds: analysis.cue2Seconds,
        source: decodedOk ? 'auto-scan' : 'default',
        customArtist: analysis.artistGuess,
        customTitle: analysis.titleGuess,
        customDuration: analysis.durationFormatted,
      };
    }

    const totalMb = Math.max(1, Math.round(totalBytes / (1024 * 1024)));
    const fileSizeLabel =
      totalMb >= 1024 ? `${(totalMb / 1024).toFixed(2)} GB` : `${totalMb} MB`;

    const newPack: MusicPack = {
      id: packId,
      slug: packSlug,
      title: folderTitle,
      subtitle: `${tracks.length} mizik enpòte an lòd (001–${String(tracks.length).padStart(
        3,
        '0'
      )}) ak koulè VirtualDJ + 2 Hot Cues.`,
      genre: 'Folder Enpòte VIP',
      trackCount: tracks.length,
      fileSize: fileSizeLabel,
      bitrate: 'Audio Original + ID3 Color',
      bpmRange: 'Auto Scan',
      coverImage: '/src/assets/images/hero_studio_console_1795118961756.jpg',
      tracks,
      isCustomUpload: true,
    };

    const defaultColorCfg: FolderColorConfig = {
      packId,
      mode: 'rainbow',
      solidColor: '#22C55E',
      trackColors: {},
    };

    const cuesCfg: FolderCuesConfig = {
      packId,
      tracks: cueTracks,
    };

    upsertCustomPack(newPack);
    saveFolderColorConfig(defaultColorCfg);
    saveFolderCuesConfig(cuesCfg);

    setImportedPackId(packId);
    setImportedPackNameInput(folderTitle);
    setSelectedPackId(packId);
    setDraftColorConfig(defaultColorCfg);
    setDraftCuesConfig(cuesCfg);
    setUploadedCount(tracks.length);

    setIsProcessingFolder(false);
    setFolderProgressText(
      `✅ Folder "${folderTitle}" pare! ${tracks.length} mizik nimewote (001–${String(
        tracks.length
      ).padStart(3, '0')}) ak koulè VirtualDJ + Cue 1 & Cue 2.`
    );

    onCustomPacksChanged();
    onColorsChanged();

    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const handleFolderPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const folderName = extractFolderNameFromFileList(files);
    void processWholeMusicFolder(files, folderName);
  };

  const handleFolderDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFolder(false);
    if (isProcessingFolder) return;

    const { files, folderName } = await extractDroppedAudioFiles(e.dataTransfer);
    void processWholeMusicFolder(files, folderName);
  };

  const handleCreateComingSoonFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = comingSoonName.trim();
    if (!trimmedName) {
      setComingSoonError(
        'Tanpri antre non folder la (egzanp: Rabòday_Kanaval_2027_VIP.zip).'
      );
      return;
    }

    const created = createComingSoonPack(trimmedName, comingSoonGenre);
    setComingSoonName('');
    setComingSoonError(null);
    setComingSoonSuccess(
      `⏳ Folder "${formatZipFolderFilename(created)}" kreye kòm « AN PREPARASYON »! Lè w pare pou w lanse l, klike sou « 📂 Ajoute Mizik & Aktive Folder Sa a ».`
    );
    setSelectedPackId(created.id);
    setActiveTab('packs');
    onCustomPacksChanged();
  };

  const processActivateComingSoonPack = async (pack: MusicPack, rawFiles: File[]) => {
    const audioFiles = sortAudioFilesSequentially(rawFiles.filter(isAudioFile));
    if (audioFiles.length === 0) {
      setFolderUploadError(
        'Pa gen okenn fichye mizik (.MP3, .WAV, .M4A, elatriye) yo jwenn pou aktive folder sa a.'
      );
      setActivatingPackId(null);
      return;
    }

    setIsProcessingFolder(true);
    setFolderUploadError(null);
    setComingSoonSuccess(null);
    setFolderProgressText(
      `Ap eskane ${audioFiles.length} mizik pou aktive "${formatZipFolderFilename(pack)}"...`
    );

    const tracks: TrackItem[] = [];
    const cueTracks: Record<number, TrackHotCues> = {};
    let totalBytes = 0;

    clearUploadedMp3sForPack(pack.id);

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const trackNum = i + 1;
      totalBytes += file.size;

      setFolderProgressText(
        `Ap eskane (${trackNum}/${audioFiles.length}): ${file.name} — Cue 1 Kòmansman + Cue 2 Pi Gou...`
      );

      const { analysis, rawBuffer, fileExt, decodedOk } = await analyzeMp3FileForHotCues(file);
      storeUploadedMp3Buffer(pack.id, trackNum, rawBuffer, fileExt);

      tracks.push({
        number: trackNum,
        title: analysis.titleGuess,
        artist: analysis.artistGuess,
        bpm: 105,
        duration: analysis.durationFormatted,
        mixType: 'Original Audio',
      });

      cueTracks[trackNum] = {
        cue1Seconds: analysis.cue1Seconds,
        cue2Seconds: analysis.cue2Seconds,
        source: decodedOk ? 'auto-scan' : 'default',
        customArtist: analysis.artistGuess,
        customTitle: analysis.titleGuess,
        customDuration: analysis.durationFormatted,
      };
    }

    const totalMb = Math.max(1, Math.round(totalBytes / (1024 * 1024)));
    const fileSizeLabel =
      totalMb >= 1024 ? `${(totalMb / 1024).toFixed(2)} GB` : `${totalMb} MB`;

    const activatedPack = activateComingSoonPack(pack, tracks, fileSizeLabel);

    const existingColorCfg = getFolderColorConfig(pack.id);
    const defaultColorCfg: FolderColorConfig = {
      packId: pack.id,
      mode: existingColorCfg.mode || 'rainbow',
      solidColor: existingColorCfg.solidColor || '#22C55E',
      trackColors: existingColorCfg.trackColors || {},
    };
    const cuesCfg: FolderCuesConfig = {
      packId: pack.id,
      tracks: cueTracks,
    };

    saveFolderColorConfig(defaultColorCfg);
    saveFolderCuesConfig(cuesCfg);

    setImportedPackId(activatedPack.id);
    setImportedPackNameInput(activatedPack.title);
    setSelectedPackId(activatedPack.id);
    setDraftColorConfig(defaultColorCfg);
    setDraftCuesConfig(cuesCfg);
    setUploadedCount(tracks.length);
    setActivatingPackId(null);
    setIsProcessingFolder(false);
    setFolderProgressText(
      `✅ Folder "${formatZipFolderFilename(activatedPack)}" aktive ak ${tracks.length} mizik! Kounye a li disponib pou telechaje sou sit la.`
    );

    onCustomPacksChanged();
    onColorsChanged();

    if (activatePackInputRef.current) {
      activatePackInputRef.current.value = '';
    }
  };

  const handleStartActivateComingSoon = (packId: string) => {
    setActivatingPackId(packId);
    setFolderUploadError(null);
    window.setTimeout(() => {
      activatePackInputRef.current?.click();
    }, 0);
  };

  const handleActivateFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const targetPack = allPacks.find((p) => p.id === activatingPackId);
    if (files.length === 0 || !targetPack) {
      setActivatingPackId(null);
      return;
    }
    void processActivateComingSoonPack(targetPack, files);
  };

  const handleRenameImportedPack = (nextTitle: string) => {
    setImportedPackNameInput(nextTitle);
    if (importedPackId) {
      renameCustomPack(importedPackId, nextTitle);
      onCustomPacksChanged();
    }
  };

  const handleDeletePack = (packId: string) => {
    deletePackById(packId);
    clearUploadedMp3sForPack(packId);
    if (importedPackId === packId) {
      setImportedPackId(null);
      setImportedPackNameInput('');
      setFolderProgressText(null);
    }
    if (selectedPackId === packId) {
      const remaining = allPacks.filter((p) => p.id !== packId);
      if (remaining[0]) {
        setSelectedPackId(remaining[0].id);
      }
    }
    onCustomPacksChanged();
    onColorsChanged();
  };

  const handleRestoreDemoPacks = () => {
    restoreDemoPacks();
    onCustomPacksChanged();
    onColorsChanged();
  };

  const handleSelectPackForStudio = (packId: string) => {
    cueAuditionPlayer.stop();
    groovePreview.stop();
    setPlayingCueKey(null);
    setSelectedPackId(packId);
    setDraftColorConfig(getFolderColorConfig(packId));
    setDraftCuesConfig(getFolderCuesConfig(packId));
    setUploadedCount(countUploadedMp3sForPack(packId));
    setColorSavedBanner(false);
    setScanStatus(null);
    setScanError(null);
    setTrackSearch('');
  };

  const handleMp3FilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !selectedPack) return;

    const files = sortAudioFilesSequentially(Array.from(fileList).filter(isAudioFile));
    if (files.length === 0) {
      setScanError('Tanpri chwazi fichye .MP3 / odyo valid sèlman.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setColorSavedBanner(false);

    let slot = Math.max(1, Math.min(selectedPack.tracks.length || 100, startSlotNumber));
    const maxSlots = Math.max(100, selectedPack.tracks.length);
    const updatedTracks = { ...draftCuesConfig.tracks };
    let successCount = 0;

    for (let i = 0; i < files.length && slot <= maxSlots; i++) {
      const file = files[i];
      setScanStatus(
        `Ap eskane (${i + 1}/${files.length}): ${file.name} via Web Audio API...`
      );
      try {
        const { analysis, rawBuffer, fileExt } = await analyzeMp3FileForHotCues(file);
        storeUploadedMp3Buffer(selectedPackId, slot, rawBuffer, fileExt);
        updatedTracks[slot] = {
          cue1Seconds: analysis.cue1Seconds,
          cue2Seconds: analysis.cue2Seconds,
          source: 'auto-scan',
          customArtist: analysis.artistGuess,
          customTitle: analysis.titleGuess,
          customDuration: analysis.durationFormatted,
        };
        successCount += 1;
        slot += 1;
      } catch {
        setScanError(
          `Pa kapab dekode "${file.name}". Verifye si fichye a se yon MP3 valid.`
        );
      }
    }

    const nextCuesConfig: FolderCuesConfig = {
      packId: selectedPackId,
      tracks: updatedTracks,
    };
    setDraftCuesConfig(nextCuesConfig);
    saveFolderCuesConfig(nextCuesConfig);
    setUploadedCount(countUploadedMp3sForPack(selectedPackId));
    setStartSlotNumber(Math.min(100, slot));
    setIsScanning(false);

    if (successCount > 0) {
      setScanStatus(
        `✅ ${successCount} MP3 eskane! Cue 1 (KÒMANSMAN) ak Cue 2 (PI GOU) detekte ak anrejistre.`
      );
      onColorsChanged();
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSetTrackColorOverride = (trackNumber: number, hex: string) => {
    setDraftColorConfig((prev) => ({
      ...prev,
      trackColors: {
        ...prev.trackColors,
        [trackNumber]: hex.toUpperCase(),
      },
    }));
    setColorSavedBanner(false);
  };

  const handleClearTrackColorOverride = (trackNumber: number) => {
    setDraftColorConfig((prev) => {
      const nextTracks = { ...prev.trackColors };
      delete nextTracks[trackNumber];
      return { ...prev, trackColors: nextTracks };
    });
    setColorSavedBanner(false);
  };

  const handleClearAllTrackOverrides = () => {
    setDraftColorConfig((prev) => ({
      ...prev,
      trackColors: {},
    }));
    setColorSavedBanner(false);
  };

  const handleCueChange = (
    trackNumber: number,
    cueField: 'cue1Seconds' | 'cue2Seconds',
    rawVal: string
  ) => {
    if (!selectedPack) return;
    const parsed = Math.max(0, Number(parseFloat(rawVal).toFixed(2)) || 0);
    const track = selectedPack.tracks.find((t) => t.number === trackNumber);
    if (!track) return;
    const currentCues = resolveTrackHotCues(selectedPackId, track, draftCuesConfig);

    setDraftCuesConfig((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackNumber]: {
          ...currentCues,
          [cueField]: parsed,
          source: 'manual',
        },
      },
    }));
    setColorSavedBanner(false);
  };

  const handleResetTrackCues = (trackNumber: number) => {
    if (!selectedPack) return;
    const track = selectedPack.tracks.find((t) => t.number === trackNumber);
    if (!track) return;
    const def = computeDefaultHotCues(track.bpm, track.number);
    setDraftCuesConfig((prev) => {
      const next = { ...prev.tracks };
      next[trackNumber] = def;
      return { ...prev, tracks: next };
    });
    setColorSavedBanner(false);
  };

  const handleAuditionCue = (
    trackNumber: number,
    cueLabel: 'cue1' | 'cue2',
    seconds: number,
    bpm: number
  ) => {
    const cueKey = `${selectedPackId}-${trackNumber}-${cueLabel}`;
    if (playingCueKey === cueKey) {
      cueAuditionPlayer.stop();
      groovePreview.stop();
      setPlayingCueKey(null);
      return;
    }

    cueAuditionPlayer.stop();
    groovePreview.stop();

    const uploadedBuffer = getUploadedMp3Buffer(selectedPackId, trackNumber);
    if (uploadedBuffer) {
      const ext = getUploadedAudioExt(selectedPackId, trackNumber);
      cueAuditionPlayer.playFromTimestamp(uploadedBuffer, seconds, ext);
    } else {
      groovePreview.toggle(cueKey, bpm, selectedPackId);
    }
    setPlayingCueKey(cueKey);
  };

  const handleSaveStudioConfig = () => {
    saveFolderColorConfig(draftColorConfig);
    saveFolderCuesConfig(draftCuesConfig);
    onColorsChanged();
    setColorSavedBanner(true);
    window.setTimeout(() => setColorSavedBanner(false), 3000);
  };

  const overrideCount = Object.keys(draftColorConfig.trackColors || {}).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-heading"
    >
      <div className="relative w-full max-w-5xl rounded-2xl bg-[#13151B] border border-zinc-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-800 bg-[#0F1117]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <h2
              id="admin-panel-heading"
              className="font-display text-base sm:text-lg font-bold text-white tracking-tight truncate"
            >
              WESLEY MUSIC PACKS — Admin Panel
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && (
              <button
                type="button"
                onClick={onAdminLogout}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-rose-500/60 text-xs font-medium text-zinc-300 hover:text-rose-300 transition-colors cursor-pointer"
              >
                Dekonekte Admin
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fèmen Admin Panel la"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          <form onSubmit={handleLogin} className="p-6 sm:p-8 max-w-md mx-auto space-y-4">
            <div className="text-center space-y-1.5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 mb-3">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl font-bold text-white">Aksè Admin Pwoteje</h3>
              <p className="text-sm text-zinc-400">
                Antre PIN Admin nan pou w debloke telechajman gratis ilimite, jere pake yo,
                epi kreye Kòd VIP.
              </p>
            </div>

            <div className="relative">
              <label htmlFor="admin-password-input" className="sr-only">
                Modpas Admin
              </label>
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="Antre PIN Admin nan..."
                autoFocus
                className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 pl-4 pr-11 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Kache modpas' : 'Montre modpas'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {authError && (
              <p role="alert" className="text-xs text-rose-400 text-center">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm transition-colors cursor-pointer"
            >
              Ouvri Admin Panel la
            </button>
          </form>
        ) : (
          <div className="flex flex-col max-h-[86vh]">
            {/* Admin Section Switcher Tabs */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-zinc-800 bg-[#0E1015]">
              <button
                type="button"
                onClick={() => setActiveTab('packs')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'packs'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span>📁 Jere Pake Mizik Yo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('colors')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'colors'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <Palette className="h-4 w-4 shrink-0" />
                <span>🎛️ Eskanè MP3, Koulè &amp; Hot Cues VirtualDJ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('keys')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'keys'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <KeyRound className="h-4 w-4 shrink-0" />
                <span>🔑 Kòd VIP (Yon Sèl Fwa)</span>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* TOP OF ADMIN PANEL: + Kreye Nouvo Folder (Upload Real Folder OR Coming Soon Placeholder) */}
              <div className="rounded-2xl border border-zinc-800 bg-[#0E1015] p-5 sm:p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-white">
                        + Kreye Nouvo Folder
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Voye yon folder mizik konplè kounye a, oswa prepare yon folder « An
                        Preparasyon » pou w plen sit la.
                      </p>
                    </div>
                  </div>

                  {/* Toggle: Coming Soon Placeholder Mode */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={createAsComingSoon}
                    onClick={() => {
                      setCreateAsComingSoon((v) => !v);
                      setComingSoonError(null);
                      setFolderUploadError(null);
                    }}
                    className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      createAsComingSoon
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.18)]'
                        : 'bg-[#0B0C10] border-zinc-700 hover:border-amber-400/60 text-zinc-200'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        createAsComingSoon ? 'bg-amber-400 justify-end' : 'bg-zinc-700 justify-start'
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full bg-zinc-950 shadow-sm" />
                    </span>
                    <span className="text-left">
                      ⏳ Kreye kòm Folder &apos;An Preparasyon&apos; (San Mizik Pou Kounye a)
                    </span>
                  </button>
                </div>

                {createAsComingSoon ? (
                  /* Coming Soon Placeholder Form — Name & Genre ONLY, zero MP3 upload needed */
                  <form
                    onSubmit={handleCreateComingSoonFolder}
                    className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-[#0B0C10] to-zinc-950 p-5 space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/45 text-amber-300">
                        <Hourglass className="h-5 w-5 animate-[spin_6s_linear_infinite]" />
                      </div>
                      <div>
                        <h4 className="font-display text-sm sm:text-base font-bold text-amber-300">
                          ⏳ Nouvo Folder &apos;An Preparasyon&apos; (San Mizik Pou Kounye a)
                        </h4>
                        <p className="text-xs text-zinc-300 mt-0.5">
                          Tape non folder la ak estil li sèlman — pa gen okenn fichye MP3 ki
                          obligatwa! Kliyan VIP yo ap wè l sou sit la san yo pa ka depanse kredi
                          sou li jiskaske ou mete mizik yo ladan l.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-6">
                        <label
                          htmlFor="coming-soon-folder-name"
                          className="block text-xs font-semibold text-zinc-200 mb-1.5"
                        >
                          Non Folder la (.ZIP)
                        </label>
                        <input
                          id="coming-soon-folder-name"
                          type="text"
                          value={comingSoonName}
                          onChange={(e) => {
                            setComingSoonName(e.target.value);
                            if (comingSoonError) setComingSoonError(null);
                          }}
                          placeholder="Ex: Rabòday_Kanaval_2027_VIP.zip oswa Konpa_Gouyad_Vol_18.zip"
                          className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-mono text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                        />
                        {comingSoonName.trim() && (
                          <p className="mt-1.5 text-[11px] font-mono text-amber-300">
                            📦 Ap parèt sou sit la kòm:{' '}
                            {formatZipFolderFilename({
                              id: 'preview',
                              slug: slugifyPackTitle(comingSoonName),
                              title: comingSoonName,
                              subtitle: '',
                              genre: comingSoonGenre,
                              trackCount: 0,
                              fileSize: '',
                              bitrate: '',
                              bpmRange: '',
                              coverImage: '',
                              tracks: [],
                            })}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-6">
                        <label
                          htmlFor="coming-soon-folder-genre"
                          className="block text-xs font-semibold text-zinc-200 mb-1.5"
                        >
                          Estil Mizik (Genre)
                        </label>
                        <input
                          id="coming-soon-folder-genre"
                          type="text"
                          value={comingSoonGenre}
                          onChange={(e) => setComingSoonGenre(e.target.value)}
                          placeholder="Ex: Rabòday / Kanaval"
                          className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {COMING_SOON_GENRE_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setComingSoonGenre(preset)}
                              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                                comingSoonGenre === preset
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                  : 'bg-[#13151B] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {comingSoonError && (
                      <p role="alert" className="text-xs font-medium text-rose-400">
                        {comingSoonError}
                      </p>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer"
                      >
                        <Hourglass className="h-4 w-4 shrink-0" />
                        <span>⏳ Kreye Folder &apos;An Preparasyon&apos;</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Full-Folder Upload & Drag-and-Drop Zone */
                  <div
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingFolder(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isDraggingFolder) setIsDraggingFolder(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setIsDraggingFolder(false);
                    }}
                    onDrop={(e) => void handleFolderDrop(e)}
                    className={`rounded-2xl border-2 border-dashed p-5 sm:p-6 transition-all ${
                      isDraggingFolder
                        ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                        : 'border-amber-400/70 bg-gradient-to-br from-emerald-500/10 via-[#0B0C10] to-amber-500/10 hover:border-emerald-400/90'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/25 to-amber-500/25 border border-amber-400/40 text-amber-300">
                          <FolderUp className="h-7 w-7" />
                        </div>
                        <div>
                          <h4 className="font-display text-base sm:text-lg font-extrabold text-amber-300 tracking-tight">
                            📂 CHWAZI OSWA GLISE TOUT YON FOLDER MIZIK ISIT LA
                          </h4>
                          <p className="text-xs sm:text-sm text-zinc-200 mt-1 leading-relaxed">
                            Chwazi tout yon folder mizik sou òdinatè Windows/Mac ou an 1 klik, oswa
                            glise l dirèkteman anndan bwat sa a. Sistèm nan ap mete non folder la,
                            nimewote tout mizik yo an lòd (
                            <span className="font-mono text-emerald-300">001 - ...</span>), aplike
                            koulè VirtualDJ yo, epi detekte 2 Hot Cues otomatikman!
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <input
                          ref={folderInputRef}
                          id="admin-full-folder-input"
                          type="file"
                          multiple
                          accept="audio/*"
                          {...({
                            webkitdirectory: '',
                            directory: '',
                          } as React.InputHTMLAttributes<HTMLInputElement>)}
                          onChange={handleFolderPickerChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="admin-full-folder-input"
                          className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm whitespace-nowrap shadow-lg cursor-pointer transition-all ${
                            isProcessingFolder ? 'opacity-60 pointer-events-none' : ''
                          }`}
                        >
                          <FolderOpen className="h-4 w-4 shrink-0" />
                          <span>
                            {isProcessingFolder
                              ? 'Ap Eskane Folder la...'
                              : '📁 CHWAZI YON FOLDER SOU LAPTOP LA'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {comingSoonSuccess && (
                  <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-4 py-2.5 text-xs font-medium text-amber-200 flex items-center gap-2">
                    <Hourglass className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>{comingSoonSuccess}</span>
                  </div>
                )}

                {folderProgressText && (
                  <div className="rounded-xl bg-[#0B0C10]/90 border border-emerald-500/35 px-4 py-2.5 text-xs font-medium text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{folderProgressText}</span>
                  </div>
                )}

                {folderUploadError && (
                  <div
                    role="alert"
                    className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-2.5 text-xs font-medium text-rose-300"
                  >
                    {folderUploadError}
                  </div>
                )}

                {/* Auto-filled Pack Name + Ready Test Download Card */}
                {importedPack && !importedPack.isComingSoon && (
                  <div className="rounded-xl bg-[#0B0C10] border border-emerald-500/45 p-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                      <div className="lg:col-span-6">
                        <label
                          htmlFor="imported-pack-name-input"
                          className="block text-xs font-semibold text-amber-300 mb-1.5"
                        >
                          Non Folder .ZIP la (Ranpli Otomatikman ak Non Folder la):
                        </label>
                        <input
                          id="imported-pack-name-input"
                          type="text"
                          value={importedPackNameInput}
                          onChange={(e) => handleRenameImportedPack(e.target.value)}
                          className="w-full rounded-xl bg-[#13151B] border border-zinc-700 px-3.5 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <p className="text-[11px] font-mono text-emerald-400 mt-1.5">
                          📦 {formatZipFolderFilename(importedPack)} · {importedPack.trackCount}{' '}
                          Mizik an Lòd • .ZIP
                        </p>
                      </div>

                      <div className="lg:col-span-6 flex flex-wrap items-center gap-2.5 justify-end">
                        <button
                          type="button"
                          disabled={packagingPackId === importedPack.id}
                          onClick={() => void onAdminFreeDownloadPack(importedPack)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 font-display font-extrabold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer"
                        >
                          <Download className="h-4 w-4 shrink-0" />
                          <span>
                            {packagingPackId === importedPack.id
                              ? 'Ap prepare .ZIP...'
                              : '⚡ Telechaje Gratis Admin'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleSelectPackForStudio(importedPack.id);
                            setActiveTab('colors');
                          }}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#13151B] border border-zinc-700 hover:border-zinc-500 text-xs font-semibold text-zinc-200 whitespace-nowrap cursor-pointer"
                        >
                          <Palette className="h-3.5 w-3.5" />
                          <span>Koulè &amp; Cues</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Hidden file input for activating any "An Preparasyon" folder with real MP3s */}
              <input
                ref={activatePackInputRef}
                type="file"
                multiple
                accept="audio/*"
                onChange={handleActivateFilesChange}
                className="hidden"
              />

              {activeTab === 'packs' ? (
                /* 📁 Jere Pake Mizik Yo — Activate Coming Soon Folders + Free Admin Test Download + Delete */
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-emerald-300">
                        👑 Jere Folder .ZIP yo — Telechaje Gratis, Aktive oswa Siprime nenpòt Folder
                      </h3>
                      <p className="text-xs text-zinc-300 mt-1">
                        Teste nenpòt folder .ZIP gratis, ajoute mizik sou yon folder « An
                        Preparasyon » pou w aktive l, oswa efase nenpòt pake.
                      </p>
                    </div>
                    {loadDeletedPackIds().length > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreDemoPacks}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B0C10] border border-zinc-700 hover:border-emerald-500 text-xs font-semibold text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Reyajiste Demo yo ({loadDeletedPackIds().length})</span>
                      </button>
                    )}
                  </div>

                  {allPacks.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-[#0E1015] p-8 text-center space-y-3">
                      <p className="text-sm font-semibold text-zinc-200">
                        Pa gen okenn folder .ZIP aktif kounye a.
                      </p>
                      <p className="text-xs text-zinc-400">
                        Chwazi yon folder mizik sou laptop ou anlè a oswa reyajiste pake demo yo.
                      </p>
                      {loadDeletedPackIds().length > 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreDemoPacks}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Reyajiste Pake Demo yo</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allPacks.map((pack) => {
                        const isComingSoon = Boolean(pack.isComingSoon);
                        const colorCfg = getFolderColorConfig(pack.id);
                        const mp3Uploaded = countUploadedMp3sForPack(pack.id);
                        const isDownloading = packagingPackId === pack.id;
                        const isActivatingThis = isProcessingFolder && activatingPackId === pack.id;

                        return (
                          <div
                            key={pack.id}
                            className={`flex flex-col justify-between rounded-xl border p-4 gap-4 ${
                              isComingSoon
                                ? 'bg-amber-500/[0.04] border-amber-500/50'
                                : pack.isCustomUpload
                                  ? 'bg-[#0E1015] border-amber-500/45'
                                  : 'bg-[#0E1015] border-zinc-800'
                            }`}
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div
                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                                  isComingSoon
                                    ? 'bg-amber-500/15 border-amber-400/45 text-amber-300'
                                    : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                                }`}
                              >
                                {isComingSoon ? (
                                  <Hourglass className="h-6 w-6 animate-[spin_6s_linear_infinite]" />
                                ) : (
                                  <FolderArchive className="h-6 w-6" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                {isComingSoon ? (
                                  <p className="text-[11px] font-bold text-amber-300">
                                    ⏳ AN PREPARASYON · {pack.genre}
                                  </p>
                                ) : (
                                  <p className="text-xs text-emerald-400 font-medium">
                                    {pack.genre} · {pack.trackCount} Mizik an Lòd • .ZIP
                                  </p>
                                )}
                                <h4 className="font-mono text-sm font-bold text-white truncate mt-0.5">
                                  {formatZipFolderFilename(pack)}
                                </h4>
                                <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">
                                  {isComingSoon
                                    ? 'Poko gen mizik — klike bouton jòn/vèt la pou w ajoute MP3 yo'
                                    : `${
                                        colorCfg.mode === 'rainbow'
                                          ? '🌈 Multi-Color DJ Rainbow'
                                          : `🎯 Koulè ${colorCfg.solidColor}`
                                      } · ${mp3Uploaded} Odyo Chaje`}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
                              {isComingSoon ? (
                                <button
                                  type="button"
                                  disabled={isProcessingFolder}
                                  onClick={() => handleStartActivateComingSoon(pack.id)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-zinc-950 text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                                >
                                  <FolderUp className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {isActivatingThis
                                      ? 'Ap Eskane Mizik...'
                                      : '📂 Ajoute Mizik & Aktive Folder Sa a'}
                                  </span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={isDownloading}
                                    onClick={() => void onAdminFreeDownloadPack(pack)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                                  >
                                    <Download className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      {isDownloading
                                        ? 'Ap prepare .ZIP...'
                                        : '⚡ Telechaje Gratis Admin'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectPackForStudio(pack.id);
                                      setActiveTab('colors');
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-[#0B0C10] border border-zinc-700 hover:border-zinc-500 text-xs font-medium text-zinc-200 whitespace-nowrap transition-colors cursor-pointer"
                                  >
                                    <Palette className="h-3.5 w-3.5 text-zinc-300" />
                                    <span>Koulè</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeletePack(pack.id)}
                                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/45 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                              >
                                <span>🗑️ Siprime Folder</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : activeTab === 'keys' ? (
                <>
                  {/* Short VIP Code & Folder Quota Generator Form */}
                  <form
                    onSubmit={handleCreateKey}
                    className="rounded-xl bg-[#0E1015] border border-zinc-800 p-5 space-y-5"
                  >
                    <div>
                      <h3 className="font-display text-base font-bold text-white">
                        1. Chwazi Kantite Folder pou Kòd VIP la
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Chak kòd fèt pou yon sèl itilizasyon (« Yon Sèl Fwa ») epi li boule nèt
                        otomatikman lè tout folder li yo fini.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {FOLDER_PLANS.map((plan) => {
                        const isSelected =
                          customQuotaInput.trim() === '' && selectedQuota === plan.folders;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => {
                              setSelectedQuota(plan.folders);
                              setCustomQuotaInput('');
                            }}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200'
                                : 'bg-[#0B0C10] border-zinc-800 text-zinc-300 hover:border-zinc-600'
                            }`}
                          >
                            <span>{plan.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Short Code Pattern & Manual Override */}
                    <div className="border-t border-zinc-800/80 pt-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-display text-sm font-bold text-white">
                            2. Modèl Kòd Kout Sekrè &amp; Pèsonalizasyon
                          </h4>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Jenere yon kòd 6–8 karaktè ak senbòl (ex: W#84K2, JW@91X) oswa tape
                            pwòp kòd ou (ex: W*94K#).
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {PREFIX_PRESETS.map((prefix) => (
                            <button
                              key={prefix}
                              type="button"
                              onClick={() => {
                                setPatternPrefix(prefix);
                                handleGenerateRandomShortCode(prefix);
                              }}
                              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
                                patternPrefix === prefix
                                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                                  : 'bg-[#0B0C10] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {prefix}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-3">
                          <label
                            htmlFor="pattern-prefix-input"
                            className="block text-xs font-medium text-zinc-300 mb-1.5"
                          >
                            Prefiks / Senbòl
                          </label>
                          <input
                            id="pattern-prefix-input"
                            type="text"
                            maxLength={5}
                            value={patternPrefix}
                            onChange={(e) => setPatternPrefix(e.target.value.toUpperCase())}
                            placeholder="W#"
                            className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label
                            htmlFor="editable-short-code"
                            className="block text-xs font-medium text-zinc-300 mb-1.5"
                          >
                            Kòd VIP Kout (Ou ka modifye l)
                          </label>
                          <input
                            id="editable-short-code"
                            type="text"
                            maxLength={16}
                            value={customCodeInput}
                            onChange={(e) => {
                              setCustomCodeInput(
                                e.target.value.toUpperCase().replace(/\s+/g, '')
                              );
                              if (createError) setCreateError(null);
                            }}
                            placeholder="Ex: W#84K2 oswa W*94K#"
                            className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider text-emerald-300 placeholder:font-normal placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <button
                            type="button"
                            onClick={() => handleGenerateRandomShortCode()}
                            className="w-full inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-white whitespace-nowrap transition-colors cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>⚡ Jenere Kòd Kout Sekrè</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="custom-folder-quota"
                          className="block text-xs font-medium text-zinc-300 mb-1.5"
                        >
                          Kantite Folder Pèsonalize
                        </label>
                        <input
                          id="custom-folder-quota"
                          type="number"
                          min={1}
                          max={999}
                          value={customQuotaInput}
                          onChange={(e) => setCustomQuotaInput(e.target.value)}
                          placeholder="Egzanp: 2, 15, 20"
                          className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-mono text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="client-note-input"
                          className="block text-xs font-medium text-zinc-300 mb-1.5"
                        >
                          Non Kliyan / Nòt (Opsyonèl)
                        </label>
                        <input
                          id="client-note-input"
                          type="text"
                          value={clientNote}
                          onChange={(e) => setClientNote(e.target.value)}
                          placeholder="Egzanp: DJ Marc - TikTok"
                          className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {createError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                        <span>{createError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <p className="text-xs text-zinc-400 tabular-nums">
                        Plan seleksyone:{' '}
                        <span className="font-semibold text-white">
                          {activeQuota} Folder ({activeQuota * 100} Mizik)
                        </span>
                      </p>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm whitespace-nowrap transition-colors cursor-pointer"
                      >
                        <span>⚡ Kreye Kle VIP</span>
                      </button>
                    </div>
                  </form>

                  {/* Generated Keys Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-bold text-white">
                        Lis Kòd VIP yo ({keys.length})
                      </h3>
                      {lastCreatedCode && (
                        <span className="text-xs text-emerald-400 font-medium">
                          Nouvo kòd kreye:{' '}
                          <span className="font-mono font-bold">{lastCreatedCode}</span>
                        </span>
                      )}
                    </div>

                    {keys.length === 0 ? (
                      <div className="rounded-xl border border-zinc-800 bg-[#0E1015] p-8 text-center text-sm text-zinc-400">
                        Ou poko kreye okenn Kòd VIP. Chwazi yon kantite folder, verifye kòd kout
                        la epi klike sou « ⚡ Kreye Kle VIP ».
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0E1015]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400">
                              <th className="py-3 px-4">Kòd VIP</th>
                              <th className="py-3 px-4">Estati</th>
                              <th className="py-3 px-4">Kredi ki Rete</th>
                              <th className="py-3 px-4">Nòt</th>
                              <th className="py-3 px-4 text-right">Aksyon</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/70 text-sm">
                            {keys.map((record) => {
                              const status = getVipKeyStatus(record);
                              const usedFolders = record.totalFolders - record.remainingFolders;
                              const isCopied = copiedCode === record.code;

                              return (
                                <tr key={record.code} className="hover:bg-zinc-900/40">
                                  <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap tracking-wider">
                                    {record.code}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold tabular-nums">
                                    {status === 'available' && (
                                      <span className="text-emerald-400">
                                        🟢 DISPONIB (Poko Sèvi)
                                      </span>
                                    )}
                                    {status === 'in_progress' && (
                                      <span className="text-amber-300">
                                        🟡 AN KOU ({usedFolders}/{record.totalFolders} Folder)
                                      </span>
                                    )}
                                    {status === 'burned' && (
                                      <span className="text-rose-400">
                                        🔴 FINI / BOULE (Pa Ka Sèvi Ankò)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap text-xs text-zinc-300 tabular-nums">
                                    Rete {record.remainingFolders} / {record.totalFolders} Folder
                                  </td>
                                  <td className="py-3 px-4 text-xs text-zinc-400 max-w-[140px] truncate">
                                    {record.note || '—'}
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyForWhatsapp(record)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0C10] border border-zinc-700 hover:border-emerald-500 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                                      >
                                        {isCopied ? (
                                          <>
                                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                                            <span className="text-emerald-300">Kopye!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-3.5 w-3.5 text-zinc-400" />
                                            <span>📋 Kopye Kle a pou WhatsApp</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteKey(record.code)}
                                        aria-label={`Efase kòd ${record.code}`}
                                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : !selectedPack ? (
                <div className="rounded-xl border border-zinc-800 bg-[#0E1015] p-8 text-center text-sm text-zinc-400">
                  Pa gen okenn folder .ZIP disponib pou w konfigire. Chwazi yon folder anlè a oswa
                  reyajiste pake demo yo nan tab « 📁 Jere Pake Mizik Yo ».
                </div>
              ) : (
                /* VirtualDJ MP3 Energy Scanner + Folder Color Picker + Cue Fine-Tuner */
                <div className="space-y-5">
                  <div className="rounded-xl bg-[#0E1015] border border-zinc-800 p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-display text-base font-bold text-white">
                          1. Eskanè Enèji MP3 Otomatik (Web Audio API)
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Voye fichye MP3 pou w detekte otomatikman{' '}
                          <span className="text-emerald-400 font-semibold">
                            Cue 1: KÒMANSMAN (#22C55E)
                          </span>{' '}
                          ak{' '}
                          <span className="text-rose-400 font-semibold">
                            Cue 2: PI GOU / DROP (#EF4444)
                          </span>
                          .
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="sm:w-64">
                          <label htmlFor="color-pack-select" className="sr-only">
                            Chwazi Folder Mizik
                          </label>
                          <select
                            id="color-pack-select"
                            value={selectedPack.id}
                            onChange={(e) => handleSelectPackForStudio(e.target.value)}
                            className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-medium text-white focus:border-emerald-500 focus:outline-none"
                          >
                            {allPacks.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedPack.isComingSoon ? (
                          <button
                            type="button"
                            disabled={isProcessingFolder}
                            onClick={() => handleStartActivateComingSoon(selectedPack.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-zinc-950 text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                          >
                            <FolderUp className="h-3.5 w-3.5" />
                            <span>📂 Ajoute Mizik &amp; Aktive Folder Sa a</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={packagingPackId === selectedPack.id}
                            onClick={() => void onAdminFreeDownloadPack(selectedPack)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {packagingPackId === selectedPack.id
                                ? 'Ap prepare .ZIP...'
                                : '⚡ Telechaje Gratis Admin'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* MP3 Upload Zone */}
                    <div className="rounded-xl border border-dashed border-zinc-700 bg-[#0B0C10] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <Activity className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Eskane MP3 pou Folder sa a ({uploadedCount} MP3 reyèl chaje)
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Chak MP3 eskane pa `decodeAudioData` anrejistre dirèkteman pou
                            telechajman .ZIP la ak tout 2 Hot Cues + Koulè VirtualDJ.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                          <span>Kòmanse nan #:</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={startSlotNumber}
                            onChange={(e) =>
                              setStartSlotNumber(
                                Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1))
                              )
                            }
                            className="w-16 rounded-lg bg-[#13151B] border border-zinc-700 px-2 py-1.5 text-xs font-mono text-white text-center"
                          />
                        </label>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*"
                          multiple
                          onChange={(e) => void handleMp3FilesUpload(e.target.files)}
                          className="hidden"
                          id="admin-mp3-upload-input"
                        />
                        <label
                          htmlFor="admin-mp3-upload-input"
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            isScanning ? 'opacity-60 pointer-events-none' : ''
                          }`}
                        >
                          <Upload className="h-4 w-4" />
                          <span>{isScanning ? 'Ap Eskane...' : 'Chwazi Fichye .MP3'}</span>
                        </label>
                      </div>
                    </div>

                    {scanStatus && (
                      <p className="text-xs font-medium text-emerald-300">{scanStatus}</p>
                    )}
                    {scanError && (
                      <p role="alert" className="text-xs font-medium text-rose-400">
                        {scanError}
                      </p>
                    )}

                    {/* Folder Color Mode Selection */}
                    <div className="border-t border-zinc-800/80 pt-5 space-y-4">
                      <h3 className="font-display text-base font-bold text-white">
                        2. Koulè VirtualDJ Folder la (TXXX:COLOR + #EXTVDJ)
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftColorConfig((prev) => ({ ...prev, mode: 'rainbow' }));
                            setColorSavedBanner(false);
                          }}
                          className={`flex flex-col justify-between p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                            draftColorConfig.mode === 'rainbow'
                              ? 'bg-emerald-500/15 border-emerald-500 text-white'
                              : 'bg-[#0B0C10] border-zinc-800 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          <span className="text-sm font-bold">
                            🌈 Koulè Otomatik Varye (Multi-Color DJ Rainbow)
                          </span>
                          <span className="text-xs text-zinc-400 mt-1">
                            Altène 6 koulè DJ yo sou chak mizik (Wouj, Ble, Vèt, Lò, Vyolèt, Syàn).
                          </span>
                          <div className="flex items-center gap-1.5 mt-3">
                            {DJ_RAINBOW_COLORS.map((c) => (
                              <span
                                key={c.hex}
                                className="h-3.5 w-6 rounded-sm"
                                style={{ backgroundColor: c.hex }}
                                title={c.label}
                              />
                            ))}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDraftColorConfig((prev) => ({ ...prev, mode: 'solid' }));
                            setColorSavedBanner(false);
                          }}
                          className={`flex flex-col justify-between p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                            draftColorConfig.mode === 'solid'
                              ? 'bg-emerald-500/15 border-emerald-500 text-white'
                              : 'bg-[#0B0C10] border-zinc-800 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          <span className="text-sm font-bold">
                            🎯 Koulè Siyati Inik (Single Folder Color)
                          </span>
                          <span className="text-xs text-zinc-400 mt-1">
                            Tout mizik nan folder la pran menm koulè siyati a (sòf sa w chanje
                            anba a).
                          </span>
                          <div className="flex items-center gap-2 mt-3">
                            <span
                              className="h-3.5 w-10 rounded-sm border border-white/20"
                              style={{ backgroundColor: draftColorConfig.solidColor }}
                            />
                            <span className="text-xs font-mono text-zinc-300">
                              {draftColorConfig.solidColor}
                            </span>
                          </div>
                        </button>
                      </div>

                      {draftColorConfig.mode === 'solid' && (
                        <div className="rounded-xl bg-[#0B0C10] border border-zinc-800 p-4 space-y-3">
                          <p className="text-xs font-medium text-zinc-300">
                            Chwazi Koulè Siyati Folder la:
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {DJ_RAINBOW_COLORS.map((preset) => {
                              const active =
                                draftColorConfig.solidColor.toUpperCase() === preset.hex;
                              return (
                                <button
                                  key={preset.hex}
                                  type="button"
                                  onClick={() => {
                                    setDraftColorConfig((prev) => ({
                                      ...prev,
                                      solidColor: preset.hex,
                                    }));
                                    setColorSavedBanner(false);
                                  }}
                                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                                    active
                                      ? 'border-white bg-zinc-800 text-white'
                                      : 'border-zinc-800 bg-[#13151B] text-zinc-300 hover:border-zinc-600'
                                  }`}
                                >
                                  <span
                                    className="h-3.5 w-3.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: preset.hex }}
                                  />
                                  <span>{preset.label}</span>
                                </button>
                              );
                            })}

                            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-[#13151B] text-xs text-zinc-300 cursor-pointer hover:border-zinc-600">
                              <input
                                type="color"
                                value={draftColorConfig.solidColor}
                                onChange={(e) => {
                                  setDraftColorConfig((prev) => ({
                                    ...prev,
                                    solidColor: e.target.value.toUpperCase(),
                                  }));
                                  setColorSavedBanner(false);
                                }}
                                className="h-5 w-6 bg-transparent border-0 cursor-pointer"
                              />
                              <span className="font-mono">{draftColorConfig.solidColor}</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Save Color + Hot Cues Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-zinc-400">
                        {overrideCount > 0 ? (
                          <span className="text-amber-300 tabular-nums">
                            {overrideCount} mizik gen koulè endividyèl pèsonalize
                          </span>
                        ) : (
                          <span>Tout 100 mizik yo gen Hot Cue 1 &amp; Cue 2 + koulè VirtualDJ</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {overrideCount > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllTrackOverrides}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-xs font-medium text-zinc-300 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reyajiste Koulè</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveStudioConfig}
                          className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm cursor-pointer transition-colors"
                        >
                          {colorSavedBanner ? (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Koulè &amp; Hot Cues Anrejistre!</span>
                            </>
                          ) : (
                            <span>💾 Anrejistre Koulè &amp; Hot Cues</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Individual Track Color & Cue 1 / Cue 2 Fine-Tuning List */}
                  <div className="rounded-xl border border-zinc-800 bg-[#0E1015] overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800">
                      <div>
                        <h4 className="font-display text-sm font-bold text-white">
                          Ajiste Koulè ak Hot Cue 1 &amp; 2 pa Mizik ({selectedPack.tracks.length})
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Cue 1 (Vèt #22C55E): KÒMANSMAN · Cue 2 (Wouj #EF4444): PI GOU / DROP
                        </p>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <input
                          type="search"
                          value={trackSearch}
                          onChange={(e) => setTrackSearch(e.target.value)}
                          placeholder="Chèche nimewo, atis, tit..."
                          className="w-full rounded-lg bg-[#0B0C10] border border-zinc-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
                      {filteredStudioTracks.map((track) => {
                        const resolvedHex = resolveTrackColor(
                          selectedPack.id,
                          track.number,
                          draftColorConfig
                        );
                        const cues = resolveTrackHotCues(
                          selectedPack.id,
                          track,
                          draftCuesConfig
                        );
                        const hasOverride = Boolean(
                          draftColorConfig.trackColors?.[track.number]
                        );
                        const hasRealMp3 = hasUploadedMp3Buffer(selectedPack.id, track.number);
                        const effArtist = cues.customArtist || track.artist;
                        const effTitle = cues.customTitle || track.title;
                        const cue1Key = `${selectedPack.id}-${track.number}-cue1`;
                        const cue2Key = `${selectedPack.id}-${track.number}-cue2`;

                        return (
                          <div
                            key={`${selectedPack.id}-studio-${track.number}`}
                            className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 transition-colors"
                            style={{
                              backgroundColor: `${resolvedHex}14`,
                              borderLeft: `4px solid ${resolvedHex}`,
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span
                                className="h-4 w-4 rounded-sm shrink-0 border border-white/20"
                                style={{ backgroundColor: resolvedHex }}
                                title={resolvedHex}
                              />
                              <span
                                className="font-mono text-xs font-bold tabular-nums shrink-0"
                                style={{ color: resolvedHex }}
                              >
                                {String(track.number).padStart(3, '0')}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-zinc-100 truncate">
                                  {effArtist} — {effTitle}
                                </p>
                                <p className="text-[11px] text-zinc-500 tabular-nums">
                                  {track.bpm} BPM ·{' '}
                                  {hasRealMp3
                                    ? 'MP3 Eskane (Audio Reyèl)'
                                    : cues.source === 'manual'
                                      ? 'Ajiste Manyèlman'
                                      : 'Auto BPM'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1 rounded-lg bg-[#0B0C10] border border-emerald-500/35 px-2 py-1">
                                <span className="text-[11px] font-bold text-emerald-400 whitespace-nowrap">
                                  1: KÒM
                                </span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  aria-label={`Cue 1 Kòmansman pou mizik ${track.number}`}
                                  value={cues.cue1Seconds}
                                  onChange={(e) =>
                                    handleCueChange(track.number, 'cue1Seconds', e.target.value)
                                  }
                                  className="w-14 bg-transparent text-xs font-mono text-white text-right tabular-nums focus:outline-none"
                                />
                                <span className="text-[10px] text-zinc-500">s</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuditionCue(
                                      track.number,
                                      'cue1',
                                      cues.cue1Seconds,
                                      track.bpm
                                    )
                                  }
                                  title="Koute Cue 1: KÒMANSMAN"
                                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                                >
                                  {playingCueKey === cue1Key ? (
                                    <Square className="h-3 w-3 fill-current" />
                                  ) : (
                                    <Play className="h-3 w-3 fill-current" />
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-1 rounded-lg bg-[#0B0C10] border border-rose-500/35 px-2 py-1">
                                <span className="text-[11px] font-bold text-rose-400 whitespace-nowrap">
                                  2: PI GOU
                                </span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  aria-label={`Cue 2 Drop pou mizik ${track.number}`}
                                  value={cues.cue2Seconds}
                                  onChange={(e) =>
                                    handleCueChange(track.number, 'cue2Seconds', e.target.value)
                                  }
                                  className="w-14 bg-transparent text-xs font-mono text-white text-right tabular-nums focus:outline-none"
                                />
                                <span className="text-[10px] text-zinc-500">s</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuditionCue(
                                      track.number,
                                      'cue2',
                                      cues.cue2Seconds,
                                      track.bpm
                                    )
                                  }
                                  title="Koute Cue 2: PI GOU / DROP"
                                  className="p-1 rounded text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                                >
                                  {playingCueKey === cue2Key ? (
                                    <Square className="h-3 w-3 fill-current" />
                                  ) : (
                                    <Play className="h-3 w-3 fill-current" />
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                {DJ_RAINBOW_COLORS.map((preset) => (
                                  <button
                                    key={preset.hex}
                                    type="button"
                                    title={`${preset.label} (${preset.hex})`}
                                    onClick={() =>
                                      handleSetTrackColorOverride(track.number, preset.hex)
                                    }
                                    className={`h-4 w-4 rounded border transition-transform cursor-pointer ${
                                      resolvedHex === preset.hex
                                        ? 'border-white scale-110'
                                        : 'border-zinc-700 opacity-75 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: preset.hex }}
                                  />
                                ))}
                                <input
                                  type="color"
                                  aria-label={`Chwazi koulè pou mizik ${track.number}`}
                                  value={resolvedHex}
                                  onChange={(e) =>
                                    handleSetTrackColorOverride(track.number, e.target.value)
                                  }
                                  className="h-4 w-5 bg-transparent border-0 cursor-pointer"
                                />
                                {(hasOverride || cues.source === 'manual') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleClearTrackColorOverride(track.number);
                                      handleResetTrackCues(track.number);
                                    }}
                                    title="Reyajiste koulè ak cues"
                                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
