// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SkillToken.sol";
import "./SkillFiDAO.sol";

/**
 * @title SkillFiEscrow
 * @dev Advanced escrow system with anti-scam mechanisms and DAO dispute resolution
 */
contract SkillFiEscrow is ReentrancyGuard, Pausable, Ownable {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;
    
    Counters.Counter private _projectIds;
    
    SkillToken public immutable skillToken;
    SkillFiDAO public immutable dao;
    
    // Project states
    enum ProjectStatus {
        Open,           // 0 - Accepting proposals
        InProgress,     // 1 - Work in progress
        Submitted,      // 2 - Work submitted, awaiting approval
        Completed,      // 3 - Completed and paid
        Disputed,       // 4 - In dispute resolution
        Cancelled       // 5 - Cancelled
    }
    
    // Milestone structure for complex projects
    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        bool completed;
        bool approved;
    }
    
    // Project structure
    struct Project {
        uint256 id;
        address client;
        address freelancer;
        string title;
        string description;
        uint256 totalAmount;
        uint256 deadline;
        ProjectStatus status;
        uint256 createdAt;
        uint256 lastActivity;
        string[] skills;
        Milestone[] milestones;
        uint256 disputeId;
        bool hasMilestones;
    }
    
    // Reputation and rating system
    struct UserReputation {
        uint256 totalRating;
        uint256 ratingCount;
        uint256 completedProjects;
        uint256 totalEarned;
        bool isVerified;
        uint256 stakeAmount;
    }
    
    // Anti-scam mechanisms
    struct AntiScamData {
        uint256 requiredStake;
        uint256 maxProjectValue;
        bool requiresVerification;
        uint256 cooldownPeriod;
        mapping(address => uint256) lastProjectTime;
        mapping(address => uint256) activeProjects;
    }
    
    // Storage
    mapping(uint256 => Project) public projects;
    mapping(address => UserReputation) public userReputations;
    mapping(uint256 => mapping(address => uint256)) public ratings; // projectId => rater => rating
    mapping(address => uint256[]) public userProjects;
    
    AntiScamData public antiScamData;
    
    // Platform settings
    uint256 public platformFee = 250; // 2.5%
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant MIN_STAKE_AMOUNT = 100 * 10**18; // 100 SKILL tokens
    uint256 public constant MAX_PROJECT_DURATION = 180 days;
    uint256 public constant DISPUTE_TIMEOUT = 7 days;
    
    address public platformTreasury;
    
    // Events
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed client,
        string title,
        uint256 amount,
        bool hasMilestones
    );
    
    event ProposalAccepted(
        uint256 indexed projectId,
        address indexed freelancer,
        uint256 amount
    );
    
    event MilestoneCompleted(
        uint256 indexed projectId,
        uint256 milestoneIndex,
        uint256 amount
    );
    
    event ProjectCompleted(
        uint256 indexed projectId,
        address indexed freelancer,
        uint256 totalAmount
    );
    
    event DisputeRaised(
        uint256 indexed projectId,
        address indexed initiator,
        uint256 disputeId
    );
    
    event UserRated(
        uint256 indexed projectId,
        address indexed rater,
        address indexed target,
        uint256 rating
    );
    
    event StakeDeposited(address indexed user, uint256 amount);
    event StakeWithdrawn(address indexed user, uint256 amount);
    
    modifier onlyProjectParticipant(uint256 projectId) {
        Project storage project = projects[projectId];
        require(
            msg.sender == project.client || msg.sender == project.freelancer,
            "Not project participant"
        );
        _;
    }
    
    modifier validProject(uint256 projectId) {
        require(projects[projectId].id != 0, "Project does not exist");
        _;
    }
    
    modifier antiScamCheck(address user, uint256 amount) {
        require(
            block.timestamp >= antiScamData.lastProjectTime[user] + antiScamData.cooldownPeriod,
            "Cooldown period not met"
        );
        require(
            antiScamData.activeProjects[user] < 5,
            "Too many active projects"
        );
        require(
            amount <= antiScamData.maxProjectValue || userReputations[user].isVerified,
            "Amount exceeds limit for unverified users"
        );
        _;
    }
    
    constructor(
        address _skillToken,
        address _dao,
        address _platformTreasury
    ) {
        skillToken = SkillToken(_skillToken);
        dao = SkillFiDAO(_dao);
        platformTreasury = _platformTreasury;
        
        // Initialize anti-scam settings
        antiScamData.requiredStake = MIN_STAKE_AMOUNT;
        antiScamData.maxProjectValue = 10000 * 10**18; // 10,000 SKILL for unverified
        antiScamData.requiresVerification = false;
        antiScamData.cooldownPeriod = 1 hours;
    }
    
    /**
     * @dev Create a new project with escrow
     */
    function createProject(
        string memory title,
        string memory description,
        uint256 amount,
        uint256 deadline,
        string[] memory skills,
        Milestone[] memory milestones
    ) external nonReentrant whenNotPaused antiScamCheck(msg.sender, amount) {
        require(amount > 0, "Amount must be greater than 0");
        require(deadline > block.timestamp, "Invalid deadline");
        require(deadline <= block.timestamp + MAX_PROJECT_DURATION, "Deadline too far");
        require(bytes(title).length > 0, "Title required");
        
        // Check user has sufficient stake
        require(
            userReputations[msg.sender].stakeAmount >= antiScamData.requiredStake,
            "Insufficient stake"
        );
        
        _projectIds.increment();
        uint256 projectId = _projectIds.current();
        
        // Transfer tokens to escrow
        skillToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create project
        Project storage project = projects[projectId];
        project.id = projectId;
        project.client = msg.sender;
        project.title = title;
        project.description = description;
        project.totalAmount = amount;
        project.deadline = deadline;
        project.status = ProjectStatus.Open;
        project.createdAt = block.timestamp;
        project.lastActivity = block.timestamp;
        project.skills = skills;
        project.hasMilestones = milestones.length > 0;
        
        // Add milestones if provided
        for (uint i = 0; i < milestones.length; i++) {
            project.milestones.push(milestones[i]);
        }
        
        userProjects[msg.sender].push(projectId);
        antiScamData.activeProjects[msg.sender]++;
        antiScamData.lastProjectTime[msg.sender] = block.timestamp;
        
        emit ProjectCreated(projectId, msg.sender, title, amount, project.hasMilestones);
    }
    
    /**
     * @dev Accept a freelancer for the project
     */
    function acceptFreelancer(
        uint256 projectId,
        address freelancer
    ) external validProject(projectId) nonReentrant {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client can accept");
        require(project.status == ProjectStatus.Open, "Project not open");
        require(freelancer != project.client, "Cannot accept self");
        
        // Check freelancer has sufficient stake
        require(
            userReputations[freelancer].stakeAmount >= antiScamData.requiredStake,
            "Freelancer has insufficient stake"
        );
        
        project.freelancer = freelancer;
        project.status = ProjectStatus.InProgress;
        project.lastActivity = block.timestamp;
        
        userProjects[freelancer].push(projectId);
        antiScamData.activeProjects[freelancer]++;
        
        emit ProposalAccepted(projectId, freelancer, project.totalAmount);
    }
    
    /**
     * @dev Submit work for approval
     */
    function submitWork(uint256 projectId) external validProject(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.freelancer, "Only freelancer can submit");
        require(project.status == ProjectStatus.InProgress, "Invalid status");
        
        project.status = ProjectStatus.Submitted;
        project.lastActivity = block.timestamp;
    }
    
    /**
     * @dev Complete milestone
     */
    function completeMilestone(
        uint256 projectId,
        uint256 milestoneIndex
    ) external validProject(projectId) nonReentrant {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client can approve");
        require(project.hasMilestones, "Project has no milestones");
        require(milestoneIndex < project.milestones.length, "Invalid milestone");
        require(!project.milestones[milestoneIndex].completed, "Already completed");
        
        Milestone storage milestone = project.milestones[milestoneIndex];
        milestone.completed = true;
        milestone.approved = true;
        
        uint256 amount = milestone.amount;
        uint256 platformFeeAmount = (amount * platformFee) / FEE_DENOMINATOR;
        uint256 freelancerAmount = amount - platformFeeAmount;
        
        // Transfer payments
        skillToken.safeTransfer(project.freelancer, freelancerAmount);
        skillToken.safeTransfer(platformTreasury, platformFeeAmount);
        
        // Update reputation
        userReputations[project.freelancer].totalEarned += freelancerAmount;
        
        project.lastActivity = block.timestamp;
        
        emit MilestoneCompleted(projectId, milestoneIndex, amount);
        
        // Check if all milestones completed
        bool allCompleted = true;
        for (uint i = 0; i < project.milestones.length; i++) {
            if (!project.milestones[i].completed) {
                allCompleted = false;
                break;
            }
        }
        
        if (allCompleted) {
            _completeProject(projectId);
        }
    }
    
    /**
     * @dev Complete project and release payment
     */
    function completeProject(uint256 projectId) external validProject(projectId) nonReentrant {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client can complete");
        require(
            project.status == ProjectStatus.Submitted || 
            project.status == ProjectStatus.InProgress,
            "Invalid status"
        );
        require(!project.hasMilestones, "Use milestone completion for milestone projects");
        
        _completeProject(projectId);
    }
    
    /**
     * @dev Internal function to complete project
     */
    function _completeProject(uint256 projectId) internal {
        Project storage project = projects[projectId];
        
        if (!project.hasMilestones) {
            uint256 platformFeeAmount = (project.totalAmount * platformFee) / FEE_DENOMINATOR;
            uint256 freelancerAmount = project.totalAmount - platformFeeAmount;
            
            // Transfer payments
            skillToken.safeTransfer(project.freelancer, freelancerAmount);
            skillToken.safeTransfer(platformTreasury, platformFeeAmount);
            
            // Update reputation
            userReputations[project.freelancer].totalEarned += freelancerAmount;
        }
        
        project.status = ProjectStatus.Completed;
        project.lastActivity = block.timestamp;
        
        // Update counters
        userReputations[project.client].completedProjects++;
        userReputations[project.freelancer].completedProjects++;
        antiScamData.activeProjects[project.client]--;
        antiScamData.activeProjects[project.freelancer]--;
        
        emit ProjectCompleted(projectId, project.freelancer, project.totalAmount);
    }
    
    /**
     * @dev Raise a dispute
     */
    function raiseDispute(
        uint256 projectId,
        string memory reason
    ) external validProject(projectId) onlyProjectParticipant(projectId) {
        Project storage project = projects[projectId];
        require(
            project.status == ProjectStatus.InProgress || 
            project.status == ProjectStatus.Submitted,
            "Cannot dispute at this stage"
        );
        require(project.disputeId == 0, "Dispute already exists");
        
        project.status = ProjectStatus.Disputed;
        project.lastActivity = block.timestamp;
        
        // Create dispute in DAO
        uint256 disputeId = dao.createDispute(
            projectId,
            project.client,
            project.freelancer,
            project.totalAmount,
            reason
        );
        
        project.disputeId = disputeId;
        
        emit DisputeRaised(projectId, msg.sender, disputeId);
    }
    
    /**
     * @dev Resolve dispute based on DAO decision
     */
    function resolveDispute(uint256 projectId) external validProject(projectId) {
        Project storage project = projects[projectId];
        require(project.status == ProjectStatus.Disputed, "Not in dispute");
        require(project.disputeId != 0, "No dispute ID");
        
        // Get dispute result from DAO
        SkillFiDAO.Dispute memory dispute = dao.getDispute(project.disputeId);
        require(dispute.resolved, "Dispute not resolved yet");
        
        uint256 platformFeeAmount = (project.totalAmount * platformFee) / FEE_DENOMINATOR;
        uint256 remainingAmount = project.totalAmount - platformFeeAmount;
        
        if (dispute.winner == project.client) {
            // Refund client
            skillToken.safeTransfer(project.client, remainingAmount);
        } else if (dispute.winner == project.freelancer) {
            // Pay freelancer
            skillToken.safeTransfer(project.freelancer, remainingAmount);
            userReputations[project.freelancer].totalEarned += remainingAmount;
        } else {
            // Split funds
            uint256 halfAmount = remainingAmount / 2;
            skillToken.safeTransfer(project.client, halfAmount);
            skillToken.safeTransfer(project.freelancer, remainingAmount - halfAmount);
            userReputations[project.freelancer].totalEarned += (remainingAmount - halfAmount);
        }
        
        // Platform fee
        skillToken.safeTransfer(platformTreasury, platformFeeAmount);
        
        project.status = ProjectStatus.Completed;
        project.lastActivity = block.timestamp;
        
        // Update counters
        antiScamData.activeProjects[project.client]--;
        antiScamData.activeProjects[project.freelancer]--;
    }
    
    /**
     * @dev Rate a user after project completion
     */
    function rateUser(
        uint256 projectId,
        address target,
        uint256 rating
    ) external validProject(projectId) onlyProjectParticipant(projectId) {
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        require(ratings[projectId][msg.sender] == 0, "Already rated");
        
        Project storage project = projects[projectId];
        require(project.status == ProjectStatus.Completed, "Project not completed");
        require(target == project.client || target == project.freelancer, "Invalid target");
        require(target != msg.sender, "Cannot rate yourself");
        
        ratings[projectId][msg.sender] = rating;
        
        UserReputation storage reputation = userReputations[target];
        reputation.totalRating += rating;
        reputation.ratingCount++;
        
        emit UserRated(projectId, msg.sender, target, rating);
    }
    
    /**
     * @dev Deposit stake to participate in platform
     */
    function depositStake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        skillToken.safeTransferFrom(msg.sender, address(this), amount);
        userReputations[msg.sender].stakeAmount += amount;
        
        emit StakeDeposited(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw stake (if no active projects)
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(
            userReputations[msg.sender].stakeAmount >= amount,
            "Insufficient stake"
        );
        require(
            antiScamData.activeProjects[msg.sender] == 0,
            "Cannot withdraw with active projects"
        );
        require(
            userReputations[msg.sender].stakeAmount - amount >= MIN_STAKE_AMOUNT,
            "Must maintain minimum stake"
        );
        
        userReputations[msg.sender].stakeAmount -= amount;
        skillToken.safeTransfer(msg.sender, amount);
        
        emit StakeWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Verify user (only owner)
     */
    function verifyUser(address user) external onlyOwner {
        userReputations[user].isVerified = true;
    }
    
    /**
     * @dev Get user's average rating
     */
    function getUserRating(address user) external view returns (uint256) {
        UserReputation memory reputation = userReputations[user];
        if (reputation.ratingCount == 0) return 0;
        return reputation.totalRating / reputation.ratingCount;
    }
    
    /**
     * @dev Get project details
     */
    function getProject(uint256 projectId) external view returns (Project memory) {
        return projects[projectId];
    }
    
    /**
     * @dev Get user's projects
     */
    function getUserProjects(address user) external view returns (uint256[] memory) {
        return userProjects[user];
    }
    
    /**
     * @dev Emergency functions
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function updatePlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee cannot exceed 10%");
        platformFee = _fee;
    }
    
    function updateAntiScamSettings(
        uint256 _requiredStake,
        uint256 _maxProjectValue,
        uint256 _cooldownPeriod
    ) external onlyOwner {
        antiScamData.requiredStake = _requiredStake;
        antiScamData.maxProjectValue = _maxProjectValue;
        antiScamData.cooldownPeriod = _cooldownPeriod;
    }
}