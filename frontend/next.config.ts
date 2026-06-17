import type { NextConfig } from "next";
import withPWAPackage from "@ducanh2912/next-pwa";

const withPWA = withPWAPackage({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
});

const nextConfig: NextConfig = {
  /* Your existing nextConfig rules go here (if any) */
};

export default withPWA(nextConfig);