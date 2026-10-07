import { redirect } from "next/navigation";

// Preserve old emailed/bookmarked feedback links without requiring a customer login.
export default function LegacyFeedbackPage() {
  redirect("/feedback");
}
