import { redirect } from "next/navigation";

// The proxy routes "/" to /login or /dashboard; this is a fallback.
export default function Home() {
  redirect("/dashboard");
}
