import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminAssistant } from "@/components/chat/AdminAssistant";

export default async function AdminAssistantPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return <AdminAssistant />;
}
