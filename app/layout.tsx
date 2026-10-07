import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme-provider";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#040404" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "OBAOL | Cold Email Infrastructure",
    template: "%s | OBAOL"
  },
  description: "Validate leads, protect inbox reputation, control delivery, and turn replies into action with OBAOL's outbound operations platform.",
  keywords: ["cold email", "outbound", "email infrastructure", "B2B sales", "lead generation", "inbox warm-up", "domain protection", "auto-suppression"],
  metadataBase: new URL("https://emarketing.obaol.com"),
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "OBAOL Team" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "OBAOL | Cold Email Infrastructure",
    description: "Validate leads, protect inbox reputation, control delivery, and turn replies into action from one outbound operations platform.",
    url: "https://emarketing.obaol.com",
    siteName: "OBAOL",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 2160,
        height: 2160,
        alt: "OBAOL | Cold Email Infrastructure",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OBAOL | Cold Email Infrastructure",
    description: "Validate leads, protect inbox reputation, control delivery, and turn replies into action from one outbound operations platform.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/30 selection:text-primary">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster 
            position="top-right" 
            toastOptions={{
              className: 'glass-card border-border/50 text-foreground',
              style: {
                background: 'var(--card)',
                color: 'var(--card-foreground)',
                backdropFilter: 'blur(12px)',
              }
            }} 
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
