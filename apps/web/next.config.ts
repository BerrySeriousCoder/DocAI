import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: { browser: "" },
    },
  },
  serverExternalPackages: ["child_process", "@ocular/pdf"],
};

export default nextConfig;
