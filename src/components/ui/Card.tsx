import React from "react";
import { View, ViewStyle } from "react-native";
import { theme } from "../../theme/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "subtle";
};

export function Card({ children, style, variant = "default" }: Props) {
  const variantStyle =
    variant === "subtle"
      ? { backgroundColor: theme.colors.bg, borderColor: theme.colors.border }
      : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  return (
    <View
      style={[
        {
          backgroundColor: variantStyle.backgroundColor,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: variantStyle.borderColor,
          padding: theme.spacing.lg,
          ...theme.shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}