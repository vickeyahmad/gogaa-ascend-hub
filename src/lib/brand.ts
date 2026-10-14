import logo from '@/assets/gb-logo.png.asset.json';
export const brand = { name: 'Gogaa Byte', subtitle: 'Control Center', logo: logo.url };
// Future integration only. No client requests are made in Phase 1.
export const apiConfig = { baseUrl: import.meta.env['VITE_API_BASE_URL'] || 'https://api.gogaabyte.com', connected: false } as const;
