import React, { useState, useCallback, useMemo } from 'react';
import {
  Download,
  Lock,
  Unlock,
  MessageCircle,
  KeyRound,
  FolderCheck,
  FolderArchive,
  LogOut,
  Clock,
} from 'lucide-react';
import {
  ACTIVE_KEY_STORAGE_KEY,
  HERO_IMAGE,
  MusicPack,
  VipKeyRecord,
  WHATSAPP_BASE_URL,
  consumeFolderCredit,
  formatZipFolderFilename,
  getAllMusicPacks,
  getFolderColorConfig,
  getFolderCuesConfig,
  getVipKeyByCode,
} from './data/musicPacks';
import { buildVirtualDjColorZip } from './utils/id3Mp3Packager';
import { WelcomeVipModal } from './components/WelcomeVipModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { QuotaExhaustedModal } from './components/QuotaExhaustedModal';
import { ZipFilenameText } from './components/ZipFilenameText';
import { PWAInstallButton } from './components/PWAInstallButton';
import { StickyBannerAd, NativeSponsorCard, SponsorAdModal } from './components/AdSlots';
import { loadAdConfig, sanitizeHttpUrl } from './data/adConfig';

const ADMIN_SESSION_STORAGE_KEY = 'wesley_admin_auth_session_v1';

