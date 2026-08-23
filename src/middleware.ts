import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "./lib/supabase";

const PROTECTED = ["/admin", "/api/admin"];
const PUBLIC = ["/admin/login"];
const CANONICAL_HOST = "videomarketingsevilla.com";
const LEGACY_REDIRECTS: Record<string, string> = {
  "/ultimos-proyectos": "/proyectos",
};

function isNavigationRequest(method: string) {
  return method === "GET" || method === "HEAD";
}

function shouldNormalizeTrailingSlash(pathname: string) {
  if (pathname === "/") return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.includes(".")) return false;

  return pathname.endsWith("/");
}

function getCanonicalRedirectUrl(request: Request) {
  if (!import.meta.env.PROD || !isNavigationRequest(request.method)) return null;

  const currentUrl = new URL(request.url);
  const targetUrl = new URL(currentUrl);
  let shouldRedirect = false;
  const normalizedPath = currentUrl.pathname.length > 1
    ? currentUrl.pathname.replace(/\/+$/, "")
    : currentUrl.pathname;

  if (targetUrl.hostname === `www.${CANONICAL_HOST}`) {
    targetUrl.hostname = CANONICAL_HOST;
    shouldRedirect = true;
  }

  if (request.headers.get("x-forwarded-proto") === "http" && targetUrl.hostname === CANONICAL_HOST) {
    targetUrl.protocol = "https:";
    shouldRedirect = true;
  }

  const legacyTarget = LEGACY_REDIRECTS[normalizedPath];
  if (legacyTarget) {
    targetUrl.pathname = legacyTarget;
    shouldRedirect = true;
  } else if (shouldNormalizeTrailingSlash(currentUrl.pathname)) {
    targetUrl.pathname = normalizedPath;
    shouldRedirect = true;
  }

  return shouldRedirect ? targetUrl : null;
}

export const onRequest = defineMiddleware(async ({ request, cookies, redirect, locals }, next) => {
  const { pathname, host } = new URL(request.url);
  const canonicalRedirectUrl = getCanonicalRedirectUrl(request);

  if (canonicalRedirectUrl) {
    return Response.redirect(canonicalRedirectUrl, 301);
  }

  if (
    import.meta.env.PROD &&
    request.method === "GET" &&
    pathname === "/" &&
    (host === "localhost:3000" || host === "127.0.0.1:3000")
  ) {
    return new Response("ok", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const isProtected = PROTECTED.some(r => pathname.startsWith(r)) && !PUBLIC.includes(pathname);

  if (!isProtected) return next();

  const isApiRequest = pathname.startsWith("/api/");

  const accessToken = cookies.get("sb-access-token")?.value;
  const refreshToken = cookies.get("sb-refresh-token")?.value;

  if (!accessToken || !refreshToken) {
    if (isApiRequest) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return redirect(`/admin/login?redirectTo=${encodeURIComponent(pathname)}`);
  }

  // Use service role for permission check to avoid RLS issues
  const supabaseAdmin = getServiceSupabase();
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user) {
    console.error("Middleware Auth Error:", error?.message || "No user found");
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });
    if (isApiRequest) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return redirect("/admin/login");
  }

  // Mapping of paths to section IDs (matching those in AdminLayout menu)
  const SECTION_MAP: Record<string, string> = {
    "/admin/proyectos": "proyectos",
    "/admin/servicios": "servicios",
    "/admin/sectores": "sectores",
    "/admin/empresas": "empresas",
    "/admin/portal": "portal",
    "/admin/contratos": "contratos",
    "/admin/mensajes": "mensajes",
    "/admin/ajustes": "ajustes",
    "/admin/seo": "seo",
    "/admin/usuarios": "usuarios",
    "/admin": "dashboard", 
    // API mappings
    "/api/admin/projects": "proyectos",
    "/api/admin/proyectos": "proyectos",
    "/api/admin/services": "servicios",
    "/api/admin/servicios": "servicios",
    "/api/admin/sectors": "sectores",
    "/api/admin/sectores": "sectores",
    "/api/admin/companies": "empresas",
    "/api/admin/faqs": "faqs",
    "/api/admin/portal": "portal",
    "/api/admin/contracts": "contratos",
    "/api/admin/messages": "mensajes",
    "/api/admin/settings": "ajustes",
    "/api/admin/templates": "ajustes",
    "/api/admin/upload": "upload",
    "/api/admin/cloudinary-sign": "upload",
    "/api/admin/awards": "ajustes",
    "/api/admin/seo": "seo",
    "/api/admin/users": "usuarios",
  };

  // Identify the target section
  const targetPath = Object.keys(SECTION_MAP)
    .sort((a, b) => b.length - a.length)
    .find(path => pathname.startsWith(path));
  
  const targetSection = targetPath ? SECTION_MAP[targetPath] : null;

  // 3. Permission Check: Verify profile and permissions
  const { data: profile, error: profileError } = await (supabaseAdmin || supabase)
    .from('profiles')
    .select('is_admin, permissions')
    .eq('id', (data.user as any).id)
    .maybeSingle();

  if (profileError || !profile) {
    if (isApiRequest) {
      return new Response(JSON.stringify({ error: "Forbidden: No profile found" }), { status: 403 });
    }
    return redirect("/admin/login?error=" + encodeURIComponent("No se encontró un perfil de administrador para tu cuenta."));
  }

  // Store profile in locals for layouts/pages
  locals.userProfile = profile;

  // Super-admin has access to everything
  if (profile.is_admin) {
    return next();
  }

  // Grant access if the section is in the user's permissions
  const userPermissions = profile.permissions || [];
  if (targetSection === "upload" && userPermissions.length > 0) {
    return next();
  }
  if (targetSection && userPermissions.includes(targetSection)) {
    return next();
  }

  // Deny access if no permission found
  if (isApiRequest) {
    return new Response(JSON.stringify({ error: "Forbidden: Missing permissions" }), { status: 403 });
  }
  return redirect("/admin/login?error=" + encodeURIComponent("No tienes permisos para acceder a esta sección."));
});
