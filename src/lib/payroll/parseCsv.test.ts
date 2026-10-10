import { describe, it, expect } from 'vitest';
import { parsePayrollCsv } from './parseCsv';

describe('Payroll CSV Validation & Parsing', () => {
  it('should parse valid CSV rows successfully', () => {
    const csv = `name,address,amount,currency,memo\nAda Lovelace,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.1,USDC,Jan Salary`;
    const rows = parsePayrollCsv(csv);

    expect(rows.length).toBe(1);
    expect(rows[0].isValidAddress).toBe(true);
    expect(rows[0].errors.length).toBe(0);
    expect(rows[0].name).toBe('Ada Lovelace');
    expect(rows[0].amount).toBe('0.1');
  });

  it('should reject zero address (address(0))', () => {
    const csv = `name,address,amount\nBad Recipient,0x0000000000000000000000000000000000000000,1.0`;
    const rows = parsePayrollCsv(csv);

    expect(rows.length).toBe(1);
    expect(rows[0].isValidAddress).toBe(false);
    expect(rows[0].errors).toContain('Cannot send funds to zero address (address(0))');
  });

  it('should reject invalid checksum addresses', () => {
    // 0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554 has bad checksum if case altered
    const badChecksum = '0xF4948e13e95fb5d3F5a2f7F9a354D1D5F1c9E554';
    const csv = `name,address,amount\nTest,${badChecksum},1.0`;
    const rows = parsePayrollCsv(csv);

    expect(rows.length).toBe(1);
    expect(rows[0].isValidAddress).toBe(false);
    expect(rows[0].errors).toContain('Invalid address checksum');
  });

  it('should reject amounts with > 6 decimal places', () => {
    const csv = `name,address,amount\nAda,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.1234567`;
    const rows = parsePayrollCsv(csv);

    expect(rows.length).toBe(1);
    expect(rows[0].isValidAddress).toBe(false);
    expect(rows[0].errors).toContain('Amount exceeds maximum 6 decimal places for Arc tokens');
  });

  it('should accept valid amounts up to 6 decimal places', () => {
    const csv = `name,address,amount\nAda,0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554,0.123456`;
    const rows = parsePayrollCsv(csv);

    expect(rows.length).toBe(1);
    expect(rows[0].isValidAddress).toBe(true);
  });
});
