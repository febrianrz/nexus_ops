import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXUS_BUILD_DIR ?? '.next',
  poweredByHeader: false,
};
export default config;
