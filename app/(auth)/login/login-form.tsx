"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField, PasswordField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/http";
import { loginSchema, toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = React.useState({ email: "", password: "" });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("reset") === "1") {
      toast.success("Password updated. Sign in with your new password.", { id: "password-reset" });
    }
    if (searchParams.get("expired") === "1") {
      toast.info("You were signed out due to inactivity. Please sign in again.", {
        id: "session-expired",
      });
    }
  }, [searchParams]);

  const update = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));

    setPending(true);
    const res = await postJson<{ maskedEmail: string }>("/api/auth/login", parsed.data);
    setPending(false);

    if (res.ok) {
      sessionStorage.setItem("login_masked_email", res.maskedEmail);
      router.push("/login/verify");
      return;
    }
    if (res.code === "EMAIL_NOT_CONFIRMED") {
      toast.info(res.error);
      router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
      return;
    }
    setFormError(res.error);
    setErrors(res.fieldErrors ?? {});
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={values.email}
        onChange={update("email")}
        error={errors.email}
      />
      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Your password"
        value={values.password}
        onChange={update("password")}
        error={errors.password}
        labelAction={
          <Link href="/forgot-password" className="text-xs font-medium text-accent-foreground/80 hover:underline">
            Forgot password?
          </Link>
        }
      />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Checking…" : "Continue"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
