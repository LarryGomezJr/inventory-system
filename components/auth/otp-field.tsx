"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function OtpField({
  value,
  onChange,
  onComplete,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid justify-items-center gap-2">
      <InputOTP
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
        autoFocus
        aria-label="6-digit verification code"
        aria-invalid={!!error}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => (
            <InputOTPSlot
              key={i}
              index={i}
              aria-invalid={!!error}
              className="size-11 bg-card text-lg font-semibold sm:size-12"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
