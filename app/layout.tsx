import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-sans-custom",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OBAOL | Cold Email Infrastructure",
  description: "OBAOL is an execution system designed for outbound teams that operate at scale. Built as Infrastructure.",
  keywords: ["cold email", "outbound", "email infrastructure", "B2B sales", "lead generation"],
  openGraph: {
    title: "OBAOL | Cold Email Infrastructure",
    description: "Built for operators. System-level control for outbound email marketing.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/30 selection:text-primary">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <div className="fixed bottom-6 right-6 z-50">
            <ThemeToggle />
          </div>
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
