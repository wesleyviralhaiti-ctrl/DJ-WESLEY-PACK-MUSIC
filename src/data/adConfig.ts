export const DEFAULT_HILLTOP_DIRECT_LINK = 'https://plump-plastic.com/uCIfdy';

export interface AdSystemConfig {
  enabled: boolean;
  enableSponsorPopup: boolean;
  bannerAdHtml: string;
  nativeAdHtml: string;
  smartLinkUrl: string;
  smartLinkClearedByAdmin?: boolean;
  updatedAt: number;
}

export const AD_CONFIG_STORAGE_KEY = 'wesley_ad_system_config_v1';

export const DEFAULT_PROMO_HEADLINE =
  '🎧 Telechaje Plis Hits Konpa & Rabòday — Klike Isit La!';

export const DEFAULT_PROMO_SUBTEXT =
  'Dekouvri nouvo miks DJ, eksklizivite Rabòday, ak pakèt mizik cho pou VirtualDJ.';

export const DEFAULT_AD_CONFIG: AdSystemConfig = {
  enabled: true,
  enableSponsorPopup: true,
  bannerAdHtml: '',
  nativeAdHtml: '',
  smartLinkUrl: DEFAULT_HILLTOP_DIRECT_LINK,
  smartLinkClearedByAdmin: false,
  updatedAt: 0,
};

export function sanitizeHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidOptionalHttpUrl(rawUrl: string): boolean {
  if (!rawUrl.trim()) return true;
  return sanitizeHttpUrl(rawUrl) !== null;
}

export function loadAdConfig(): AdSystemConfig {
  try {
    const raw = window.localStorage.getItem(AD_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AD_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AdSystemConfig>;
    const clearedByAdmin = Boolean(parsed.smartLinkClearedByAdmin);
    const parsedLink =
      typeof parsed.smartLinkUrl === 'string'
        ? sanitizeHttpUrl(parsed.smartLinkUrl) ?? ''
        : '';

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      enableSponsorPopup:
        typeof parsed.enableSponsorPopup === 'boolean' ? parsed.enableSponsorPopup : true,
      bannerAdHtml: typeof parsed.bannerAdHtml === 'string' ? parsed.bannerAdHtml : '',
      nativeAdHtml: typeof parsed.nativeAdHtml === 'string' ? parsed.nativeAdHtml : '',
      smartLinkUrl: parsedLink || (clearedByAdmin ? '' : DEFAULT_HILLTOP_DIRECT_LINK),
      smartLinkClearedByAdmin: clearedByAdmin,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return DEFAULT_AD_CONFIG;
  }
}

export function saveAdConfig(config: AdSystemConfig): AdSystemConfig {
  const safeSmartLink = config.smartLinkUrl.trim()
    ? sanitizeHttpUrl(config.smartLinkUrl) ?? ''
    : '';
  const sanitized: AdSystemConfig = {
    enabled: Boolean(config.enabled),
    enableSponsorPopup: Boolean(config.enableSponsorPopup),
    bannerAdHtml: config.bannerAdHtml,
    nativeAdHtml: config.nativeAdHtml,
    smartLinkUrl: safeSmartLink,
    smartLinkClearedByAdmin: safeSmartLink.length === 0,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(AD_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota errors cleanly
  }
  return sanitized;
}

export function resetAdConfig(): AdSystemConfig {
  const fresh: AdSystemConfig = {
    ...DEFAULT_AD_CONFIG,
    smartLinkClearedByAdmin: false,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(AD_CONFIG_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore storage errors cleanly
  }
  return fresh;
}

export function buildSandboxedAdSrcDoc(adHtmlSnippet: string): string {
  return `<!DOCTYPE html>
<html lang="ht">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0B0C10;
      color: #E4E4E7;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    img, iframe { max-width: 100%; }
  </style>
</head>
<body>
  ${adHtmlSnippet}
</body>
</html>`;
}
