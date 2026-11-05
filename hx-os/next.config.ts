import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion's renderer/bundler run in a separate Node process (scripts/render.mjs),
  // but keep them out of the Next bundle in case anything imports them server-side.
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler", "@anthropic-ai/sdk"],
};

export default nextConfig;
