import { useLocalStorage } from './useLocalStorage';
import { useCallback, useMemo } from 'react';

const SETTINGS_KEY = 'retro-browser-settings';

const DEFAULT_SETTINGS = {
  corsProxyUrl: '',
  romBaseUrl: '',
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage(SETTINGS_KEY, DEFAULT_SETTINGS);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  const getProxiedUrl = useCallback((originalUrl) => {
    if (!settings.corsProxyUrl) return originalUrl;
    const proxy = settings.corsProxyUrl.replace(/\/+$/, '');
    return `${proxy}/?url=${encodeURIComponent(originalUrl)}`;
  }, [settings.corsProxyUrl]);

  const isConfigured = useMemo(() => {
    return Boolean(settings.corsProxyUrl);
  }, [settings.corsProxyUrl]);

  return {
    settings,
    updateSetting,
    getProxiedUrl,
    isConfigured,
  };
}
