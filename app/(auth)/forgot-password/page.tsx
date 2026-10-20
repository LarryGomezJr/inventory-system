import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title="Forgot your password?"
        description="Enter your account email and we'll send you a code to reset it."
      />
      <ForgotPasswordForm />
    </>
  );
}
