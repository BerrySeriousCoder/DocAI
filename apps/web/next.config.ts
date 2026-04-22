import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: { browser: "" },
    },
  },
  serverExternalPackages: ["child_process", "@docai/pdf"],
};

export default nextConfig;
