const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA;

/** @type {import('next').NextConfig} */
const nextConfig = {
  deploymentId,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          }
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'api.kobara.app',
          },
        ],
        destination: '/api/:path*',
      },
      {
        source: '/api/:path*',
        has: [
          {
            type: 'host',
            value: 'dashboard.kobara.app',
          },
        ],
        destination: '/api/:path*',
      },
      {
        source: '/kyc/mobile/:path*',
        has: [
          {
            type: 'host',
            value: 'dashboard.kobara.app',
          },
        ],
        destination: '/kyc/mobile/:path*',
      },
      {
        source: '/pay/:path*',
        has: [
          {
            type: 'host',
            value: 'dashboard.kobara.app',
          },
        ],
        destination: '/pay/:path*',
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'dashboard.kobara.app',
          },
        ],
        destination: '/dashboard/:path*',
      },
      {
        source: '/api/:path*',
        has: [
          {
            type: 'host',
            value: 'pay.kobara.app',
          },
        ],
        destination: '/api/:path*',
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'pay.kobara.app',
          },
        ],
        destination: '/pay/:path*',
      },
    ];
  },
};

export default nextConfig;
