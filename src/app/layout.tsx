import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ClientProviders } from "@/components/providers/ClientProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Этерия: Война Теней | Eteria: Shadow War",
  description: "Browser 3D real-time strategy game. Choose your faction and battle for dominion over Eteria!",
  keywords: ["RTS", "strategy", "war", "fantasy", "browser game", "real-time strategy"],
  authors: [{ name: "Eteria Games" }],
  icons: {
    icon: "/assets/icons/icon-512.png",
    apple: "/assets/icons/icon-512.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Этерия: Война Теней",
    description: "Browser 3D real-time strategy game",
    type: "website",
    images: ["/assets/icons/icon-512.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Этерия: Война Теней",
    description: "Browser 3D real-time strategy game",
    images: ["/assets/icons/icon-512.png"],
  },
  other: {
    // Generic platform hints - can be overridden by specific platform manifests
    "platform:orientation": "landscape",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3B82F6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Platform SDKs are loaded dynamically by the platform adapter layer */}
        {/* Do NOT hardcode specific SDK scripts here - this layout is platform-agnostic */}
        
        {/* PWA theme color for mobile browsers */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Этерия" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-hidden`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        <Toaster />
      </body>
    </html>
  );
}
