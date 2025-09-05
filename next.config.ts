import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'mei88ly3gv2nfhdr.public.blob.vercel-storage.com',
      },
      {
        hostname: '*.vercel-storage.com',
        protocol: 'https',
      },
    ],
  },
};

export default nextConfig;
