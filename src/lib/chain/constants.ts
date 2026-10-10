import { defineChain, type Chain } from 'viem';

export type ArcNetworkType = 'mainnet' | 'testnet';

export const ARC_MAINNET = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.mainnet.arc.io',
        'https://rpc.drpc.mainnet.arc.io',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
});

export const ARC_TESTNET = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan Testnet', url: 'https://explorer.testnet.arc.network' },
  },
});

export interface NetworkConfig {
  network: ArcNetworkType;
  chain: Chain;
  chainId: number;
  hexChainId: `0x${string}`;
  rpcUrl: string;
  fallbackRpcUrl: string;
  explorerUrl: string;
  usdcAddress: `0x${string}`;
  eurcAddress: `0x${string}`;
  multicall3FromAddress: `0x${string}`;
  memoAddress: `0x${string}`;
}

export const NETWORK_CONFIGS: Record<ArcNetworkType, NetworkConfig> = {
  mainnet: {
    network: 'mainnet',
    chain: ARC_MAINNET,
    chainId: 5042,
    hexChainId: '0x13B2',
    rpcUrl: 'https://rpc.mainnet.arc.io',
    fallbackRpcUrl: 'https://rpc.drpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    eurcAddress: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    multicall3FromAddress: '0x522fAf9A91c41c443c66765030741e4AaCe147D0',
    memoAddress: '0x5294E9927c3306DcBaDb03fe70b92e01cCede505',
  },
  testnet: {
    network: 'testnet',
    chain: ARC_TESTNET,
    chainId: 5042002,
    hexChainId: '0x4CEEFA',
    rpcUrl: 'https://rpc.testnet.arc.network',
    fallbackRpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://explorer.testnet.arc.network',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    eurcAddress: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    multicall3FromAddress: '0x522f6b60021c3f91f3B98D5A344d5c1B85D347D0',
    memoAddress: '0x5294E9927c3306DcBaDb03fe70b92e01cCede505',
  },
};

export function getArcNetwork(): NetworkConfig {
  const envNet = (
    process.env.NEXT_PUBLIC_ARC_NETWORK ||
    process.env.ARC_NETWORK ||
    'mainnet'
  ).toLowerCase();

  if (envNet === 'testnet') {
    return NETWORK_CONFIGS.testnet;
  }
  return NETWORK_CONFIGS.mainnet;
}
