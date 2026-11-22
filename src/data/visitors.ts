import {
  CountryCode,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import { getCountryByCode } from './countries';
import { SUPABASE_ANON_KEY, SUPABASE_URL, SupabaseVisitorRow, supabase } from '../lib/supabase';

export const VISITOR_PROFILE_STORAGE_KEY = 'wesley_visitor_profile_v1';
export const VISITORS_CACHE_STORAGE_KEY = 'wesley_visitors_cache_v1';
export const VISITORS_UPDATED_EVENT = 'wesley-visitors-updated';
export const VISITOR_ONLINE_WINDOW_MS = 65_000;

export interface VisitorProfile {
  id: string;
  fullName: string;
  country: string;
  countryCode: string;
  phoneNumber: string;
  isOnline: boolean;
  lastSeenAt: number;
  createdAt: number;
}

const FALLBACK_DIAL_CODES: Record<string, string> = {
  XK: '383',
  VA: '39',
};

const SEQUENTIAL_JUNK_PHONE_PATTERNS = [
  '01234567',
  '12345678',
  '23456789',
  '98765432',
  '87654321',
  '76543210',
  '00000000',
  '11111111',
  '22222222',
  '33333333',
  '44444444',
  '55555555',
  '66666666',
  '77777777',
  '88888888',
  '99999999',
];

export function getDialCodeForCountry(countryCode: string): string {
  const upper = (countryCode || 'HT').trim().toUpperCase();
  try {
    return getCountryCallingCode(upper as CountryCode);
  } catch {
    return FALLBACK_DIAL_CODES[upper] ?? '1';
  }
}

export function getPhonePlaceholderForCountry(countryCode: string): string {
  const upper = (countryCode || 'HT').trim().toUpperCase();
  if (upper === 'HT') return '3856 9265';
  if (upper === 'US' || upper === 'CA') return '305 555 0192';
  if (upper === 'BR') return '11 98765 4321';
  if (upper === 'FR') return '6 12 34 56 78';
  if (upper === 'DO') return '809 555 0142';
  if (upper === 'CI') return '07 12 34 56 78';
  if (upper === 'NG') return '803 123 4567';
  if (upper === 'CD') return '812 345 678';
  if (upper === 'SN') return '77 123 45 67';

  try {
    const example = getExampleNumber(upper as CountryCode, examples);
    if (example) {
      return example.formatNational().replace(/^0/, '');
    }
  } catch {
    // fallback below
  }
  return 'XXX XXX XXXX';
}

export interface PhoneValidationResult {
  valid: boolean;
  formattedInternational?: string;
  formattedE164?: string;
  dialCode: string;
  error?: string;
}

export function validateCountryPhoneNumber(
  rawPhone: string,
  countryCode: string
): PhoneValidationResult {
  const country = getCountryByCode(countryCode);
  const dialCode = getDialCodeForCountry(country.code);
  const compatError = `⚠️ Nimewo telefòn sa a pa konpatib ak peyi ${country.name} (+${dialCode})! Tanpri antre yon vrè nimewo telefòn ki valid pou peyi sa a.`;

  const trimmed = (rawPhone || '').trim();
  if (!trimmed) {
    return { valid: false, dialCode, error: compatError };
  }

  // Strip letters or weird symbols immediately
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, dialCode, error: compatError };
  }

  const normalizedChars = trimmed.replace(/[\s().-]+/g, '');
  const digitsOnly = normalizedChars.replace(/\D+/g, '');
  if (digitsOnly.length < 6) {
    return { valid: false, dialCode, error: compatError };
  }

  let parsed = parsePhoneNumberFromString(normalizedChars, country.code as CountryCode);

  // If user typed full dial code without '+' (e.g. 50938569265 for HT), try parsing with '+'
  if (
    (!parsed || !parsed.isValid()) &&
    !normalizedChars.startsWith('+') &&
    digitsOnly.startsWith(dialCode) &&
    digitsOnly.length >= dialCode.length + 7
  ) {
    parsed = parsePhoneNumberFromString(`+${digitsOnly}`, country.code as CountryCode);
  }

  if (!parsed || !parsed.isValid()) {
    return { valid: false, dialCode, error: compatError };
  }

  // Must match selected country's calling code (blocks +1 inside France, +509 inside USA, etc.)
  if (parsed.countryCallingCode !== dialCode) {
    return { valid: false, dialCode, error: compatError };
  }

  // If libphonenumber identified an exact ISO country (outside shared +1/+7 plans), ensure it matches
  if (dialCode !== '1' && dialCode !== '7' && parsed.country && parsed.country !== country.code) {
    return { valid: false, dialCode, error: compatError };
  }

  const national = parsed.nationalNumber || '';

  // Strict explicit rules requested for key regions
  if (country.code === 'HT' && !/^[2345]\d{7}$/.test(national)) {
    return { valid: false, dialCode, error: compatError };
  }
  if ((country.code === 'US' || country.code === 'CA') && !/^\d{10}$/.test(national)) {
    return { valid: false, dialCode, error: compatError };
  }
  if (country.code === 'BR' && !/^\d{10,11}$/.test(national)) {
    return { valid: false, dialCode, error: compatError };
  }
  if (country.code === 'FR' && !/^\d{9}$/.test(national)) {
    return { valid: false, dialCode, error: compatError };
  }

  // Block repeated or sequential dummy numbers (11111111, 31111111, 12345678, etc.)
  if (
    /^(\d)\1{5,}$/.test(national) ||
    /(\d)\1{5,}/.test(national) ||
    SEQUENTIAL_JUNK_PHONE_PATTERNS.some((seq) => national.includes(seq))
  ) {
    return { valid: false, dialCode, error: compatError };
  }

  return {
    valid: true,
    dialCode,
    formattedE164: parsed.number,
    formattedInternational: parsed.formatInternational(),
  };
}

