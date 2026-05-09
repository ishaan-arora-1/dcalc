import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Supabase OAuth redirects the browser back here with a `code` query param.
 * We exchange it for a session, then upsert a Profile row mirroring the
 * Supabase user (so Prisma-managed tables can foreign-key to it).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/account";

  if (!code) {
    return NextResponse.redirect(new URL("/account?error=missing_code", url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/account?error=${encodeURIComponent(error.message)}`, url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const meta = (user.user_metadata ?? {}) as {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      picture?: string;
    };
    await prisma.profile.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? "",
        name: meta.full_name ?? meta.name ?? null,
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      },
      update: {
        email: user.email ?? "",
        name: meta.full_name ?? meta.name ?? undefined,
        avatarUrl: meta.avatar_url ?? meta.picture ?? undefined,
      },
    });
  }

  return NextResponse.redirect(new URL(next, url));
}
