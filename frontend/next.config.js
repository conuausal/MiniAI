/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // 必须关闭：Next 的 gzip 压缩会把代理转发的 SSE（/api/chat/completions、/api/write/article）
  // 缓冲到流结束才发出，导致浏览器端完全没有流式/打字机效果（gzip 下实测跨度 0.0s）。
  // 生产环境如需 gzip，请在 nginx 层做（并排除 text/event-stream）。
  compress: false,
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
