/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '20mb' },
  },
  async rewrites() {
    // 服务端 rewrite 目标用非 NEXT_PUBLIC 的 API_BASE（不内联进浏览器 JS）
    // 客户端始终用相对路径（见 lib/api.ts），由 rewrite 转发，避免浏览器直连容器主机名
    const base = process.env.API_BASE || 'http://localhost:8000';
    return [
      { source: '/api/:path*', destination: `${base}/api/:path*` },
      { source: '/health', destination: `${base}/health` },
    ];
  },
};
module.exports = nextConfig;
