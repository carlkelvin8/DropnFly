"use client";

import { useState } from "react";
import { Download, FileDown, Calendar, CalendarRange, List } from "lucide-react";

type ExportType = "day" | "month" | "range" | "all";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [exportType, setExportType] = useState<ExportType>("all");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  if (!open) return null;

  function buildUrl() {
    const params = new URLSearchParams();
    params.set("type", exportType);
    if (exportType === "day" && date) params.set("date", date);
    if (exportType === "month" && month) params.set("month", month);
    if (exportType === "range") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return `/api/export/bookings?${params.toString()}`;
  }

  function handleExport() {
    const url = buildUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Export Bookings</h3>
            <p className="text-sm text-muted-foreground">Choose export range</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <ExportOption
            icon={<Calendar className="h-4 w-4" />}
            value="day"
            label="Per Day"
            selected={exportType === "day"}
            onSelect={() => setExportType("day")}
          >
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            />
          </ExportOption>

          <ExportOption
            icon={<CalendarRange className="h-4 w-4" />}
            value="month"
            label="Monthly"
            selected={exportType === "month"}
            onSelect={() => setExportType("month")}
          >
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            />
          </ExportOption>

          <ExportOption
            icon={<CalendarRange className="h-4 w-4" />}
            value="range"
            label="Specified Range"
            selected={exportType === "range"}
            onSelect={() => setExportType("range")}
          >
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-muted-foreground">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-medium text-muted-foreground">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                />
              </div>
            </div>
          </ExportOption>

          <ExportOption
            icon={<List className="h-4 w-4" />}
            value="all"
            label="All Bookings"
            selected={exportType === "all"}
            onSelect={() => setExportType("all")}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
          >
            <FileDown className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportOption({
  icon,
  value,
  label,
  selected,
  onSelect,
  children,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"
      }`}
    >
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <input
          type="radio"
          name="export-type"
          value={value}
          checked={selected}
          onChange={onSelect}
          className="text-primary"
        />
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </label>
      {selected && children}
    </div>
  );
}
