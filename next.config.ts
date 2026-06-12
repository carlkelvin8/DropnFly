import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "prisma", "@prisma/client"],
};

export default nextConfig;
