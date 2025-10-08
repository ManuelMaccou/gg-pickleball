import { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Theme appearance="light" accentColor="blue">
      {children}
    </Theme>
  );
}
