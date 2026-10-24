/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@syapa/shared", "@syapa/db", "@syapa/ai"],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: process.env.EXTENSION_ID ? `chrome-extension://${process.env.EXTENSION_ID}` : "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-token" },
        ],
      },
    ];
  },
};

export default nextConfig;
