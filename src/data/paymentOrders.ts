import {
  createVipKeyRecord,
  FolderPlan,
  FOLDER_PLANS,
  generateShortSecretCode,
  VipKeyRecord,
} from './musicPacks';

export const NATCASH_MERCHANT_NUMBER = '+509 56568810';
export const USDT_TRC20_WALLET_ADDRESS = 'TDdBs9ivYbUjXmXh3PQT85nKKEf9bsjbxQ';
export const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export const PAYMENT_ORDERS_STORAGE_KEY = 'wesley_payment_orders_v1';
export const ACTIVE_CHECKOUT_ORDER_STORAGE_KEY = 'wesley_active_checkout_order_id_v1';
export const ORDERS_UPDATED_EVENT = 'wesley-orders-updated';

export type PaymentMethod = 'natcash' | 'usdt_trc20';
export type PaymentOrderStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentOrder {
  id: string;
  method: PaymentMethod;
  status: PaymentOrderStatus;
  planId: string;
  planTitle: string;
  folders: number;
  amountLabel: string;
  usdtAmount?: number;
  countryCode: string;
  countryName: string;
  buyerPhone?: string;
  transactionId: string;
  issuedVipKey?: string;
  verifiedBy?: 'trongrid' | 'admin';
  createdAt: number;
  updatedAt: number;
}

export const USDT_AMOUNTS_BY_PLAN: Record<string, number> = {
  '10-folder': 10,
  '21-folder': 20,
  '36-folder': 30,
  '55-folder': 40,
  'unlimited-vip': 60,
};

export function getUsdtAmountForPlan(planId: string): number {
  return USDT_AMOUNTS_BY_PLAN[planId] ?? 20;
}

function notifyOrdersUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  } catch {
    // ignore event errors
  }
}

