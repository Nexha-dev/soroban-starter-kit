import React from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  TextInputProps,
  KeyboardTypeOptions,
} from 'react-native';
import { theme } from '../theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
};

export function Input({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label} accessibilityRole="text">{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={error}
        returnKeyType="done"
        autoCorrect={false}
        autoCapitalize="none"
        {...rest}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: theme.spacing.md },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  input: {
    minHeight: theme.touchTarget,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  inputError: { borderColor: theme.colors.error },
  error: { color: theme.colors.error, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
});
