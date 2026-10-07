import { redirect } from "next/navigation";

// Logistics tasks live on the dedicated Logistics page; keep old links working.
export default function MyDashboardRedirect() {
  redirect("/dashboard/logistics");
}