export function loadPaymentOrders(): PaymentOrder[] {
  try {
    const raw = window.localStorage.getItem(PAYMENT_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePaymentOrders(orders: PaymentOrder[]): void {
  try {
    window.localStorage.setItem(PAYMENT_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    notifyOrdersUpdated();
  } catch {
    // ignore storage errors cleanly
  }
}

export function getPaymentOrderById(orderId: string | null | undefined): PaymentOrder | null {
  if (!orderId) return null;
  return loadPaymentOrders().find((o) => o.id === orderId) ?? null;
}

export function loadActiveCheckoutOrderId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_CHECKOUT_ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveCheckoutOrderId(orderId: string | null): void {
  try {
    if (orderId) {
      window.localStorage.setItem(ACTIVE_CHECKOUT_ORDER_STORAGE_KEY, orderId);
    } else {
      window.localStorage.removeItem(ACTIVE_CHECKOUT_ORDER_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export interface CreateOrderInput {
  method: PaymentMethod;
  plan: FolderPlan;
  amountLabel: string;
  usdtAmount?: number;
  countryCode: string;
  countryName: string;
  buyerPhone?: string;
  transactionId: string;
}

export function createPendingPaymentOrder(input: CreateOrderInput): {
  success: boolean;
  order?: PaymentOrder;
  error?: string;
} {
  const cleanTx = input.transactionId.trim();
  if (cleanTx.length < 4) {
    return {
      success: false,
      error:
        input.method === 'natcash'
          ? 'Tanpri antre Kòd Tranzaksyon (ID) Natcash valid ou a.'
          : 'Tanpri antre Transaction ID / Hash (TxID) TRON ou a.',
    };
  }

  if (input.method === 'natcash') {
    const digits = (input.buyerPhone || '').replace(/\D+/g, '');
    if (digits.length < 8) {
      return {
        success: false,
        error: 'Tanpri antre yon nimewo telefòn valid (minimum 8 chif).',
      };
    }
  }

  const existing = loadPaymentOrders();
  const normalizedTx = cleanTx.toUpperCase();
  const duplicate = existing.find(
    (o) =>
      o.status !== 'rejected' &&
      o.method === input.method &&
      o.transactionId.trim().toUpperCase() === normalizedTx
  );

  if (duplicate) {
    return {
      success: true,
      order: duplicate,
    };
  }

  const planObj =
    FOLDER_PLANS.find((p) => p.id === input.plan.id) ?? input.plan;

  const newOrder: PaymentOrder = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`,
    method: input.method,
    status: 'pending',
    planId: planObj.id,
    planTitle: planObj.shortLabel,
    folders: planObj.folders,
    amountLabel: input.amountLabel,
    usdtAmount: input.usdtAmount,
    countryCode: input.countryCode,
    countryName: input.countryName,
    buyerPhone: input.buyerPhone?.trim() || undefined,
    transactionId: cleanTx,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  savePaymentOrders([newOrder, ...existing]);
  saveActiveCheckoutOrderId(newOrder.id);
  return { success: true, order: newOrder };
}

export function approvePaymentOrder(
  orderId: string,
  verifiedBy: 'trongrid' | 'admin' = 'admin'
): { success: boolean; order?: PaymentOrder; vipRecord?: VipKeyRecord; error?: string } {
  const orders = loadPaymentOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    return { success: false, error: 'Kòmand lan pa jwenn.' };
  }

  const target = orders[idx];
  if (target.status === 'approved' && target.issuedVipKey) {
    return { success: true, order: target };
  }

  const noteLabel =
    target.method === 'natcash'
      ? `Natcash (${target.buyerPhone || ''}) · ID: ${target.transactionId}`
      : `USDT TRC20 (${target.usdtAmount ?? ''} USDT) · Tx: ${target.transactionId.slice(0, 12)}...`;

  let createdRecord: VipKeyRecord | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateCode = generateShortSecretCode('W#');
    const created = createVipKeyRecord(target.folders, candidateCode, noteLabel);
    if (created.success && created.record) {
      createdRecord = created.record;
      break;
    }
  }

  if (!createdRecord) {
    return { success: false, error: 'Pa kapab jenere Kle VIP la. Eseye ankò.' };
  }

  const updatedOrder: PaymentOrder = {
    ...target,
    status: 'approved',
    issuedVipKey: createdRecord.code,
    verifiedBy,
    updatedAt: Date.now(),
  };

  orders[idx] = updatedOrder;
  savePaymentOrders(orders);

  return { success: true, order: updatedOrder, vipRecord: createdRecord };
}

export function rejectPaymentOrder(orderId: string): void {
  const orders = loadPaymentOrders();
  const updated = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: 'rejected' as const,
          updatedAt: Date.now(),
        }
      : o
  );
  savePaymentOrders(updated);
}

export function deletePaymentOrder(orderId: string): void {
  const orders = loadPaymentOrders().filter((o) => o.id !== orderId);
  savePaymentOrders(orders);
}

export interface TronVerificationResult {
  confirmed: boolean;
  hardMismatch?: boolean;
  reason: string;
}

export function isValidTronTxHash(rawTxId: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(rawTxId.trim());
}

/**
 * Queries real-time TRON blockchain APIs (TronGrid / TronScan) to verify if a TxHash
 * sent at least `expectedUsdtAmount` TRC20 USDT to the owner's Trust Wallet address.
 */
export async function verifyTronUsdtTransaction(
  rawTxId: string,
  expectedUsdtAmount: number
): Promise<TronVerificationResult> {
  const txId = rawTxId.trim();
  if (!isValidTronTxHash(txId)) {
    return {
      confirmed: false,
      reason: 'pending_manual',
    };
  }

  const targetAddrLower = USDT_TRC20_WALLET_ADDRESS.toLowerCase();
  const contractLower = USDT_TRC20_CONTRACT.toLowerCase();

  // 1. Try TronGrid v1 events endpoint first
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.trongrid.io/v1/transactions/${encodeURIComponent(txId)}/events`,
      { signal: controller.signal }
    );
    window.clearTimeout(timeoutId);

    if (res.ok) {
      const json = (await res.json()) as {
        success?: boolean;
        data?: Array<{
          event_name?: string;
          contract_address?: string;
          result?: Record<string, string>;
        }>;
      };

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        let foundAnyTrc20ToOwner = false;
        for (const ev of json.data) {
          const evContract = (ev.contract_address || '').toLowerCase();
          const toAddr = (ev.result?.to || '').toLowerCase();
          const valRaw = Number(ev.result?.value || '0');
          const usdtPaid = valRaw / 1_000_000;

          if (ev.event_name === 'Transfer' && toAddr === targetAddrLower) {
            if (evContract === contractLower || usdtPaid > 0) {
              foundAnyTrc20ToOwner = true;
              if (usdtPaid >= expectedUsdtAmount - 0.01) {
                return { confirmed: true, reason: 'trongrid_verified' };
              }
            }
          }
        }
        if (foundAnyTrc20ToOwner) {
          return {
            confirmed: false,
            hardMismatch: true,
            reason: `Montan USDT yo voye a pi piti pase ${expectedUsdtAmount} USDT.`,
          };
        }
      }
    }
  } catch {
    // Fallback to TronScan or manual Admin queue cleanly
  }

  // 2. Fallback check via TronScan public transaction-info API
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(txId)}`,
      { signal: controller.signal }
    );
    window.clearTimeout(timeoutId);

    if (res.ok) {
      const info = (await res.json()) as {
        confirmed?: boolean;
        contractRet?: string;
        trc20TransferInfo?: Array<{
          contract_address?: string;
          to_address?: string;
          amount_str?: string;
          decimals?: number;
        }>;
      };

      if (
        info.confirmed &&
        info.contractRet === 'SUCCESS' &&
        Array.isArray(info.trc20TransferInfo)
      ) {
        for (const transfer of info.trc20TransferInfo) {
          const toAddr = (transfer.to_address || '').toLowerCase();
          const cAddr = (transfer.contract_address || '').toLowerCase();
          const decimals = typeof transfer.decimals === 'number' ? transfer.decimals : 6;
          const usdtPaid = Number(transfer.amount_str || '0') / 10 ** decimals;

          if (cAddr === contractLower && toAddr === targetAddrLower) {
            if (usdtPaid >= expectedUsdtAmount - 0.01) {
              return { confirmed: true, reason: 'tronscan_verified' };
            }
            return {
              confirmed: false,
              hardMismatch: true,
              reason: `Montan USDT yo voye a (${usdtPaid} USDT) pi piti pase ${expectedUsdtAmount} USDT.`,
            };
          }
        }
      }
    }
  } catch {
    // Network / CORS fallback -> queue cleanly in Admin VIP
  }

  return {
    confirmed: false,
    reason: 'pending_manual',
  };
}
