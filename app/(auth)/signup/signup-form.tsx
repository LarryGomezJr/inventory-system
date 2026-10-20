"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField, PasswordField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/http";
import { signupSchema, toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

const initial = {
  fullName: "",
  username: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const update = (field: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));

    setPending(true);
    const res = await postJson<{ email: string; resent?: boolean }>("/api/auth/signup", parsed.data);
    setPending(false);

    if (res.ok) {
      toast.success(
        res.resent
          ? "This email is waiting for verification — we sent a new code."
          : "Account created! Check your email for the code.",
      );
      router.push(`/verify-email?email=${encodeURIComponent(res.email)}`);
      return;
    }
    setFormError(res.error);
    setErrors(res.fieldErrors ?? {});
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}
      <FormField
        id="fullName"
        label="Full name"
        autoComplete="name"
        placeholder="Juan Dela Cruz"
        value={values.fullName}
        onChange={update("fullName")}
        error={errors.fullName}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="username"
          label="Username"
          autoComplete="username"
          placeholder="juandc"
          value={values.username}
          onChange={update("username")}
          error={errors.username}
        />
        <FormField
          id="phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          placeholder="+63 912 345 6789"
          value={values.phone}
          onChange={update("phone")}
          error={errors.phone}
        />
      </div>
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
        autoComplete="new-password"
        placeholder="Create a password"
        value={values.password}
        onChange={update("password")}
        error={errors.password}
        hint="8+ characters with uppercase, lowercase and a number"
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Repeat your password"
        value={values.confirmPassword}
        onChange={update("confirmPassword")}
        error={errors.confirmPassword}
      />
      <Button type="submit" size="lg" className="mt-2 h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
