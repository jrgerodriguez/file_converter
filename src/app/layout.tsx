import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FileOptimizer",
  description: "Optimización de imágenes profesional, 100% local",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fafafa] dark:bg-zinc-900 transition-colors font-sans selection:bg-blue-500/30">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
           {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
