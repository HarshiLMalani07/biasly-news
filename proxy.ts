import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Public-first gating: article detail pages require an account, everything
 * else - the home feed, /sign-in, /sign-up - stays readable signed out.
 *
 * Action routes under /api are deliberately not protected here. AGENTS.md
 * sections 15 and 18 guard those with the `x-biasly-admin-secret` header and
 * `CRON_SECRET` respectively, so Clerk must not block machine callers.
 */
const isProtectedRoute = createRouteMatcher(["/news(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
