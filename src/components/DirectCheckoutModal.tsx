import React, { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Smartphone,
  QrCode,
} from 'lucide-react';
import {
  FolderPlan,
  VipKeyRecord,
  validateVipKeyCode,
} from '../data/musicPacks';
import {
  getCountryByCode,
  getFormattedPlanPrice,
} from '../data/countries';
import {
  approvePaymentOrder,
  createPendingPaymentOrder,
  getPaymentOrderById,
  getUsdtAmountForPlan,
  isValidTronTxHash,
  NATCASH_MERCHANT_NUMBER,
  ORDERS_UPDATED_EVENT,
  PaymentOrder,
  saveActiveCheckoutOrderId,
  USDT_TRC20_WALLET_ADDRESS,
  verifyTronUsdtTransaction,
} from '../data/paymentOrders';

interface DirectCheckoutModalProps {
  isOpen: boolean;
  plan: FolderPlan | null;
  selectedCountryCode: string;
  initialOrderId?: string | null;
  onClose: () => void;
  onUnlockWithKey: (record: VipKeyRecord) => void;
}

export const DirectCheckoutModal: React.FC<DirectCheckoutModalProps> = ({
  isOpen,
  plan,
  selectedCountryCode,
  initialOrderId,
  onClose,
  onUnlockWithKey,
}) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [txIdInput, setTxIdInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'natcash' | 'usdt' | 'key' | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isVerifyingTron, setIsVerifyingTron] = useState(false);
  const [tronStatusNote, setTronStatusNote] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<PaymentOrder | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const isHaiti = selectedCountryCode.trim().toUpperCase() === 'HT';
  const country = getCountryByCode(selectedCountryCode);

  // Generate QR code for USDT TRC20 Trust Wallet address
  useEffect(() => {
    if (!isOpen || isHaiti) return;
    let cancelled = false;
    QRCode.toDataURL(USDT_TRC20_WALLET_ADDRESS, {
      width: 220,
      margin: 2,
      color: {
        dark: '#090A0D',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isHaiti]);

  // Reset form or load existing order when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setUnlockError(null);
    setTronStatusNote(null);

    if (initialOrderId) {
      const existing = getPaymentOrderById(initialOrderId);
      setCurrentOrder(existing);
    } else {
      setCurrentOrder(null);
      setPhoneInput('');
      setTxIdInput('');
    }
  }, [isOpen, initialOrderId, plan?.id, selectedCountryCode]);

  // Live listen for Admin VIP 1-click approval ("✔ Valide & Voye Kle VIP") across tabs & same window
  const refreshCurrentOrder = useCallback(() => {
    setCurrentOrder((prev) => {
      if (!prev) return prev;
      const fresh = getPaymentOrderById(prev.id);
      return fresh ?? prev;
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !currentOrder || currentOrder.status !== 'pending') return;

    const handleSync = () => refreshCurrentOrder();
    window.addEventListener('storage', handleSync);
    window.addEventListener(ORDERS_UPDATED_EVENT, handleSync);
    const poll = window.setInterval(handleSync, 1200);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleSync);
      window.clearInterval(poll);
    };
  }, [isOpen, currentOrder, refreshCurrentOrder]);

  if (!isOpen || (!plan && !currentOrder)) return null;

  const activePlanId = currentOrder?.planId ?? plan!.id;
  const activePlanTitle = currentOrder?.planTitle ?? plan!.shortLabel;
  const activePlanBadge = plan?.badge;
  const activePlanSubtitle =
    plan?.subtitle ??
    (currentOrder && currentOrder.folders >= 999
      ? "♾️ Telechajman a L'Infini ak tout folder .ZIP yo"
      : `${((currentOrder?.folders ?? 10) * 100).toLocaleString('en-US')} Mizik .ZIP an Lòd`);

  const haitiPriceLabel = getFormattedPlanPrice(activePlanId, 'HT');
  const displayPriceLabel = getFormattedPlanPrice(activePlanId, selectedCountryCode);
  const usdtAmount = currentOrder?.usdtAmount ?? getUsdtAmountForPlan(activePlanId);

  const handleCopy = async (text: string, field: 'natcash' | 'usdt' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((curr) => (curr === field ? null : curr));
    }, 2400);
  };

  const handleNatcashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setFormError(null);

    const res = createPendingPaymentOrder({
      method: 'natcash',
      plan,
      amountLabel: haitiPriceLabel,
      countryCode: country.code,
      countryName: country.name,
      buyerPhone: phoneInput,
      transactionId: txIdInput,
    });

    if (!res.success || !res.order) {
      setFormError(res.error ?? 'Tanpri verifye enfòmasyon Natcash ou yo.');
      return;
    }

    setCurrentOrder(res.order);
  };

  const handleUsdtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setFormError(null);
    setTronStatusNote(null);

    const created = createPendingPaymentOrder({
      method: 'usdt_trc20',
      plan,
      amountLabel: `${usdtAmount} USDT (TRC20)`,
      usdtAmount,
      countryCode: country.code,
      countryName: country.name,
      transactionId: txIdInput,
    });

    if (!created.success || !created.order) {
      setFormError(created.error ?? 'Tanpri antre Transaction ID / Hash (TxID) ou a.');
      return;
    }

    const order = created.order;
    if (order.status === 'approved' && order.issuedVipKey) {
      setCurrentOrder(order);
      return;
    }

    if (isValidTronTxHash(order.transactionId)) {
      setIsVerifyingTron(true);
      const verification = await verifyTronUsdtTransaction(
        order.transactionId,
        usdtAmount
      );
      setIsVerifyingTron(false);

      if (verification.confirmed) {
        const approved = approvePaymentOrder(order.id, 'trongrid');
        if (approved.success && approved.order) {
          setCurrentOrder(approved.order);
          return;
        }
      } else if (verification.hardMismatch) {
        setFormError(verification.reason);
        setCurrentOrder(order);
        return;
      } else {
        setTronStatusNote(
          'Tranzaksyon an anrejistre! Si li fèk pase sou rezo TRON an, Admin VIP ap valide l nan yon ti moman epi Kle VIP ou a ap parèt dirèkteman isit la.'
        );
      }
    } else {
      setTronStatusNote(
        'Kòd tranzaksyon an anrejistre nan sistèm nan! Kle VIP ou a ap parèt dirèkteman sou ekran sa a kou l valide.'
      );
    }

    setCurrentOrder(order);
  };

  const handleRecheckTron = async () => {
    if (!currentOrder || currentOrder.method !== 'usdt_trc20') return;
    setIsVerifyingTron(true);
    setTronStatusNote(null);
    const verification = await verifyTronUsdtTransaction(
      currentOrder.transactionId,
      currentOrder.usdtAmount ?? usdtAmount
    );
    setIsVerifyingTron(false);

    if (verification.confirmed) {
      const approved = approvePaymentOrder(currentOrder.id, 'trongrid');
      if (approved.success && approved.order) {
        setCurrentOrder(approved.order);
        return;
      }
    }
    refreshCurrentOrder();
    setTronStatusNote(
      'N ap tann konfimasyon rezo TRON / validasyon Admin VIP — ekran sa a ap mete ajou otomatikman.'
    );
  };

  const handleUnlockScreenKey = () => {
    if (!currentOrder?.issuedVipKey) return;
    const validation = validateVipKeyCode(currentOrder.issuedVipKey);
    if (validation.status !== 'valid' || !validation.record) {
      setUnlockError(validation.error ?? 'Kòd la pa valid oswa li deja itilize.');
      return;
    }
    saveActiveCheckoutOrderId(null);
    onUnlockWithKey(validation.record);
    onClose();
  };

  const handleStartOver = () => {
    saveActiveCheckoutOrderId(null);
    setCurrentOrder(null);
    setFormError(null);
    setTronStatusNote(null);
    setUnlockError(null);
  };

  const renderApprovedKeyView = (order: PaymentOrder) => (
    <div className="space-y-5 pt-2">
      <div className="rounded-2xl border border-emerald-400/60 bg-gradient-to-b from-emerald-500/20 to-[#0B0C10] p-5 text-center space-y-3 shadow-[0_0_32px_rgba(16,185,129,0.22)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-zinc-950">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-300">
            {order.verifiedBy === 'trongrid'
              ? '⚡ Konfime Otomatikman sou TRON (TRC20)'
              : '✔ Valide pa Sistèm VIP Wesley Music'}
          </p>
          <h3 className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-white">
            🎉 MEN KLE VIP OU A!
          </h3>
          <p className="mt-1 text-xs text-zinc-300">
            Plan: <strong className="text-white">{order.planTitle}</strong> ·{' '}
            {order.folders >= 999
              ? "♾️ Aksè Ilimite a L'Infini"
              : `${order.folders} Folder .ZIP`}
          </p>
        </div>

        <div className="rounded-xl bg-[#090A0D] border border-emerald-500/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Kòd Sekrè VIP Ou (Yon Sèl Fwa)
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-300 select-all">
              {order.issuedVipKey}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleCopy(order.issuedVipKey || '', 'key')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-bold text-white cursor-pointer shrink-0"
          >
            {copiedField === 'key' ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">Kopye!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-zinc-300" />
                <span>📋 Kopye Kle a</span>
              </>
            )}
          </button>
        </div>

        {unlockError && (
          <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/40 rounded-lg px-3 py-2">
            {unlockError}
          </p>
        )}

        <button
          type="button"
          onClick={handleUnlockScreenKey}
          className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-extrabold text-sm sm:text-base px-5 py-3.5 shadow-[0_0_24px_rgba(16,185,129,0.4)] transition-colors cursor-pointer"
        >
          <KeyRound className="h-5 w-5 shrink-0" />
          <span>🔓 DEBLOKE TOUT FOLDER .ZIP YO KOUNYE A</span>
        </button>
      </div>
    </div>
  );

  const renderPendingOrderView = (order: PaymentOrder) => (
    <div className="space-y-4 pt-2">
      <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-500/10 to-[#0B0C10] p-5 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 border border-amber-400/50 text-amber-300">
          <Clock className="h-6 w-6 animate-pulse" />
        </div>
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-amber-300 font-bold">
            ⏳ KÒMAND #{order.id} ANREJISTRE
          </p>
          <h3 className="mt-1 font-display text-lg sm:text-xl font-bold text-white">
            Ap Tann Validasyon Peman an...
          </h3>
          <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
            Pa fèmen ekran sa a — kou peman w lan valide,{' '}
            <strong className="text-emerald-300">Kle VIP ou a ap parèt dirèkteman isit la!</strong>
          </p>
        </div>

        <div className="rounded-xl bg-[#090A0D] border border-zinc-800 p-3.5 text-left text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">Plan:</span>
            <span className="font-bold text-white">{order.planTitle}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">Montan:</span>
            <span className="font-mono font-bold text-emerald-300">{order.amountLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">Metòd:</span>
            <span className="font-semibold text-zinc-200">
              {order.method === 'natcash' ? '🇭🇹 Natcash (+509 56568810)' : '🌐 USDT (TRC20)'}
            </span>
          </div>
          {order.buyerPhone && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-400">Telefòn:</span>
              <span className="font-mono text-zinc-200">{order.buyerPhone}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">TxID:</span>
            <span className="font-mono text-amber-200 truncate max-w-[210px]">
              {order.transactionId}
            </span>
          </div>
        </div>

        {tronStatusNote && (
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {tronStatusNote}
          </p>
        )}

        {order.method === 'usdt_trc20' && isValidTronTxHash(order.transactionId) && (
          <button
            type="button"
            disabled={isVerifyingTron}
            onClick={() => void handleRecheckTron()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 px-4 py-2.5 text-xs font-bold text-emerald-300 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isVerifyingTron ? 'animate-spin' : ''}`} />
            <span>
              {isVerifyingTron ? 'Ap tcheke TRON...' : '🔄 Verifye Sou Blockchain TRON Kounye a'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleStartOver}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
        >
          Modifye Kòd Tranzaksyon oswa Voye yon Lòt Peman
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="direct-checkout-heading"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#13151B] border border-emerald-500/40 shadow-2xl p-5 sm:p-7 my-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fèmen fenèt peman an"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Selected Plan Summary Header */}
        <div className="pr-10 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold mb-1">
            <span>{country.flag}</span>
            <span>{country.name}</span>
            <span>·</span>
            <span>{isHaiti ? 'NATCASH DIRÈK' : 'USDT (TRC20) INSTANT'}</span>
          </div>
          <h2
            id="direct-checkout-heading"
            className="font-display text-lg sm:text-xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-2"
          >
            <span>{activePlanTitle}</span>
            {activePlanBadge && (
              <span className="rounded bg-emerald-500/15 border border-emerald-400/40 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                {activePlanBadge}
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">{activePlanSubtitle}</p>
        </div>

        {currentOrder?.status === 'approved' && currentOrder.issuedVipKey ? (
          renderApprovedKeyView(currentOrder)
        ) : currentOrder?.status === 'pending' ? (
          renderPendingOrderView(currentOrder)
        ) : currentOrder?.status === 'rejected' ? (
          <div className="space-y-4 pt-4 text-center">
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-4 text-xs text-rose-200 space-y-2">
              <AlertCircle className="h-6 w-6 text-rose-400 mx-auto" />
              <p className="font-bold text-sm text-rose-200">
                Peman #{currentOrder.transactionId} sa a pa t ka valide.
              </p>
              <p>Verifye kòd tranzaksyon an oswa montan an epi eseye soumèt ankò.</p>
            </div>
            <button
              type="button"
              onClick={handleStartOver}
              className="w-full min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold text-sm cursor-pointer"
            >
              Eseye Ankò
            </button>
          </div>
        ) : isHaiti ? (
          /* 1. HAITI NATCASH DIRECT PAYMENT MODAL */
          <form onSubmit={handleNatcashSubmit} className="pt-4 space-y-4">
            <div className="rounded-xl bg-[#0B0C10] border border-emerald-500/35 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-400">Montan pou Peye:</span>
                <span className="font-mono text-base sm:text-lg font-extrabold text-emerald-300">
                  {haitiPriceLabel}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Voye peman Natcash la sou nimewo sa a:</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-[#13151B] border border-zinc-700 p-3">
                  <span className="font-mono text-lg sm:text-xl font-black tracking-wide text-white select-all">
                    {NATCASH_MERCHANT_NUMBER}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(NATCASH_MERCHANT_NUMBER, 'natcash')}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/45 hover:bg-emerald-500/25 text-xs font-bold text-emerald-300 cursor-pointer shrink-0"
                  >
                    {copiedField === 'natcash' ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>✔ Nimewo Kopye!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>📋 Kopye Nimewo Natcash</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="natcash-buyer-phone"
                  className="block text-xs font-semibold text-zinc-200 mb-1.5"
                >
                  Nimewo Telefòn Ou
                </label>
                <input
                  id="natcash-buyer-phone"
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Ex: +509 3XXX-XXXX"
                  className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-mono text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="natcash-tx-id"
                  className="block text-xs font-semibold text-zinc-200 mb-1.5"
                >
                  Kòd Tranzaksyon (ID) Natcash la
                </label>
                <input
                  id="natcash-tx-id"
                  type="text"
                  required
                  value={txIdInput}
                  onChange={(e) => {
                    setTxIdInput(e.target.value.toUpperCase());
                    if (formError) setFormError(null);
                  }}
                  placeholder="Ex: NC94827105 (mete ID ki nan SMS Natcash la)"
                  className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-sm font-mono text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-rose-500/15 border border-rose-500/40 px-3 py-2.5 text-xs text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 hover:brightness-110 text-zinc-950 font-display font-extrabold text-xs sm:text-sm px-4 py-3.5 shadow-[0_0_24px_rgba(16,185,129,0.38)] transition-all cursor-pointer"
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span>⚡ KONFIME PEMAN &amp; RESEVWA KLE VIP</span>
            </button>

            <div className="flex items-center justify-between pt-1 text-xs text-zinc-400">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 hover:text-zinc-200 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Chwazi yon lòt plan</span>
              </button>
              <span className="inline-flex items-center gap-1 text-emerald-400/90">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Kle VIP parèt sou ekran an</span>
              </span>
            </div>
          </form>
        ) : (
          /* 2. INTERNATIONAL USDT (TRC20) INSTANT CRYPTO CHECKOUT MODAL */
          <form onSubmit={(e) => void handleUsdtSubmit(e)} className="pt-4 space-y-4">
            <div className="rounded-xl bg-[#0B0C10] border border-emerald-500/35 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[11px] font-semibold text-zinc-400">
                    Montan Egzak pou Voye ({displayPriceLabel}):
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-300">
                    {usdtAmount} USDT
                  </span>
                </div>
                <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-300">
                  Network: TRON / TRC20
                </span>
              </div>

              {/* Scannable QR Code + Trust Wallet Address */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t border-zinc-800/80">
                <div className="shrink-0 rounded-xl bg-white p-2 shadow-md">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code USDT TRC20"
                      className="h-28 w-28 sm:h-32 sm:w-32 block"
                    />
                  ) : (
                    <div className="h-28 w-28 sm:h-32 sm:w-32 flex items-center justify-center bg-zinc-100 text-zinc-800">
                      <QrCode className="h-10 w-10" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 w-full space-y-2 text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-zinc-300">
                    Adrès USDT (TRC20) Trust Wallet:
                  </p>
                  <div className="rounded-lg bg-[#13151B] border border-zinc-700 px-3 py-2 font-mono text-xs text-emerald-200 break-all select-all">
                    {USDT_TRC20_WALLET_ADDRESS}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(USDT_TRC20_WALLET_ADDRESS, 'usdt')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/45 hover:bg-emerald-500/25 text-xs font-bold text-emerald-300 cursor-pointer"
                  >
                    {copiedField === 'usdt' ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>✔ Adrès USDT Kopye!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>📋 Kopye Adrès USDT (TRC20)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="usdt-tx-hash-input"
                className="block text-xs font-semibold text-zinc-200 mb-1.5"
              >
                Transaction ID / Hash (TxID)
              </label>
              <input
                id="usdt-tx-hash-input"
                type="text"
                required
                value={txIdInput}
                onChange={(e) => {
                  setTxIdInput(e.target.value.trim());
                  if (formError) setFormError(null);
                }}
                placeholder="Kole 64-karaktè TxID / Hash TRON lan isit la..."
                spellCheck={false}
                className="w-full rounded-xl bg-[#0B0C10] border border-zinc-700 px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder:font-sans placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-rose-500/15 border border-rose-500/40 px-3 py-2.5 text-xs text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingTron}
              className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 hover:brightness-110 disabled:opacity-65 text-zinc-950 font-display font-extrabold text-xs sm:text-sm px-4 py-3.5 shadow-[0_0_24px_rgba(16,185,129,0.38)] transition-all cursor-pointer"
            >
              {isVerifyingTron ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                  <span>Ap verifye sou TRON (TRC20)...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>⚡ VERIFYE PEMAN &amp; DEBLOKE KLE VIP</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs text-zinc-400">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 hover:text-zinc-200 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Chwazi yon lòt plan</span>
              </button>
              <span className="inline-flex items-center gap-1 text-emerald-400/90">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verifikasyon TronGrid + VIP</span>
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
