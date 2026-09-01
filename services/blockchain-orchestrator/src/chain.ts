import { createPublicClient, createWalletClient, http, defineChain, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { soulboundTokenAbi } from "./abi.js";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 31337);
const PRIVATE_KEY = process.env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}` | undefined;
export const SBT_CONTRACT_ADDRESS = process.env.SBT_CONTRACT_ADDRESS as Address | undefined;

const localChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 31337 ? "hardhat-local" : `chain-${CHAIN_ID}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export const publicClient = createPublicClient({ chain: localChain, transport: http(RPC_URL) });

export const walletClient = PRIVATE_KEY
  ? createWalletClient({
      account: privateKeyToAccount(PRIVATE_KEY),
      chain: localChain,
      transport: http(RPC_URL),
    })
  : undefined;

export function requireContractAddress(): Address {
  if (!SBT_CONTRACT_ADDRESS) {
    throw new Error("SBT_CONTRACT_ADDRESS is not set — deploy contracts/ and set it in .env first.");
  }
  return SBT_CONTRACT_ADDRESS;
}

export { soulboundTokenAbi };
