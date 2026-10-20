"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { postJson } from "@/lib/http";

const STORAGE_KEY = "inv_session_touch";
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;

function readShared() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(value: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable (private mode etc.) — this tab still works on its own.
  }
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Signs the user out after `idleSeconds` without activity. The server enforces
 * the same window with a signed cookie; this keeps it renewed while the user
 * is active and warns them before it runs out.
 */
export function SessionTimeout({ idleSeconds }: { idleSeconds: number }) {
  const router = useRouter();
  const warnSeconds = Math.min(120, Math.floor(idleSeconds / 3));
  const heartbeatEveryMs = Math.min(60, Math.floor(idleSeconds / 6)) * 1000;

  const [open, setOpen] = React.useState(false);
  const [remaining, setRemaining] = React.useState(warnSeconds);

  const lastServerTouch = React.useRef(0);
  const openRef = React.useRef(false);
  const inFlight = React.useRef(false);
  const finished = React.useRef(false);

  const markTouched = React.useCallback((at: number) => {
    lastServerTouch.current = Math.max(lastServerTouch.current, at);
    writeShared(lastServerTouch.current);
  }, []);

  const finish = React.useCallback(
    async (reason: "expired" | "manual") => {
      if (finished.current) return;
      finished.current = true;
      setOpen(false);
      await postJson("/api/auth/logout");
      if (reason === "expired") {
        router.replace("/login?expired=1");
      } else {
        toast.success("Signed out");
        router.replace("/login");
      }
      router.refresh();
    },
    [router],
  );

  const heartbeat = React.useCallback(async () => {
    if (inFlight.current || finished.current) return;
    inFlight.current = true;
    const sentAt = Date.now();
    const res = await postJson("/api/auth/heartbeat");
    inFlight.current = false;
    if (res.ok) {
      markTouched(sentAt);
    } else if (res.code === "SESSION_EXPIRED") {
      finished.current = true;
      router.replace("/login?expired=1");
      router.refresh();
    }
  }, [markTouched, router]);

  React.useEffect(() => {
    // This page load itself renewed the server-side window.
    markTouched(Date.now());

    const onActivity = () => {
      if (openRef.current) return; // While warning, only the buttons count.
      if (Date.now() - lastServerTouch.current >= heartbeatEveryMs) void heartbeat();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        lastServerTouch.current = Math.max(lastServerTouch.current, Number(e.newValue) || 0);
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(() => {
      lastServerTouch.current = Math.max(lastServerTouch.current, readShared());
      const left = Math.ceil((lastServerTouch.current + idleSeconds * 1000 - Date.now()) / 1000);

      if (left <= 0) {
        void finish("expired");
      } else if (left <= warnSeconds) {
        openRef.current = true;
        setOpen(true);
        setRemaining(left);
      } else if (openRef.current) {
        // Another tab (or "Stay signed in") extended the session.
        openRef.current = false;
        setOpen(false);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [finish, heartbeat, heartbeatEveryMs, idleSeconds, markTouched, warnSeconds]);

  const staySignedIn = () => {
    openRef.current = false;
    setOpen(false);
    void heartbeat();
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && staySignedIn()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            For your security, you&apos;ll be signed out in{" "}
            <span className="font-semibold tabular-nums text-foreground">{formatSeconds(remaining)}</span>{" "}
            because of inactivity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void finish("manual")}>Sign out</AlertDialogCancel>
          <AlertDialogAction onClick={staySignedIn}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
