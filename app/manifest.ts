import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'いきたいお店', short_name: 'いきたいお店',
    start_url: '/', scope: '/', display: 'standalone',
    lang: 'ja', background_color: '#f4f7f9', theme_color: '#f4f7f9',
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
