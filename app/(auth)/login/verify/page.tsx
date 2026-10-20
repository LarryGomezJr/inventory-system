import type { Metadata } from "next";
import { LoginVerifyForm } from "./login-verify-form";

export const metadata: Metadata = { title: "Enter sign-in code" };

export default function LoginVerifyPage() {
  return <LoginVerifyForm />;
}
