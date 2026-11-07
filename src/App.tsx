import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav, Button, ErrorState, LoadingState } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { NavigationProvider, useNavigation, type Route } from './navigation';
import { ActivityScreen } from './screens/ActivityScreen';
import { AuthScreen, ConfigMissingScreen } from './screens/AuthScreen';
import { ExpenseDetailScreen } from './screens/ExpenseScreen';
import { GroupDetailScreen, MembersScreen, SettleScreen, SettlementDetailScreen } from './screens/GroupScreens';
import { CreateGroupScreen, GroupsScreen } from './screens/GroupsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ReviewReceiptScreen } from './screens/ReviewScreen';
import { ScanScreen } from './screens/ScanScreen';
import { colors, spacing } from './theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <AuthProvider>
          <Root />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Root() {
  const { status, profileError, reloadProfile, signOut } = useAuth();

  if (status === 'unconfigured') {
    return <ConfigMissingScreen />;
  }

  if (status === 'restoring' || status === 'loadingProfile') {
    return (
      <View style={styles.center}>
        <LoadingState label={status === 'restoring' ? 'Restoring session' : 'Loading profile'} />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <AuthScreen />;
  }

  if (status === 'profileError') {
    return (
      <View style={styles.center}>
        <ErrorState message={profileError ?? 'Could not load your profile.'} onRetry={reloadProfile} />
        <Button variant="text" label="Sign out" onPress={signOut} />
      </View>
    );
  }

  return (
    <NavigationProvider>
      <View style={styles.shell}>
        <View style={styles.flex}>
          <CurrentScreen />
        </View>
        <BottomNav />
      </View>
    </NavigationProvider>
  );
}

function CurrentScreen() {
  const { route } = useNavigation();
  return renderRoute(route);
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'groups':
      return <GroupsScreen />;
    case 'activity':
      return <ActivityScreen />;
    case 'scan':
      return <ScanScreen key={route.groupId ?? 'scan'} groupId={route.groupId} />;
    case 'profile':
      return <ProfileScreen />;
    case 'createGroup':
      return <CreateGroupScreen />;
    case 'group':
      return <GroupDetailScreen key={route.groupId} groupId={route.groupId} />;
    case 'members':
      return <MembersScreen groupId={route.groupId} />;
    case 'review':
      return <ReviewReceiptScreen key={route.draft.receiptId ?? 'new'} groupId={route.groupId} draft={route.draft} />;
    case 'expense':
      return <ExpenseDetailScreen key={route.expenseId} expenseId={route.expenseId} />;
    case 'settle':
      return (
        <SettleScreen
          groupId={route.groupId}
          fromId={route.fromId}
          toId={route.toId}
          amountCents={route.amountCents}
        />
      );
    case 'settlement':
      return <SettlementDetailScreen settlementId={route.settlementId} />;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.margin, backgroundColor: colors.surface },
});
