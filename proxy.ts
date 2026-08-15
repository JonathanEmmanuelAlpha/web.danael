import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCurrentDbUserByClerkId } from "./lib/clerk";
import { getUserDashboardRoadByRole } from "./lib/utils";

// Types d'onboarding (à partager avec la base de données)
export const ONBOARDING_STATUS = [
  "not_started",
  "role_selected",
  "profile_completed",
  "completed",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUS)[number];

// Routes publiques (accessibles sans authentification)
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/verify-account",
  "/forgot-password",
  "/reset-password",
  "/sso-callback",
  "/pricing",
  "/how-it-works",
  "/schools",
  "/testimonials",
  "/contact",
  "/faq",
  "/legal",
  "/api/webhooks",
  "/api/health",
  "/api/uploadthing",
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.json",
  "/manifest.webmanifest",
];

// Routes d'authentification (pages de connexion, etc.) – sans `/onboarding`
const AUTH_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/verify-account",
  "/forgot-password",
  "/reset-password",
];

// Utilitaires
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/") && !pathname.includes("/api/uploadthing");
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|pdf)$/.test(
      pathname,
    )
  );
}

function isOnboardingRoute(pathname: string): boolean {
  return pathname.startsWith("/onboarding/");
}

/**
 * Détermine la redirection d'onboarding nécessaire en fonction du statut.
 * Retourne l'URL de redirection ou `null` si aucune redirection n'est requise.
 */
function getOnboardingRedirect(
  pathname: string,
  status: OnboardingStatus | null,
  role?: string | null,
): string | null {
  if (status === "completed") return null;

  if (!status || status === "not_started") {
    if (pathname !== "/onboarding/role") {
      return "/onboarding/role";
    }
    return null;
  }

  if (status === "role_selected") {
    if (!pathname.startsWith("/onboarding/profile")) {
      const target = role ? `?target=${role}` : "";
      return `/onboarding/profile${target}`;
    }
    return null;
  }

  if (status === "profile_completed") {
    if (!role) {
      // Rôle manquant → recommencer le choix du rôle
      return "/onboarding/role";
    }
    const expected = `/onboarding/${role}`;
    if (!pathname.startsWith(expected)) {
      return expected;
    }
    return null;
  }

  return null;
}

export default clerkMiddleware(async (auth, req) => {
  if (isStaticAsset(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  const pathname = req.nextUrl.pathname;
  const isPublic = isPublicRoute(pathname);
  const isAuth = isAuthRoute(pathname);
  const isApi = isApiRoute(pathname);
  const isOnboarding = isOnboardingRoute(pathname);

  // 1. Utilisateur non authentifié
  if (!userId) {
    if (isPublic) {
      return NextResponse.next();
    }
    if (isApi) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        },
        { status: 401 },
      );
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // 2. Authentifié sur une page d'auth (sign-in, etc.) → dashboard
  if (userId && isAuth && !pathname.startsWith("/sso-callback")) {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  // 3. Routes protégées (non publiques, non API)
  if (userId && !isPublic && !isApi) {
    // Récupération de l'utilisateur en base
    let dbUser = null;
    try {
      dbUser = await getCurrentDbUserByClerkId(userId);
    } catch (err) {
      console.error("Error fetching db user:", err);
    }

    const status: OnboardingStatus | null = dbUser?.onboardingStatus ?? null;
    const role = dbUser?.role ?? null;

    // Si c'est une route d'onboarding
    if (isOnboarding) {
      // Si l'onboarding est déjà terminé, rediriger vers le dashboard
      if (status === "completed") {
        return NextResponse.redirect(
          new URL(getUserDashboardRoadByRole(role!), req.url),
        );
      }
      const redirectUrl = getOnboardingRedirect(
        pathname,
        status,
        role === "school_admin" ? "school" : role,
      );
      if (redirectUrl) {
        return NextResponse.redirect(new URL(redirectUrl, req.url));
      }
      return NextResponse.next();
    }

    // Route non‑onboarding : exiger que l'onboarding soit terminé
    if (status !== "completed") {
      const redirectUrl = getOnboardingRedirect(
        "/onboarding/role",
        status,
        role,
      );
      if (redirectUrl) {
        return NextResponse.redirect(new URL(redirectUrl, req.url));
      }
      // Fallback
      return NextResponse.redirect(new URL("/onboarding/role", req.url));
    }

    return NextResponse.next();
  }

  // 4. Autres cas (public, API, etc.) → laisser passer
  return NextResponse.next();
});

// Configuration du matcher (identique)
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|pdf)).*)",
    "/(api|trpc)(.*)",
  ],
};
