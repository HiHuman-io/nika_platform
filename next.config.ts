import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow Excel/PDF uploads through the import server action (default is 1MB).
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
