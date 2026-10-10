import { encodeFunctionData, parseUnits, stringToHex, pad, getAddress } from 'viem';
import { erc20Abi, memoAbi } from './abis';
import { NetworkConfig } from './constants';
import { PayrollRow, Token } from '../payroll/types';

export interface Aggregate3Call {
  target: `0x${string}`;
  allowFailure: boolean;
  callData: `0x${string}`;
}

export function buildSubcalls(
  rows: PayrollRow[],
  token: Token,
  netConfig: NetworkConfig
): Aggregate3Call[] {
  const tokenAddress = token === 'EURC' ? netConfig.eurcAddress : netConfig.usdcAddress;

  return rows.map((row) => {
    const recipient = getAddress(row.address);
    const amountUnits = parseUnits(row.amount, 6);

    const transferCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amountUnits],
    });

    if (row.memo && row.memo.trim().length > 0) {
      const memoBytes = stringToHex(row.memo.trim());
      const memoId = pad('0x0', { size: 32 });

      const memoCalldata = encodeFunctionData({
        abi: memoAbi,
        functionName: 'memo',
        args: [tokenAddress, transferCalldata, memoId, memoBytes],
      });

      return {
        target: netConfig.memoAddress,
        allowFailure: false,
        callData: memoCalldata,
      };
    }

    return {
      target: tokenAddress,
      allowFailure: false,
      callData: transferCalldata,
    };
  });
}
