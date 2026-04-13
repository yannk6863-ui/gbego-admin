import React from "react";
import { theme } from "../../theme/theme";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padded?: boolean;
};

export function Screen({ children, style, padded = true }: Props) {
  return (
    <div style={{ backgroundColor: theme.colors.bg, minHeight: "100vh" }}>
      <div
        style={{
          paddingLeft: padded ? theme.spacing.lg : 0,
          paddingRight: padded ? theme.spacing.lg : 0,
          paddingTop: padded ? theme.spacing.xl : 0,
          paddingBottom: padded ? theme.spacing.lg : 0,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}