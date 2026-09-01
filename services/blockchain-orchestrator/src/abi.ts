// Minimal ABI fragment for the calls the orchestrator makes.
// Kept hand-written and decoupled from the contracts/ package so this service
// doesn't need a build-time dependency on Hardhat artifacts.
export const soulboundTokenAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "gtin", type: "string" },
      { name: "serial", type: "string" },
      { name: "tokenURI_", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "isActiveFor",
    stateMutability: "view",
    inputs: [
      { name: "gtin", type: "string" },
      { name: "serial", type: "string" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "tokenIdFor",
    stateMutability: "view",
    inputs: [
      { name: "gtin", type: "string" },
      { name: "serial", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setActive",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "addClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "label", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [{ name: "index", type: "uint256" }],
  },
  {
    type: "function",
    name: "getClaims",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "label", type: "string" },
          { name: "value", type: "string" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "updateTokenURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newTokenURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "gtin", type: "string", indexed: false },
      { name: "serial", type: "string", indexed: false },
      { name: "tokenURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ClaimAdded",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "index", type: "uint256", indexed: false },
      { name: "label", type: "string", indexed: false },
      { name: "value", type: "string", indexed: false },
    ],
  },
  { type: "error", name: "AlreadyMinted", inputs: [] },
  { type: "error", name: "UnknownItem", inputs: [] },
  { type: "error", name: "SoulboundTokenNonTransferable", inputs: [] },
  { type: "error", name: "TokenDoesNotExist", inputs: [] },
] as const;
