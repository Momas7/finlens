import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:3333';

const nextConfig: NextConfig = {
  // Extratos de até 5 MB passam pela Server Action de importação.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  // O navegador fala só com o Next; auth e API são encaminhadas para o Fastify.
  // Assim o cookie de sessão fica na mesma origem do frontend.
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${apiUrl}/api/auth/:path*` },
      { source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` },
    ];
  },
};

export default nextConfig;
