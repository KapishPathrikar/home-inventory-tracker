import type { NextConfig } from "next";
import withPWAPackage from "@ducanh2912/next-pwa";

const withPWA = withPWAPackage({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* Your existing nextConfig rules go here (if any) */
};

export default withPWA(nextConfig);