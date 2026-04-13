import React from "react";
import { Text, TextProps, TextStyle } from "react-native";
import { theme } from "../../theme/theme";

type Variant = "title" | "h2" | "h3" | "body" | "small" | "tiny";

type Props = TextProps & {
  variant?: Variant;
  weight?: "400" | "500" | "600" | "700";
  center?: boolean;
  muted?: boolean;
  tone?: "default" | "success" | "danger";
  style?: TextStyle;
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
  ...props
}: Props) {
  const lineHeight: Record<Variant, number> = {
    title: Math.round(theme.typography.title * 1.2),
    h2: Math.round(theme.typography.h2 * 1.25),
    h3: Math.round(theme.typography.h3 * 1.3),
    body: Math.round(theme.typography.body * 1.45),
    small: Math.round(theme.typography.small * 1.4),
    tiny: Math.round(theme.typography.tiny * 1.35),
  };

  const toneColor = tone === "success" ? theme.colors.success : tone === "danger" ? theme.colors.danger : theme.colors.text;

  return (
    <Text
      {...props}
      style={[
        {
          fontSize: size[variant],
          fontWeight: weight,
          lineHeight: lineHeight[variant],
          color: muted ? theme.colors.muted : toneColor,
          textAlign: center ? "center" : "left",
        },
        style,
      ]}
    />
  );
}