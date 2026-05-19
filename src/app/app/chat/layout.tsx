import { ReactNode } from "react";

// Chat layout — sidebar is rendered per-page (needs activeId param)
export default function ChatLayout({ children }: { children: ReactNode }) {
  return <div className="flex h-full">{children}</div>;
}
