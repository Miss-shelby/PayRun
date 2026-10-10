// @ts-ignore
import Papa from 'papaparse';
import { isAddress, getAddress } from 'viem';
import { PayrollRow } from './types';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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

    const errors: string[] = [];
    const isBaseAddressValid = isAddress(rawAddr.toLowerCase());
    const isExactAddressValid = isAddress(rawAddr);
    let checksumAddr = rawAddr;

    if (!rawAddr) {
      errors.push('Missing address');
    } else if (!isBaseAddressValid) {
      errors.push('Invalid 0x address format');
    } else if (rawAddr.toLowerCase() === ZERO_ADDRESS) {
      errors.push('Cannot send funds to zero address (address(0))');
    } else if (!isExactAddressValid) {
      errors.push('Invalid address checksum');
      checksumAddr = getAddress(rawAddr.toLowerCase());
    } else {
      checksumAddr = getAddress(rawAddr);
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      errors.push('Invalid amount');
    } else {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length > 6) {
        errors.push('Amount exceeds maximum 6 decimal places for Arc tokens');
      }
    }

    return {
      id: `row-${i}-${Date.now()}`,
      index: i + 1,
      name,
      address: checksumAddr,
      amount,
      memo,
      isValidAddress: errors.length === 0,
      errors,
    };
  });
}
