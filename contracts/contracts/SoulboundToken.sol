// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Non-transferable ERC-721 (Soulbound Token) notarizing one GS1-identified
/// item (GTIN + Serial) per token. Minted by the Blockchain Orchestrator on the Hub's
/// behalf; ownership is checked by the Identity & Auth Service before issuing a JWT.
contract SoulboundToken is ERC721, ERC721URIStorage, Ownable {
    error SoulboundTokenNonTransferable();
    error AlreadyMinted();
    error UnknownItem();
    error TokenDoesNotExist();

    /// @notice One fact attached to a token after minting — e.g. a certification earned,
    /// volunteer hours logged, or a correction. Append-only: once added, never edited or removed.
    struct Claim {
        string label;
        string value;
        uint64 timestamp;
    }

    mapping(uint256 tokenId => bool isActive) public active;
    mapping(bytes32 identityKey => uint256 tokenId) private _identityToTokenId;
    mapping(uint256 tokenId => Claim[]) private _claims;

    uint256 private _nextTokenId = 1;

    event Minted(uint256 indexed tokenId, address indexed to, string gtin, string serial, string tokenURI);
    event StatusChanged(uint256 indexed tokenId, bool active);
    event ClaimAdded(uint256 indexed tokenId, uint256 index, string label, string value);
    event TokenURIUpdated(uint256 indexed tokenId, string tokenURI);

    constructor(address orchestrator) ERC721("CampusPass Credential", "CPCRED") Ownable(orchestrator) {}

    function mint(address to, string calldata gtin, string calldata serial, string calldata tokenURI_)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        bytes32 key = _identityKey(gtin, serial);
        if (_identityToTokenId[key] != 0) revert AlreadyMinted();

        tokenId = _nextTokenId++;
        _identityToTokenId[key] = tokenId;
        active[tokenId] = true;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        emit Minted(tokenId, to, gtin, serial, tokenURI_);
    }

    function setActive(uint256 tokenId, bool isActive) external onlyOwner {
        active[tokenId] = isActive;
        emit StatusChanged(tokenId, isActive);
    }

    /// @notice Appends one fact to a token's permanent record. Does not touch the
    /// token itself (still non-transferable) — just grows its history.
    function addClaim(uint256 tokenId, string calldata label, string calldata value)
        external
        onlyOwner
        returns (uint256 index)
    {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        index = _claims[tokenId].length;
        _claims[tokenId].push(Claim({label: label, value: value, timestamp: uint64(block.timestamp)}));
        emit ClaimAdded(tokenId, index, label, value);
    }

    function claimCount(uint256 tokenId) external view returns (uint256) {
        return _claims[tokenId].length;
    }

    function getClaims(uint256 tokenId) external view returns (Claim[] memory) {
        return _claims[tokenId];
    }

    /// @notice Repoints a token at a corrected/updated metadata blob on IPFS.
    /// Use sparingly — prefer addClaim for append-only facts; this replaces the base record.
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        _setTokenURI(tokenId, newTokenURI);
        emit TokenURIUpdated(tokenId, newTokenURI);
    }

    function tokenIdFor(string calldata gtin, string calldata serial) external view returns (uint256) {
        return _identityToTokenId[_identityKey(gtin, serial)];
    }

    /// @notice What the Auth Service checks before issuing a JWT for this item.
    function isActiveFor(string calldata gtin, string calldata serial) external view returns (bool) {
        uint256 tokenId = _identityToTokenId[_identityKey(gtin, serial)];
        if (tokenId == 0) revert UnknownItem();
        return active[tokenId];
    }

    function _identityKey(string calldata gtin, string calldata serial) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(gtin, serial));
    }

    // --- Soulbound enforcement: allow mint (from == 0) and burn (to == 0) only ---

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundTokenNonTransferable();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert SoulboundTokenNonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert SoulboundTokenNonTransferable();
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
