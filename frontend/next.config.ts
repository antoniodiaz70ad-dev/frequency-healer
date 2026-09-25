import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VOICE_JOURNEY_ENABLED:
      process.env.NEXT_PUBLIC_VOICE_JOURNEY_ENABLED ?? "true",
    NEXT_PUBLIC_HARMONIC_LAB_ENABLED:
      process.env.NEXT_PUBLIC_HARMONIC_LAB_ENABLED ?? "true",
    VOICE_AI_ENABLED: process.env.VOICE_AI_ENABLED ?? "false",
  },
};

export default nextConfig;
