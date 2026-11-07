import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { canSaveReceipt, dollars, type ReceiptInput } from './core/allocation.mjs';
import { groups, members, scannedReceipt } from './data/demo';
import { colors, spacing, type } from './theme';

type Route = 'login' | 'groups' | 'scan' | 'review' | 'activity' | 'profile';
type ReceiptDraft = typeof scannedReceipt;

export default function App() {
  const [route, setRoute] = useState<Route>('login');
  const [receipt, setReceipt] = useState<ReceiptDraft>(scannedReceipt);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {route === 'login' ? (
        <LoginScreen onDone={() => setRoute('groups')} />
      ) : (
        <View style={styles.shell}>
          {route === 'groups' && <GroupsScreen onScan={() => setRoute('scan')} />}
          {route === 'scan' && <ScanScreen onCapture={() => setRoute('review')} />}
          {route === 'review' && (
            <ReviewReceiptScreen
              receipt={receipt}
              onChangeReceipt={setReceipt}
              onBack={() => setRoute('scan')}
            />
          )}
          {route === 'activity' && <PlaceholderScreen title="Activity" label="SETTLEMENT LOG" />}
          {route === 'profile' && <PlaceholderScreen title="Profile" label="ACCOUNT" />}
          <BottomNav active={route} onNavigate={setRoute} />
        </View>
      )}
    </SafeAreaView>
  );
}

function LoginScreen({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.loginCanvas}>
      <View style={styles.loginHeader}>
        <Text style={[type.display, styles.uppercase]}>Split</Text>
        <Text style={[type.body, styles.muted]}>Architectural debt management.</Text>
      </View>
      <View style={styles.formStack}>
        <Field label="EMAIL ADDRESS" placeholder="name@example.com" keyboardType="email-address" />
        <Field label="PASSWORD" placeholder="Password" secureTextEntry />
        <Pressable style={styles.primaryButton} onPress={onDone}>
          <Text style={styles.primaryButtonText}>GET STARTED</Text>
        </Pressable>
      </View>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={[type.label, styles.muted]}>OR</Text>
        <View style={styles.divider} />
      </View>
      <Pressable style={styles.textAction}>
        <Text style={styles.textActionLabel}>CONTINUE WITH APPLE</Text>
      </Pressable>
      <Pressable style={styles.textAction}>
        <Text style={styles.textActionLabel}>CONTINUE WITH GOOGLE</Text>
      </Pressable>
    </View>
  );
}

