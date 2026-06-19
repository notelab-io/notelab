import * as React from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Text } from "@/components/ui/text";
import { Fonts } from "@/constants/theme";
import { type ThemePalette, useThemedStyles } from "@/hooks/use-app-theme";

export type AuthFormStyles = {
  field: ViewStyle;
  fieldLabel: TextStyle;
  input: TextStyle;
  inputFocused: TextStyle;
  otpBox: ViewStyle;
  otpBoxActive: ViewStyle;
  otpBoxFilled: ViewStyle;
  otpBoxes: ViewStyle;
  otpDigit: TextStyle;
  otpHiddenInput: TextStyle;
  otpWrapper: ViewStyle;
};

export function createAuthFormStyles(
  palette: ThemePalette,
  isDark: boolean,
): AuthFormStyles {
  return StyleSheet.create({
    field: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: palette.foreground,
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: Fonts.sans,
      fontWeight: "400",
      letterSpacing: 0,
      textAlign: "left",
      color: palette.foreground,
    },
    inputFocused: {
      borderColor: palette.foreground,
      shadowColor: palette.foreground,
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    otpWrapper: {
      position: "relative",
    },
    otpHiddenInput: {
      position: "absolute",
      width: 1,
      height: 1,
      opacity: 0,
    },
    otpBoxes: {
      flexDirection: "row",
      gap: 10,
    },
    otpBox: {
      flex: 1,
      height: 56,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },
    otpBoxFilled: {
      borderColor: isDark ? palette.ring : palette.input,
    },
    otpBoxActive: {
      borderColor: palette.foreground,
      shadowColor: palette.foreground,
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    otpDigit: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "600",
      color: palette.foreground,
      fontVariant: ["tabular-nums"],
    },
  });
}

export function AuthFieldLabel({ label }: { label: string }) {
  const { styles } = useThemedStyles(createAuthFormStyles);

  return <Text style={styles.fieldLabel}>{label}</Text>;
}

export function AuthField({ children }: React.PropsWithChildren) {
  const { styles } = useThemedStyles(createAuthFormStyles);

  return <View style={styles.field}>{children}</View>;
}

export function AuthInput({
  style,
  ...props
}: React.ComponentProps<typeof TextInput>) {
  const { palette, styles } = useThemedStyles(createAuthFormStyles);
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <TextInput
      placeholderTextColor={palette.mutedForeground}
      selectionColor={palette.foreground}
      style={[styles.input, isFocused && styles.inputFocused, style]}
      onBlur={(event) => {
        setIsFocused(false);
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        props.onFocus?.(event);
      }}
      {...props}
    />
  );
}

export function AuthOtpInput({
  inputRef,
  onChange,
  value,
}: {
  inputRef: React.RefObject<TextInput | null>;
  onChange: (value: string) => void;
  value: string;
}) {
  const { styles } = useThemedStyles(createAuthFormStyles);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");
  const activeIndex = Math.min(value.length, 5);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={styles.otpWrapper}
    >
      <TextInput
        ref={inputRef}
        autoCapitalize="characters"
        autoCorrect={false}
        caretHidden
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(nextValue) => onChange(nextValue.replace(/\D/g, ""))}
        spellCheck={false}
        style={styles.otpHiddenInput}
        value={value}
      />
      <View style={styles.otpBoxes}>
        {digits.map((digit, index) => {
          const isActive = index === activeIndex && value.length < 6;

          return (
            <View
              key={index}
              style={[
                styles.otpBox,
                digit && styles.otpBoxFilled,
                isActive && styles.otpBoxActive,
              ]}
            >
              <Text style={styles.otpDigit}>{digit}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}