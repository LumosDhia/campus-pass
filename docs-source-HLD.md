# High-Level Design (HLD): Ethical Digital Product Passport (DPP) & Auth Hub

## 1. Project Overview

The objective is to develop a "Phygital" Hub that provides logistical and digital services for social and commercial enterprises. The system acts as a central authority to issue GS1-compliant identities, encode physical tags (NFC/QR), notarize ethical claims on the Polygon blockchain via Soulbound Tokens (SBT), and manage licensed access to digital contents.

## 2. System Architecture

The architecture is based on a modular microservices approach to ensure multi-tenancy and high availability.

### 2.1 Core Components

1. **Enterprise Management Portal:** Dashboard for clients to manage product catalogs and commission tag batches.
2. **GS1 Digital Link Resolver:** A high-performance redirection engine following GS1 URI Syntax v1.2.
3. **Blockchain Orchestrator:** Handles metadata uploads to IPFS and minting of SBTs on Polygon PoS.
4. **Identity & Auth Service:** Issues RS256-signed JWTs based on on-chain SBT ownership.
5. **Public DPP Portal:** A mobile-first web interface for consumer transparency and product storytelling.

## 3. Technical Specifications

- **Blockchain:** Polygon (Low-cost, high speed). Standard: **ERC-721 (Non-transferable)**.
- **Storage:** IPFS for decentralized metadata (JSON-LD).
- **Standards:** GS1 Digital Link, Schema.org, JSON-LD.
- **Security:** JWT (JSON Web Token) with **RS256** signatures; **OIDC** compatibility.

## 4. Key User Stories & Functional Requirements

### 4.1 Education & Access (NFC Member Card)

- **User Story:** "As a member, I want to tap my card to log into Moodle without credentials."
- **Requirement:** The system must verify the SBT on Polygon. If valid, the Auth Service signs a JWT containing the user's role and course_permissions, then redirects to the LMS (Moodle) via SSO.

### 4.2 Ethical Consumerism (Cosmetics/Social Goods)

- **User Story:** "As a customer, I want to scan a cream's QR code to see its organic origin and ethical impact."
- **Requirement:** The Resolver detects a "Public Request" and serves the DPP Portal. The portal fetches the IPFS metadata to display the supply chain, ingredient list, and the social value generated (e.g., hours of inclusive labor).

### 4.3 Technical Support & Circularity (Furniture/Assembly)

- **User Story:** "As a buyer, I want to scan the NFC on a product to see assembly instructions and recycling info."
- **Requirement:** Based on the GTIN, the Resolver redirects the user to the "Technical Docs" section of the DPP. It must display end-of-life instructions to comply with EU Circular Economy regulations.

### 4.4 Live Assistance (Customer Support)

- **User Story:** "As a user in difficulty, I want to scan the tag and start a chat with an operator who already knows my product serial."
- **Requirement:** The DPP Portal must integrate a Chat Widget (e.g., Zendesk/Intercom) that automatically passes the Serial_Number and Warranty_Status as metadata to the operator.

## 5. Sequence Diagram: Authorization Flow

1. **Scan:** Smartphone reads NFC: `https://id-hub.io/01/GTIN/21/SERIAL`.
2. **Verify:** Resolver identifies the request needs "Authorized Access".
3. **On-Chain Check:** Blockchain Orchestrator verifies if the SBT for SERIAL is active on Polygon.
4. **Sign:** Auth Service generates a JWT signed with the Hub's Private Key.
5. **Redirect:** User is sent to the target service (e.g., Moodle) with the JWT.
6. **Validate:** Target service verifies the JWT using the Hub's Public Key (JWKS).

## 6. Implementation Roadmap for MVP

- **Phase 1 (Identity):** Build the GS1 Resolver and URI generation logic.
- **Phase 2 (Trust):** Integrate IPFS and Polygon Smart Contracts (SBT Minting).
- **Phase 3 (Auth):** Develop the JWT Issuance Service and Moodle SSO connector.
- **Phase 4 (UX):** Create the Public DPP Portal with multi-language support and "Ethical Claims" visualization.
- **Phase 5 (Ops):** API for mass-encoding NFC tags for the logistical center.

## 7. Developer Guidelines

- **Standardization:** All data schemas must inherit from Schema.org and GS1 Web Vocabulary.
- **Privacy:** Ensure GDPR compliance by using pseudonymized identifiers on-chain.
- **Reliability:** The Resolver must implement a caching layer (Redis) for Blockchain verification to handle high traffic.
