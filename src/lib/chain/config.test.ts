import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getArcNetwork } from './constants';

describe('Arc Network Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should default to Arc Mainnet (Chain ID 5042)', () => {
    delete process.env.NEXT_PUBLIC_ARC_NETWORK;
    delete process.env.ARC_NETWORK;

    const config = getArcNetwork();
    expect(config.network).toBe('mainnet');
    expect(config.chainId).toBe(5042);
    expect(config.hexChainId).toBe('0x13B2');
    expect(config.rpcUrl).toBe('https://rpc.mainnet.arc.io');
    expect(config.explorerUrl).toBe('https://explorer.arc.io');
    expect(config.usdcAddress.toLowerCase()).toBe('0x3600000000000000000000000000000000000000');
    expect(config.eurcAddress.toLowerCase()).toBe('0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1');
    expect(config.multicall3FromAddress.toLowerCase()).toBe('0x522faf9a91c41c443c66765030741e4aace147d0');
    expect(config.memoAddress.toLowerCase()).toBe('0x5294e9927c3306dcbadb03fe70b92e01ccede505');
  });

  it('should select Arc Testnet when ARC_NETWORK=testnet', () => {
    process.env.NEXT_PUBLIC_ARC_NETWORK = 'testnet';

    const config = getArcNetwork();
    expect(config.network).toBe('testnet');
    expect(config.chainId).toBe(5042002);
    expect(config.hexChainId).toBe('0x4CEEFA');
    expect(config.rpcUrl).toBe('https://rpc.testnet.arc.network');
    expect(config.explorerUrl).toBe('https://explorer.testnet.arc.network');
    expect(config.usdcAddress.toLowerCase()).toBe('0x3600000000000000000000000000000000000000');
    expect(config.eurcAddress.toLowerCase()).toBe('0x89b50855aa3be2f677cd6303cec089b5f319d72a');
    expect(config.multicall3FromAddress.toLowerCase()).toBe('0x522f6b60021c3f91f3b98d5a344d5c1b85d347d0');
    expect(config.memoAddress.toLowerCase()).toBe('0x5294e9927c3306dcbadb03fe70b92e01ccede505');
  });
});
