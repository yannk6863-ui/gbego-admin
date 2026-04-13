import React, { useMemo, useState } from "react";
import { TextInput, View, TextInputProps, ViewStyle } from "react-native";
import { theme } from "../../theme/theme";
import { AppText } from "./AppText";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
};

export function AppInput({
  label,
  error,
  hint,
  containerStyle,
  editable,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  const isDisabled = editable === false;

  const borderColor = useMemo(() => {
    if (error) return theme.colors.danger;
    if (focused) return theme.colors.primary;
    return theme.colors.border;
  }, [error, focused]);

  return (
    <View style={containerStyle}>
      {label && (
        <AppText variant="small" weight="600" style={{ marginBottom: 6 }}>
          {label}
        </AppText>
      )}

      <View
        style={{
          height: 52,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: isDisabled ? theme.colors.bg : theme.colors.surface,
          paddingHorizontal: theme.spacing.lg,
          justifyContent: "center",
          ...(focused && !error ? { ...theme.shadow.card } : null),
        }}
      >
        <TextInput
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.muted}
          style={{
            fontSize: theme.typography.body,
            color: isDisabled ? theme.colors.muted : theme.colors.text,
            fontWeight: "500",
          }}
          {...props}
        />
      </View>

      {error && (
        <AppText
          variant="tiny"
          weight="600"
          style={{ color: theme.colors.danger, marginTop: 6 }}
        >
          {error}
        </AppText>
      )}

      {!error && hint ? (
        <AppText variant="tiny" muted style={{ marginTop: 6 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}