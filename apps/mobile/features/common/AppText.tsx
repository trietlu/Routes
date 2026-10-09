import { Text, type TextProps } from 'react-native';
import { type TypographyVariant, useTheme } from '../../theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** Secondary text is grey (UX § Visual language). */
  secondary?: boolean;
}

/** Text in the app's type scale. It always scales with Dynamic Type (NFR-6). */
export function AppText({ variant = 'body', secondary = false, style, ...props }: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        theme.typography[variant],
        { color: secondary ? theme.colors.textSecondary : theme.colors.text },
        style,
      ]}
    />
  );
}
