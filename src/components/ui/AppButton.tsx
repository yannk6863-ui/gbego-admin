import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  ViewStyle,
} from "react-native";
import { theme } from "../../theme/theme";
import { AppText } from "./AppText";

type Variant = "primary" | "outline" | "ghost";

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
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

  const base: ViewStyle = {
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    width: "100%",
    opacity: isDisabled ? 0.6 : 1,
  };

  const variants: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: theme.colors.primary, ...theme.shadow.card },
    outline: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: { backgroundColor: `${theme.colors.muted}14` },
  };

  const textColor =
    variant === "primary" ? theme.colors.surface : theme.colors.text;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        base,
        variants[variant],
        pressed && !isDisabled ? { transform: [{ scale: 0.98 }], opacity: 0.96 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText weight="700" style={{ color: textColor }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}