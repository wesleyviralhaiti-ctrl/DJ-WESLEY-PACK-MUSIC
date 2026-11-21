import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Flame,
  KeyRound,
  Sparkles,
  Volume2,
  X,
  Clock,
} from 'lucide-react';
import {
  AdSystemConfig,
  DEFAULT_HILLTOP_DIRECT_LINK,
  DEFAULT_PROMO_HEADLINE,
  DEFAULT_PROMO_SUBTEXT,
  buildSandboxedAdSrcDoc,
  sanitizeHttpUrl,
} from '../data/adConfig';
import { WHATSAPP_BASE_URL } from '../data/musicPacks';

interface SandboxedAdFrameProps {
  htmlSnippet: string;
  title: string;
  className?: string;
}

export const SandboxedAdFrame: React.FC<SandboxedAdFrameProps> = ({
  htmlSnippet,
  title,
  className = '',
}) => {
  const srcDoc = buildSandboxedAdSrcDoc(htmlSnippet);
  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      referrerPolicy="no-referrer-when-downgrade"
      className={`border-0 bg-[#0B0C10] ${className}`}
    />
  );
};

interface StickyBannerAdProps {
  adConfig: AdSystemConfig;
  isVisible: boolean;
  onDismiss: () => void;
}

export const StickyBannerAd: React.FC<StickyBannerAdProps> = ({
  adConfig,
  isVisible,
  onDismiss,
}) => {
  if (!isVisible) return null;

  const hasCustomBanner = adConfig.bannerAdHtml.trim().length > 0;
  const safeSmartLink = sanitizeHttpUrl(adConfig.smartLinkUrl);
  const promoHref = safeSmartLink ?? WHATSAPP_BASE_URL;

  return (
    <aside
      aria-label="Anons Sponsor"
      className="fixed bottom-0 inset-x-0 z-30 pointer-events-none px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto mx-auto max-w-[760px] rounded-xl border border-emerald-500/35 bg-[#090A0D]/95 backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.75)] px-2.5 py-2 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between px-1 mb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-300/90">
              SPONSOR / ANONS
            </span>
            <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">
              728×90 · Kliyan VIP pa wè anons
            </span>
          </div>

          {hasCustomBanner ? (
            <div className="w-full flex justify-center overflow-hidden rounded-lg border border-zinc-800 bg-[#0B0C10]">
              <SandboxedAdFrame
                htmlSnippet={adConfig.bannerAdHtml}
                title="Banyè Sponsor Wesley Music"
                className="w-[320px] h-[50px] sm:w-[728px] sm:h-[90px]"
              />
            </div>
          ) : (
            <a
              href={promoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[50px] sm:min-h-[68px] rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-[#13151B] to-amber-500/10 hover:border-emerald-400/60 px-3 sm:px-5 py-2 flex items-center justify-between gap-3 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <Volume2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {DEFAULT_PROMO_HEADLINE}
                  </p>
                  <p className="hidden sm:block text-[11px] text-zinc-400 truncate">
                    {DEFAULT_PROMO_SUBTEXT}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-emerald-500 group-hover:bg-emerald-400 px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-extrabold text-zinc-950 whitespace-nowrap">
                <span>Klike la</span>
                <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Kache banyè anons lan"
          title="Kache banyè anons lan"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer self-start"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};

interface NativeSponsorCardProps {
  adConfig: AdSystemConfig;
  slotIndex: number;
  onOpenVipModal: () => void;
}

export const NativeSponsorCard: React.FC<NativeSponsorCardProps> = ({
  adConfig,
  slotIndex,
  onOpenVipModal,
}) => {
  const hasCustomNative = adConfig.nativeAdHtml.trim().length > 0;
  const safeSmartLink = sanitizeHttpUrl(adConfig.smartLinkUrl);
  const promoHref = safeSmartLink ?? WHATSAPP_BASE_URL;

  return (
    <article
      aria-label={`Anons Sponsor ${slotIndex}`}
      className="flex flex-col justify-between rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.06] via-[#13151B] to-[#0E1015] p-6 shadow-[0_0_24px_rgba(245,158,11,0.06)]"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 text-amber-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <span className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-mono font-extrabold tracking-widest text-amber-300 uppercase">
            SPONSOR / ANONS
          </span>
        </div>

        {hasCustomNative ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0B0C10]">
            <SandboxedAdFrame
              htmlSnippet={adConfig.nativeAdHtml}
              title={`Anons Natif Sponsor ${slotIndex}`}
              className="w-full h-[180px]"
            />
          </div>
        ) : (
          <>
            <h3 className="mt-4 font-display text-lg font-bold text-white leading-snug">
              {DEFAULT_PROMO_HEADLINE}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {DEFAULT_PROMO_SUBTEXT} Antre yon Kle VIP tou pou w retire tout anons yo nèt!
            </p>
          </>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-zinc-800/80 space-y-2.5">
        <a
          href={promoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-colors"
        >
          <span>🎧 Klike Pou Wè Ofri Sponsor an</span>
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
        <button
          type="button"
          onClick={onOpenVipModal}
          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Retire anons yo ak Kle VIP</span>
        </button>
      </div>
    </article>
  );
};

interface InterstitialAdModalProps {
  isOpen: boolean;
  adConfig: AdSystemConfig;
  onClose: () => void;
}

const INTERSTITIAL_DURATION_MS = 4500;

export const InterstitialAdModal: React.FC<InterstitialAdModalProps> = ({
  isOpen,
  adConfig,
  onClose,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(INTERSTITIAL_DURATION_MS);

  useEffect(() => {
    if (!isOpen) return;
    const startTime = Date.now();
    setRemainingMs(INTERSTITIAL_DURATION_MS);

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const nextRemaining = Math.max(0, INTERSTITIAL_DURATION_MS - elapsed);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        window.clearInterval(interval);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const safeSmartLink = sanitizeHttpUrl(adConfig.smartLinkUrl) ?? DEFAULT_HILLTOP_DIRECT_LINK;
  const hasCustomBanner = adConfig.bannerAdHtml.trim().length > 0;
  const hasCustomNative = adConfig.nativeAdHtml.trim().length > 0;
  const modalCreativeHtml = hasCustomNative
    ? adConfig.nativeAdHtml
    : hasCustomBanner
      ? adConfig.bannerAdHtml
      : '';
  const canClose = remainingMs <= 0;
  const displaySeconds = Math.min(4, Math.max(1, Math.ceil(remainingMs / 1000)));
  const progressPercent = Math.min(
    100,
    Math.max(0, ((INTERSTITIAL_DURATION_MS - remainingMs) / INTERSTITIAL_DURATION_MS) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interstitial-ad-heading"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#13151B] border border-emerald-500/45 shadow-[0_0_50px_rgba(16,185,129,0.18)] p-5 sm:p-7 my-auto space-y-5">
        {/* Top Bar: Sponsor Badge + Top-Right Countdown ("⏳ 4s...") / Prominent "✖" Close Button */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-1.5 text-[11px] font-mono font-extrabold tracking-wider text-amber-300 uppercase">
            📢 ANONS SPONSOR (WESLEY MUSIC)
          </span>

          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fèmen / Soti nan anons lan"
              className="inline-flex items-center justify-center gap-1.5 min-h-[42px] min-w-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-zinc-950 transition-all cursor-pointer shadow-[0_0_16px_rgba(16,185,129,0.4)] whitespace-nowrap"
            >
              <span className="text-base leading-none" aria-hidden="true">
                ✖
              </span>
              <span>Fèmen / Soti</span>
            </button>
          ) : (
            <span
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-[#0B0C10] px-3 py-1.5 text-xs font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap"
            >
              <span>⏳ {displaySeconds}s...</span>
            </span>
          )}
        </div>

        {/* Smooth 4.5s progress bar */}
        <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Optional Custom Adsterra/Monetag Script Frame if pasted in Admin */}
        {modalCreativeHtml && (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0B0C10]">
            <SandboxedAdFrame
              htmlSnippet={modalCreativeHtml}
              title="Anons Sponsor Live"
              className="w-full h-[120px]"
            />
          </div>
        )}

        {/* Rich Clickable Interactive Sponsor Banner Card (Entire Card Opens HilltopAds DirectLink) */}
        <a
          href={safeSmartLink}
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-2xl border border-emerald-500/45 bg-gradient-to-br from-emerald-500/15 via-[#0B0C10] to-amber-500/15 hover:border-emerald-400 p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
              <Volume2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 mb-1">
                OFRI ESPESYAL SPONSOR • KLIKE LA
              </p>
              <h2
                id="interstitial-ad-heading"
                className="font-display text-lg sm:text-xl font-extrabold text-white leading-snug group-hover:text-emerald-200 transition-colors"
              >
                {DEFAULT_PROMO_HEADLINE}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {DEFAULT_PROMO_SUBTEXT} Sipòte Wesley Music pou tout folder .ZIP yo rete aktif!
              </p>
            </div>
          </div>

          <div className="mt-5">
            <span className="w-full inline-flex items-center justify-center gap-2 min-h-[50px] px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-amber-400 group-hover:brightness-110 text-zinc-950 font-display font-extrabold text-sm sm:text-base shadow-[0_0_24px_rgba(16,185,129,0.45)] transition-all">
              <Flame className="h-5 w-5 shrink-0" />
              <span>🔥 OUVRI OFRI SPONSOR LA KOUNYE A</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </span>
          </div>
        </a>

        {/* Bottom 4.5-Second Countdown / Prominent Unlockable Close & Exit Button */}
        <div className="pt-1">
          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-display font-extrabold text-sm transition-colors cursor-pointer shadow-lg"
            >
              <span>✖ Fèmen / Soti</span>
            </button>
          ) : (
            <div
              aria-live="polite"
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-[#0B0C10] border border-zinc-800 text-amber-300 font-mono font-bold text-sm tabular-nums cursor-wait"
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>⏳ {displaySeconds}s...</span>
            </div>
          )}
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            Kliyan ki deja gen Kle VIP pa janm wè anons sa a.
          </p>
        </div>
      </div>
    </div>
  );
};
