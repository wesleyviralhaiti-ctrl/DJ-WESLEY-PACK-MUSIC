import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Download, AlertCircle, FolderArchive, Clock, Film } from 'lucide-react';
import {
  MusicPack,
  VipKeyRecord,
  WHATSAPP_BASE_URL,
  formatZipFolderFilename,
  validateVipKeyCode,
} from '../data/musicPacks';
import { ZipFilenameText } from './ZipFilenameText';

interface WelcomeVipModalProps {
  isOpen: boolean;
  allPacks: MusicPack[];
  activeKey: VipKeyRecord | null;
  pendingPack: MusicPack | null;
  showSponsorTrigger?: boolean;
  sponsorDirectLink?: string | null;
  onTriggerSponsorAd?: () => void;
  onUnlock: (record: VipKeyRecord) => void;
  onUnlockOrDownloadPack: (pack: MusicPack) => void;
  onBrowsePacks: () => void;
}

export const WelcomeVipModal: React.FC<WelcomeVipModalProps> = ({
  isOpen,
  allPacks,
  activeKey,
  pendingPack,
  showSponsorTrigger = false,
  sponsorDirectLink = null,
  onTriggerSponsorAd,
  onUnlock,
  onUnlockOrDownloadPack,
  onBrowsePacks,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateVipKeyCode(keyInput);
    if (result.status !== 'valid' || !result.record) {
      setErrorMsg(result.error ?? '🚫 KÒD SA A DEJA SÈVI / EKSPIRE');
      return;
    }
    setErrorMsg(null);
    onUnlock(result.record);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vip-welcome-heading"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#13151B] border border-zinc-800 shadow-2xl p-6 sm:p-8 my-auto">
        <button
          type="button"
          onClick={onBrowsePacks}
          aria-label="Fèmen fenèt la"
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          <X className="h-5 w-5" />
        </button>

        {activeKey && activeKey.remainingFolders > 0 ? (
          /* Unlocked inside popup: clean .ZIP download list with zero tracklist exposure */
          <div className="space-y-5">
            <div className="pr-8">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2 tabular-nums">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  📁 Kredi Folder ki rete: {activeKey.remainingFolders} /{' '}
                  {activeKey.totalFolders} Folder
                </span>
              </div>
              <h2
                id="vip-welcome-heading"
                className="font-display text-2xl font-bold text-white tracking-tight"
              >
                Chwazi Folder .ZIP pou w Telechaje
              </h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                Kòd <span className="font-mono text-zinc-200">{activeKey.code}</span> aktif.
                Klike sou nenpòt folder pou w telechaje .ZIP la (1 Kredi Folder).
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/80 border border-zinc-800 rounded-xl bg-[#0E1015]">
              {allPacks.map((pack) => {
                const isComingSoon = Boolean(pack.isComingSoon);
                const isTarget = pendingPack?.id === pack.id;
                return (
                  <div
                    key={pack.id}
                    className={`flex items-center justify-between gap-3 p-3.5 ${
                      isTarget && !isComingSoon ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isComingSoon ? (
                        <Clock className="h-5 w-5 text-amber-400 shrink-0 animate-[spin_6s_linear_infinite]" />
                      ) : (
                        <FolderArchive className="h-5 w-5 text-emerald-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 leading-snug font-mono">
                          <ZipFilenameText filename={formatZipFolderFilename(pack)} />
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            isComingSoon ? 'text-amber-300 font-medium' : 'text-zinc-400'
                          }`}
                        >
                          {isComingSoon
                            ? `${pack.genre} · ⏳ AN PREPARASYON`
                            : `${pack.genre} · ${pack.trackCount} Mizik an Lòd • .ZIP`}
                        </p>
                      </div>
                    </div>
                    {isComingSoon ? (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-amber-500/30 text-amber-300/80 text-xs font-bold whitespace-nowrap cursor-not-allowed shrink-0 opacity-85"
                      >
                        <span>⏳ POKO DISPONIB</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUnlockOrDownloadPack(pack)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>⬇️ TELECHAJE .ZIP</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onBrowsePacks}
                className="text-sm font-medium text-zinc-300 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
              >
                Wè tout folder .ZIP yo sou sit la
              </button>
            </div>
          </div>
        ) : (
          /* Combined Gate Card: Top VIP Key Input + Bottom Divider + WhatsApp Purchase + Browse Link */
          <div>
            <div className="pr-8">
              <h2
                id="vip-welcome-heading"
                className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                🔑 OU GENTAN GEN YON KLE VIP ?
              </h2>
              {pendingPack ? (
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
                  Antre Kle VIP ou a pou w telechaje{' '}
                  <span className="font-semibold font-mono text-white">
                    {formatZipFolderFilename(pendingPack)}
                  </span>
                  .
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Si w te deja achte kòd ou a, antre li anba a pou w debloke folder .ZIP ou yo epi
                  telechaje yo imedyatman.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
              <div>
                <label htmlFor="vip-key-input" className="sr-only">
                  Antre Kle VIP ou
                </label>
                <input
                  id="vip-key-input"
                  type="text"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value.toUpperCase());
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Antre Kle VIP ou isit la... ex: W#84K2"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-4 py-3.5 text-base font-mono text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 transition-colors"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-rose-500/15 border border-rose-500/40 px-3.5 py-2.5 text-xs font-semibold text-rose-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-display font-bold text-sm sm:text-base tracking-tight px-5 py-3.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                🔓 DEBLOKE AKSÈ VIP KOUNYE A
              </button>
            </form>

            {/* Bottom Divider */}
            <div className="relative my-7 flex items-center justify-center">
              <div className="w-full border-t border-zinc-800" />
              <span className="absolute bg-[#13151B] px-3 text-xs font-semibold tracking-wider text-zinc-400 whitespace-nowrap">
                — OUBYEN —
              </span>
            </div>

            {/* Bottom WhatsApp Purchase Section */}
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Ou poko gen Kle VIP? Ekri Admin nan sou WhatsApp pou w achte yon plan (1 Folder,
                3 Folder, 5 Folder, oswa 10 Folder)!
              </p>

              <div
                className={`grid gap-2.5 ${
                  showSponsorTrigger ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                <a
                  href={WHATSAPP_BASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full min-h-[52px] items-center justify-center rounded-xl bg-[#25D366] hover:bg-[#20BD5A] active:bg-[#1DA851] text-zinc-950 font-display font-bold text-xs sm:text-sm text-center leading-tight px-3.5 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
                >
                  📲 Mande Kle VIP sou WhatsApp (+509 38569265)
                </a>

                {showSponsorTrigger &&
                  (sponsorDirectLink ? (
                    <a
                      href={sponsorDirectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm text-center leading-tight px-3.5 py-3 transition-colors"
                    >
                      <Film className="h-4 w-4 shrink-0" />
                      <span>🎬 Koute / Gade Sponsor Pou Sipòte Sit la</span>
                    </a>
                  ) : (
                    onTriggerSponsorAd && (
                      <button
                        type="button"
                        onClick={onTriggerSponsorAd}
                        className="flex w-full min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-display font-bold text-xs sm:text-sm text-center leading-tight px-3.5 py-3 transition-colors cursor-pointer"
                      >
                        <Film className="h-4 w-4 shrink-0" />
                        <span>🎬 Koute / Gade Sponsor Pou Sipòte Sit la</span>
                      </button>
                    )
                  ))}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={onBrowsePacks}
                  className="inline-flex items-center justify-center min-h-[40px] px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 underline underline-offset-4 transition-colors cursor-pointer"
                >
                  👀 Gade Folder .ZIP yo Anvan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
