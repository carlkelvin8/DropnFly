"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPlayback } from "@/components/tracking/LocationPlayback";
import { MapPin, Users } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
}

export default function TrackingPlaybackPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => {
        const emps = Array.isArray(data) ? data : data.employees || [];
        setEmployees(emps);
        if (emps.length > 0) setSelectedId(emps[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedEmployee = employees.find((e) => e.id === selectedId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-cyan-500" />
            Historical Location Playback
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and replay the routes taken by riders on any given day
          </p>
        </div>
      </div>

      {/* Employee Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select Rider / Employee
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading employees...</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                    selectedId === emp.id
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm dark:bg-cyan-950/30 dark:text-cyan-400"
                      : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${
                    emp.lastLocationUpdate && (Date.now() - new Date(emp.lastLocationUpdate).getTime() < 300000)
                      ? "bg-green-500"
                      : "bg-gray-300"
                  }`} />
                  <span className="font-medium">{emp.name}</span>
                  <span className="text-xs text-muted-foreground">{emp.role}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playback */}
      {selectedId && (
        <LocationPlayback userId={selectedId} userName={selectedEmployee?.name} />
      )}
    </div>
  );
}
