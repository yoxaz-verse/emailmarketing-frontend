import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme-provider";

export const viewport: Viewport = {
  themeColor: "#040404",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "OBAOL | Cold Email Infrastructure",
    template: "%s | OBAOL"
  },
  description: "OBAOL is a system-level outbound execution engine designed for scale. Features lead validation, warmup, delivery control, and bounce intelligence.",
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
    description: "Built for operators. System-level control for outbound email marketing.",
    url: "https://emarketing.obaol.com",
    siteName: "OBAOL",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OBAOL | Cold Email Infrastructure",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OBAOL | Cold Email Infrastructure",
    description: "Built for operators. System-level control for outbound email marketing.",
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
