/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the Docker runtime stage can ship
  // without node_modules. Fly runs this as `node server.js`.
  output: "standalone",
  // The TLE cache file is read with readFileSync at runtime — serverless
  // output tracing must bundle it or the offline fallback silently breaks.
  outputFileTracingIncludes: {
    "/api/tle": ["./public/tle-cache.json"],
    "/api/passes": ["./public/tle-cache.json"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "celestrak.org" },
      { protocol: "https", hostname: "nasa.gov" },
      { protocol: "https", hostname: "unpkg.com" },
    ],
  },
  headers: async () => [
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
      ],
    },
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
