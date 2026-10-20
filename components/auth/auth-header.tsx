import type { LucideIcon } from "lucide-react";

export function AuthHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-8 space-y-2">
      {Icon && (
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="size-5" />
        </span>
      )}
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
