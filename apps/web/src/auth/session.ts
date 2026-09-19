let accessToken: string | null = null;

const REFRESH_TOKEN_KEY = 'saraya.auth.refresh_token';
const ACCESS_TOKEN_KEY = 'saraya.auth.access_token';

type DesktopSessionBridge = {
  apiBaseUrl?: string;
  getRefreshToken?: () => Promise<string | null>;
  setRefreshToken?: (token: string) => Promise<boolean>;
  clearRefreshToken?: () => Promise<boolean>;
};

function desktopBridge(): DesktopSessionBridge | undefined {
  return (window as typeof window & { electronAPI?: DesktopSessionBridge }).electronAPI;
}

export function isDesktopClient() {
  return typeof window !== 'undefined' && 
    (Boolean((window as any).electronAPI) || window.location.protocol === 'file:' || Boolean(desktopBridge()?.getRefreshToken));
}

export function getAccessToken() {
  if (!accessToken) {
    try {
      accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {}
  }
  return accessToken;
}

export async function storeAuthentication(access: string, refresh?: string) {
  accessToken = access;
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
  } catch {}
  if (refresh) {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    } catch {}
    if (desktopBridge()?.setRefreshToken) {
      try {
        await desktopBridge()?.setRefreshToken?.(refresh);
      } catch {}
    }
  }
}

export async function getStoredRefreshToken(): Promise<string | undefined> {
  if (desktopBridge()?.getRefreshToken) {
    try {
      const electronToken = await desktopBridge()?.getRefreshToken?.();
      if (electronToken) return electronToken;
    } catch {}
  }
  try {
    const localToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (localToken) return localToken;
  } catch {}
  return undefined;
}

export async function clearAuthentication() {
  accessToken = null;
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem('saraya.auth.user');
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
  if (desktopBridge()?.clearRefreshToken) {
    try {
      await desktopBridge()?.clearRefreshToken?.();
    } catch {}
  }
}

export function desktopClientHeaders(): Record<string, string> {
  return isDesktopClient() ? { 'X-Saraya-Client': 'desktop' } : {};
}
