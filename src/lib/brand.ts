export const brand = { name: 'Gogaa Byte', subtitle: 'Control Center', logo: '/assets/brand/gb-logo.png' };
// Development: empty baseUrl defaults to same-origin dev proxy (/api) to avoid schemeful SameSite cookie drops.
// Production / Custom: VITE_API_BASE_URL sets the central backend API origin (e.g. https://api.gogaabyte.com).
export const apiConfig = {
  baseUrl: (import.meta.env['VITE_API_BASE_URL'] ?? '').replace(/\/+$/, ''),
  connected: true,
} as const;
