"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth/auth-header";
import { PasswordField } from "@/components/auth/form-field";
import { OtpField } from "@/components/auth/otp-field";
import { ResendButton } from "@/components/auth/resend-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/http";
import { resetPasswordSchema, toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [values, setValues] = React.useState({ token: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ email, ...values });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));

    setPending(true);
    const res = await postJson<{ redirectTo: string }>("/api/auth/reset-password", parsed.data);
    setPending(false);

    if (res.ok) {
      router.replace(res.redirectTo);
      return;
    }
    setFormError(res.error);
    setErrors(res.fieldErrors ?? {});
    // A rejected code can't be reused, so clear it like the other code screens do.
    if (res.fieldErrors?.token) setValues((v) => ({ ...v, token: "" }));
  }

  async function resend() {
    const res = await postJson("/api/auth/forgot-password", { email });
    if (res.ok) {
      toast.success("A new code is on its way.");
      return true;
    }
    toast.error(res.error);
    return false;
  }

  if (!email) {
    return (
      <>
        <AuthHeader
          icon={KeyRound}
          title="Reset your password"
          description="Start by telling us which account to reset."
        />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href="/forgot-password">Request a reset code</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title="Set a new password"
        description={
          <>
            Enter the code sent to <span className="font-medium text-foreground">{email}</span> and
            choose a new password.
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
        <div className="grid gap-2">
          <Label className="justify-center">Reset code</Label>
          <OtpField value={values.token} onChange={(v) => set("token", v)} error={errors.token} disabled={pending} />
        </div>
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
          hint="8+ characters with uppercase, lowercase and a number"
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => set("confirmPassword", e.target.value)}
          error={errors.confirmPassword}
        />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Updating…" : "Update password"}
        </Button>
        <ResendButton onResend={resend} />
        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </form>
    </>
  );
}
