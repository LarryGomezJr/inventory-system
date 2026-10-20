"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth/auth-header";
import { OtpField } from "@/components/auth/otp-field";
import { ResendButton } from "@/components/auth/resend-button";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/http";

const EXPIRED_CODES = new Set(["CHALLENGE_EXPIRED"]);

const noopSubscribe = () => () => {};
function readMaskedEmail() {
  try {
    return sessionStorage.getItem("login_masked_email");
  } catch {
    return null;
  }
}

export function LoginVerifyForm() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);
  const maskedEmail = React.useSyncExternalStore(noopSubscribe, readMaskedEmail, () => null);

  async function verify(token: string) {
    if (token.length !== 6 || pending) return;
    setPending(true);
    setError(undefined);
    const res = await postJson<{ redirectTo: string }>("/api/auth/login/verify", { token });

    if (res.ok) {
      sessionStorage.removeItem("login_masked_email");
      toast.success("Signed in");
      router.replace(res.redirectTo);
      router.refresh();
      return;
    }
    setPending(false);
    setCode("");
    if (res.code && EXPIRED_CODES.has(res.code)) {
      toast.error(res.error);
      router.replace("/login");
      return;
    }
    setError(res.error);
  }

  async function resend() {
    const res = await postJson("/api/auth/login/resend");
    if (res.ok) {
      toast.success("A new code is on its way.");
      setError(undefined);
      return true;
    }
    if (res.code && EXPIRED_CODES.has(res.code)) {
      toast.error(res.error);
      router.replace("/login");
      return false;
    }
    toast.error(res.error);
    return false;
  }

  return (
    <>
      <AuthHeader
        icon={MailCheck}
        title="Check your email"
        description={
          <>
            We sent a 6-digit sign-in code to{" "}
            <span className="font-medium text-foreground">{maskedEmail ?? "your email"}</span>. It
            expires in 10 minutes.
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
          {pending ? "Verifying…" : "Verify and sign in"}
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
