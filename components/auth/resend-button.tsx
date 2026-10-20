"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/** "Resend code" link with a countdown so users can't spam the endpoint. */
export function ResendButton({
  onResend,
  cooldownSeconds = 60,
  startWithCooldown = true,
}: {
  onResend: () => Promise<boolean>;
  cooldownSeconds?: number;
  startWithCooldown?: boolean;
}) {
  const [remaining, setRemaining] = React.useState(startWithCooldown ? cooldownSeconds : 0);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  async function handleClick() {
    setSending(true);
    const sent = await onResend();
    setSending(false);
    if (sent) setRemaining(cooldownSeconds);
  }

  return (
    <p className="text-center text-sm text-muted-foreground">
      Didn&apos;t get the code?{" "}
      <Button
        type="button"
        variant="link"
        className="h-auto p-0"
        disabled={remaining > 0 || sending}
        onClick={handleClick}
      >
        {sending ? "Sending…" : remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
      </Button>
    </p>
  );
}
