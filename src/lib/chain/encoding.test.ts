import { describe, it, expect } from 'vitest';
import { decodeFunctionData, hexToString, parseUnits } from 'viem';
import { buildSubcalls } from './encoding';
import { NETWORK_CONFIGS } from './constants';
import { erc20Abi, memoAbi } from './abis';
import { PayrollRow } from '../payroll/types';

describe('Multicall3From & Memo Calldata Encoding', () => {
  const mainnetConfig = NETWORK_CONFIGS.mainnet;

  it('should encode direct ERC-20 transfer when memo is empty', () => {
    const rows: PayrollRow[] = [
      {
        id: '1',
        index: 1,
        name: 'Ada Lovelace',
        address: '0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554',
        amount: '0.1',
        memo: '',
        isValidAddress: true,
        errors: [],
      },
    ];

    const calls = buildSubcalls(rows, 'USDC', mainnetConfig);

    expect(calls.length).toBe(1);
    expect(calls[0].target.toLowerCase()).toBe(mainnetConfig.usdcAddress.toLowerCase());
    expect(calls[0].allowFailure).toBe(false);

    // Decode transfer calldata
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: calls[0].callData,
    });

    expect(decoded.functionName).toBe('transfer');
    expect(decoded.args[0].toLowerCase()).toBe('0xf4948e13e95fb5d3f5a2f7f9a354d1d5f1c9e554');
    expect(decoded.args[1]).toBe(parseUnits('0.1', 6));
  });

  it('should encode Memo contract call when memo string is present', () => {
    const rows: PayrollRow[] = [
      {
        id: '1',
        index: 1,
        name: 'Ada Lovelace',
        address: '0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554',
        amount: '0.5',
        memo: 'Oct Salary - Ada',
        isValidAddress: true,
        errors: [],
      },
    ];

    const calls = buildSubcalls(rows, 'USDC', mainnetConfig);

    expect(calls.length).toBe(1);
    expect(calls[0].target.toLowerCase()).toBe(mainnetConfig.memoAddress.toLowerCase());
    expect(calls[0].allowFailure).toBe(false);

    // Decode outer Memo call
    const decodedMemo = decodeFunctionData({
      abi: memoAbi,
      data: calls[0].callData,
    });

    expect(decodedMemo.functionName).toBe('memo');
    expect(decodedMemo.args[0].toLowerCase()).toBe(mainnetConfig.usdcAddress.toLowerCase()); // target token

    // Decode inner transfer data
    const decodedInnerTransfer = decodeFunctionData({
      abi: erc20Abi,
      data: decodedMemo.args[1],
    });
    expect(decodedInnerTransfer.functionName).toBe('transfer');
    expect(decodedInnerTransfer.args[0].toLowerCase()).toBe('0xf4948e13e95fb5d3f5a2f7f9a354d1d5f1c9e554');
    expect(decodedInnerTransfer.args[1]).toBe(parseUnits('0.5', 6));

    // Decode memo string data
    const memoText = hexToString(decodedMemo.args[3]);
    expect(memoText).toBe('Oct Salary - Ada');
  });

  it('should route EURC transfers to mainnet EURC token address', () => {
    const rows: PayrollRow[] = [
      {
        id: '1',
        index: 1,
        name: 'Charles Babbage',
        address: '0xF4948E13E95fb5d3F5a2f7F9a354D1D5F1c9E554',
        amount: '1.5',
        memo: '',
        isValidAddress: true,
        errors: [],
      },
    ];

    const calls = buildSubcalls(rows, 'EURC', mainnetConfig);

    expect(calls[0].target.toLowerCase()).toBe(mainnetConfig.eurcAddress.toLowerCase());
  });
});
