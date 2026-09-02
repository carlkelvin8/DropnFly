"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2, X } from "lucide-react";

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
  /** Maximum number of suggestions shown in the dropdown. Default: 50 */
  maxVisible?: number;
}

const MAX_VISIBLE_DEFAULT = 50;

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = "Type to search...",
  disabled = false,
  loading = false,
  className,
  id,
  maxVisible = MAX_VISIBLE_DEFAULT,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return options.slice(0, maxVisible);
    return options
      .filter((opt) => opt.toLowerCase().includes(normalizedQuery))
      .slice(0, maxVisible);
  }, [options, normalizedQuery, maxVisible]);

  const totalCount = useMemo(() => {
    if (!normalizedQuery) return options.length;
    return options.filter((opt) => opt.toLowerCase().includes(normalizedQuery)).length;
  }, [options, normalizedQuery]);

  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current.has(highlightedIndex)) {
      itemRefs.current.get(highlightedIndex)?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  function handleFocus() {
    if (disabled) return;
    setOpen(true);
    setQuery(value);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (!open) setOpen(true);
  }

  function selectOption(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setQuery(value);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          selectOption(filtered[highlightedIndex]);
        } else if (query.trim()) {
          selectOption(query.trim());
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery(value);
        inputRef.current?.blur();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  function handleClear() {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  const showNoResults = open && !loading && filtered.length === 0 && normalizedQuery.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={open ? query : value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={loading ? "Loading..." : placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={cn(
            "pr-8",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <div className="absolute right-0 top-0 flex h-full items-center pr-2 pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : value && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto rounded-full p-0.5 hover:bg-muted"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={listRef}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          >
            {!loading && filtered.length === 0 && !showNoResults && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Start typing to search...
              </div>
            )}
            {showNoResults && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No results found. Press Enter to use &quot;{query.trim()}&quot;
              </div>
            )}
            {filtered.map((opt, i) => {
              const isHighlighted = i === highlightedIndex;
              const isSelected = opt === value;
              return (
                <div
                  key={opt}
                  ref={(el) => { if (el) itemRefs.current.set(i, el); }}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "relative flex cursor-pointer items-center rounded-sm px-3 py-1.5 text-sm outline-none select-none",
                    isHighlighted && "bg-accent text-accent-foreground",
                    isSelected && "font-medium"
                  )}
                  onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  {opt}
                </div>
              );
            })}
            {normalizedQuery && totalCount > filtered.length && (
              <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                {totalCount - filtered.length} more result{totalCount - filtered.length !== 1 ? "s" : ""} available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
