import { createPublicClient, http, formatUnits } from "viem";
import { getArcNetwork } from "../src/lib/chain/constants";

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
  const activeNet = getArcNetwork();
  console.log(`🚀 Connecting to ${activeNet.chain.name} (${activeNet.rpcUrl})...\n`);

  // Create a read-only client to talk to the blockchain RPC
  const publicClient = createPublicClient({
    chain: activeNet.chain,
    transport: http(activeNet.rpcUrl),
  });

  // Get current block number
  const blockNumber = await publicClient.getBlockNumber();
  console.log(`✅ Connected! Current Block Number: ${blockNumber}`);

  // Test address (USDC contract address)
  const testAccount = activeNet.usdcAddress;

  // Read USDC total supply or balance
  const balanceRaw = await publicClient.readContract({
    address: activeNet.usdcAddress,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [testAccount],
  });

  // USDC has 6 decimal places
  const balanceFormatted = formatUnits(balanceRaw, 6);

  console.log(`\n💼 Contract Test Account: ${testAccount}`);
  console.log(`💰 Query result: ${balanceFormatted} USDC`);
  console.log(`\n🎉 Connection to ${activeNet.chain.name} is 100% SUCCESSFUL!`);
}

main().catch(console.error);


