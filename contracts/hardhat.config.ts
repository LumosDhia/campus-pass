import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Public testnet target for when this MVP moves past local dev.
    // Requires POLYGON_AMOY_RPC_URL and DEPLOYER_PRIVATE_KEY in a local .env (never commit it).
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL ?? "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
};

export default config;
