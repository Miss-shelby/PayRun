import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { ARC_MAINNET, ARC_TESTNET, getArcNetwork, NETWORK_CONFIGS } from './constants';

const activeNet = getArcNetwork();

export const config = createConfig({
  chains: activeNet.network === 'testnet' ? [ARC_TESTNET, ARC_MAINNET] : [ARC_MAINNET, ARC_TESTNET],
  connectors: [injected()],
  transports: {
    [ARC_MAINNET.id]: http(NETWORK_CONFIGS.mainnet.rpcUrl),
    [ARC_TESTNET.id]: http(NETWORK_CONFIGS.testnet.rpcUrl),
  },
  ssr: true,
});

