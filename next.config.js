/**
 * Next.js configuration
 * TODO: Adjust as needed for images and headers. Avoid Edge runtime for server-only secrets usage.
 */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["*"]
    }
  }
};

module.exports = nextConfig;


