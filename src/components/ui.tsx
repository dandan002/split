import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { dollars, formatCentsInput, parseCents } from '../core/allocation.mjs';
import { useNavigation, type TabName } from '../navigation';
import { colors, spacing, type } from '../theme';

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={12} onPress={onBack} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={28} color={colors.ink} />
        </Pressable>
      ) : null}
      <Text numberOfLines={1} style={[type.headline, styles.headerTitle]}>
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Screen({
  title,
  onBack,
  right,
  children,
  footer,
  refreshing,
  onRefresh,
  scroll = true,
  contentStyle,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const nav = useNavigation();
  const back = onBack ?? (nav.canGoBack ? nav.back : undefined);

  return (
    <View style={styles.flex}>
      <Header title={title} onBack={back} right={right} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, footer ? styles.screenContentWithFooter : null, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.screenContent, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function Label({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<any>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[type.label, styles.muted, style]}>
      {children}
    </Text>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Label>{title}</Label>
      {typeof right === 'string' ? <Label>{right}</Label> : right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.inverse : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonSecondary,
        variant === 'text' && styles.buttonText,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={18} color={variant === 'danger' ? colors.danger : textColor} /> : null}
          <Text
            style={[
              styles.buttonLabel,
              { color: variant === 'danger' ? colors.danger : textColor },
              variant === 'text' && styles.buttonTextLabel,
            ]}
          >
            {label.toUpperCase()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  flagged,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; flagged?: boolean; error?: string | null }) {
  return (
    <View style={style as StyleProp<ViewStyle>}>
      {label ? (
        <View style={styles.fieldLabelRow}>
          <Label>{label}</Label>
          {flagged ? <CheckTag /> : null}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, (flagged || error) && styles.inputFlagged]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// Text input bound to integer cents. Keeps the user's raw text while typing and
// reports NaN for malformed input so validation can flag it.
export function MoneyInput({
  value,
  onChange,
  label,
  flagged,
  allowNegative = false,
  style,
  inputStyle,
  testID,
}: {
  value: number;
  onChange: (cents: number) => void;
  label?: string;
  flagged?: boolean;
  allowNegative?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<any>;
  testID?: string;
}) {
  const [text, setText] = useState(formatCentsInput(value));

  useEffect(() => {
    const parsed = parseCents(text);
    if (parsed !== value && !(Number.isNaN(value) && parsed === null)) {
      setText(formatCentsInput(value));
    }
    // Only resync when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const invalid = Number.isNaN(value);

  return (
    <View style={style}>
      {label ? (
        <View style={styles.fieldLabelRow}>
          <Label>{label}</Label>
          {flagged ? <CheckTag /> : null}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel={label ?? 'Amount'}
        testID={testID}
        inputMode="decimal"
        keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={(next) => {
          setText(next);
          const parsed = parseCents(next);
          onChange(parsed === null || (!allowNegative && parsed < 0) ? Number.NaN : parsed);
        }}
        style={[styles.input, styles.moneyInput, (invalid || flagged) && styles.inputFlagged, inputStyle]}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function CheckTag({ label = 'CHECK' }: { label?: string }) {
  return <Text style={styles.checkTag}>{label}</Text>;
}

export function Avatar({ name, uri, size = 32 }: { name: string; uri?: string | null; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, { width: size, height: size }]} />;
  }
  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      <Text style={[styles.avatarText, { fontSize: Math.max(10, size * 0.42) }]}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.ink} />
      <Label style={styles.stateLabel}>{label}</Label>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.state}>
      <Ionicons name="alert-circle-outline" size={32} color={colors.ink} />
      <Text style={[type.body, styles.stateText]}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={type.title}>{title}</Text>
      {body ? <Text style={[type.body, styles.muted, styles.emptyBody]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  return (
    <View style={[styles.banner, tone === 'error' && styles.bannerError, tone === 'warning' && styles.bannerWarning]}>
      <Ionicons
        name={tone === 'info' ? 'information-circle-outline' : 'alert-circle-outline'}
        size={18}
        color={tone === 'error' ? colors.danger : colors.ink}
      />
      <View style={styles.flex}>{typeof children === 'string' ? <Text style={type.body}>{children}</Text> : children}</View>
    </View>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
  left,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <>
      {left}
      <View style={styles.flex}>
        <Text style={type.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.label, styles.muted, styles.rowSubtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.alignEnd}>{right}</View>
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function Money({ cents, style }: { cents: number; style?: StyleProp<any> }) {
  return <Text style={[styles.money, style]}>{dollars(cents)}</Text>;
}

export function BottomNav() {
  const nav = useNavigation();
  const items: Array<{ tab: TabName; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { tab: 'groups', label: 'Groups', icon: 'people-outline' },
    { tab: 'activity', label: 'Activity', icon: 'notifications-outline' },
    { tab: 'scan', label: 'Scan', icon: 'scan-outline' },
    { tab: 'profile', label: 'Profile', icon: 'person-outline' },
  ];

  return (
    <View style={styles.bottomNav} accessibilityRole="tablist">
      {items.map((item) => {
        const selected = nav.tab === item.tab;
        return (
          <Pressable
            key={item.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            style={styles.navItem}
            onPress={() => nav.switchTab(item.tab)}
          >
            <View style={[styles.navIndicator, selected && styles.navIndicatorActive]} />
            <Ionicons name={item.icon} size={24} color={selected ? colors.ink : colors.muted} />
            <Text style={[type.label, styles.navLabel, selected ? styles.navSelected : styles.muted]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: colors.muted },
  alignEnd: { alignItems: 'flex-end' },
  header: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 64,
    paddingHorizontal: spacing.margin,
  },
  headerIcon: { marginRight: spacing.md },
  headerTitle: { flexShrink: 1 },
  headerRight: { alignItems: 'flex-end', flex: 1, marginLeft: spacing.sm },
  screenContent: {
    paddingBottom: 96,
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.lg,
  },
  screenContentWithFooter: { paddingBottom: 180 },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    padding: spacing.margin,
    position: 'absolute',
    right: 0,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  button: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonSecondary: { borderColor: colors.ink, borderWidth: 1, backgroundColor: colors.surface },
  buttonText: { height: 40, paddingHorizontal: spacing.sm },
  buttonInner: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  buttonLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  buttonTextLabel: { textDecorationLine: 'underline' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  fieldLabelRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  input: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  inputFlagged: { borderBottomColor: colors.ink, borderBottomWidth: 2 },
  moneyInput: { fontVariant: ['tabular-nums'], fontWeight: '700', textAlign: 'right' },
  fieldError: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  chip: {
    borderColor: colors.ink,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  chipTextSelected: { color: colors.inverse },
  checkTag: {
    borderColor: colors.ink,
    borderWidth: 2,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderColor: colors.ink,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  avatarText: { color: colors.ink, fontWeight: '900' },
  state: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl * 2 },
  stateLabel: { marginTop: spacing.sm },
  stateText: { textAlign: 'center' },
  empty: {
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  emptyBody: { marginBottom: spacing.sm },
  banner: {
    alignItems: 'flex-start',
    backgroundColor: colors.subtle,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  bannerWarning: { borderLeftColor: colors.ink, borderLeftWidth: 3 },
  bannerError: { borderLeftColor: colors.danger, borderLeftWidth: 3 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    paddingVertical: spacing.sm,
  },
  rowSubtitle: { marginTop: 2 },
  money: { color: colors.ink, fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '900' },
  bottomNav: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 64,
  },
  navItem: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  navIndicator: { backgroundColor: 'transparent', height: 3, position: 'absolute', top: 0, width: 56 },
  navIndicatorActive: { backgroundColor: colors.ink },
  navLabel: { fontSize: 10, letterSpacing: 1.2, marginTop: 2 },
  navSelected: { color: colors.ink },
});
