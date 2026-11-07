import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Label, LoadingState, Money, Row, Screen } from '../components/ui';
import { getActivity, type ActivityEntry } from '../lib/api';
import { useCurrentUser } from '../lib/auth';
import { shortName, timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useNavigation } from '../navigation';
import { colors } from '../theme';
import { openReceipt } from './ScanScreen';

export function ActivityScreen() {
  const nav = useNavigation();
  const { userId } = useCurrentUser();
  const feed = useAsync(getActivity, []);
  const names = feed.data?.names ?? {};
  const person = (id: string) => (id === userId ? 'You' : shortName(names[id] ?? 'Someone'));

  const open = (entry: ActivityEntry) => {
    if (entry.kind === 'expense') {
      nav.push({ name: 'expense', expenseId: entry.id });
    } else if (entry.kind === 'settlement') {
      nav.push({ name: 'settlement', settlementId: entry.id });
    } else if (entry.receipt.uploaded_by === userId) {
      openReceipt(nav, entry.receipt, userId);
    } else {
      nav.push({ name: 'group', groupId: entry.groupId });
    }
  };

  return (
    <Screen title="Activity" refreshing={feed.refreshing} onRefresh={feed.refresh}>
      <Label>ACROSS ALL GROUPS</Label>
      {feed.loading && !feed.data ? <LoadingState label="Loading activity" /> : null}
      {feed.error ? <ErrorState message={feed.error} onRetry={feed.reload} /> : null}
      {feed.data && feed.data.entries.length === 0 ? (
        <EmptyState title="Nothing yet" body="Saved receipts, payments and drafts waiting for review show up here." />
      ) : null}

      {(feed.data?.entries ?? []).map((entry) => {
        if (entry.kind === 'expense') {
          return (
            <Row
              key={`e-${entry.id}`}
              left={<Icon name="receipt-text-outline" />}
              title={entry.expense.merchant}
              subtitle={`${person(entry.expense.created_by)} added · ${entry.groupName} · ${timeAgo(entry.at)}`.toUpperCase()}
              right={<Money cents={entry.expense.total_cents} />}
              onPress={() => open(entry)}
            />
          );
        }
        if (entry.kind === 'settlement') {
          return (
            <Row
              key={`s-${entry.id}`}
              left={<Icon name="swap-horizontal" />}
              title={`${person(entry.settlement.from_profile_id)} paid ${person(entry.settlement.to_profile_id)}`}
              subtitle={`${entry.groupName} · ${timeAgo(entry.at)}`.toUpperCase()}
              right={<Money cents={entry.settlement.amount_cents} />}
              onPress={() => open(entry)}
            />
          );
        }
        return (
          <Row
            key={`r-${entry.id}`}
            left={<Icon name="file-document-edit-outline" muted />}
            title={entry.receipt.merchant || 'Receipt draft'}
            subtitle={`${entry.receipt.ocr_status.replace('_', ' ')} · ${entry.groupName} · ${timeAgo(entry.at)}`.toUpperCase()}
            right={<Label>{entry.receipt.uploaded_by === userId ? 'REVIEW' : 'DRAFT'}</Label>}
            onPress={() => open(entry)}
          />
        );
      })}
    </Screen>
  );
}

function Icon({ name, muted }: { name: keyof typeof MaterialCommunityIcons.glyphMap; muted?: boolean }) {
  return (
    <View style={[styles.icon, muted && styles.iconMuted]}>
      {name === 'swap-horizontal' ? (
        <Ionicons name="swap-horizontal" size={20} color={colors.inverse} />
      ) : (
        <MaterialCommunityIcons name={name} size={20} color={muted ? colors.ink : colors.inverse} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', backgroundColor: colors.ink, height: 40, justifyContent: 'center', width: 40 },
  iconMuted: { backgroundColor: colors.subtle },
});