function generateVisitorId(): string {
  return `VIS-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export function loadSavedVisitorProfile(): VisitorProfile | null {
  try {
    const raw = window.localStorage.getItem(VISITOR_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VisitorProfile>;
    if (!parsed.id || !parsed.fullName || !parsed.countryCode || !parsed.phoneNumber) {
      return null;
    }
    return {
      id: parsed.id,
      fullName: parsed.fullName,
      country: parsed.country || getCountryByCode(parsed.countryCode).name,
      countryCode: parsed.countryCode.toUpperCase(),
      phoneNumber: parsed.phoneNumber,
      isOnline: parsed.isOnline ?? true,
      lastSeenAt: Number(parsed.lastSeenAt) || Date.now(),
      createdAt: Number(parsed.createdAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveVisitorProfileLocally(profile: VisitorProfile): void {
  try {
    window.localStorage.setItem(VISITOR_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    const cache = loadVisitorsCache().filter((v) => v.id !== profile.id);
    window.localStorage.setItem(
      VISITORS_CACHE_STORAGE_KEY,
      JSON.stringify([profile, ...cache])
    );
    window.dispatchEvent(new CustomEvent(VISITORS_UPDATED_EVENT));
  } catch {
    // ignore storage errors
  }
}

export function loadVisitorsCache(): VisitorProfile[] {
  try {
    const raw = window.localStorage.getItem(VISITORS_CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VisitorProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapSupabaseVisitorRow(row: SupabaseVisitorRow): VisitorProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    country: row.country,
    countryCode: row.country_code,
    phoneNumber: row.phone_number,
    isOnline: Boolean(row.is_online),
    lastSeenAt: Number(row.last_seen_at) || Date.now(),
    createdAt: Number(row.created_at) || Date.now(),
  };
}

export function isVisitorCurrentlyOnline(visitor: VisitorProfile, nowMs = Date.now()): boolean {
  return visitor.isOnline && nowMs - visitor.lastSeenAt < VISITOR_ONLINE_WINDOW_MS;
}

export async function registerOrUpdateVisitorRemote(input: {
  fullName: string;
  countryCode: string;
  rawPhone: string;
}): Promise<{ success: boolean; visitor?: VisitorProfile; error?: string }> {
  const cleanName = input.fullName.trim().replace(/\s+/g, ' ');
  if (cleanName.length < 3) {
    return {
      success: false,
      error: '⚠️ Tanpri antre Non Konplè ou (omwen 3 karaktè).',
    };
  }

  const country = getCountryByCode(input.countryCode);
  const phoneCheck = validateCountryPhoneNumber(input.rawPhone, country.code);
  if (!phoneCheck.valid || !phoneCheck.formattedInternational) {
    return {
      success: false,
      error: phoneCheck.error,
    };
  }

  const existing = loadSavedVisitorProfile();
  const now = Date.now();
  const visitor: VisitorProfile = {
    id: existing?.id || generateVisitorId(),
    fullName: cleanName,
    country: country.name,
    countryCode: country.code,
    phoneNumber: phoneCheck.formattedInternational,
    isOnline: true,
    lastSeenAt: now,
    createdAt: existing?.createdAt || now,
  };

  saveVisitorProfileLocally(visitor);

  try {
    const { data, error } = await supabase
      .from('visitors')
      .upsert(
        {
          id: visitor.id,
          full_name: visitor.fullName,
          country: visitor.country,
          country_code: visitor.countryCode,
          phone_number: visitor.phoneNumber,
          is_online: true,
          last_seen_at: now,
          created_at: visitor.createdAt,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (!error && data) {
      const synced = mapSupabaseVisitorRow(data as SupabaseVisitorRow);
      saveVisitorProfileLocally(synced);
      return { success: true, visitor: synced };
    }
  } catch {
    // Local profile saved cleanly even if offline
  }

  return { success: true, visitor };
}

export async function sendVisitorHeartbeatRemote(
  profile: VisitorProfile,
  overrideCountryCode?: string
): Promise<void> {
  const now = Date.now();
  const country = overrideCountryCode
    ? getCountryByCode(overrideCountryCode)
    : getCountryByCode(profile.countryCode);

  const updated: VisitorProfile = {
    ...profile,
    country: country.name,
    countryCode: country.code,
    isOnline: true,
    lastSeenAt: now,
  };
  saveVisitorProfileLocally(updated);

  try {
    await supabase.from('visitors').upsert(
      {
        id: updated.id,
        full_name: updated.fullName,
        country: updated.country,
        country_code: updated.countryCode,
        phone_number: updated.phoneNumber,
        is_online: true,
        last_seen_at: now,
        created_at: updated.createdAt,
      },
      { onConflict: 'id' }
    );
  } catch {
    // ignore transient heartbeat failure
  }
}

export function markVisitorOfflineKeepalive(visitorId: string): void {
  if (!visitorId) return;
  const now = Date.now();
  const saved = loadSavedVisitorProfile();
  if (saved && saved.id === visitorId) {
    saveVisitorProfileLocally({ ...saved, isOnline: false, lastSeenAt: now });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/visitors?id=eq.${encodeURIComponent(visitorId)}`;
    void fetch(url, {
      method: 'PATCH',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        is_online: false,
        last_seen_at: now,
      }),
    });
  } catch {
    // ignore unload failure
  }
}

export async function fetchAllVisitorsRemote(): Promise<VisitorProfile[]> {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .order('last_seen_at', { ascending: false });

    if (error || !data) {
      return loadVisitorsCache();
    }

    const mapped = (data as SupabaseVisitorRow[]).map(mapSupabaseVisitorRow);
    try {
      window.localStorage.setItem(VISITORS_CACHE_STORAGE_KEY, JSON.stringify(mapped));
    } catch {
      // ignore storage errors
    }
    return mapped;
  } catch {
    return loadVisitorsCache();
  }
}

export async function deleteVisitorRecordRemote(visitorId: string): Promise<void> {
  try {
    const remaining = loadVisitorsCache().filter((v) => v.id !== visitorId);
    window.localStorage.setItem(VISITORS_CACHE_STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // ignore storage errors
  }

  try {
    await supabase.from('visitors').delete().eq('id', visitorId);
  } catch {
    // ignore network failure
  }
}

export function subscribeVisitorsRealtime(onChange: () => void): () => void {
  const channel = supabase
    .channel(`visitors_realtime_${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'visitors' },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
