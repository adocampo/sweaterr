import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blazarr - Forum Downloader",
  description: "Integración con foros de descarga directa para Sonarr/Radarr/Lidarr. Automatiza la búsqueda y descarga de contenido desde foros.",
  keywords: ["Blazarr", "Forum Downloader", "Sonarr", "Radarr", "Lidarr", "JDownloader", "Direct Download", "Forums"],
  authors: [{ name: "Blazarr Team" }],
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "Blazarr - Forum Downloader",
    description: "Integración con foros de descarga directa para Sonarr/Radarr/Lidarr",
    siteName: "Blazarr",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blazarr - Forum Downloader",
    description: "Integración con foros de descarga directa para Sonarr/Radarr/Lidarr",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
