/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Enable React strict mode for better performance
  reactStrictMode: true,
  
  // Optimize production builds
  swcMinify: true,
  
  // Power optimization features
  poweredByHeader: false,
  
  // Webpack configuration for server-side PDF generation
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Fix for PDFKit on server-side
      config.resolve.alias = config.resolve.alias || {}
      config.resolve.alias.canvas = false
      config.resolve.alias.encoding = false
      
      // Prevent bundling of native modules
      config.externals = config.externals || []
      config.externals.push('canvas', 'bufferutil', 'utf-8-validate')
    }
    
    return config
  },
  
  // Experimental features for better performance
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    // Optimize package imports
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
  
  // Headers for caching static assets
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;

