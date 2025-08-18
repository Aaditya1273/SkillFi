// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SkillFiNFT
 * @dev NFT contract for SkillFi achievements, certifications, and reputation badges
 */
contract SkillFiNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, Pausable {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    Counters.Counter private _tokenIds;
    
    // Achievement types
    enum AchievementType {
        ProjectCompletion,    // 0 - Complete X projects
        HighRating,          // 1 - Maintain high rating
        EarningMilestone,    // 2 - Earn X SKILL tokens
        SkillCertification,  // 3 - Skill-specific certification
        CommunityContribution, // 4 - DAO participation
        LoyaltyBadge,        // 5 - Platform loyalty
        SpecialEvent         // 6 - Special events/campaigns
    }
    
    // Achievement tiers
    enum AchievementTier {
        Bronze,   // 0
        Silver,   // 1
        Gold,     // 2
        Platinum, // 3
        Diamond   // 4
    }
    
    struct Achievement {
        uint256 id;
        AchievementType achievementType;
        AchievementTier tier;
        string title;
        string description;
        string skill; // For skill certifications
        uint256 threshold; // Required value to earn
        uint256 earnedAt;
        address earner;
        bool isActive;
        string metadataURI;
    }
    
    struct UserStats {
        uint256 totalAchievements;
        uint256 projectsCompleted;
        uint256 totalEarned;
        uint256 averageRating;
        uint256 daoParticipation;
        mapping(AchievementType => uint256) achievementCounts;
        mapping(string => bool) skillCertifications;
    }
    
    mapping(uint256 => Achievement) public achievements;
    mapping(address => UserStats) public userStats;
    mapping(address => uint256[]) public userAchievements;
    mapping(bytes32 => bool) public achievementExists; // Hash of type+tier+skill
    
    // Authorized contracts that can mint achievements
    mapping(address => bool) public authorizedMinters;
    
    // Achievement templates
    mapping(bytes32 => Achievement) public achievementTemplates;
    
    string private _baseTokenURI;
    
    event AchievementEarned(
        address indexed user,
        uint256 indexed tokenId,
        AchievementType achievementType,
        AchievementTier tier,
        string title
    );
    
    event AchievementTemplateCreated(
        bytes32 indexed templateId,
        AchievementType achievementType,
        AchievementTier tier,
        string title
    );
    
    event UserStatsUpdated(
        address indexed user,
        uint256 projectsCompleted,
        uint256 totalEarned,
        uint256 averageRating
    );
    
    modifier onlyAuthorized() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }
    
    constructor(string memory baseURI) ERC721("SkillFi Achievement NFT", "SKILLNFT") {
        _baseTokenURI = baseURI;
        _initializeAchievementTemplates();
    }
    
    /**
     * @dev Initialize default achievement templates
     */
    function _initializeAchievementTemplates() internal {
        // Project completion achievements
        _createAchievementTemplate(
            AchievementType.ProjectCompletion,
            AchievementTier.Bronze,
            "First Steps",
            "Complete your first project on SkillFi",
            "",
            1
        );
        
        _createAchievementTemplate(
            AchievementType.ProjectCompletion,
            AchievementTier.Silver,
            "Getting Started",
            "Complete 5 projects on SkillFi",
            "",
            5
        );
        
        _createAchievementTemplate(
            AchievementType.ProjectCompletion,
            AchievementTier.Gold,
            "Experienced Freelancer",
            "Complete 25 projects on SkillFi",
            "",
            25
        );
        
        _createAchievementTemplate(
            AchievementType.ProjectCompletion,
            AchievementTier.Platinum,
            "Veteran Contributor",
            "Complete 100 projects on SkillFi",
            "",
            100
        );
        
        // High rating achievements
        _createAchievementTemplate(
            AchievementType.HighRating,
            AchievementTier.Gold,
            "Excellence Award",
            "Maintain 4.8+ average rating with 10+ projects",
            "",
            48 // 4.8 * 10
        );
        
        _createAchievementTemplate(
            AchievementType.HighRating,
            AchievementTier.Platinum,
            "Perfect Reputation",
            "Maintain 4.9+ average rating with 25+ projects",
            "",
            49 // 4.9 * 10
        );
        
        // Earning milestones
        _createAchievementTemplate(
            AchievementType.EarningMilestone,
            AchievementTier.Bronze,
            "First Earnings",
            "Earn your first 1,000 SKILL tokens",
            "",
            1000
        );
        
        _createAchievementTemplate(
            AchievementType.EarningMilestone,
            AchievementTier.Silver,
            "Rising Earner",
            "Earn 10,000 SKILL tokens",
            "",
            10000
        );
        
        _createAchievementTemplate(
            AchievementType.EarningMilestone,
            AchievementTier.Gold,
            "High Earner",
            "Earn 100,000 SKILL tokens",
            "",
            100000
        );
        
        _createAchievementTemplate(
            AchievementType.EarningMilestone,
            AchievementTier.Diamond,
            "Elite Earner",
            "Earn 1,000,000 SKILL tokens",
            "",
            1000000
        );
    }
    
    /**
     * @dev Create achievement template
     */
    function _createAchievementTemplate(
        AchievementType achievementType,
        AchievementTier tier,
        string memory title,
        string memory description,
        string memory skill,
        uint256 threshold
    ) internal {
        bytes32 templateId = keccak256(abi.encodePacked(achievementType, tier, skill));
        
        achievementTemplates[templateId] = Achievement({
            id: 0,
            achievementType: achievementType,
            tier: tier,
            title: title,
            description: description,
            skill: skill,
            threshold: threshold,
            earnedAt: 0,
            earner: address(0),
            isActive: true,
            metadataURI: ""
        });
        
        emit AchievementTemplateCreated(templateId, achievementType, tier, title);
    }
    
    /**
     * @dev Update user stats (called by authorized contracts)
     */
    function updateUserStats(
        address user,
        uint256 projectsCompleted,
        uint256 totalEarned,
        uint256 averageRating,
        uint256 daoParticipation
    ) external onlyAuthorized {
        UserStats storage stats = userStats[user];
        stats.projectsCompleted = projectsCompleted;
        stats.totalEarned = totalEarned;
        stats.averageRating = averageRating;
        stats.daoParticipation = daoParticipation;
        
        emit UserStatsUpdated(user, projectsCompleted, totalEarned, averageRating);
        
        // Check for new achievements
        _checkAndMintAchievements(user);
    }
    
    /**
     * @dev Check and mint eligible achievements
     */
    function _checkAndMintAchievements(address user) internal {
        UserStats storage stats = userStats[user];
        
        // Check project completion achievements
        _checkProjectCompletionAchievements(user, stats.projectsCompleted);
        
        // Check earning milestones
        _checkEarningMilestones(user, stats.totalEarned);
        
        // Check high rating achievements
        _checkHighRatingAchievements(user, stats.averageRating, stats.projectsCompleted);
    }
    
    /**
     * @dev Check project completion achievements
     */
    function _checkProjectCompletionAchievements(address user, uint256 projectsCompleted) internal {
        uint256[] memory thresholds = new uint256[](4);
        thresholds[0] = 1;   // Bronze
        thresholds[1] = 5;   // Silver
        thresholds[2] = 25;  // Gold
        thresholds[3] = 100; // Platinum
        
        for (uint256 i = 0; i < thresholds.length; i++) {
            if (projectsCompleted >= thresholds[i]) {
                bytes32 templateId = keccak256(abi.encodePacked(
                    AchievementType.ProjectCompletion,
                    AchievementTier(i),
                    ""
                ));
                
                if (!_hasAchievement(user, templateId)) {
                    _mintAchievementFromTemplate(user, templateId);
                }
            }
        }
    }
    
    /**
     * @dev Check earning milestone achievements
     */
    function _checkEarningMilestones(address user, uint256 totalEarned) internal {
        uint256[] memory thresholds = new uint256[](4);
        thresholds[0] = 1000;     // Bronze
        thresholds[1] = 10000;    // Silver
        thresholds[2] = 100000;   // Gold
        thresholds[3] = 1000000;  // Diamond
        
        AchievementTier[] memory tiers = new AchievementTier[](4);
        tiers[0] = AchievementTier.Bronze;
        tiers[1] = AchievementTier.Silver;
        tiers[2] = AchievementTier.Gold;
        tiers[3] = AchievementTier.Diamond;
        
        for (uint256 i = 0; i < thresholds.length; i++) {
            if (totalEarned >= thresholds[i]) {
                bytes32 templateId = keccak256(abi.encodePacked(
                    AchievementType.EarningMilestone,
                    tiers[i],
                    ""
                ));
                
                if (!_hasAchievement(user, templateId)) {
                    _mintAchievementFromTemplate(user, templateId);
                }
            }
        }
    }
    
    /**
     * @dev Check high rating achievements
     */
    function _checkHighRatingAchievements(address user, uint256 averageRating, uint256 projectsCompleted) internal {
        // Excellence Award: 4.8+ rating with 10+ projects
        if (averageRating >= 48 && projectsCompleted >= 10) {
            bytes32 templateId = keccak256(abi.encodePacked(
                AchievementType.HighRating,
                AchievementTier.Gold,
                ""
            ));
            
            if (!_hasAchievement(user, templateId)) {
                _mintAchievementFromTemplate(user, templateId);
            }
        }
        
        // Perfect Reputation: 4.9+ rating with 25+ projects
        if (averageRating >= 49 && projectsCompleted >= 25) {
            bytes32 templateId = keccak256(abi.encodePacked(
                AchievementType.HighRating,
                AchievementTier.Platinum,
                ""
            ));
            
            if (!_hasAchievement(user, templateId)) {
                _mintAchievementFromTemplate(user, templateId);
            }
        }
    }
    
    /**
     * @dev Check if user has specific achievement
     */
    function _hasAchievement(address user, bytes32 templateId) internal view returns (bool) {
        uint256[] memory userTokens = userAchievements[user];
        Achievement memory template = achievementTemplates[templateId];
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            Achievement memory achievement = achievements[userTokens[i]];
            if (achievement.achievementType == template.achievementType &&
                achievement.tier == template.tier &&
                keccak256(bytes(achievement.skill)) == keccak256(bytes(template.skill))) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Mint achievement from template
     */
    function _mintAchievementFromTemplate(address user, bytes32 templateId) internal {
        Achievement memory template = achievementTemplates[templateId];
        require(template.isActive, "Template not active");
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        achievements[tokenId] = Achievement({
            id: tokenId,
            achievementType: template.achievementType,
            tier: template.tier,
            title: template.title,
            description: template.description,
            skill: template.skill,
            threshold: template.threshold,
            earnedAt: block.timestamp,
            earner: user,
            isActive: true,
            metadataURI: _generateMetadataURI(template)
        });
        
        userAchievements[user].push(tokenId);
        userStats[user].totalAchievements++;
        userStats[user].achievementCounts[template.achievementType]++;
        
        _mint(user, tokenId);
        _setTokenURI(tokenId, achievements[tokenId].metadataURI);
        
        emit AchievementEarned(user, tokenId, template.achievementType, template.tier, template.title);
    }
    
    /**
     * @dev Mint skill certification NFT
     */
    function mintSkillCertification(
        address user,
        string memory skill,
        AchievementTier tier,
        string memory certificationBody
    ) external onlyAuthorized {
        require(!userStats[user].skillCertifications[skill], "Already certified in this skill");
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        string memory title = string(abi.encodePacked(skill, " Certification"));
        string memory description = string(abi.encodePacked(
            "Certified in ", skill, " by ", certificationBody
        ));
        
        achievements[tokenId] = Achievement({
            id: tokenId,
            achievementType: AchievementType.SkillCertification,
            tier: tier,
            title: title,
            description: description,
            skill: skill,
            threshold: 0,
            earnedAt: block.timestamp,
            earner: user,
            isActive: true,
            metadataURI: ""
        });
        
        achievements[tokenId].metadataURI = _generateCertificationMetadata(achievements[tokenId]);
        
        userAchievements[user].push(tokenId);
        userStats[user].totalAchievements++;
        userStats[user].achievementCounts[AchievementType.SkillCertification]++;
        userStats[user].skillCertifications[skill] = true;
        
        _mint(user, tokenId);
        _setTokenURI(tokenId, achievements[tokenId].metadataURI);
        
        emit AchievementEarned(user, tokenId, AchievementType.SkillCertification, tier, title);
    }
    
    /**
     * @dev Generate metadata URI for achievement
     */
    function _generateMetadataURI(Achievement memory achievement) internal pure returns (string memory) {
        string memory tierName = _getTierName(achievement.tier);
        string memory typeName = _getTypeName(achievement.achievementType);
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "', achievement.title, '",',
                        '"description": "', achievement.description, '",',
                        '"image": "', _generateImageURI(achievement), '",',
                        '"attributes": [',
                        '{"trait_type": "Type", "value": "', typeName, '"},',
                        '{"trait_type": "Tier", "value": "', tierName, '"},',
                        '{"trait_type": "Earned At", "value": ', achievement.earnedAt.toString(), '},',
                        '{"trait_type": "Threshold", "value": ', achievement.threshold.toString(), '}',
                        ']}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    /**
     * @dev Generate certification metadata
     */
    function _generateCertificationMetadata(Achievement memory achievement) internal pure returns (string memory) {
        string memory tierName = _getTierName(achievement.tier);
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "', achievement.title, '",',
                        '"description": "', achievement.description, '",',
                        '"image": "', _generateCertificationImageURI(achievement), '",',
                        '"attributes": [',
                        '{"trait_type": "Type", "value": "Skill Certification"},',
                        '{"trait_type": "Skill", "value": "', achievement.skill, '"},',
                        '{"trait_type": "Tier", "value": "', tierName, '"},',
                        '{"trait_type": "Earned At", "value": ', achievement.earnedAt.toString(), '}',
                        ']}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    /**
     * @dev Generate image URI for achievement
     */
    function _generateImageURI(Achievement memory achievement) internal pure returns (string memory) {
        // This would typically point to IPFS or a CDN with achievement images
        return string(abi.encodePacked(
            "https://skillfi.io/achievements/",
            _getTypeName(achievement.achievementType), "/",
            _getTierName(achievement.tier), ".png"
        ));
    }
    
    /**
     * @dev Generate image URI for certification
     */
    function _generateCertificationImageURI(Achievement memory achievement) internal pure returns (string memory) {
        return string(abi.encodePacked(
            "https://skillfi.io/certifications/",
            achievement.skill, "/",
            _getTierName(achievement.tier), ".png"
        ));
    }
    
    /**
     * @dev Get tier name string
     */
    function _getTierName(AchievementTier tier) internal pure returns (string memory) {
        if (tier == AchievementTier.Bronze) return "Bronze";
        if (tier == AchievementTier.Silver) return "Silver";
        if (tier == AchievementTier.Gold) return "Gold";
        if (tier == AchievementTier.Platinum) return "Platinum";
        if (tier == AchievementTier.Diamond) return "Diamond";
        return "Unknown";
    }
    
    /**
     * @dev Get achievement type name string
     */
    function _getTypeName(AchievementType achievementType) internal pure returns (string memory) {
        if (achievementType == AchievementType.ProjectCompletion) return "Project Completion";
        if (achievementType == AchievementType.HighRating) return "High Rating";
        if (achievementType == AchievementType.EarningMilestone) return "Earning Milestone";
        if (achievementType == AchievementType.SkillCertification) return "Skill Certification";
        if (achievementType == AchievementType.CommunityContribution) return "Community Contribution";
        if (achievementType == AchievementType.LoyaltyBadge) return "Loyalty Badge";
        if (achievementType == AchievementType.SpecialEvent) return "Special Event";
        return "Unknown";
    }
    
    /**
     * @dev Get user's achievements
     */
    function getUserAchievements(address user) external view returns (uint256[] memory) {
        return userAchievements[user];
    }
    
    /**
     * @dev Get user's achievement count by type
     */
    function getUserAchievementCount(address user, AchievementType achievementType) external view returns (uint256) {
        return userStats[user].achievementCounts[achievementType];
    }
    
    /**
     * @dev Check if user has skill certification
     */
    function hasSkillCertification(address user, string memory skill) external view returns (bool) {
        return userStats[user].skillCertifications[skill];
    }
    
    /**
     * @dev Add authorized minter
     */
    function addAuthorizedMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
    }
    
    /**
     * @dev Remove authorized minter
     */
    function removeAuthorizedMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
    }
    
    /**
     * @dev Create custom achievement template
     */
    function createAchievementTemplate(
        AchievementType achievementType,
        AchievementTier tier,
        string memory title,
        string memory description,
        string memory skill,
        uint256 threshold
    ) external onlyOwner {
        _createAchievementTemplate(achievementType, tier, title, description, skill, threshold);
    }
    
    /**
     * @dev Set base URI for token metadata
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Override required functions
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}