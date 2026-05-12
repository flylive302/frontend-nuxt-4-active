// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  include: [
    "/*"
  ],
  exclude: [
    "/sw.js",
    "/workbox-*",
    "/_fonts/*",
    "/_nuxt/*",
    "/_scripts/*",
    "/_headers",
    "/_redirects",
    "/coin-policy",
    "/countries.json",
    "/favicon.ico",
    "/forgot-password",
    "/log-in",
    "/manifest.webmanifest",
    "/privacy-policy",
    "/robots.txt",
    "/sign-up",
    "/sw-asset-handler.js",
    "/terms-of-service",
    "/welcome",
    "/.well-known/assetlinks.json",
    "/forgot-password/_payload.json",
    "/images/auth-deco.png",
    "/log-in/_payload.json",
    "/logos/favicon.png",
    "/logos/flylive-logo-wide.png",
    "/logos/icon.png",
    "/logos/logo-full.png",
    "/logos/logo-full.svg",
    "/logos/logo-text.png",
    "/pwa-assets/maskable-icon.png",
    "/sign-up/_payload.json",
    "/pwa-assets/android/launchericon-192x192.png",
    "/pwa-assets/android/launchericon-512x512.png",
    "/pwa-assets/android/launchericon-96x96.png",
    "/pwa-assets/ios/16.png",
    "/pwa-assets/ios/180.png",
    "/pwa-assets/ios/32.png",
    "/pwa-assets/ios/64.png",
    "/pwa-assets/screenshots/720x1280.webp"
  ]
};

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "/home/xha/Flylive/frontend-nuxt-4-active/.wrangler/tmp/pages-UXij47/bundledWorker-0.6341260052224607.mjs";
import { isRoutingRuleMatch } from "/home/xha/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-dev-util.ts";
export * from "/home/xha/Flylive/frontend-nuxt-4-active/.wrangler/tmp/pages-UXij47/bundledWorker-0.6341260052224607.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_dev_pipeline_default as default
};
//# sourceMappingURL=1mfp21z63iv.js.map
