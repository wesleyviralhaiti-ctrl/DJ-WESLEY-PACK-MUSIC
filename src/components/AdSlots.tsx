import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Film,
  KeyRound,
  MessageCircle,
  Sparkles,
  Volume2,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  AdSystemConfig,
  DEFAULT_PROMO_HEADLINE,
  DEFAULT_PROMO_SUBTEXT,
  buildSandboxedAdSrcDoc,
  sanitizeHttpUrl,
} from '../data/adConfig';
import { MusicPack, WHATSAPP_BASE_URL, formatZipFolderFilename } from '../data/musicPacks';
import { ZipFilenameText } from './ZipFilenameText';

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

interface SponsorAdModalProps {
  isOpen: boolean;
  adConfig: AdSystemConfig;
  targetPack: MusicPack | null;
  onClose: () => void;
  onProceedToVipKey: () => void;
}

export const SponsorAdModal: React.FC<SponsorAdModalProps> = ({
  isOpen,
  adConfig,
  targetPack,
  onClose,
  onProceedToVipKey,
}) => {
  const [watchedSponsor, setWatchedSponsor] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setWatchedSponsor(false);
      setCountdown(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          setWatchedSponsor(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const safeSmartLink = sanitizeHttpUrl(adConfig.smartLinkUrl);
  const hasCustomBanner = adConfig.bannerAdHtml.trim().length > 0;
  const hasCustomNative = adConfig.nativeAdHtml.trim().length > 0;
  const modalCreativeHtml = hasCustomNative
    ? adConfig.nativeAdHtml
    : hasCustomBanner
      ? adConfig.bannerAdHtml
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sponsor-modal-heading"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#13151B] border border-amber-500/40 shadow-2xl p-6 sm:p-7 my-auto space-y-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fèmen fenèt sponsor an"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-8">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-mono font-bold tracking-widest text-amber-300 uppercase mb-2.5">
            <span>🎬 SPONSOR / ANONS VIDMATE</span>
          </div>
          <h2
            id="sponsor-modal-heading"
            className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Sipòte Wesley Music oswa Debloke ak Kle VIP
          </h2>
          {targetPack && (
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-400">
              Folder chwazi:{' '}
              <span className="font-mono text-emerald-300 font-semibold">
                <ZipFilenameText filename={formatZipFolderFilename(targetPack)} />
              </span>
            </p>
          )}
        </div>

        {/* Embedded Sponsor Preview / Default Promo Box */}
        <div className="rounded-xl border border-zinc-800 bg-[#0B0C10] p-4 space-y-3">
          {modalCreativeHtml ? (
            <div className="overflow-hidden rounded-lg border border-zinc-800">
              <SandboxedAdFrame
                htmlSnippet={modalCreativeHtml}
                title="Anons Sponsor Popup"
                className="w-full h-[140px]"
              />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
                <Volume2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{DEFAULT_PROMO_HEADLINE}</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {DEFAULT_PROMO_SUBTEXT}
                </p>
              </div>
            </div>
          )}

          {countdown !== null && countdown > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200 text-center tabular-nums">
              ⏳ Ap li ti anons sponsor an... ({countdown}s)
            </div>
          )}

          {watchedSponsor && (
            <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/35 px-3 py-2 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Mèsi paske w gade ti anons sponsor an! Antre Kle VIP ou a pou w telechaje.</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {safeSmartLink ? (
              <a
                href={safeSmartLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWatchedSponsor(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm text-center leading-tight transition-colors"
              >
                <Film className="h-4 w-4 shrink-0" />
                <span>🎬 Koute / Gade Sponsor Pou Sipòte Sit la</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!watchedSponsor && countdown === null) {
                    setCountdown(4);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm text-center leading-tight transition-colors cursor-pointer"
              >
                <Film className="h-4 w-4 shrink-0" />
                <span>
                  {countdown !== null && countdown > 0
                    ? `🎬 Ap Gade (${countdown}s)...`
                    : watchedSponsor
                      ? '✅ Anons Gade!'
                      : '🎬 Koute / Gade Sponsor Pou Sipòte Sit la'}
                </span>
              </button>
            )}

            <a
              href={WHATSAPP_BASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-zinc-950 font-display font-extrabold text-xs sm:text-sm text-center leading-tight transition-colors"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>📲 Mande Kle VIP sou WhatsApp (+509 38569265)</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onProceedToVipKey}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-extrabold text-sm whitespace-nowrap transition-colors cursor-pointer"
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>🔑 Mwen Gen Kle VIP — Debloke San Anons</span>
          </button>
        </div>
      </div>
    </div>
  );
};
