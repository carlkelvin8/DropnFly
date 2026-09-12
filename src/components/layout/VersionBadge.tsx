"use client";

import { GitCommitHorizontal } from "lucide-react";
import { APP_BUILD, APP_BUILD_SHORT } from "@/lib/version";

export function VersionBadge() {
  return (
    <div
      className="mb-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground"
      title={`Build: ${APP_BUILD}`}
    >
      <GitCommitHorizontal className="h-3 w-3" />
      <span>{APP_BUILD_SHORT}</span>
    </div>
  );
}