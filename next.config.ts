import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // Our custom production server bypasses `next start` (Next.js 15 Docker streaming bug)
    // and does not implement the on-the-fly image optimizer route (`/_next/image`).
    // Disabling optimization makes `next/image` serve public assets directly.
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable Next.js hot reload, handled by nodemon
  reactStrictMode: false,
  eslint: {
    // Ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  logging: {
    fetches: {
      fullUrl: false,
      hmrRefreshes: false,
    },
  },
  // Ignore logs, databases, and temporary files to prevent constant reloads
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/logs/**',
          '**/*.log',
          '**/*.db',
          '**/*.db-journal',
          '**/dev.out',
          '**/tsconfig.tsbuildinfo',
          '**/prisma/dev.db',
          '**/prisma/dev.db-journal',
          '**/prisma/*.db',
          '**/prisma/*.db-journal',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
