export type Token = 'USDC' | 'EURC';

export type PayrollRow = {
  id: string;
  index: number;
  name: string;
  address: string;
  amount: string;
  memo: string;
  isValidAddress: boolean;
  errors: string[];
};

export type PayrollRun = {
  id: string;
  title: string;
  token: Token;
  recipientCount: number;
  totalAmount: string;
  txHash?: string;
  status: 'draft' | 'pending' | 'success' | 'failed';
  createdAt: string;
  rows: PayrollRow[];
  feeUsd: string;
};
