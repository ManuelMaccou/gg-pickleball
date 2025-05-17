import "../globals.css";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Theme appearance="dark" accentColor="yellow">
      <div style={{ background: 'linear-gradient(135deg,rgb(4, 19, 86),rgb(1, 107, 245))' }}>
        {children}
      </div>
    </Theme>
  );
}
