import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rest/ui", "@rest/types", "@rest/sync"],
};

// Serwist genera public/sw.js desde app/sw.ts en build (docs/05-diseno-pwa.md).
export default withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
