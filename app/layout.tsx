import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Sora,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { StoreInitializer } from "@/components/providers/store-initializer";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const APP_URL = "https://danael.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Danaël — La plateforme scolaire qui révèle votre potentiel",
    template: "%s · Danaël",
  },
  description:
    "Danaël connecte élèves, enseignants, établissements et parents autour d'un suivi scolaire moderne, engageant et adapté au contexte camerounais. Inscrivez-vous gratuitement.",
  applicationName: "Danaël",
  keywords: [
    "Danaël",
    "plateforme scolaire",
    "éducation Cameroun",
    "e-learning",
    "suivi scolaire",
    "devoirs",
    "quiz",
    "bibliothèque pédagogique",
    "tutorat",
    "gamification",
  ],
  authors: [{ name: "Danaël", url: APP_URL }],
  creator: "Danaël",
  publisher: "Danaël",
  category: "Education",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: {
      fr: "/",
      en: "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    url: APP_URL,
    siteName: "Danaël",
    title: "Danaël — La plateforme scolaire qui révèle votre potentiel",
    description:
      "Suivi scolaire moderne pour élèves, enseignants, écoles et parents. Inscrivez-vous gratuitement.",
    images: [
      {
        url: "/logo.svg",
        width: 1200,
        height: 630,
        alt: "Danaël — La plateforme scolaire qui révèle votre potentiel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Danaël — La plateforme scolaire qui révèle votre potentiel",
    description:
      "Suivi scolaire moderne pour élèves, enseignants, écoles et parents.",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#93d91a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1b43" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AuthProvider>
          <StoreInitializer />
          <QueryProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem={false}
                disableTransitionOnChange
              >
                {children}
                <Toaster position="top-center" richColors closeButton />
              </ThemeProvider>
            </NextIntlClientProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
