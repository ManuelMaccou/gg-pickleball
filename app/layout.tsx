import type { Metadata } from "next";
import type { Viewport } from 'next'
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { getResolvedUser } from '@/lib/getResolvedUser'
import { UserProvider } from "./contexts/UserContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GG Pickleball",
  description: "LA pickleball league",
};

export const viewport: Viewport = {
  themeColor: 'black',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const resolvedUser = await getResolvedUser()
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Theme appearance="dark" accentColor="yellow">
          <UserProvider initialUser={resolvedUser}>
            <div style={{ background: 'linear-gradient(135deg,rgb(4, 19, 86),rgb(1, 107, 245))' }}>
              {children}
            </div>
          </UserProvider>
        </Theme>
      </body>
    </html>
  );
}
