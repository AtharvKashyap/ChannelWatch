/**
 * Next.js configuration for the CHANNELWATCH web app (public site + future
 * authed `/review`). Kept minimal: this milestone builds only the shared
 * foundation, not those features.
 *
 * ESLint is run by the repo's root flat config (`eslint .`) via the `lint`
 * script and CI, so Next's own lint-during-build (which needs
 * `eslint-config-next`) is disabled to avoid a second, divergent config.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The repo authors relative imports with explicit `.js` extensions (the
  // NodeNext/bundler convention used across packages/*, services/api, and the
  // extension). Teach both bundlers to resolve those specifiers to the `.ts(x)`
  // source, matching how tsc and Vite already resolve them.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".mjs"],
  },
};

export default nextConfig;
