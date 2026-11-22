import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Download,
  Lock,
  Unlock,
  KeyRound,
  FolderCheck,
  FolderArchive,
  LogOut,
  Clock,
  Zap,
  Bell,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import {
  ACTIVE_KEY_STORAGE_KEY,
  HERO_IMAGE,
  FolderPlan,
  MusicPack,
  VipKeyRecord,
  consumeFolderCreditRemote,
  fetchVipKeyByCodeRemote,
  formatZipFolderFilename,
  getAllMusicPacks,
  getFolderColorConfig,
  getFolderCuesConfig,
  getVipKeyByCode,
  subscribeSingleVipKeyRealtime,
} from './data/musicPacks';
import { buildVirtualDjColorZip } from './utils/id3Mp3Packager';
import { WelcomeVipModal } from './components/WelcomeVipModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { QuotaExhaustedModal } from './components/QuotaExhaustedModal';
import { DirectCheckoutModal } from './components/DirectCheckoutModal';
import { VisitorEntryGateModal } from './components/VisitorEntryGateModal';
import { ZipFilenameText } from './components/ZipFilenameText';
import { PWAInstallButton } from './components/PWAInstallButton';
import { CountrySelector } from './components/CountrySelector';
import {
  getCountryByCode,
  loadSelectedCountryCode,
  saveSelectedCountryCode,
} from './data/countries';
import { buildCountryTrendingComingSoonPacks } from './data/trendingCatalog';
import {
  loadRequestedZipNames,
  submitPackRequestRemote,
} from './data/packRequests';
import {
  VisitorProfile,
  loadSavedVisitorProfile,
  markVisitorOfflineKeepalive,
  sendVisitorHeartbeatRemote,
} from './data/visitors';
import {
  ACTIVE_CHECKOUT_ORDER_STORAGE_KEY,
  fetchPaymentOrderByIdRemote,
  getPaymentOrderById,
  loadActiveCheckoutOrderId,
  ORDERS_UPDATED_EVENT,
  PAYMENT_ORDERS_STORAGE_KEY,
  PaymentOrder,
  saveActiveCheckoutOrderId,
  subscribePaymentOrderByIdRealtime,
} from './data/paymentOrders';

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
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(() =>
    loadSavedVisitorProfile()
  );
  const [activeKey, setActiveKey] = useState<VipKeyRecord | null>(() => loadActiveKeyRecord());
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(
    () => Boolean(loadSavedVisitorProfile()) && !loadActiveKeyRecord() && !loadAdminAuthenticatedFlag()
  );
  const [pendingPack, setPendingPack] = useState<MusicPack | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [exhaustedKeyCode, setExhaustedKeyCode] = useState<string | null>(null);
  const [isExhaustedOpen, setIsExhaustedOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [colorVersion, setColorVersion] = useState<number>(0);
  const [customPacksVersion, setCustomPacksVersion] = useState<number>(0);
  const [packagingPackId, setPackagingPackId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() =>
    loadSelectedCountryCode()
  );
  const [checkoutPlan, setCheckoutPlan] = useState<FolderPlan | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() =>
    loadActiveCheckoutOrderId()
  );
  const [isDirectCheckoutOpen, setIsDirectCheckoutOpen] = useState<boolean>(false);
  const [requestedZips, setRequestedZips] = useState<string[]>(() => loadRequestedZipNames());
  const [requestingZip, setRequestingZip] = useState<string | null>(null);

  const handleSelectCountry = useCallback(
    (code: string) => {
      const saved = saveSelectedCountryCode(code);
      setSelectedCountryCode(saved);
      if (visitorProfile) {
        void sendVisitorHeartbeatRemote(visitorProfile, saved);
        setVisitorProfile((prev) => (prev ? { ...prev, countryCode: saved } : prev));
      }
    },
    [visitorProfile]
  );

  // Real-time online presence heartbeat + offline keepalive on tab close
  useEffect(() => {
    if (!visitorProfile) return;

    void sendVisitorHeartbeatRemote(visitorProfile, selectedCountryCode);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void sendVisitorHeartbeatRemote(visitorProfile, selectedCountryCode);
      }
    }, 25_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sendVisitorHeartbeatRemote(visitorProfile, selectedCountryCode);
      }
    };

    const handleUnload = () => {
      markVisitorOfflineKeepalive(visitorProfile.id);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [visitorProfile?.id, selectedCountryCode]);

  const handleStartDirectCheckout = useCallback((plan: FolderPlan) => {
    saveActiveCheckoutOrderId(null);
    setActiveOrderId(null);
    setCheckoutPlan(plan);
    setIsWelcomeOpen(false);
    setIsExhaustedOpen(false);
    setIsDirectCheckoutOpen(true);
  }, []);

  const allPacks = useMemo(() => {
    void customPacksVersion;
    return getAllMusicPacks();
  }, [customPacksVersion]);

  const selectedCountry = useMemo(
    () => getCountryByCode(selectedCountryCode),
    [selectedCountryCode]
  );

  const availablePacks = useMemo(
    () => allPacks.filter((p) => !p.isComingSoon),
    [allPacks]
  );

  const trendingComingSoonPacks = useMemo(() => {
    const ownerComingSoon = allPacks.filter((p) => Boolean(p.isComingSoon));
    const existingKeys = new Set(
      allPacks.map((p) => p.title.toLowerCase().replace(/\.zip$/i, '').trim())
    );
    const dynamicCountryPacks = buildCountryTrendingComingSoonPacks(
      selectedCountryCode,
      existingKeys
    );
    return [...ownerComingSoon, ...dynamicCountryPacks];
  }, [allPacks, selectedCountryCode]);

  const activePacksCount = availablePacks.length;
  const comingSoonPacksCount = trendingComingSoonPacks.length;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  const handleRequestComingSoonPack = useCallback(
    async (pack: MusicPack) => {
      const zipFilename = formatZipFolderFilename(pack);
      setRequestingZip(zipFilename);
      await submitPackRequestRemote({
        packTitle: pack.title,
        zipFilename,
        genre: pack.genre,
        countryCode: selectedCountryCode,
      });
      setRequestingZip(null);
      setRequestedZips((prev) => (prev.includes(zipFilename) ? prev : [...prev, zipFilename]));
      showToast('✅ Demann ou an voye bay DJ Wesley! N ap lage pake sa a byento.');
    },
    [selectedCountryCode, showToast]
  );

  const syncActiveKeyFromStore = useCallback(() => {
    const code = window.localStorage.getItem(ACTIVE_KEY_STORAGE_KEY);
    if (!code) {
      setActiveKey(null);
      return;
    }
    void fetchVipKeyByCodeRemote(code).then((fresh) => {
      if (!fresh || fresh.burned || fresh.remainingFolders <= 0) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
        setActiveKey(null);
      } else {
        setActiveKey(fresh);
      }
    });
  }, []);

  // Subscribe to real-time Supabase changes on the buyer's active VIP Key
  // so credits & burned/exhausted lock stay exact across all devices
  useEffect(() => {
    const code = activeKey?.code;
    if (!code) return;

    void fetchVipKeyByCodeRemote(code).then((fresh) => {
      if (!fresh || fresh.burned || fresh.remainingFolders <= 0) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
        setActiveKey(null);
      } else {
        setActiveKey(fresh);
      }
    });

    const unsubscribeKey = subscribeSingleVipKeyRealtime(code, (updated) => {
      if (!updated || updated.burned || updated.remainingFolders <= 0) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
        setActiveKey(null);
        setExhaustedKeyCode(code);
        setIsExhaustedOpen(true);
      } else {
        setActiveKey(updated);
      }
    });

    return () => {
      unsubscribeKey();
    };
  }, [activeKey?.code]);

  // Automatically pop the generated short VIP Key straight onto the buyer's screen
  // in real time via Supabase Realtime the moment Admin VIP clicks "✔ Valide & Voye Kle VIP"
  useEffect(() => {
    const surfaceApprovedOrder = (order: PaymentOrder | null) => {
      if (order && order.status === 'approved' && order.issuedVipKey) {
        setActiveOrderId(order.id);
        setIsWelcomeOpen(false);
        setIsExhaustedOpen(false);
        setIsDirectCheckoutOpen(true);
        // Mark as surfaced so closing the modal won't forcefully re-open it later
        saveActiveCheckoutOrderId(null);
      }
    };

    const checkApprovedOrder = async () => {
      const pendingOrderId = loadActiveCheckoutOrderId();
      if (!pendingOrderId) return;
      const localOrder = getPaymentOrderById(pendingOrderId);
      if (localOrder?.status === 'approved' && localOrder.issuedVipKey) {
        surfaceApprovedOrder(localOrder);
        return;
      }
      const remoteOrder = await fetchPaymentOrderByIdRemote(pendingOrderId);
      surfaceApprovedOrder(remoteOrder);
    };

    const pendingOrderId = loadActiveCheckoutOrderId();
    const unsubscribeOrder = pendingOrderId
      ? subscribePaymentOrderByIdRealtime(pendingOrderId, (updated) => {
          surfaceApprovedOrder(updated);
        })
      : () => {};

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === PAYMENT_ORDERS_STORAGE_KEY ||
        e.key === ACTIVE_CHECKOUT_ORDER_STORAGE_KEY ||
        e.key === null
      ) {
        void checkApprovedOrder();
      }
    };

    const onOrdersUpdated = () => {
      void checkApprovedOrder();
    };

    void checkApprovedOrder();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    const poll = window.setInterval(() => void checkApprovedOrder(), 4000);

    return () => {
      unsubscribeOrder();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
      window.clearInterval(poll);
    };
  }, [isDirectCheckoutOpen]);

  const handleUnlock = useCallback(
    (record: VipKeyRecord) => {
      window.localStorage.setItem(ACTIVE_KEY_STORAGE_KEY, record.code);
      setActiveKey(record);
      showToast(
        record.totalFolders >= 999
          ? '👑 Aksè VIP Ilimite debloke pou tout katalòg la!'
          : `Aksè VIP debloke! Kredi Folder: ${record.remainingFolders} / ${record.totalFolders} Folder`
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

      const result = await consumeFolderCreditRemote(activeKey.code, pack.id);
      if (!result.allowed || !result.updatedRecord) {
        window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
        setActiveKey(null);
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
          result.updatedRecord.totalFolders >= 999
            ? 'Telechajman .ZIP lanse! Aksè VIP Ilimite aktif.'
            : `Telechajman .ZIP lanse! Kredi ki rete: ${result.updatedRecord.remainingFolders} / ${result.updatedRecord.totalFolders} Folder`
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

  return (
    <div className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)] bg-[#0B0C10] text-zinc-100 flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b border-zinc-800/80 bg-[#0B0C10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-6 px-3 sm:px-6 h-16">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            className="font-display text-sm sm:text-lg font-bold tracking-tight text-white whitespace-nowrap truncate min-w-0"
          >
            WESLEY MUSIC PACKS
          </a>

          {/* Zone 2: Clean single-line nav links */}
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

          {/* Zone 3: Worldwide Country & Currency Selector + Primary Action / Quota Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <CountrySelector
              selectedCountryCode={selectedCountryCode}
              onSelectCountry={handleSelectCountry}
              align="right"
            />

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
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-colors cursor-pointer ${
                  hasRemainingCredits
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                }`}
              >
                <span>
                  {activeKey.totalFolders >= 999 ? (
                    '👑 VIP Ilimite'
                  ) : (
                    <>
                      <span className="hidden sm:inline">📁 Kredi Folder ki rete: </span>
                      <span className="sm:hidden">📁 </span>
                      {activeKey.remainingFolders} / {activeKey.totalFolders}
                      <span className="hidden sm:inline"> Folder</span>
                    </>
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingPack(null);
                  setIsWelcomeOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Antre Kle VIP</span>
                <span className="sm:hidden">Kle VIP</span>
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
                {activeKey.totalFolders >= 999
                  ? '👑 Aksè VIP Ilimite Aktif (Tout Katalòg la)'
                  : `📁 Kredi Folder ki rete: ${activeKey.remainingFolders} / ${activeKey.totalFolders} Folder`}
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
                      <button
                        type="button"
                        onClick={() => {
                          setPendingPack(null);
                          setIsWelcomeOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl border border-zinc-700 hover:border-emerald-500/60 text-zinc-100 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
                      >
                        <Zap className="h-4 w-4 text-emerald-400" />
                        <span>Achte Kle VIP Otomatik</span>
                      </button>
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

            {/* 1. REAL OWNER DOWNLOADABLE .ZIP FOLDERS AT THE TOP */}
            <div className="mb-12">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-extrabold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>✅ DISPONIB KOUNYE A ({activePacksCount} Folder .ZIP Pare)</span>
                </div>
              </div>

              {availablePacks.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-[#13151B] p-8 text-center space-y-2">
                  <FolderArchive className="h-9 w-9 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-200">
                    Pa gen okenn folder .ZIP pare pou telechaje pou moman an.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {availablePacks.map((pack) => {
                    const isPackaging = packagingPackId === pack.id;
                    const zipFilename = formatZipFolderFilename(pack);
                    void colorVersion;

                    return (
                      <article
                        key={pack.id}
                        className={`group flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 ${
                          isUnlockedForDownload
                            ? 'bg-[#13151B] border-emerald-500/45 shadow-[0_0_24px_rgba(16,185,129,0.08)]'
                            : 'bg-[#13151B] border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                                isUnlockedForDownload
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              }`}
                            >
                              <FolderArchive className="h-7 w-7" />
                            </div>

                            <span className="text-xs font-semibold text-right text-emerald-400">
                              {pack.genre}
                            </span>
                          </div>

                          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-emerald-300">
                            <span>✅ DISPONIB KOUNYE A</span>
                          </div>

                          <h3 className="mt-3 font-mono text-[15px] sm:text-lg leading-snug font-bold text-white tracking-tight">
                            <ZipFilenameText filename={zipFilename} />
                          </h3>

                          <p className="mt-2 text-xs sm:text-sm font-medium text-zinc-400 tabular-nums">
                            {pack.trackCount} Mizik an Lòd • .ZIP
                          </p>
                        </div>

                        <div className="mt-6 pt-5 border-t border-zinc-800/80">
                          {isUnlockedForDownload ? (
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. COUNTRY-AWARE TRENDING CATALOG ("🔥 TANDANS NAN PEYI W") */}
            <div className="pt-8 border-t border-zinc-800/80">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-400/40 px-3.5 py-1.5 text-xs font-extrabold text-amber-300 mb-3">
                    <Flame className="h-4 w-4 shrink-0" />
                    <span>
                      🔥 TANDANS NAN PEYI W · {selectedCountry.flag} {selectedCountry.name}
                    </span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                    🔥 TANDANS NAN PEYI W ({comingSoonPacksCount} Pake .ZIP An Preparasyon)
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 max-w-2xl">
                    Pake ki pi cho yo pou{' '}
                    <span className="text-zinc-200 font-semibold">
                      {selectedCountry.flag} {selectedCountry.name}
                    </span>
                    . Klike sou « 🔔 Mande Pake Sa a » pou w di DJ Wesley kilès pou l lage pi vit
                    (pa depanse okenn kredi VIP!).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {trendingComingSoonPacks.map((pack) => {
                  const zipFilename = formatZipFolderFilename(pack);
                  const alreadyRequested = requestedZips.includes(zipFilename);
                  const isSending = requestingZip === zipFilename;

                  return (
                    <article
                      key={pack.id}
                      className="group flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-b from-amber-500/[0.06] to-[#13151B] border-amber-500/40 hover:border-amber-400/70 shadow-[0_0_24px_rgba(245,158,11,0.06)]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-amber-500/15 border-amber-400/45 text-amber-300">
                            <Clock className="h-7 w-7 animate-[spin_6s_linear_infinite]" />
                          </div>

                          <span className="text-xs font-semibold text-right text-amber-300">
                            {pack.genre}
                          </span>
                        </div>

                        <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-300">
                          <span>⏳ AN PREPARASYON (AP VINI BYENTO)</span>
                        </div>

                        <h3 className="mt-4 font-mono text-[15px] sm:text-lg leading-snug font-bold text-white tracking-tight">
                          <ZipFilenameText filename={zipFilename} />
                        </h3>

                        <p className="mt-2 text-xs sm:text-sm font-medium text-zinc-400">
                          Tandans {selectedCountry.flag} {selectedCountry.name} • Ap vini byento
                        </p>
                      </div>

                      <div className="mt-6 pt-5 border-t border-zinc-800/80">
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => void handleRequestComingSoonPack(pack)}
                          className={`w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                            alreadyRequested
                              ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-amber-500/15 border-amber-400/60 hover:bg-amber-400 hover:text-zinc-950 text-amber-200'
                          }`}
                        >
                          {alreadyRequested ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>✅ Demann Voye (Mande Ankò)</span>
                            </>
                          ) : (
                            <>
                              <Bell className="h-4 w-4 shrink-0" />
                              <span>{isSending ? 'Ap voye demann...' : '🔔 Mande Pake Sa a'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
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
                <p className="font-mono text-xs text-emerald-400 font-semibold">01. Achte Otomatik</p>
                <h3 className="mt-2 font-display text-lg font-bold text-white">
                  Peye An Liy oswa Sèvi ak Kat Prepeye
                </h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Chwazi plan ou bezwen an (10, 21, 36, 55 Folder oswa VIP Ilimite) epi peye ak Kat
                  Vityèl, Kat Bankè oswa Crypto USDT pou w resevwa Kle VIP ou a otomatikman.
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
      <footer className="border-t border-zinc-800/80 bg-[#090A0D]">
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
            <PWAInstallButton variant="footer" />
          </div>
        </div>
      </footer>

      {/* Required Country-Validated Visitor Entry Gate */}
      <VisitorEntryGateModal
        isOpen={!visitorProfile && !isAdminAuthenticated && !isAdminOpen}
        selectedCountryCode={selectedCountryCode}
        onSelectCountry={handleSelectCountry}
        onCompleted={(savedVisitor) => {
          setVisitorProfile(savedVisitor);
          if (!activeKey) {
            setIsWelcomeOpen(true);
          }
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Immediate Welcome VIP Modal */}
      <WelcomeVipModal
        isOpen={isWelcomeOpen && (Boolean(visitorProfile) || isAdminAuthenticated)}
        allPacks={allPacks}
        activeKey={activeKey}
        pendingPack={pendingPack}
        selectedCountryCode={selectedCountryCode}
        onSelectCountry={handleSelectCountry}
        onStartDirectCheckout={handleStartDirectCheckout}
        onUnlock={handleUnlock}
        onUnlockOrDownloadPack={(pack) => void handleUnlockOrDownloadPack(pack)}
        onBrowsePacks={() => {
          setIsWelcomeOpen(false);
          setPendingPack(null);
        }}
      />

      {/* Quota Exhausted Renewal Modal (when 0 / Y folders remain) */}
      <QuotaExhaustedModal
        isOpen={isExhaustedOpen}
        exhaustedKeyCode={exhaustedKeyCode}
        selectedCountryCode={selectedCountryCode}
        onSelectCountry={handleSelectCountry}
        onStartDirectCheckout={handleStartDirectCheckout}
        onClose={() => setIsExhaustedOpen(false)}
        onEnterNewKey={() => {
          setIsExhaustedOpen(false);
          setPendingPack(null);
          setIsWelcomeOpen(true);
        }}
      />

      {/* Built-in Country-Aware Direct Checkout (Natcash Haiti / USDT TRC20 International) */}
      <DirectCheckoutModal
        isOpen={isDirectCheckoutOpen}
        plan={checkoutPlan}
        selectedCountryCode={selectedCountryCode}
        initialOrderId={activeOrderId}
        onClose={() => {
          setIsDirectCheckoutOpen(false);
          setActiveOrderId(loadActiveCheckoutOrderId());
        }}
        onUnlockWithKey={(record) => {
          handleUnlock(record);
          setIsDirectCheckoutOpen(false);
        }}
      />

      {/* Password-Protected Admin Key Generator, Folder Deleter & Uploader Modal */}
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
        onCheckoutConfigChanged={() => {}}
      />

      {/* Non-intrusive Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl bg-[#13151B] border border-emerald-500/40 px-4 py-3 text-sm font-medium text-emerald-200 shadow-xl max-w-sm"
        >
          <FolderCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
