import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { RateLimiter, getClientKey } from "@/lib/rateLimit";

// Coarse gate for everything under /admin and /api/admin: role must be ADMIN
// or MODERATOR. This does NOT replace the per-route checkPermission/
// requirePermission calls (lib/permissions.ts) - those still decide which
// specific Feature a MODERATOR is allowed to touch. This layer only closes
// the "a new route forgot to add any check at all" gap, which has already
// slipped through twice (see ARCHITECTURE.md "Known Issues").
//
// Uses next-auth/jwt's getToken (decodes the JWT cookie directly, no DB
// call) rather than importing @/auth - auth.ts constructs a PrismaAdapter
// backed by better-sqlite3 at module scope, which is a native Node addon
// and cannot run in the Edge runtime middleware normally executes under.
const ADMIN_ROLES = new Set(["ADMIN", "MODERATOR"]);

// Basic abuse protection for the public API surface - see lib/rateLimit.ts
// for why an in-memory limiter is correct for this project's deployment.
// 120 req/min per client is generous for normal UI use (search-as-you-type,
// several widgets on one page) while still bounding scraping/abuse.
const apiRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 120 });

// Stricter limiter for the two public write endpoints behind roadmap items
// 49/97 (suggest a word / report an error) - these are cheap-content spam
// vectors (no auth required), so they get a tighter budget on top of the
// general 120/min limiter above rather than relying on it alone.
const publicWriteRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
const PUBLIC_WRITE_PATHS = new Set(["/api/reports", "/api/suggestions"]);

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // NextAuth's own endpoints must stay unthrottled and ungated - hit
    // repeatedly during normal page loads (session checks) and gate the
    // login flow itself.
    if (pathname.startsWith("/api/auth")) {
        return NextResponse.next();
    }

    const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

    if (isAdminRoute) {
        // @auth/core's getToken() defaults secureCookie to false when not
        // passed explicitly, which makes it look for the plain
        // "authjs.session-token" cookie. On an HTTPS deployment, the real
        // sign-in flow (the full Auth.js handler under /api/auth, not this
        // standalone helper) sets the "__Secure-"-prefixed cookie instead -
        // so without this, a genuinely logged-in ADMIN/MODERATOR would
        // never be found here and would always be redirected to
        // /unauthorized. Behind a reverse proxy (nginx etc.) the request
        // itself arrives over plain HTTP, so req.nextUrl.protocol alone
        // isn't reliable - x-forwarded-proto (standard nginx
        // `proxy_set_header X-Forwarded-Proto $scheme`) is checked first.
        const secureCookie = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
        const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });
        const role = token?.role as string | undefined;

        if (!role || !ADMIN_ROLES.has(role)) {
            if (pathname.startsWith("/api/admin")) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
    }

    if (pathname.startsWith("/api")) {
        const { limited, retryAfterSeconds } = apiRateLimiter.check(getClientKey(req.headers));
        if (limited) {
            return NextResponse.json(
                { error: "Too many requests" },
                { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
            );
        }

        if (req.method === "POST" && PUBLIC_WRITE_PATHS.has(pathname)) {
            const writeLimit = publicWriteRateLimiter.check(getClientKey(req.headers));
            if (writeLimit.limited) {
                return NextResponse.json(
                    { error: "Too many requests" },
                    { status: 429, headers: { "Retry-After": String(writeLimit.retryAfterSeconds) } }
                );
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/:path*"],
};
