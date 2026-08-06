/**
 * Next.js configuration for the CHANNELWATCH web app (public site + future
 * authed `/review`). Kept minimal: this milestone builds only the shared
 * foundation, not those features.
 *
 * ESLint is run by the repo's root flat config (`eslint .`) via the `lint`
 * script and CI, so Next's own lint-during-build (which needs
 * `eslint-config-next`) is disabled to avoid a second, divergent config.
 */

/**
 * Origin of the API the browser bundle talks to (fetch in client components).
 * CSP `connect-src` must allow it, else those requests are blocked. Derived from
 * the same `NEXT_PUBLIC_API_BASE_URL` the api-client reads; falls back to the
 * local dev API. If the value is malformed we omit it rather than crash the build.
 */
function apiOrigin() {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

/**
 * A conservative Content-Security-Policy for this Next.js app. Next injects
 * inline hydration scripts and inline styles, so `script-src`/`style-src` need
 * `'unsafe-inline'`; the dev server additionally evals, so `'unsafe-eval'` is
 * added only outside production. Everything else defaults to `'self'`; framing
 * is denied (defense in depth with X-Frame-Options), and `connect-src` also
 * admits the API origin the browser bundle fetches.
 */
function contentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== "production";
  const api = apiOrigin();
  const scriptSrc = ["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : ""]
    .filter(Boolean)
    .join(" ");
  const connectSrc = ["'self'", api].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Baseline security headers applied to every route. A conservative CSP (see
  // above), plus clickjacking and MIME-sniffing protections.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
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
