import React, { useState } from 'react';
import { Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'hero' | 'footer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'hero' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress completely when already running in standalone full-screen mode
  if (isInstalled) {
    return null;
  }

  // Android / Chrome native install flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'hero'
            ? 'inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-3 rounded-xl border border-emerald-500/40 bg-[#090A0D] hover:border-emerald-400 text-emerald-300 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer'
            : 'inline-flex items-center gap-1.5 hover:text-emerald-300 text-emerald-400 font-medium transition-colors cursor-pointer'
        }
      >
        <Smartphone className="h-4 w-4 shrink-0" />
        <span>Enstale sou Telefòn</span>
      </button>
    );
  }

  // iOS Safari Add to Home Screen flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'hero'
              ? 'inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-3 rounded-xl border border-emerald-500/40 bg-[#090A0D] hover:border-emerald-400 text-emerald-300 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer'
              : 'inline-flex items-center gap-1.5 hover:text-emerald-300 text-emerald-400 font-medium transition-colors cursor-pointer'
          }
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          <span>Mete sou Ekran iPhone</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-heading"
          >
            <div className="relative w-full max-w-sm rounded-2xl bg-[#090A0D] border border-emerald-500/40 p-6 shadow-2xl space-y-4">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Fèmen"
                className="absolute top-3.5 right-3.5 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 pr-8">
                <img
                  src="/apple-touch-icon.png"
                  alt="Wesley Music Icon"
                  className="h-12 w-12 rounded-xl border border-emerald-500/40 shrink-0"
                />
                <div>
                  <h3
                    id="ios-install-heading"
                    className="font-display text-base font-bold text-white"
                  >
                    Mete Wesley Music sou Ekran iPhone
                  </h3>
                  <p className="text-xs text-emerald-400">Ouvri san ba Safari (Full Screen)</p>
                </div>
              </div>

              <ol className="space-y-2.5 text-sm text-zinc-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <Share className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
                  <span>
                    1. Peze bouton <strong className="text-white">Share</strong> anba nan mitan
                    Safari a.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <PlusSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
                  <span>
                    2. Desann epi peze <strong className="text-white">Add to Home Screen</strong>{' '}
                    (Ajoute sou ekran dakèy).
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm transition-colors cursor-pointer"
              >
                Oke, Mwen Konprann
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
