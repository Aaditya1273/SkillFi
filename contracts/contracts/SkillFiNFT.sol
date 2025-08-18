// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./SkillFiEscrow.sol";
import "./SkillFiRewards.sol";

/**
 * @title SkillFiNFT
 * @dev NFT system for achievements, certifications, and project completion certificates
 */
contract SkillFiNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    Counters.Counter private _tokenIds;
    
    SkillFiEscrow public immutable escrow;
    SkillFiRewards public immutable rewards;
    
    // NFT Types
    enum NFTType {
        ProjectCompletion,  // Certificate for completing a project
        Achievement,        // Achievement badges
        Skill,             // Skill certifications
        Milestone,         // Special milestone NFTs
        Reputation,        // Reputation level NFTs
        Event              // Special event NFTs
    }
    
    // Rarity levels
    enum Rarity {
        Common,     // Bronze tier
        Uncommon,   // Silver tier
        Rare,       // Gold tier
        Epic,       // Platinum tier
        Legendary   // Diamond tier
    }
    
    struct NFTMetadata {
        uint256 id;
        NFTType nftType;
        Rarity rarity;
        string title;
        string description;
        uint256 projectId;
        address recipient;
        uint256 mintedAt;
        uint256 value; // Project value or achievement score
        string[] attributes;
        bool isTransferable;
    }
    
    struct SkillCertification {
        string skillName;
        uint256 level; // 1-10
        uint256 projectsCompleted;
        uint256 totalValue;
        uint256 averageRating;
        uint256 certifiedAt;
        address certifier;
    }
    
    mapping(uint256 => NFTMetadata) public nftMetadata;
    mapping(address => mapping(string => SkillCertification)) public skillCertifications;
    mapping(address => uint256[]) public userNFTs;
    mapping(NFTType => uint256) public nftTypeCounts;
    mapping(Rarity => string) public rarityColors;
    
    // Achievement tracking
    mapping(address => mapping(SkillFiRewards.AchievementType => bool)) public achievementNFTMinted;
    
    // Events
    event NFTMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        NFTType nftType,
        Rarity rarity,
        string title
    );
    
    event SkillCertified(
        address indexed user,
        string skill,
        uint256 level,
        uint256 tokenId
    );
    
    constructor(
        address _escrow,
        address _rewards
    ) ERC721("SkillFi Certificates", "SKILLNFT") {
        escrow = SkillFiEscrow(_escrow);
        rewards = SkillFiRewards(_rewards);
        
        // Initialize rarity colors
        rarityColors[Rarity.Common] = "#CD7F32";     // Bronze
        rarityColors[Rarity.Uncommon] = "#C0C0C0";   // Silver
        rarityColors[Rarity.Rare] = "#FFD700";       // Gold
        rarityColors[Rarity.Epic] = "#E5E4E2";       // Platinum
        rarityColors[Rarity.Legendary] = "#B9F2FF";  // Diamond
    }
    
    /**
     * @dev Mint project completion certificate
     */
    function mintProjectCompletion(
        uint256 projectId,
        address recipient
    ) external returns (uint256) {
        require(msg.sender == address(escrow), "Only escrow can mint");
        
        SkillFiEscrow.Project memory project = escrow.getProject(projectId);
        require(project.status == SkillFiEscrow.ProjectStatus.Completed, "Project not completed");
        require(
            recipient == project.client || recipient == project.freelancer,
            "Recipient not involved in project"
        );
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        // Determine rarity based on project value
        Rarity rarity = _determineProjectRarity(project.totalAmount);
        
        // Create metadata
        string[] memory attributes = new string[](4);
        attributes[0] = string(abi.encodePacked("Project Value: ", (project.totalAmount / 10**18).toString(), " SKILL"));
        attributes[1] = string(abi.encodePacked("Role: ", recipient == project.client ? "Client" : "Freelancer"));
        attributes[2] = string(abi.encodePacked("Skills: ", _arrayToString(project.skills)));
        attributes[3] = string(abi.encodePacked("Completion Date: ", block.timestamp.toString()));
        
        nftMetadata[tokenId] = NFTMetadata({
            id: tokenId,
            nftType: NFTType.ProjectCompletion,
            rarity: rarity,
            title: string(abi.encodePacked("Project Completion: ", project.title)),
            description: string(abi.encodePacked("Certificate of completion for project: ", project.title)),
            projectId: projectId,
            recipient: recipient,
            mintedAt: block.timestamp,
            value: project.totalAmount,
            attributes: attributes,
            isTransferable: true
        });
        
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        
        userNFTs[recipient].push(tokenId);
        nftTypeCounts[NFTType.ProjectCompletion]++;
        
        emit NFTMinted(tokenId, recipient, NFTType.ProjectCompletion, rarity, nftMetadata[tokenId].title);
        
        return tokenId;
    }
    
    /**
     * @dev Mint achievement NFT
     */
    function mintAchievement(
        address recipient,
        SkillFiRewards.AchievementType achievement
    ) external returns (uint256) {
        require(msg.sender == address(rewards), "Only rewards contract can mint");
        require(!achievementNFTMinted[recipient][achievement], "Achievement NFT already minted");
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        achievementNFTMinted[recipient][achievement] = true;
        
        // Determine rarity and details based on achievement type
        (Rarity rarity, string memory title, string memory description) = _getAchievementDetails(achievement);
        
        string[] memory attributes = new string[](3);
        attributes[0] = string(abi.encodePacked("Achievement: ", title));
        attributes[1] = string(abi.encodePacked("Earned Date: ", block.timestamp.toString()));
        attributes[2] = "Type: Achievement Badge";
        
        nftMetadata[tokenId] = NFTMetadata({
            id: tokenId,
            nftType: NFTType.Achievement,
            rarity: rarity,
            title: title,
            description: description,
            projectId: 0,
            recipient: recipient,
            mintedAt: block.timestamp,
            value: 0,
            attributes: attributes,
            isTransferable: false // Achievement NFTs are soulbound
        });
        
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        
        userNFTs[recipient].push(tokenId);
        nftTypeCounts[NFTType.Achievement]++;
        
        emit NFTMinted(tokenId, recipient, NFTType.Achievement, rarity, title);
        
        return tokenId;
    }
    
    /**
     * @dev Mint skill certification NFT
     */
    function mintSkillCertification(
        address recipient,
        string memory skillName,
        uint256 level,
        uint256 projectsCompleted,
        uint256 totalValue,
        uint256 averageRating
    ) external onlyOwner returns (uint256) {
        require(level >= 1 && level <= 10, "Invalid skill level");
        require(projectsCompleted > 0, "No projects completed");
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        // Store skill certification
        skillCertifications[recipient][skillName] = SkillCertification({
            skillName: skillName,
            level: level,
            projectsCompleted: projectsCompleted,
            totalValue: totalValue,
            averageRating: averageRating,
            certifiedAt: block.timestamp,
            certifier: msg.sender
        });
        
        // Determine rarity based on level and performance
        Rarity rarity = _determineSkillRarity(level, averageRating);
        
        string[] memory attributes = new string[](6);
        attributes[0] = string(abi.encodePacked("Skill: ", skillName));
        attributes[1] = string(abi.encodePacked("Level: ", level.toString()));
        attributes[2] = string(abi.encodePacked("Projects: ", projectsCompleted.toString()));
        attributes[3] = string(abi.encodePacked("Total Value: ", (totalValue / 10**18).toString(), " SKILL"));
        attributes[4] = string(abi.encodePacked("Average Rating: ", (averageRating / 10).toString(), ".", (averageRating % 10).toString()));
        attributes[5] = string(abi.encodePacked("Certified Date: ", block.timestamp.toString()));
        
        nftMetadata[tokenId] = NFTMetadata({
            id: tokenId,
            nftType: NFTType.Skill,
            rarity: rarity,
            title: string(abi.encodePacked(skillName, " Certification - Level ", level.toString())),
            description: string(abi.encodePacked("Official certification for ", skillName, " skill at level ", level.toString())),
            projectId: 0,
            recipient: recipient,
            mintedAt: block.timestamp,
            value: totalValue,
            attributes: attributes,
            isTransferable: true
        });
        
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        
        userNFTs[recipient].push(tokenId);
        nftTypeCounts[NFTType.Skill]++;
        
        emit NFTMinted(tokenId, recipient, NFTType.Skill, rarity, nftMetadata[tokenId].title);
        emit SkillCertified(recipient, skillName, level, tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev Mint special milestone NFT
     */
    function mintMilestone(
        address recipient,
        string memory title,
        string memory description,
        Rarity rarity,
        string[] memory attributes
    ) external onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        nftMetadata[tokenId] = NFTMetadata({
            id: tokenId,
            nftType: NFTType.Milestone,
            rarity: rarity,
            title: title,
            description: description,
            projectId: 0,
            recipient: recipient,
            mintedAt: block.timestamp,
            value: 0,
            attributes: attributes,
            isTransferable: true
        });
        
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        
        userNFTs[recipient].push(tokenId);
        nftTypeCounts[NFTType.Milestone]++;
        
        emit NFTMinted(tokenId, recipient, NFTType.Milestone, rarity, title);
        
        return tokenId;
    }
    
    /**
     * @dev Generate token URI with on-chain metadata
     */
    function _generateTokenURI(uint256 tokenId) internal view returns (string memory) {
        NFTMetadata memory metadata = nftMetadata[tokenId];
        
        string memory svg = _generateSVG(metadata);
        string memory attributes = _generateAttributes(metadata);
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "', metadata.title, '",',
                        '"description": "', metadata.description, '",',
                        '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                        '"attributes": [', attributes, ']}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    /**
     * @dev Generate SVG image for NFT
     */
    function _generateSVG(NFTMetadata memory metadata) internal view returns (string memory) {
        string memory rarityColor = rarityColors[metadata.rarity];
        string memory nftTypeText = _getNFTTypeText(metadata.nftType);
        string memory rarityText = _getRarityText(metadata.rarity);
        
        return string(
            abi.encodePacked(
                '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
                '<defs>',
                '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#1a1a2e"/>',
                '<stop offset="100%" style="stop-color:#16213e"/>',
                '</linearGradient>',
                '<linearGradient id="border" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:', rarityColor, '"/>',
                '<stop offset="100%" style="stop-color:', rarityColor, ';stop-opacity:0.7"/>',
                '</linearGradient>',
                '</defs>',
                '<rect width="400" height="400" fill="url(#bg)"/>',
                '<rect x="10" y="10" width="380" height="380" fill="none" stroke="url(#border)" stroke-width="4"/>',
                '<text x="200" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">SkillFi</text>',
                '<text x="200" y="100" text-anchor="middle" fill="', rarityColor, '" font-size="18">', nftTypeText, '</text>',
                '<text x="200" y="130" text-anchor="middle" fill="', rarityColor, '" font-size="14">', rarityText, '</text>',
                '<text x="200" y="200" text-anchor="middle" fill="white" font-size="16" font-weight="bold">', _truncateString(metadata.title, 25), '</text>',
                '<text x="200" y="250" text-anchor="middle" fill="#cccccc" font-size="12">', _truncateString(metadata.description, 35), '</text>',
                '<text x="200" y="320" text-anchor="middle" fill="#888888" font-size="10">Token ID: ', metadata.id.toString(), '</text>',
                '<text x="200" y="340" text-anchor="middle" fill="#888888" font-size="10">Minted: ', _formatDate(metadata.mintedAt), '</text>',
                '</svg>'
            )
        );
    }
    
    /**
     * @dev Generate JSON attributes for metadata
     */
    function _generateAttributes(NFTMetadata memory metadata) internal pure returns (string memory) {
        string memory baseAttributes = string(
            abi.encodePacked(
                '{"trait_type": "Type", "value": "', _getNFTTypeText(metadata.nftType), '"},',
                '{"trait_type": "Rarity", "value": "', _getRarityText(metadata.rarity), '"},',
                '{"trait_type": "Minted", "value": "', metadata.mintedAt.toString(), '"}'
            )
        );
        
        if (metadata.value > 0) {
            baseAttributes = string(
                abi.encodePacked(
                    baseAttributes,
                    ',{"trait_type": "Value", "value": "', (metadata.value / 10**18).toString(), ' SKILL"}'
                )
            );
        }
        
        // Add custom attributes
        for (uint i = 0; i < metadata.attributes.length; i++) {
            if (bytes(metadata.attributes[i]).length > 0) {
                baseAttributes = string(
                    abi.encodePacked(
                        baseAttributes,
                        ',{"trait_type": "Info", "value": "', metadata.attributes[i], '"}'
                    )
                );
            }
        }
        
        return baseAttributes;
    }
    
    /**
     * @dev Determine project completion rarity based on value
     */
    function _determineProjectRarity(uint256 projectValue) internal pure returns (Rarity) {
        uint256 valueInSkill = projectValue / 10**18;
        
        if (valueInSkill >= 100000) return Rarity.Legendary;  // 100k+ SKILL
        if (valueInSkill >= 50000) return Rarity.Epic;        // 50k+ SKILL
        if (valueInSkill >= 10000) return Rarity.Rare;        // 10k+ SKILL
        if (valueInSkill >= 1000) return Rarity.Uncommon;     // 1k+ SKILL
        return Rarity.Common;                                  // < 1k SKILL
    }
    
    /**
     * @dev Determine skill certification rarity
     */
    function _determineSkillRarity(uint256 level, uint256 averageRating) internal pure returns (Rarity) {
        if (level >= 9 && averageRating >= 48) return Rarity.Legendary; // Level 9-10, 4.8+ rating
        if (level >= 7 && averageRating >= 45) return Rarity.Epic;      // Level 7-8, 4.5+ rating
        if (level >= 5 && averageRating >= 40) return Rarity.Rare;      // Level 5-6, 4.0+ rating
        if (level >= 3 && averageRating >= 35) return Rarity.Uncommon;  // Level 3-4, 3.5+ rating
        return Rarity.Common;                                            // Level 1-2 or low rating
    }
    
    /**
     * @dev Get achievement details
     */
    function _getAchievementDetails(SkillFiRewards.AchievementType achievement) internal pure returns (
        Rarity rarity,
        string memory title,
        string memory description
    ) {
        if (achievement == SkillFiRewards.AchievementType.FirstProject) {
            return (Rarity.Common, "First Steps", "Completed your first project on SkillFi");
        } else if (achievement == SkillFiRewards.AchievementType.ProjectStreak) {
            return (Rarity.Uncommon, "Streak Master", "Completed 10 projects in a row");
        } else if (achievement == SkillFiRewards.AchievementType.HighRating) {
            return (Rarity.Rare, "Excellence", "Maintained 4.8+ average rating");
        } else if (achievement == SkillFiRewards.AchievementType.VolumeTrader) {
            return (Rarity.Epic, "High Roller", "Earned over 100,000 SKILL tokens");
        } else if (achievement == SkillFiRewards.AchievementType.CommunityHelper) {
            return (Rarity.Rare, "Community Builder", "Referred 50+ users to SkillFi");
        } else if (achievement == SkillFiRewards.AchievementType.EarlyAdopter) {
            return (Rarity.Legendary, "Pioneer", "Early adopter of SkillFi platform");
        } else if (achievement == SkillFiRewards.AchievementType.Specialist) {
            return (Rarity.Epic, "Specialist", "Master of specialized skills");
        } else if (achievement == SkillFiRewards.AchievementType.Mentor) {
            return (Rarity.Legendary, "Mentor", "Guided and mentored other users");
        }
        
        return (Rarity.Common, "Achievement", "Special achievement unlocked");
    }
    
    /**
     * @dev Helper functions
     */
    function _getNFTTypeText(NFTType nftType) internal pure returns (string memory) {
        if (nftType == NFTType.ProjectCompletion) return "Project Certificate";
        if (nftType == NFTType.Achievement) return "Achievement Badge";
        if (nftType == NFTType.Skill) return "Skill Certification";
        if (nftType == NFTType.Milestone) return "Milestone Badge";
        if (nftType == NFTType.Reputation) return "Reputation Badge";
        if (nftType == NFTType.Event) return "Event Badge";
        return "Certificate";
    }
    
    function _getRarityText(Rarity rarity) internal pure returns (string memory) {
        if (rarity == Rarity.Common) return "Common";
        if (rarity == Rarity.Uncommon) return "Uncommon";
        if (rarity == Rarity.Rare) return "Rare";
        if (rarity == Rarity.Epic) return "Epic";
        if (rarity == Rarity.Legendary) return "Legendary";
        return "Unknown";
    }
    
    function _arrayToString(string[] memory array) internal pure returns (string memory) {
        if (array.length == 0) return "";
        
        string memory result = array[0];
        for (uint i = 1; i < array.length && i < 3; i++) { // Limit to 3 skills
            result = string(abi.encodePacked(result, ", ", array[i]));
        }
        return result;
    }
    
    function _truncateString(string memory str, uint256 maxLength) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLength) return str;
        
        bytes memory truncated = new bytes(maxLength - 3);
        for (uint i = 0; i < maxLength - 3; i++) {
            truncated[i] = strBytes[i];
        }
        return string(abi.encodePacked(truncated, "..."));
    }
    
    function _formatDate(uint256 timestamp) internal pure returns (string memory) {
        // Simple date formatting (just return timestamp for now)
        return timestamp.toString();
    }
    
    /**
     * @dev Override transfer functions for soulbound tokens
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Allow minting and burning
        if (from == address(0) || to == address(0)) return;
        
        // Check if token is transferable
        require(nftMetadata[tokenId].isTransferable, "Token is soulbound");
    }
    
    /**
     * @dev Get user's NFTs
     */
    function getUserNFTs(address user) external view returns (uint256[] memory) {
        return userNFTs[user];
    }
    
    /**
     * @dev Get NFT metadata
     */
    function getNFTMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        return nftMetadata[tokenId];
    }
    
    /**
     * @dev Get skill certification
     */
    function getSkillCertification(address user, string memory skill) external view returns (SkillCertification memory) {
        return skillCertifications[user][skill];
    }
    
    /**
     * @dev Override required functions
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}