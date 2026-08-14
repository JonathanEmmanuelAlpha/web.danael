import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { locales, defaultLocale, type Locale } from "./constants";

export { locales, defaultLocale };
export type { Locale };

/**
 * next-intl request config — locale resolution WITHOUT URL routing.
 *
 * Resolution order:
 * 1. `NEXT_LOCALE` cookie (set by the language switcher)
 * 2. `Accept-Language` header
 * 3. `defaultLocale` (fr)
 *
 * This avoids URL prefix collisions with Clerk-protected routes.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined;

  let locale: Locale = defaultLocale;
  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  }

  const messages = (await import(`../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;

  return {
    locale,
    messages,
    timeZone: "Africa/Douala",
    now: new Date(),
  };
});
