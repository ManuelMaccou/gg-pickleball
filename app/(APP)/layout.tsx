import "../globals.css";
import type { Viewport } from 'next'
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";

export const viewport: Viewport = {
  themeColor: '#06287C',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Theme >
      <div>
        {children}
      </div>
    </Theme>
  );
}
