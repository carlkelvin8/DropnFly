import type { Metadata } from "next";
import { FeedbackClient } from "./FeedbackClient";

export const metadata: Metadata = {
  title: "Customer Feedback - DropnFly",
  description: "Verify a completed DropnFly transaction and submit one customer review.",
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  const query = await searchParams;
  const initialReference = typeof query.reference === "string" ? query.reference : "";
  return <FeedbackClient initialReference={initialReference} />;
}
