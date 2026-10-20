import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeader } from "@/components/auth/auth-header";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeader
        title="Welcome back"
        description="Sign in with your email and password. We'll then email you a one-time code."
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
