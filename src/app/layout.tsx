import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { NotificationPrompt } from "@/components/notification-prompt";
import type { Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next";
import { MaintenanceBanner } from '@/components/maintenance-banner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: "Kobara Team" }],
  creator: "Kobara",
  publisher: "Kobara",
  category: "financial technology",
  alternates: {
    canonical: siteConfig.url,
    languages: {
      fr: siteConfig.url,
      en: `${siteConfig.url}/?lang=en`,
      ht: `${siteConfig.url}/?lang=ht`,
    },
  },
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "fr_HT",
    alternateLocale: ["en_US", "ht_HT"],
    url: siteConfig.url,
    title: siteConfig.title,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Kobara - passerelle de paiement MonCash et NatCash en Haiti",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    creator: "@kobara",
    images: [siteConfig.ogImage],
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let lang = "fr";
  try {
    const cookieStore = await cookies();
    const langCookie = cookieStore.get("kbr_lang")?.value;
    if (langCookie === "fr" || langCookie === "en") {
      lang = langCookie;
    }
  } catch {
    lang = "fr";
  }

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jakarta.variable} antialiased`}
    >
      <head>
        {/* Google Analytics */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-LEP7B1MMKK" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LEP7B1MMKK');
          `}
        </Script>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <style>{`
          .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered: ', registration.scope);
                  }, function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-[#020B14] font-body-base text-body-base text-on-surface min-h-screen flex flex-col">
        <LanguageProvider>
          <MaintenanceBanner />
          <div style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }} className="flex-1 flex flex-col">
            {children}
          </div>
          <Toaster position="top-right" richColors />
          <PwaInstallPrompt />
          <NotificationPrompt />
        </LanguageProvider>
        <Analytics />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            background-color: #020B14 !important;
          }
        `}} />
      </body>
    </html>
  );
}
