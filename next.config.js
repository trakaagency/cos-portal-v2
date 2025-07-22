/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
      // Handle path aliases
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': __dirname,
      }
      return config
    },
  }
  
  module.exports = nextConfig