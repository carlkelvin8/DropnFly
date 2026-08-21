"use client";

import Link from "next/link";
import { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
}

export function MobileNav({ open, onClose, links }: MobileNavProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
        return;
      }
      if (e.key === "Tab" && open && menuRef.current) {
        const focusable = menuRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => firstLinkRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t bg-background px-4 pb-4 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          {links.map((link, i) => (
            <Link
              key={link.href}
              ref={i === 0 ? firstLinkRef : undefined}
              href={link.href}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/book"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white"
            onClick={onClose}
          >
            Book Now
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
