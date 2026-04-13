import React from "react";
import { SafeAreaView, View, ViewStyle } from "react-native";
import { theme } from "../../theme/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
};

export function Screen({ children, style, padded = true }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={[
          {
            flex: 1,
            paddingHorizontal: padded ? theme.spacing.lg : 0,
            paddingTop: padded ? theme.spacing.xl : 0,
            paddingBottom: padded ? theme.spacing.lg : 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}