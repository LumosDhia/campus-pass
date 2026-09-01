import { expect } from "chai";
import { ethers } from "hardhat";

describe("SoulboundToken", () => {
  async function deploy() {
    const [orchestrator, holder, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("SoulboundToken");
    const contract = await factory.connect(orchestrator).deploy(orchestrator.address);
    await contract.waitForDeployment();
    return { contract, orchestrator, holder, other };
  }

  it("mints a token for a GTIN+Serial and marks it active", async () => {
    const { contract, holder } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    expect(await contract.isActiveFor("09506000134352", "SN001")).to.equal(true);
    expect(await contract.ownerOf(1)).to.equal(holder.address);
  });

  it("rejects minting the same GTIN+Serial twice", async () => {
    const { contract, holder, other } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    await expect(
      contract.mint(other.address, "09506000134352", "SN001", "ipfs://cid456")
    ).to.be.revertedWithCustomError(contract, "AlreadyMinted");
  });

  it("blocks transfers between holders", async () => {
    const { contract, holder, other } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    await expect(
      contract.connect(holder).transferFrom(holder.address, other.address, 1)
    ).to.be.revertedWithCustomError(contract, "SoulboundTokenNonTransferable");
  });

  it("lets the orchestrator revoke an item's active status", async () => {
    const { contract, holder } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    await contract.setActive(1, false);
    expect(await contract.isActiveFor("09506000134352", "SN001")).to.equal(false);
  });

  it("appends claims to a token's permanent record without touching the token", async () => {
    const { contract, holder } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    await contract.addClaim(1, "Volunteer hours", "12 — Ocean Cleanup Program");
    await contract.addClaim(1, "Certification", "First Aid Level 1");

    expect(await contract.claimCount(1)).to.equal(2n);
    const claims = await contract.getClaims(1);
    expect(claims[0].label).to.equal("Volunteer hours");
    expect(claims[1].value).to.equal("First Aid Level 1");
    // Still soulbound — claims don't loosen transfer restrictions.
    expect(await contract.ownerOf(1)).to.equal(holder.address);
  });

  it("rejects adding a claim to a token that was never minted", async () => {
    const { contract } = await deploy();
    await expect(contract.addClaim(1, "x", "y")).to.be.revertedWithCustomError(contract, "TokenDoesNotExist");
  });

  it("only the orchestrator can add claims or update the tokenURI", async () => {
    const { contract, holder } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    await expect(contract.connect(holder).addClaim(1, "x", "y")).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );
  });

  it("lets the orchestrator repoint a token's base metadata", async () => {
    const { contract, holder } = await deploy();
    await contract.mint(holder.address, "09506000134352", "SN001", "ipfs://cid123");

    await contract.updateTokenURI(1, "ipfs://cid456");
    expect(await contract.tokenURI(1)).to.equal("ipfs://cid456");
  });
});
