import { GoogleTagManager } from '@next/third-parties/google'
import type { Metadata } from "next";
import type { Viewport } from 'next'
import { Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GG Pickleball",
  description: "LA pickleball league",
};

export const viewport: Viewport = {
  themeColor: 'linear-gradient(135deg,rgb(5, 21, 94), #4895FC)',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <GoogleTagManager gtmId="GTM-WBF64LKW" />
      <body className={plusJakartaSans.variable}>
        <Theme appearance="dark" accentColor="yellow">
          {children}
        </Theme>
       
      </body>
    </html>
  );
}
