import { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Theme appearance="light" accentColor="blue">
      <div style={{ backgroundColor: "#F6F8FA", minHeight: "100vh" }}>
        {children}
      </div>
    </Theme>
  );
}
