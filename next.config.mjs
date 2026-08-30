const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA;

/** @type {import('next').NextConfig} */
const nextConfig = {
  deploymentId,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'docs.kobara.app' }],
        destination: '/docs/quickstart',
        permanent: false,
      },
      {
        source: '/docs',
        has: [{ type: 'host', value: 'kobara.app' }],
        destination: 'https://docs.kobara.app/docs/quickstart',
        permanent: true,
      },
      {
        source: '/docs/:path*',
        has: [{ type: 'host', value: 'kobara.app' }],
        destination: 'https://docs.kobara.app/docs/:path*',
        permanent: true,
      },
      {
        source: '/docs',
        has: [{ type: 'host', value: 'www.kobara.app' }],
        destination: 'https://docs.kobara.app/docs/quickstart',
        permanent: true,
      },
      {
        source: '/docs/:path*',
        has: [{ type: 'host', value: 'www.kobara.app' }],
        destination: 'https://docs.kobara.app/docs/:path*',
        permanent: true,
      },
    ];
  },
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
