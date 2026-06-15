import { registerSW } from 'virtual:pwa-register';
import './app-shell.ts';

// Auto-update the service worker (precaches app shell; runtime-caches item reads).
registerSW({ immediate: true });
