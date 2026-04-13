import React from "react";
import { theme } from "../../theme/theme";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  variant?: "default" | "subtle";
};

export function Card({ children, style, variant = "default" }: Props) {
  const variantStyle: React.CSSProperties =
    variant === "subtle"
      ? { backgroundColor: theme.colors.bg, borderColor: theme.colors.border }
      : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  return (
    <div
      style={{
        backgroundColor: variantStyle.backgroundColor,
        borderRadius: theme.radius.md,
        border: `1px solid ${variantStyle.borderColor}`,
        padding: theme.spacing.lg,
        boxShadow: "0 6px 12px rgba(0,0,0,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}