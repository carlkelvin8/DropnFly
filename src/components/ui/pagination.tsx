"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t px-2 py-4">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => {
            if (totalPages <= 7) return true;
            if (p === 1 || p === totalPages) return true;
            if (Math.abs(p - currentPage) <= 1) return true;
            return false;
          })
          .map((p, i, arr) => {
            const showEllipsis = i > 0 && p - arr[i - 1] > 1;
            return (
              <span key={p} className="flex items-center">
                {showEllipsis && (
                  <span className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground">
                    ...
                  </span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                    p === currentPage
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              </span>
            );
          })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
