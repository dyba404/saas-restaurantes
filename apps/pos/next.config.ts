import fs from "node:fs";
import path from "node:path";
import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rest/ui", "@rest/types", "@rest/sync", "@rest/printer"],
  // Las librerías @point-of-sale solo exponen "." bajo la condición "browser",
  // que el bundle SSR de App Router no activa. En vez de tocar conditionNames
  // (rompería la resolución de zod y otros), las alias directo a su dist ESM
  // del navegador. Son clases puras: seguras de bundlar también para SSR.
  webpack: (config) => {
    const root = [process.cwd(), path.resolve(process.cwd(), "../..")].find((dir) =>
      fs.existsSync(path.join(dir, "node_modules/@point-of-sale")),
    );
    if (root) {
      const pkg = (name: string) =>
        path.resolve(root, "node_modules/@point-of-sale", name, `dist/${name}.esm.js`);
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@point-of-sale/receipt-printer-encoder$": pkg("receipt-printer-encoder"),
        "@point-of-sale/webbluetooth-receipt-printer$": pkg("webbluetooth-receipt-printer"),
        "@point-of-sale/webusb-receipt-printer$": pkg("webusb-receipt-printer"),
        "@point-of-sale/webserial-receipt-printer$": pkg("webserial-receipt-printer"),
      };
    }
    return config;
  },
};

// Serwist genera public/sw.js desde app/sw.ts en build (docs/05-diseno-pwa.md).
export default withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