function loadActiveKeyRecord(): VipKeyRecord | null {
  try {
    const code = window.localStorage.getItem(ACTIVE_KEY_STORAGE_KEY);
    if (!code) return null;
    const record = getVipKeyByCode(code);
    if (!record || record.burned || record.remainingFolders <= 0) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

function loadAdminAuthenticatedFlag(): boolean {
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() =>
    loadAdminAuthenticatedFlag()
  );
  const [isAdminFreeMode, setIsAdminFreeMode] = useState<boolean>(() =>
    loadAdminAuthenticatedFlag()
  );
  const [activeKey, setActiveKey] = useState<VipKeyRecord | null>(() => loadActiveKeyRecord());
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(
    () => !loadActiveKeyRecord() && !loadAdminAuthenticatedFlag()
  );
  const [pendingPack, setPendingPack] = useState<MusicPack | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [exhaustedKeyCode, setExhaustedKeyCode] = useState<string | null>(null);
  const [isExhaustedOpen, setIsExhaustedOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [colorVersion, setColorVersion] = useState<number>(0);
  const [customPacksVersion, setCustomPacksVersion] = useState<number>(0);
  const [adConfigVersion, setAdConfigVersion] = useState<number>(0);
  const [isStickyBannerDismissed, setIsStickyBannerDismissed] = useState<boolean>(false);
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState<boolean>(false);
  const [sponsorTargetPack, setSponsorTargetPack] = useState<MusicPack | null>(null);
  const [packagingPackId, setPackagingPackId] = useState<string | null>(null);

  const adConfig = useMemo(() => {
    void adConfigVersion;
    return loadAdConfig();
  }, [adConfigVersion]);

  const allPacks = useMemo(() => {
    void customPacksVersion;
    return getAllMusicPacks();
  }, [customPacksVersion]);

  const activePacksCount = useMemo(
    () => allPacks.filter((p) => !p.isComingSoon).length,
    [allPacks]
  );
  const comingSoonPacksCount = useMemo(
    () => allPacks.filter((p) => Boolean(p.isComingSoon)).length,
    [allPacks]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  const syncActiveKeyFromStore = useCallback(() => {
    setActiveKey((curr) => {
      if (!curr) return null;
      const fresh = getVipKeyByCode(curr.code);
      if (!fresh || fresh.burned || fresh.remainingFolders <= 0) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
        return null;
      }
      return fresh;
    });
  }, []);

  const handleUnlock = useCallback(
    (record: VipKeyRecord) => {
      window.localStorage.setItem(ACTIVE_KEY_STORAGE_KEY, record.code);
      setActiveKey(record);
      setIsSponsorModalOpen(false);
      setSponsorTargetPack(null);
      showToast(
        `Aksè VIP debloke! Kredi Folder: ${record.remainingFolders} / ${record.totalFolders} Folder`
      );
    },
    [showToast]
  );

  const handleExhaustedAttempt = useCallback((code: string) => {
    setIsWelcomeOpen(false);
    setExhaustedKeyCode(code);
    setIsExhaustedOpen(true);
  }, []);

  const handleLockSession = () => {
    window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
    setActiveKey(null);
    setPendingPack(null);
    setIsWelcomeOpen(true);
  };

  const triggerZipDownload = useCallback(async (pack: MusicPack, keyCode: string) => {
    setPackagingPackId(pack.id);
    try {
      const colorConfig = getFolderColorConfig(pack.id);
      const cuesConfig = getFolderCuesConfig(pack.id);
      const zipBlob = await buildVirtualDjColorZip(pack, keyCode, colorConfig, cuesConfig);
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = formatZipFolderFilename(pack);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setPackagingPackId(null);
    }
  }, []);

  const handleAdminAuthenticated = useCallback(() => {
    try {
      window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    setIsAdminAuthenticated(true);
    setIsAdminFreeMode(true);
    setIsWelcomeOpen(false);
    showToast('👑 Mòd Admin Aktif — Telechajman Gratis Ilimite debloke!');
  }, [showToast]);

  const handleAdminLogout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setIsAdminAuthenticated(false);
    setIsAdminFreeMode(false);
    setIsAdminOpen(false);
    showToast('Ou dekonekte nan Mòd Admin lan.');
  }, [showToast]);

  const handleAdminFreeDownloadPack = useCallback(
    async (pack: MusicPack) => {
      if (!isAdminAuthenticated || pack.isComingSoon) return;
      await triggerZipDownload(pack, 'ADMIN-FREE-VIP');
      showToast(`⚡ Telechaje Gratis Admin: ${formatZipFolderFilename(pack)}`);
    },
    [isAdminAuthenticated, showToast, triggerZipDownload]
  );

  const handleUnlockOrDownloadPack = useCallback(
    async (pack: MusicPack) => {
      if (pack.isComingSoon) return;

      // Owner/Admin unlimited free download bypasses VIP Code & folder credit deduction
      if (isAdminAuthenticated && isAdminFreeMode) {
        await handleAdminFreeDownloadPack(pack);
        return;
      }

      if (!activeKey) {
        setPendingPack(pack);
        setIsWelcomeOpen(true);
        return;
      }

      if (activeKey.burned || activeKey.remainingFolders <= 0) {
        handleExhaustedAttempt(activeKey.code);
        return;
      }

      const result = consumeFolderCredit(activeKey.code, pack.id);
      if (!result.allowed || !result.updatedRecord) {
        handleExhaustedAttempt(activeKey.code);
        return;
      }

      setActiveKey(result.updatedRecord);
      await triggerZipDownload(pack, result.updatedRecord.code);

      if (result.justExhausted || result.updatedRecord.remainingFolders <= 0) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
        setActiveKey(null);
        setIsWelcomeOpen(false);
        setExhaustedKeyCode(result.updatedRecord.code);
        setIsExhaustedOpen(true);
      } else {
        showToast(
          `Telechajman .ZIP lanse! Kredi ki rete: ${result.updatedRecord.remainingFolders} / ${result.updatedRecord.totalFolders} Folder`
        );
      }
    },
    [
      activeKey,
      handleAdminFreeDownloadPack,
      handleExhaustedAttempt,
      isAdminAuthenticated,
      isAdminFreeMode,
      showToast,
      triggerZipDownload,
    ]
  );

  const hasActiveKey = Boolean(activeKey);
  const hasRemainingCredits = Boolean(activeKey && !activeKey.burned && activeKey.remainingFolders > 0);
  const isUnlockedForDownload = Boolean((isAdminAuthenticated && isAdminFreeMode) || hasRemainingCredits);
  const shouldShowAds = adConfig.enabled && !isUnlockedForDownload;
  const shouldShowStickyBanner = shouldShowAds && !isStickyBannerDismissed;

  return (
    <div className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)] bg-[#0B0C10] text-zinc-100 flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b border-zinc-800/80 bg-[#0B0C10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 h-16">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            WESLEY MUSIC PACKS
          </a>

          {/* Zone 2: Clean single-line nav links (Plan Folder tab removed) */}
          <nav
            aria-label="Navigasyon prensipal"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400"
          >
            <a
              href="#pake-mizik"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Folder .ZIP yo
            </a>
            <a
              href="#koman-sa-mache"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Kòman sa Mache
            </a>
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin VIP
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action / Live Folder Quota Badge */}
          <div className="flex items-center shrink-0">
            {hasActiveKey && activeKey ? (
              <button
                type="button"
                onClick={() => {
                  if (activeKey.remainingFolders <= 0) {
                    handleExhaustedAttempt(activeKey.code);
                  } else {
                    setPendingPack(null);
                    setIsWelcomeOpen(true);
                  }
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-colors cursor-pointer ${
                  hasRemainingCredits
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                }`}
              >
                <span>
                  📁 Kredi Folder ki rete: {activeKey.remainingFolders} /{' '}
                  {activeKey.totalFolders} Folder
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingPack(null);
                  setIsWelcomeOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Antre Kle VIP</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Admin Free Mode Toggle Banner when logged in as Admin */}
      {isAdminAuthenticated && (
        <div
          className={`border-b ${
            isAdminFreeMode
              ? 'border-emerald-500/40 bg-emerald-500/15'
              : 'border-amber-500/35 bg-amber-500/10'
          }`}
        >
          <div className="mx-auto flex flex-wrap items-center justify-between gap-3 max-w-6xl px-4 sm:px-6 py-2.5">
            <button
              type="button"
              onClick={() => setIsAdminFreeMode((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold tracking-tight transition-colors cursor-pointer ${
                isAdminFreeMode
                  ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                  : 'bg-zinc-900 border border-amber-500/50 text-amber-200 hover:bg-zinc-800'
              }`}
            >
              <span>
                {isAdminFreeMode
                  ? '👑 MÒD ADMIN AKTIF (TELECHAJMAN GRATIS ILIMITE)'
                  : '🔒 WÈ SIT LA TANKOU VIZITÈ (Klike pou Aktive Mòd Admin Gratis)'}
              </span>
            </button>

            <div className="flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setIsAdminOpen(true)}
                className="font-semibold text-emerald-300 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Ouvri Admin Panel
              </button>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="font-medium text-zinc-300 hover:text-rose-300 cursor-pointer"
              >
                Dekonekte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Folder Quota Status Bar when unlocked by buyer VIP Key */}
      {hasActiveKey && activeKey && !isAdminFreeMode && (
        <div
          className={`border-b ${
            hasRemainingCredits
              ? 'border-emerald-500/25 bg-emerald-500/10'
              : 'border-rose-500/25 bg-rose-500/10'
          }`}
        >
          <div className="mx-auto flex flex-wrap items-center justify-between gap-3 max-w-6xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm">
            <div
              className={`flex flex-wrap items-center gap-3 tabular-nums ${
                hasRemainingCredits ? 'text-emerald-200' : 'text-rose-200'
              }`}
            >
              <span className="font-semibold">
                📁 Kredi Folder ki rete: {activeKey.remainingFolders} / {activeKey.totalFolders}{' '}
                Folder
              </span>
              <span aria-hidden="true" className="opacity-50">
                ·
              </span>
              <span className="font-mono">Kòd: {activeKey.code}</span>
            </div>
            <button
              type="button"
              onClick={handleLockSession}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-white underline underline-offset-4 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Chanje Kle VIP</span>
            </button>
          </div>
        </div>
      )}

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-zinc-800/80">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="text-xs font-medium text-emerald-400 tracking-wide mb-3">
                  Koleksyon DJ &amp; Fanatik 2026 · Pake .ZIP VirtualDJ Ready
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.12] [text-wrap:balance]">
                  Folder Mizik VIP .ZIP pou DJ ak Amatè Bon Mizik
                </h1>
                <p className="mt-4 text-base text-zinc-300 leading-relaxed max-w-2xl">
                  Chak folder <span className="font-mono text-zinc-200">.ZIP</span> genyen mizik an
                  lòd ak koulè VirtualDJ + 2 Hot Cues pare. Antre Kle VIP ou a pou w telechaje
                  folder ou yo dirèkteman.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  {hasRemainingCredits ? (
                    <>
                      <a
                        href="#pake-mizik"
                        className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm whitespace-nowrap transition-colors"
                      >
                        <Unlock className="h-4 w-4" />
                        <span>Telechaje Folder .ZIP yo Kounye a</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleLockSession}
                        className="inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Chanje Kòd ({activeKey?.code})</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingPack(null);
                          setIsWelcomeOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm whitespace-nowrap transition-colors cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4" />
                        <span>Debloke ak Kle VIP</span>
                      </button>
                      <a
                        href={WHATSAPP_BASE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-100 text-sm font-semibold whitespace-nowrap transition-colors"
                      >
                        <MessageCircle className="h-4 w-4 text-[#25D366]" />
                        <span>Achte Kle sou WhatsApp</span>
                      </a>
                    </>
                  )}
                  <PWAInstallButton variant="hero" />
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative h-64 sm:h-80 lg:h-full min-h-[260px] rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                  <img
                    src={HERO_IMAGE}
                    alt="Estidyo DJ ak tab miksaj Wesley Music Packs"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0C10]/70 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Clean .ZIP Folder Cards Grid (Zero tracklists, all packs in one single clean grid) */}
        <section id="pake-mizik" className="py-14 sm:py-16 border-b border-zinc-800/80">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums">
                  Tout Folder Mizik .ZIP yo ({activePacksCount} Disponib · {comingSoonPacksCount} An
                  Preparasyon)
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Chak pake se yon folder <span className="font-mono text-zinc-300">.ZIP</span>{' '}
                  konplè ki gen tout mizik yo nimewote an lòd ak koulè VirtualDJ + 2 Hot Cues.
                </p>
              </div>
            </div>

            {allPacks.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-[#13151B] p-10 text-center space-y-2">
                <FolderArchive className="h-10 w-10 text-zinc-600 mx-auto" />
                <p className="text-base font-semibold text-zinc-200">
                  Pa gen okenn folder .ZIP pibliye pou kounye a.
                </p>
                <p className="text-xs text-zinc-400">
                  Admin nan ka konekte nan « Admin VIP » pou ajoute nouvo folder mizik yo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {allPacks.map((pack, idx) => {
                  const isComingSoon = Boolean(pack.isComingSoon);
                  const isPackaging = packagingPackId === pack.id;
                  const zipFilename = formatZipFolderFilename(pack);
                  const showNativeSponsorAfter = shouldShowAds && (idx + 1) % 4 === 0;
                  void colorVersion;

                  return (
                    <React.Fragment key={pack.id}>
                      <article
                        className={`group flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 ${
                        isComingSoon
                          ? 'bg-gradient-to-b from-amber-500/[0.06] to-[#13151B] border-amber-500/45 shadow-[0_0_24px_rgba(245,158,11,0.07)]'
                          : isUnlockedForDownload
                            ? 'bg-[#13151B] border-emerald-500/45 shadow-[0_0_24px_rgba(16,185,129,0.08)]'
                            : 'bg-[#13151B] border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        {/* Top Icon & Genre Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                              isComingSoon
                                ? 'bg-amber-500/15 border-amber-400/45 text-amber-300'
                                : isUnlockedForDownload
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}
                          >
                            {isComingSoon ? (
                              <Clock className="h-7 w-7 animate-[spin_6s_linear_infinite]" />
                            ) : (
                              <FolderArchive className="h-7 w-7" />
                            )}
                          </div>

                          <span
                            className={`text-xs font-semibold text-right ${
                              isComingSoon ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            {pack.genre}
                          </span>
                        </div>

                        {isComingSoon && (
                          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-300">
                            <span>⏳ AN PREPARASYON • AP DISPONIB BYENTO</span>
                          </div>
                        )}

                        {/* Exact .ZIP Folder Name (clean 1-2 line wrapping on iPhone without splitting .zip) */}
                        <h3 className="mt-4 font-mono text-[15px] sm:text-lg leading-snug font-bold text-white tracking-tight">
                          <ZipFilenameText filename={zipFilename} />
                        </h3>

                        {/* Track Count & .ZIP Label */}
                        <p className="mt-2 text-xs sm:text-sm font-medium text-zinc-400 tabular-nums">
                          {isComingSoon
                            ? 'Folder an preparasyon • Ap vini byento'
                            : `${pack.trackCount} Mizik an Lòd • .ZIP`}
                        </p>
                      </div>

                      {/* Single Action Button: Coming Soon Disabled vs Locked vs Unlocked Download */}
                      <div className="mt-6 pt-5 border-t border-zinc-800/80">
                        {isComingSoon ? (
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-amber-500/35 text-amber-300/85 text-xs sm:text-sm font-bold whitespace-nowrap cursor-not-allowed opacity-85"
                          >
                            <Clock className="h-4 w-4 shrink-0 animate-[spin_6s_linear_infinite]" />
                            <span>⏳ POKO DISPONIB (AP VINI BYENTO)</span>
                          </button>
                        ) : isUnlockedForDownload ? (
                          <button
                            type="button"
                            disabled={isPackaging}
                            onClick={() => void handleUnlockOrDownloadPack(pack)}
                            className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 text-sm font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                          >
                            <Download className="h-4 w-4 shrink-0" />
                            <span>
                              {isPackaging ? 'Ap prepare .ZIP...' : '⬇️ TELECHAJE .ZIP'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPackaging}
                            onClick={() => {
                              if (activeKey && (activeKey.burned || activeKey.remainingFolders <= 0)) {
                                handleExhaustedAttempt(activeKey.code);
                              } else if (shouldShowAds && adConfig.enableSponsorPopup) {
                                setPendingPack(pack);
                                setSponsorTargetPack(pack);
                                setIsSponsorModalOpen(true);
                              } else {
                                setPendingPack(pack);
                                setIsWelcomeOpen(true);
                              }
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0B0C10] border border-zinc-700 hover:border-emerald-500 disabled:opacity-60 text-white text-sm font-bold whitespace-nowrap transition-colors cursor-pointer"
                          >
                            <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>🔒 Mete Kle VIP pou Telechaje</span>
                          </button>
                        )}
                      </div>
                      </article>

                      {showNativeSponsorAfter && (
                        <NativeSponsorCard
                          adConfig={adConfig}
                          slotIndex={Math.floor((idx + 1) / 4)}
                          onOpenVipModal={() => {
                            setPendingPack(null);
                            setIsWelcomeOpen(true);
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* How It Works */}
        <section id="koman-sa-mache" className="py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mb-8">
              Kòman sa Mache nan 3 Etap
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-[#13151B] border border-zinc-800 p-6">
                <p className="font-mono text-xs text-emerald-400 font-semibold">01. Achte Kle VIP</p>
                <h3 className="mt-2 font-display text-lg font-bold text-white">
                  Kontakte Admin sou WhatsApp
                </h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Ekri Wesley sou +509 38569265 pou w chwazi kantite folder .ZIP ou bezwen an
                  (1, 2, 3, 5, oswa 10 Folder) epi resevwa Kle VIP inik ou a.
                </p>
              </div>

              <div className="rounded-2xl bg-[#13151B] border border-zinc-800 p-6">
                <p className="font-mono text-xs text-emerald-400 font-semibold">02. Debloke</p>
                <h3 className="mt-2 font-display text-lg font-bold text-white">
                  Antre Kle VIP ou a
                </h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Antre kòd kout ou a (egzanp <span className="font-mono">W#84K2</span>) pou w
                  debloke bouton vèt « ⬇️ TELECHAJE .ZIP » yo sou tout folder yo.
                </p>
              </div>

              <div className="rounded-2xl bg-[#13151B] border border-zinc-800 p-6">
                <p className="font-mono text-xs text-emerald-400 font-semibold">03. Telechaje .ZIP</p>
                <h3 className="mt-2 font-display text-lg font-bold text-white">
                  Pare pou VirtualDJ 8 / 2024+
                </h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Chak folder .ZIP vini ak MP3 nimewote an lòd,{' '}
                  <span className="font-mono">000 - PLAYLIST_VIRTUALDJ.m3u</span>, ak{' '}
                  <span className="font-mono">VIRTUALDJ_IMPORT_DATABASE.xml</span>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer
        className={`border-t border-zinc-800/80 bg-[#090A0D] ${
          shouldShowStickyBanner ? 'pb-24 sm:pb-28' : ''
        }`}
      >
        <div className="mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-6xl px-4 sm:px-6 py-8 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} WESLEY MUSIC PACKS. Tout dwa rezève.</p>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setPendingPack(null);
                setIsWelcomeOpen(true);
              }}
              className="hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Antre Kle VIP
            </button>
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Admin Panel
            </button>
            <a
              href={WHATSAPP_BASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-200 transition-colors"
            >
              WhatsApp Admin (+509 38569265)
            </a>
            <PWAInstallButton variant="footer" />
          </div>
        </div>
      </footer>

      {/* Immediate Welcome VIP Modal */}
      <WelcomeVipModal
        isOpen={isWelcomeOpen}
        allPacks={allPacks}
        activeKey={activeKey}
        pendingPack={pendingPack}
        showSponsorTrigger={shouldShowAds}
        sponsorDirectLink={sanitizeHttpUrl(adConfig.smartLinkUrl)}
        onTriggerSponsorAd={() => {
          setIsWelcomeOpen(false);
          setSponsorTargetPack(pendingPack);
          setIsSponsorModalOpen(true);
        }}
        onUnlock={handleUnlock}
        onUnlockOrDownloadPack={(pack) => void handleUnlockOrDownloadPack(pack)}
        onBrowsePacks={() => {
          setIsWelcomeOpen(false);
          setPendingPack(null);
        }}
      />

      {/* Optional VidMate-Style Sponsor Ad Gate before VIP Unlock */}
      <SponsorAdModal
        isOpen={isSponsorModalOpen && shouldShowAds}
        adConfig={adConfig}
        targetPack={sponsorTargetPack}
        onClose={() => {
          setIsSponsorModalOpen(false);
          setSponsorTargetPack(null);
        }}
        onProceedToVipKey={() => {
          setIsSponsorModalOpen(false);
          setPendingPack(sponsorTargetPack);
          setIsWelcomeOpen(true);
        }}
      />

      {/* Quota Exhausted Renewal Modal (when 0 / Y folders remain) */}
      <QuotaExhaustedModal
        isOpen={isExhaustedOpen}
        exhaustedKeyCode={exhaustedKeyCode}
        onClose={() => setIsExhaustedOpen(false)}
        onEnterNewKey={() => {
          setIsExhaustedOpen(false);
          setPendingPack(null);
          setIsWelcomeOpen(true);
        }}
      />

      {/* Password-Protected Admin Key Generator, Folder Deleter, Uploader & Ad Manager Modal */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        isAuthenticated={isAdminAuthenticated}
        allPacks={allPacks}
        packagingPackId={packagingPackId}
        onAdminAuthenticated={handleAdminAuthenticated}
        onAdminLogout={handleAdminLogout}
        onAdminFreeDownloadPack={handleAdminFreeDownloadPack}
        onClose={() => setIsAdminOpen(false)}
        onKeysChanged={syncActiveKeyFromStore}
        onColorsChanged={() => setColorVersion((v) => v + 1)}
        onCustomPacksChanged={() => setCustomPacksVersion((v) => v + 1)}
        onAdConfigChanged={() => {
          setAdConfigVersion((v) => v + 1);
          setIsStickyBannerDismissed(false);
        }}
      />

      {/* Bottom Sticky Mobile/Desktop Banner Ad (Auto-hidden for VIP buyers) */}
      <StickyBannerAd
        adConfig={adConfig}
        isVisible={shouldShowStickyBanner}
        onDismiss={() => setIsStickyBannerDismissed(true)}
      />

      {/* Non-intrusive Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-5 z-50 flex items-center gap-2.5 rounded-xl bg-[#13151B] border border-emerald-500/40 px-4 py-3 text-sm font-medium text-emerald-200 shadow-xl max-w-sm ${
            shouldShowStickyBanner ? 'bottom-24 sm:bottom-28' : 'bottom-5'
          }`}
        >
          <FolderCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
