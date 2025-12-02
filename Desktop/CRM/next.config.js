/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Enable React strict mode for better performance
  reactStrictMode: true,
  
  // Optimize production builds
  swcMinify: true,
  
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
  // Temporarily disabled optimizeCss as it may cause static file serving issues
  // experimental: {
  //   optimizeCss: true,
  // },
  
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
    ]
  },
};

module.exports = nextConfig;

