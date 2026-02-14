/**
 * Cloudflare Worker CORS Proxy
 *
 * Proxies requests to archive.org with CORS headers.
 * Deploy with: npx wrangler deploy worker/cors-proxy.js --name retro-browser-proxy
 */
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    if (!targetUrl.hostname.endsWith('archive.org')) {
      return new Response('Only archive.org URLs are allowed', { status: 403 });
    }

    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'RetroBrowser/1.0' },
    });

    const response = new Response(upstream.body, upstream);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    return response;
  },
};
