import { issueMessage } from '../core/receipt.mjs';

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Your session expired. Sign in again.',
  group_name_required: 'Give the group a name.',
  only_owner_can_add_members: 'Only the group owner can add members.',
  only_owner_can_remove_members: 'Only the group owner can remove other members.',
  no_account_for_email: 'No Split account uses that email yet. Ask them to sign up first.',
  not_a_member: 'That person is no longer in this group.',
  cannot_remove_last_owner: 'A group needs at least one owner.',
  member_has_ledger_history: 'This person has expenses or settlements in the group, so they can’t be removed.',
  receipt_not_found: 'That receipt could not be found.',
  receipt_already_saved: 'This receipt was already saved.',
  invalid_total: 'Enter a valid receipt total.',
  items_required: 'Add at least one line item.',
  invalid_item_amount: 'Item amounts must be valid, non-negative numbers.',
  allocation_member_not_in_group: 'Some assignments refer to people who are not in this group.',
  share_member_not_in_group: 'Some shares refer to people who are not in this group.',
  shares_total_mismatch: 'Member totals do not add up to the receipt total.',
  invalid_share_amount: 'A member total is negative. Adjust discounts or credits.',
  custom_adjustment_unassigned: 'Choose who shares each custom-split adjustment.',
  invalid_adjustment_strategy: 'Unknown adjustment split.',
  invalid_adjustment_amount: 'Adjustment amounts must be valid numbers.',
  group_not_found: 'That group could not be found.',
  settlement_member_not_in_group: 'Both people must be in the group.',
  settlement_same_member: 'Choose two different people.',
  invalid_settlement_amount: 'Enter an amount greater than zero.',
  receipt_id_required: 'Missing receipt.',
  not_receipt_uploader: 'Only the person who scanned this receipt can re-run recognition.',
  invalid_image_path: 'The receipt image is not in this group’s storage.',
  image_not_found: 'The receipt image could not be read.',
  image_too_large: 'That image is too large. Try a smaller photo.',
  recognition_failed: 'Recognition failed. Retry or enter the receipt manually.',
  recognition_refused: 'Recognition could not process this image. Enter it manually.',
  recognition_truncated: 'The receipt was too long to read. Enter it manually.',
  recognition_empty: 'Nothing was recognized. Retry or enter it manually.',
  recognition_unparseable: 'Recognition returned an unreadable result. Retry or enter it manually.',
  'Invalid login credentials': 'Email or password is incorrect.',
  'User already registered': 'An account with this email already exists. Sign in instead.',
  'Email not confirmed': 'Confirm your email address, then sign in.',
};

// Turns Supabase/Postgres/edge-function errors into a sentence for the user.
export function friendlyError(error: unknown): string {
  if (!error) {
    return 'Something went wrong.';
  }

  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);

  for (const [code, message] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) {
      return message;
    }
  }

  const issue = issueMessage(raw);
  if (issue !== raw.replaceAll('_', ' ')) {
    return issue;
  }

  if (/network|fetch failed|Failed to fetch/i.test(raw)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }

  return raw || 'Something went wrong.';
}
