/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression
  compress: true,
  
  // Output configuration for Render
  // Use standalone output for production deployment
  output: 'standalone',
  
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
    
    // Optimize bundle size
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test(module) {
              return module.size() > 160000 && /node_modules[/\\]/.test(module.identifier())
            },
            name(module) {
              const hash = require('crypto').createHash('sha1')
              hash.update(module.identifier())
              return hash.digest('hex').substring(0, 8)
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name(module, chunks) {
              return require('crypto')
                .createHash('sha1')
                .update(chunks.reduce((acc, chunk) => acc + chunk.name, ''))
                .digest('hex')
                .substring(0, 8)
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      },
    }
    
    return config
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
    ]
  },
  
  // Performance optimizations
  poweredByHeader: false,
  
  // Experimental features
  experimental: {
    optimizeCss: true,
  },
  
  // Environment variables available to the client
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXTAUTH_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;
