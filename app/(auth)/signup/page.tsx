import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth/auth-header";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeader
        title="Create your account"
        description="We'll email you a 6-digit code to verify your address."
      />
      <SignupForm />
    </>
  );
}
