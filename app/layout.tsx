import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

export const metadata: Metadata = {
  title: "TrainXcel | Enterprise LMS",
  description: "A robust Learning & Training Management System",
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                } catch(e) {}
              })()
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-white font-sans dark:bg-[#0a0a0a]">
        <ThemeProvider>
          <AuthProvider>
            <Toaster position="top-center" />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