function Field(props: {
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
}) {
  return (
    <View>
      <Text style={[type.label, styles.fieldLabel]}>{props.label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={props.keyboardType ?? 'default'}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={props.secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

function GroupsScreen({ onScan }: { onScan: () => void }) {
  return (
    <ScreenFrame title="Split" rightIcon="add">
      <View style={styles.overview}>
        <Text style={[type.label, styles.muted]}>OVERVIEW</Text>
        <View style={styles.spaceBetween}>
          <Text style={type.headline}>Active Groups</Text>
          <Text style={styles.monoStrong}>{`${String(groups.length).padStart(2, '0')} GROUPS`}</Text>
        </View>
      </View>

      {groups.map((group) => (
        <View key={group.id} style={styles.groupRow}>
          <View>
            <Text style={type.title}>{group.name}</Text>
            <Text style={[type.body, styles.muted]}>{group.dates}</Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={styles.monoStrong}>{dollars(group.balanceCents)}</Text>
            <Text style={group.status === 'OWED' ? styles.statusPill : styles.statusText}>
              {group.status}
            </Text>
          </View>
        </View>
      ))}

      <Pressable style={styles.dashedButton}>
        <Ionicons name="add" size={26} color={colors.muted} />
        <Text style={[type.label, styles.muted]}>CREATE NEW TRIP GROUP</Text>
      </Pressable>

      <Pressable style={styles.activityCard} onPress={onScan}>
        <View style={styles.activityIcon}>
          <MaterialCommunityIcons name="receipt-text-outline" size={22} color={colors.inverse} />
        </View>
        <View style={styles.flex}>
          <Text style={type.title}>Recent Activity</Text>
          <Text style={[type.body, styles.activityText]}>
            Marc added "Dinner at Blue Hill" to NYC trip.
          </Text>
          <Text style={[type.label, styles.muted]}>2 HOURS AGO</Text>
        </View>
      </Pressable>
    </ScreenFrame>
  );
}

function ScanScreen({ onCapture }: { onCapture: () => void }) {
  return (
    <View style={styles.flex}>
      <Header title="Scan Receipt" right={<Ionicons name="flash-outline" size={28} />} />
      <ScrollView contentContainerStyle={styles.scanScroll}>
        <View style={styles.viewfinder}>
          <View style={styles.receiptPaper}>
            <Text style={styles.fakeReceiptLine}>BLUE HILL AT STONE BARNS</Text>
            <Text style={styles.fakeReceiptLine}>OYSTERS ............ 24.00</Text>
            <Text style={styles.fakeReceiptLine}>TAGLIATELLE ........ 32.00</Text>
            <Text style={styles.fakeReceiptLine}>BRANZINO ........... 38.00</Text>
            <Text style={styles.fakeReceiptLine}>NEBBIOLO ........... 54.00</Text>
            <Text style={styles.fakeReceiptLine}>TOTAL ............. 190.92</Text>
          </View>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <Text style={styles.ocrTag}>DETECTING MERCHANT...</Text>
            <Text style={[styles.ocrTag, styles.ocrTotal]}>TOTAL: $190.92</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[type.label, styles.muted]}>RECENTLY SCANNED</Text>
          <Text style={[type.label, styles.muted]}>LIVE RECOGNITION</Text>
        </View>
        <RecentScanRow icon="cafe-outline" title="Coffee" subtitle="BLUE BOTTLE COFFEE" amount="$5.00" />
        <RecentScanRow icon="pizza-outline" title="Pizza" subtitle="ROBERTA'S PIZZA" amount="$22.00" />
        <RecentScanRow icon="document-text-outline" title="Processing..." subtitle="OCR IN PROGRESS" amount="--" />
      </ScrollView>
      <Pressable style={styles.shutter} onPress={onCapture}>
        <MaterialCommunityIcons name="qrcode-scan" size={30} color={colors.inverse} />
      </Pressable>
      <View style={styles.shutterLabel}>
        <Text style={type.label}>TAP TO CAPTURE</Text>
      </View>
    </View>
  );
}

function RecentScanRow(props: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; amount: string }) {
  return (
    <View style={styles.recentRow}>
      <View style={styles.recentIcon}>
        <Ionicons name={props.icon} size={26} color={colors.muted} />
      </View>
      <View style={styles.flex}>
        <Text style={type.body}>{props.title}</Text>
        <Text style={[type.label, styles.muted]}>{props.subtitle}</Text>
      </View>
      <View style={styles.alignEnd}>
        <Text style={styles.moneyLarge}>{props.amount}</Text>
        <Text style={[type.label, styles.muted]}>TODAY</Text>
      </View>
    </View>
  );
}

function ReviewReceiptScreen({
  receipt,
  onChangeReceipt,
  onBack,
}: {
  receipt: ReceiptDraft;
  onChangeReceipt: (receipt: ReceiptDraft) => void;
  onBack: () => void;
}) {
  const validation = useMemo(() => {
    const receiptInput: ReceiptInput = {
      members,
      items: receipt.items,
      adjustments: receipt.adjustments,
      receiptTotalCents: receipt.receiptTotalCents,
    };
    return canSaveReceipt(receiptInput);
  }, [receipt]);
  const { memberTotals, remainingCents } = validation.result;

  const cycleAssignment = (itemId: string) => {
    const presets = [
      [{ memberId: 'ana', weight: 1 }],
      [{ memberId: 'bo', weight: 1 }],
      [
        { memberId: 'ana', weight: 1 },
        { memberId: 'bo', weight: 1 },
        { memberId: 'cam', weight: 1 },
      ],
      members.map((member) => ({ memberId: member.id, weight: 1 })),
    ];

    const item = receipt.items.find((candidate) => candidate.id === itemId);
    const currentIndex = presets.findIndex(
      (preset) => JSON.stringify(preset) === JSON.stringify(item?.allocations),
    );
    const nextPreset = presets[(currentIndex + 1) % presets.length];

    onChangeReceipt({
      ...receipt,
      items: receipt.items.map((candidate) =>
        candidate.id === itemId ? { ...candidate, allocations: nextPreset } : candidate,
      ),
    });
  };

  return (
    <View style={styles.flex}>
      <Header title="Review Receipt" onBack={onBack} right={<Text style={styles.headerAction}>EDIT</Text>} />
      <ScrollView contentContainerStyle={styles.reviewScroll}>
        <View style={styles.receiptSummary}>
          <View>
            <Text style={[type.label, styles.muted]}>MERCHANT</Text>
            <Text style={type.headline}>{receipt.merchant}</Text>
            <Text style={[type.body, styles.muted]}>{receipt.date}</Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={[type.label, styles.muted]}>TOTAL</Text>
            <Text style={styles.totalText}>{dollars(receipt.receiptTotalCents)}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[type.label, styles.muted]}>ITEMS</Text>
          <Text style={[type.label, styles.muted]}>TAP ROW TO REASSIGN</Text>
        </View>
        {receipt.items.map((item) => (
          <Pressable key={item.id} style={styles.itemRow} onPress={() => cycleAssignment(item.id)}>
            <View style={styles.flex}>
              <View style={styles.rowTitleLine}>
                <Text style={type.title}>{item.name}</Text>
                {(item.confidence ?? 1) < 0.9 && <Text style={styles.lowConfidence}>CHECK</Text>}
              </View>
              <Text style={[type.label, styles.muted]}>
                {assignmentLabel(item.allocations.map((allocation) => allocation.memberId))}
              </Text>
            </View>
            <View style={styles.alignEnd}>
              <Text style={styles.moneyLarge}>{dollars(item.amountCents)}</Text>
              <AvatarStrip memberIds={item.allocations.map((allocation) => allocation.memberId)} />
            </View>
          </Pressable>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={[type.label, styles.muted]}>TAX / TIP / FEES</Text>
          <Text style={[type.label, styles.muted]}>PROPORTIONAL</Text>
        </View>
        {receipt.adjustments.map((adjustment) => (
          <View key={adjustment.id} style={styles.adjustmentRow}>
            <Text style={type.body}>{adjustment.label}</Text>
            <Text style={styles.moneyLarge}>{dollars(adjustment.amountCents)}</Text>
          </View>
        ))}

        <View style={styles.memberTotals}>
          <Text style={type.title}>Member Totals</Text>
          {members.map((member) => (
            <View key={member.id} style={styles.totalRow}>
              <Text style={type.body}>{member.name}</Text>
              <Text style={styles.monoStrong}>{dollars(memberTotals[member.id] ?? 0)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.saveBar}>
        <View>
          <Text style={[type.label, styles.muted]}>
            {validation.ok ? 'BALANCED' : validation.reasons.join(' / ').replaceAll('_', ' ')}
          </Text>
          <Text style={styles.monoStrong}>
            Remaining {dollars(remainingCents)}
          </Text>
        </View>
        <Pressable style={[styles.saveButton, !validation.ok && styles.disabledButton]} disabled={!validation.ok}>
          <Text style={styles.primaryButtonText}>SAVE SPLIT</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AvatarStrip({ memberIds }: { memberIds: string[] }) {
  return (
    <View style={styles.avatarStrip}>
      {memberIds.slice(0, 4).map((memberId) => {
        const member = members.find((candidate) => candidate.id === memberId);
        return (
          <View key={memberId} style={styles.avatar}>
            <Text style={styles.avatarText}>{member?.name.slice(0, 1) ?? '?'}</Text>
          </View>
        );
      })}
    </View>
  );
}

function assignmentLabel(memberIds: string[]) {
  if (memberIds.length === 0) {
    return 'UNASSIGNED';
  }

  if (memberIds.length === members.length) {
    return 'EVERYONE';
  }

  return memberIds
    .map((memberId) => members.find((member) => member.id === memberId)?.name ?? memberId)
    .join(' / ')
    .toUpperCase();
}

function PlaceholderScreen({ title, label }: { title: string; label: string }) {
  return (
    <ScreenFrame title={title}>
      <Text style={[type.label, styles.muted]}>{label}</Text>
      <Text style={[type.headline, styles.placeholderTitle]}>Ledger-grade trip coordination.</Text>
      <Text style={[type.body, styles.muted]}>
        This tab is ready for settlement activity and account preferences once the group ledger is connected.
      </Text>
    </ScreenFrame>
  );
}

function ScreenFrame({
  title,
  children,
  rightIcon,
}: {
  title: string;
  children: ReactNode;
  rightIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.flex}>
      <Header title={title} right={rightIcon ? <Ionicons name={rightIcon} size={30} /> : undefined} />
      <ScrollView contentContainerStyle={styles.screenContent}>{children}</ScrollView>
    </View>
  );
}

function Header({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerIcon}>
        <Ionicons name="arrow-back" size={30} color={colors.ink} />
      </Pressable>
      <Text style={type.headline}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function BottomNav({ active, onNavigate }: { active: Route; onNavigate: (route: Route) => void }) {
  const items: Array<{ route: Route; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { route: 'groups', label: 'Groups', icon: 'people-outline' },
    { route: 'activity', label: 'Activity', icon: 'notifications-outline' },
    { route: 'scan', label: 'Scan', icon: 'qr-code-outline' },
    { route: 'profile', label: 'Profile', icon: 'person-outline' },
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const selected = active === item.route || (active === 'review' && item.route === 'scan');
        return (
          <Pressable key={item.route} style={styles.navItem} onPress={() => onNavigate(item.route)}>
            <View style={[styles.navIndicator, selected && styles.navIndicatorActive]} />
            <Ionicons name={item.icon} size={26} color={selected ? colors.ink : colors.muted} />
            <Text style={[type.label, selected ? styles.navSelected : styles.muted]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  muted: {
    color: colors.muted,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  loginCanvas: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.margin,
    backgroundColor: colors.surface,
  },
  loginHeader: {
    marginBottom: spacing.xl,
  },
  formStack: {
    gap: spacing.lg,
  },
  fieldLabel: {
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  input: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    height: 56,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  divider: {
    backgroundColor: colors.line,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  textAction: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  textActionLabel: {
    borderBottomColor: colors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 64,
    paddingHorizontal: spacing.margin,
  },
  headerIcon: {
    marginRight: spacing.md,
  },
  headerRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  headerAction: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  screenContent: {
    paddingBottom: 116,
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.xl,
  },
  overview: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  spaceBetween: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  monoStrong: {
    color: colors.ink,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  groupRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 102,
  },
  statusPill: {
    backgroundColor: colors.ink,
    color: colors.inverse,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  dashedButton: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 96,
  },
  activityCard: {
    backgroundColor: colors.subtle,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  activityIcon: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  activityText: {
    marginTop: spacing.sm,
  },
  scanScroll: {
    paddingBottom: 156,
  },
  viewfinder: {
    alignItems: 'center',
    backgroundColor: '#111111',
    height: 510,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  receiptPaper: {
    backgroundColor: '#d8d8d8',
    padding: spacing.lg,
    transform: [{ rotate: '-1deg' }],
    width: 270,
  },
  fakeReceiptLine: {
    color: '#555555',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  scanFrame: {
    borderColor: '#ffffff77',
    borderStyle: 'dashed',
    borderWidth: 1,
    bottom: spacing.xl,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
    top: spacing.xl,
  },
  corner: {
    borderColor: colors.inverse,
    height: 44,
    position: 'absolute',
    width: 44,
  },
  cornerTopLeft: {
    borderLeftWidth: 3,
    borderTopWidth: 3,
    left: -1,
    top: -1,
  },
  cornerTopRight: {
    borderRightWidth: 3,
    borderTopWidth: 3,
    right: -1,
    top: -1,
  },
  cornerBottomLeft: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    bottom: -1,
    left: -1,
  },
  cornerBottomRight: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    bottom: -1,
    right: -1,
  },
  ocrTag: {
    backgroundColor: colors.inverse,
    color: colors.ink,
    fontSize: 13,
    left: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    top: 170,
  },
  ocrTotal: {
    left: undefined,
    right: 110,
    top: 330,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.xl,
  },
  recentRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.margin,
    minHeight: 84,
  },
  recentIcon: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  moneyLarge: {
    color: colors.ink,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  shutter: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: '#ffffff66',
    borderWidth: 4,
    borderRadius: 40,
    bottom: 88,
    height: 72,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -36,
    position: 'absolute',
    width: 72,
    zIndex: 2,
  },
  shutterLabel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    bottom: 65,
    left: '50%',
    marginLeft: -75,
    paddingHorizontal: spacing.sm,
    position: 'absolute',
    width: 150,
    zIndex: 2,
  },
  reviewScroll: {
    paddingBottom: 190,
  },
  receiptSummary: {
    alignItems: 'flex-start',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.margin,
  },
  totalText: {
    color: colors.ink,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  itemRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.margin,
    minHeight: 86,
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lowConfidence: {
    borderColor: colors.ink,
    borderWidth: 2,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  avatarStrip: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderColor: colors.ink,
    borderWidth: StyleSheet.hairlineWidth,
    height: 24,
    justifyContent: 'center',
    marginLeft: -4,
    width: 24,
  },
  avatarText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  adjustmentRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing.margin,
    minHeight: 64,
  },
  memberTotals: {
    backgroundColor: colors.subtle,
    gap: spacing.md,
    margin: spacing.margin,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    padding: spacing.margin,
    position: 'absolute',
    right: 0,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  disabledButton: {
    opacity: 0.3,
  },
  placeholderTitle: {
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  bottomNav: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    height: 64,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  navIndicator: {
    backgroundColor: 'transparent',
    height: 3,
    position: 'absolute',
    top: 0,
    width: 72,
  },
  navIndicatorActive: {
    backgroundColor: colors.ink,
  },
  navSelected: {
    color: colors.ink,
  },
});
