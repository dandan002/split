export type MemberBalance = { memberId: string; netCents: number };
export type Transfer = { fromMemberId: string; toMemberId: string; amountCents: number };

export function suggestTransfers(balances: MemberBalance[]): Transfer[];
export function transfersFor(memberId: string, transfers: Transfer[]): { pay: Transfer[]; receive: Transfer[] };
