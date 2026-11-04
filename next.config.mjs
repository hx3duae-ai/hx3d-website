/** @type {import('next').NextConfig} */
import path from 'node:path';
export default {
  experimental: { serverActions: { bodySizeLimit: '51mb' } },
  webpack: (c) => { c.resolve.alias['@'] = path.resolve('src'); return c; },
  poweredByHeader: false,
  headers: async () => [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  }],
};
