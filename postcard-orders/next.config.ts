import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` is a CJS package with optional native bits; keep it server-external so
  // the bundler doesn't try to trace it into the client graph.
  serverExternalPackages: ["pg"],
  // This app sits inside the studio1-ecosystem monorepo. Without this, Next walks
  // up and picks a parent lockfile as the trace root, which pulls in the whole
  // home directory when bundling.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
