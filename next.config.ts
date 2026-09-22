import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB ships a native binding, so load it with Node's require instead of bundling it.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
