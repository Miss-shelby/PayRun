import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { defineChain } from "viem";

// 1. Define Arc Testnet details
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://explorer.testnet.arc.network" },
  },
});

// 2. Pre-deployed contract addresses on Arc Testnet
const USDC_TESTNET = "0x3600000000000000000000000000000000000000"; // Testnet USDC

// Standard ERC-20 balanceOf function ABI snippet
const erc20BalanceAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  console.log("🚀 Connecting to Arc Testnet...\n");

  // Create a read-only client to talk to the blockchain RPC
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  // Get current block number
  const blockNumber = await publicClient.getBlockNumber();
  console.log(`✅ Connected! Current Block Number: ${blockNumber}`);

  // Test address (Arc USDC contract address as test recipient)
  const testAccount = "0x3600000000000000000000000000000000000000";

  // Read testnet USDC total supply or balance
  const balanceRaw = await publicClient.readContract({
    address: USDC_TESTNET,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [testAccount],
  });

  // USDC has 6 decimal places
  const balanceFormatted = formatUnits(balanceRaw, 6);

  console.log(`\n💼 Contract Test Account: ${testAccount}`);
  console.log(`💰 Query result: ${balanceFormatted} USDC`);
  console.log(`\n🎉 Connection to Arc Testnet is 100% SUCCESSFUL!`);
}

main().catch(console.error);

