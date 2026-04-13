import React from "react";
import { theme } from "../../theme/theme";
import { AppText } from "./AppText";

type Variant = "primary" | "outline" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: React.CSSProperties;
};

export function AppButton({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  ...props
}: Props) {
  const isDisabled = disabled || loading;

  const base: React.CSSProperties = {
    height: 52,
    borderRadius: theme.radius.md,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    width: "100%",
    opacity: isDisabled ? 0.6 : 1,
    cursor: isDisabled ? "not-allowed" : "pointer",
    border: "none",
  };

  const variants: Record<Variant, React.CSSProperties> = {
    primary: { backgroundColor: theme.colors.primary, boxShadow: "0 6px 12px rgba(0,0,0,0.08)" },
    outline: {
      backgroundColor: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
    },
    ghost: { backgroundColor: `${theme.colors.muted}14` },
  };

  const textColor =
    variant === "primary" ? theme.colors.surface : theme.colors.text;

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {loading ? (
        <span
          style={{
            width: 20,
            height: 20,
            border: `2px solid ${textColor}`,
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        <AppText weight="700" style={{ color: textColor }}>
          {title}
        </AppText>
      )}
    </button>
  );
}