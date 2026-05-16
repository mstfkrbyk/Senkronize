import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'app.senkronize.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
