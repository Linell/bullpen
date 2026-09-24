import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.pnpm/@duckdb+node-bindings-*/node_modules/@duckdb/node-bindings-*/libduckdb.*"],
  },
};

export default nextConfig;
