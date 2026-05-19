"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function NewChatButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-2"
      onClick={() => router.push("/app/chat")}
    >
      <Plus className="h-4 w-4" />
      Conversație nouă
    </Button>
  );
}
