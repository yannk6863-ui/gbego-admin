import React, { useMemo, useState } from "react";
import { theme } from "../../theme/theme";
import { AppText } from "./AppText";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: React.CSSProperties;
};

export function AppInput({
  label,
  error,
  hint,
  containerStyle,
  disabled,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled;

  const borderColor = useMemo(() => {
    if (error) return theme.colors.danger;
    if (focused) return theme.colors.primary;
    return theme.colors.border;
  }, [error, focused]);

  return (
    <div style={containerStyle}>
      {label && (
        <AppText variant="small" weight="600" style={{ display: "block", marginBottom: 6 }}>
          {label}
        </AppText>
      )}

      <div
        style={{
          height: 52,
          borderRadius: theme.radius.md,
          border: `1px solid ${borderColor}`,
          backgroundColor: isDisabled ? theme.colors.bg : theme.colors.surface,
          paddingLeft: theme.spacing.lg,
          paddingRight: theme.spacing.lg,
          display: "flex",
          alignItems: "center",
          ...(focused && !error ? { boxShadow: "0 6px 12px rgba(0,0,0,0.08)" } : {}),
        }}
      >
        <input
          disabled={isDisabled}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={{
            fontSize: theme.typography.body,
            color: isDisabled ? theme.colors.muted : theme.colors.text,
            fontWeight: "500",
            border: "none",
            outline: "none",
            background: "transparent",
            width: "100%",
          }}
          {...props}
        />
      </div>

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
        <AppText variant="tiny" muted style={{ display: "block", marginTop: 6 }}>
          {hint}
        </AppText>
      ) : null}
    </div>
  );
}