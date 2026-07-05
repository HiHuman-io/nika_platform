import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for a small production image (Docker `standalone`).
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
      // Behind the reverse proxy, server actions verify Origin == Host.
      allowedOrigins: ["app.musichub.hihuman.io"],
    },
  },
};

export default nextConfig;
