"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth/auth-header";
import { OtpField } from "@/components/auth/otp-field";
import { ResendButton } from "@/components/auth/resend-button";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/http";

export function VerifyEmailForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  async function verify(token: string) {
    if (token.length !== 6 || pending) return;
    setPending(true);
    setError(undefined);
    const res = await postJson<{ redirectTo: string }>("/api/auth/signup/verify", { email, token });

    if (res.ok) {
      toast.success("Email verified — welcome aboard!");
      router.replace(res.redirectTo);
      router.refresh();
      return;
    }
    setPending(false);
    setCode("");
    setError(res.error);
  }

  async function resend() {
    const res = await postJson("/api/auth/signup/resend", { email });
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
          icon={MailCheck}
          title="Verify your email"
          description="We couldn't tell which email to verify. Start again from sign up or sign in."
        />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href="/signup">Go to sign up</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        icon={MailCheck}
        title="Verify your email"
        description={
          <>
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </>
        }
      />
      <form
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
      >
        <OtpField
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(undefined);
          }}
          onComplete={verify}
          error={error}
          disabled={pending}
        />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || code.length !== 6}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Verifying…" : "Verify email"}
        </Button>
        <ResendButton onResend={resend} />
        <Link
          href="/signup"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Use a different email
        </Link>
      </form>
    </>
  );
}
