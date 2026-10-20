"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/http";
import { forgotPasswordSchema, toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));

    setPending(true);
    const res = await postJson<{ email: string }>("/api/auth/forgot-password", parsed.data);
    setPending(false);

    if (res.ok) {
      toast.success("If that email has an account, a reset code is on its way.");
      router.push(`/reset-password?email=${encodeURIComponent(res.email)}`);
      return;
    }
    setErrors(res.fieldErrors ?? { email: res.error });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors({});
        }}
        error={errors.email}
      />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Sending…" : "Send reset code"}
      </Button>
      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </form>
  );
}
