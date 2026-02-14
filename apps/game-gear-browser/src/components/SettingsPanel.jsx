import { useState } from 'react';

export function SettingsPanel({ settings, onUpdateSetting, isConfigured, onClose }) {
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'

  const handleTestConnection = async () => {
    if (!settings.corsProxyUrl) return;
    setTestStatus('testing');
    try {
      const proxy = settings.corsProxyUrl.replace(/\/+$/, '');
      const testUrl = `${proxy}/?url=${encodeURIComponent('https://archive.org/metadata/Sega_Game_Gear_TOSEC_2012_04_13')}`;
      const res = await fetch(testUrl, { method: 'GET', signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    } catch {
      setTestStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/80" onClick={onClose}>
      <div
        className="bg-gg-dark border border-gg-accent rounded-lg shadow-2xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gg-accent">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* CORS Proxy URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              CORS Proxy URL
            </label>
            <input
              type="url"
              value={settings.corsProxyUrl}
              onChange={e => onUpdateSetting('corsProxyUrl', e.target.value)}
              placeholder="https://your-worker.workers.dev"
              className="w-full bg-gg-darker border border-gg-accent rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gg-teal text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Deploy the included Cloudflare Worker and paste the URL here.
            </p>

            {/* Test Connection */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleTestConnection}
                disabled={!settings.corsProxyUrl || testStatus === 'testing'}
                className="text-sm px-3 py-1 rounded bg-gg-darker border border-gg-accent text-gray-300 hover:text-white hover:border-gg-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              {testStatus === 'success' && (
                <span className="text-sm text-green-400">Connected!</span>
              )}
              {testStatus === 'error' && (
                <span className="text-sm text-red-400">Connection failed</span>
              )}
            </div>
          </div>

          {/* ROM Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              ROM Base URL (optional)
            </label>
            <input
              type="url"
              value={settings.romBaseUrl}
              onChange={e => onUpdateSetting('romBaseUrl', e.target.value)}
              placeholder="https://archive.org/download/Sega_Game_Gear_TOSEC_2012_04_13"
              className="w-full bg-gg-darker border border-gg-accent rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gg-teal text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Override the default Internet Archive collection URL.
            </p>
          </div>

          {/* Status */}
          <div className={`rounded-lg px-4 py-3 text-sm ${isConfigured ? 'bg-green-900/20 border border-green-800 text-green-300' : 'bg-yellow-900/20 border border-yellow-800 text-yellow-300'}`}>
            {isConfigured
              ? 'CORS proxy is configured. Games are ready to play!'
              : 'Set a CORS proxy URL above to enable game playback. Browse the library without it.'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
