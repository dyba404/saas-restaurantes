import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@rest/ui", "@rest/types", "@rest/db", "@rest/printer"],
  // Postgres embebido (pglite) debe correr fuera del bundle de webpack.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
