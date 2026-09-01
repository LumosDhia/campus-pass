import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("SoulboundToken");
  const contract = await factory.deploy(deployer.address);
  await contract.waitForDeployment();

  console.log("SoulboundToken deployed to:", await contract.getAddress());
  console.log("Owner (orchestrator) address:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
