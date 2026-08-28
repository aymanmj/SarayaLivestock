let accessToken: string | null = null;

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
  return Boolean(desktopBridge()?.getRefreshToken);
}

export function getAccessToken() {
  return accessToken;
}

export async function storeAuthentication(access: string, refresh?: string) {
  accessToken = access;
  if (refresh && isDesktopClient()) await desktopBridge()?.setRefreshToken?.(refresh);
}

export async function getStoredRefreshToken() {
  return isDesktopClient() ? desktopBridge()?.getRefreshToken?.() : undefined;
}

export async function clearAuthentication() {
  accessToken = null;
  if (isDesktopClient()) await desktopBridge()?.clearRefreshToken?.();
}

export function desktopClientHeaders(): Record<string, string> {
  return isDesktopClient() ? { 'X-Saraya-Client': 'desktop' } : {};
}
