import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // 禁用 Next.js 热重载，由 nodemon 处理重编译
  reactStrictMode: false,
  eslint: {
    // 构建时忽略ESLint错误
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
