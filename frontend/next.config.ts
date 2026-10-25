import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The versioned bridge contract is shared from the repository root.
  turbopack: { root: path.join(__dirname, "..") },
  env: {
    NEXT_PUBLIC_VOICE_JOURNEY_ENABLED:
      process.env.NEXT_PUBLIC_VOICE_JOURNEY_ENABLED ?? "true",
    NEXT_PUBLIC_HARMONIC_LAB_ENABLED:
      process.env.NEXT_PUBLIC_HARMONIC_LAB_ENABLED ?? "true",
    VOICE_AI_ENABLED: process.env.VOICE_AI_ENABLED ?? "false",
  },
};

export default nextConfig;
