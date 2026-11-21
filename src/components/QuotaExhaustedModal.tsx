import React from 'react';
import { X, KeyRound } from 'lucide-react';
import { WHATSAPP_RENEWAL_URL } from '../data/musicPacks';

interface QuotaExhaustedModalProps {
  isOpen: boolean;
  exhaustedKeyCode?: string | null;
  onClose: () => void;
  onEnterNewKey: () => void;
}

export const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
  isOpen,
  exhaustedKeyCode,
  onClose,
  onEnterNewKey,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-exhausted-heading"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#13151B] border border-rose-500/40 shadow-2xl p-6 sm:p-8 my-auto text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fèmen fenèt la"
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pt-2 space-y-4">
          <h2
            id="quota-exhausted-heading"
            className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            ⏰ PLAN OU FINI!
          </h2>

          {exhaustedKeyCode && (
            <p className="text-xs font-mono text-rose-300">
              Kle: {exhaustedKeyCode} · 0 Folder .ZIP ki rete
            </p>
          )}

          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
            Ou fin telechaje tout folder .ZIP ki te nan plan ou a. Achte yon lòt kòd sou WhatsApp:
            +509 38569265 pou w telechaje plis folder!
          </p>

          <div className="pt-3 space-y-3">
            <a
              href={WHATSAPP_RENEWAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full min-h-[52px] items-center justify-center rounded-xl bg-[#25D366] hover:bg-[#20BD5A] active:bg-[#1DA851] text-zinc-950 font-display font-bold text-sm sm:text-base px-5 py-3.5 transition-colors"
            >
              📲 Achte yon lòt kòd sou WhatsApp: +509 38569265
            </a>

            <button
              type="button"
              onClick={onEnterNewKey}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm font-semibold px-4 py-2.5 transition-colors cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-emerald-400" />
              <span>Antre yon Nouvo Kle VIP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
