/// <reference types="vite/client" />

export const isBackendProxyEnabled = (): boolean => {
  const flag = String(import.meta.env.VITE_USE_BACKEND_PROXY || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
};

export const getApiBaseUrl = (): string => {
  const raw = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  // Allow empty (same-origin) when proxy is enabled.
  return raw.replace(/\/+$/, '');
};
