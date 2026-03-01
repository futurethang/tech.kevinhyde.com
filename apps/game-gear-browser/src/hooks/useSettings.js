import { useLocalStorage } from './useLocalStorage';
import { useCallback, useMemo } from 'react';

const SETTINGS_KEY = 'retro-browser-settings';

export const DEFAULT_CORS_PROXY_URL = 'https://retro-browser-proxy.k-p-hyde.workers.dev';

const DEFAULT_SETTINGS = {
  corsProxyUrl: '',
  romBaseUrl: '',
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage(SETTINGS_KEY, DEFAULT_SETTINGS);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  // Use the user's custom proxy if set, otherwise fall back to the built-in default
  const effectiveProxyUrl = useMemo(() => {
    return settings.corsProxyUrl || DEFAULT_CORS_PROXY_URL;
  }, [settings.corsProxyUrl]);

  const getProxiedUrl = useCallback((originalUrl) => {
    const proxy = effectiveProxyUrl.replace(/\/+$/, '');
    return `${proxy}/?url=${encodeURIComponent(originalUrl)}`;
  }, [effectiveProxyUrl]);

  const isConfigured = true;

  const isUsingCustomProxy = Boolean(settings.corsProxyUrl);

  return {
    settings,
    updateSetting,
    getProxiedUrl,
    isConfigured,
    isUsingCustomProxy,
    effectiveProxyUrl,
  };
}
