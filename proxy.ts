import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

export async function proxy(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    const role = token?.role as string | undefined;

    if (!role || !ADMIN_ROLES.has(role)) {
        if (req.nextUrl.pathname.startsWith("/api/admin")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
