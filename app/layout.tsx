import type { Metadata } from "next";
import type { Viewport } from 'next'
import "./globals.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { getResolvedUser } from '@/lib/getResolvedUser'
import { UserProvider } from "./contexts/UserContext";
import { CookieWarning } from "./components/CookieWarning";

export const metadata: Metadata = {
  title: "GG Pickleball",
  description: "LA pickleball league",
};

export const viewport: Viewport = {
  themeColor: 'white',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const resolvedUser = await getResolvedUser()
  return (
   <html lang="en">
      <body>
        <Theme appearance="light">
          <UserProvider initialUser={resolvedUser}>
            <CookieWarning />
            <div style={{ backgroundColor: "#FFFFFF", minHeight: "100vh" }}>
              {children}
            </div>
          </UserProvider>
        </Theme>
      </body>
    </html>
  );
}
