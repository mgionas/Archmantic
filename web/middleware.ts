import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything requires sign-in (it's a SaaS) except the auth routes and the
// machine API routes, which do their own Bearer-token auth in the handler.
// (If Clerk protected these, the CLI's token request would get the sign-in HTML
// instead of the route — a silent push failure.)
const isPublic = createRouteMatcher([
  "/",
  "/docs",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/push",
  "/api/pull",
  "/api/process-edit",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Run on all routes except Next internals and static files…
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // …and always on API routes.
    "/(api|trpc)(.*)",
  ],
};
