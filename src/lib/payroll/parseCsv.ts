// @ts-ignore
import Papa from 'papaparse';
import { isAddress, getAddress } from 'viem';
import { PayrollRow } from './types';

export function parsePayrollCsv(csvRaw: string): PayrollRow[] {
  if (!csvRaw.trim()) return [];

  const parsed = Papa.parse<string[]>(csvRaw.trim(), {
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  if (!rows || rows.length === 0) return [];

  // Check if first row is a header
  const firstRow = rows[0];
  const hasHeader =
    firstRow[0]?.toLowerCase().includes('name') ||
    firstRow[1]?.toLowerCase().includes('address') ||
    firstRow[2]?.toLowerCase().includes('amount');

  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row: string[], i: number) => {
    const name = row[0]?.trim() || `Payee #${i + 1}`;
    const rawAddr = row[1]?.trim() || '';
    const amount = row[2]?.trim() || '0.00';
    const memo = row[3]?.trim() || `Payout - ${name}`;

    const isValid = isAddress(rawAddr);
    let checksumAddr = rawAddr;
    if (isValid) {
      try {
        checksumAddr = getAddress(rawAddr.toLowerCase());
      } catch (e) {
        checksumAddr = rawAddr;
      }
    }
    const errors: string[] = [];

    if (!rawAddr) {
      errors.push('Missing address');
    } else if (!isValid) {
      errors.push('Invalid 0x address format');
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      errors.push('Invalid amount');
    }

    return {
      id: `row-${i}-${Date.now()}`,
      index: i + 1,
      name,
      address: checksumAddr,
      amount,
      memo,
      isValidAddress: isValid && errors.length === 0,
      errors,
    };
  });
}
