import React from "react";
import { theme } from "../../theme/theme";

type Variant = "title" | "h2" | "h3" | "body" | "small" | "tiny";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  weight?: "400" | "500" | "600" | "700";
  center?: boolean;
  muted?: boolean;
  tone?: "default" | "success" | "danger";
  style?: React.CSSProperties;
};

const size: Record<Variant, number> = {
  title: theme.typography.title,
  h2: theme.typography.h2,
  h3: theme.typography.h3,
  body: theme.typography.body,
  small: theme.typography.small,
  tiny: theme.typography.tiny,
};

export function AppText({
  variant = "body",
  weight = "500",
  center,
  muted,
  tone = "default",
  style,
  children,
  ...props
}: Props) {
  const toneColor =
    tone === "success"
      ? theme.colors.success
      : tone === "danger"
      ? theme.colors.danger
      : theme.colors.text;

  return (
    <span
      {...props}
      style={{
        fontSize: size[variant],
        fontWeight: weight,
        color: muted ? theme.colors.muted : toneColor,
        textAlign: center ? "center" : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
}