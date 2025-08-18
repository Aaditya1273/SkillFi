// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SkillToken.sol";
import "./SkillFiEscrow.sol";

/**
 * @title SkillFiInsurance
 * @dev Decentralized insurance system for project protection
 */
contract SkillFiInsurance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    SkillToken public immutable skillToken;
    SkillFiEscrow public immutable escrow;
    
    enum InsuranceType {
        ProjectCompletion,  // Protects against non-completion
        QualityAssurance,   // Protects against poor quality work
        TimelineProtection, // Protects against delays
        PaymentProtection   // Protects freelancers against non-payment
    }
    
    enum ClaimStatus {
        None,
        Submitted,
        UnderReview,
        Approved,
        Rejected,
        Paid
    }
    
    struct InsurancePolicy {
        InsuranceType policyType;
        uint256 premiumRate; // basis points (100 = 1%)
        uint256 coverageLimit; // maximum payout
        uint256 deductible;
        bool isActive;
        uint256 totalPremiums;
        uint256 totalClaims;
    }
    
    struct UserPolicy {
        uint256 policyId;
        uint256 projectId;
        address policyholder;
        uint256 coverageAmount;
        uint256 premiumPaid;
        uint256 purchaseTime;
        uint256 expiryTime;
        bool isActive;
    }
    
    struct InsuranceClaim {
        uint256 userPolicyId;
        address claimant;
        uint256 claimAmount;
        string evidence;
        ClaimStatus status;
        uint256 submissionTime;
        uint256 reviewDeadline;
        address[] reviewers;
        mapping(address => bool) reviewerVotes;
        uint256 approvalVotes;
        uint256 rejectionVotes;
    }
    
    struct InsurancePool {
        uint256 totalFunds;
        uint256 availableFunds;
        uint256 reserveRatio; // basis points (2000 = 20%)
        uint256 minReserve;
    }
    
    // Storage
    mapping(uint256 => InsurancePolicy) public policies;
    mapping(uint256 => UserPolicy) public userPolicies;
    mapping(uint256 => InsuranceClaim) public claims;
    mapping(address => uint256[]) public userPolicyIds;
    mapping(uint256 => uint256[]) public projectPolicies; // projectId => policyIds
    
    InsurancePool public insurancePool;
    
    uint256 public policyCounter;
    uint256 public userPolicyCounter;
    uint256 public claimCounter;
    
    uint256 public constant REVIEW_PERIOD = 7 days;
    uint256 public constant MIN_REVIEWERS = 3;
    uint256 public constant REVIEWER_REWARD = 50 * 10**18; // 50 SKILL per review
    
    address[] public authorizedReviewers;
    mapping(address => bool) public isAuthorizedReviewer;
    
    // Events
    event PolicyCreated(uint256 indexed policyId, InsuranceType policyType);
    event PolicyPurchased(
        uint256 indexed userPolicyId,
        address indexed user,
        uint256 indexed projectId,
        uint256 coverageAmount
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed userPolicyId,
        address indexed claimant,
        uint256 amount
    );
    event ClaimReviewed(
        uint256 indexed claimId,
        address indexed reviewer,
        bool approved
    );
    event ClaimResolved(
        uint256 indexed claimId,
        ClaimStatus status,
        uint256 payoutAmount
    );
    event FundsDeposited(address indexed depositor, uint256 amount);
    event ReviewerAdded(address indexed reviewer);
    
    modifier onlyAuthorizedReviewer() {
        require(isAuthorizedReviewer[msg.sender], "Not authorized reviewer");
        _;
    }
    
    modifier onlyEscrow() {
        require(msg.sender == address(escrow), "Only escrow can call");
        _;
    }
    
    constructor(
        address _skillToken,
        address _escrow
    ) {
        skillToken = SkillToken(_skillToken);
        escrow = SkillFiEscrow(_escrow);
        
        // Initialize insurance pool
        insurancePool = InsurancePool({
            totalFunds: 0,
            availableFunds: 0,
            reserveRatio: 2000, // 20%
            minReserve: 100000 * 10**18 // 100,000 SKILL minimum reserve
        });
        
        _initializePolicies();
    }
    
    /**
     * @dev Initialize default insurance policies
     */
    function _initializePolicies() internal {
        // Project Completion Insurance
        _createPolicy(
            InsuranceType.ProjectCompletion,
            500, // 5% premium
            50000 * 10**18, // 50,000 SKILL max coverage
            1000 * 10**18 // 1,000 SKILL deductible
        );
        
        // Quality Assurance Insurance
        _createPolicy(
            InsuranceType.QualityAssurance,
            300, // 3% premium
            25000 * 10**18, // 25,000 SKILL max coverage
            500 * 10**18 // 500 SKILL deductible
        );
        
        // Timeline Protection Insurance
        _createPolicy(
            InsuranceType.TimelineProtection,
            200, // 2% premium
            15000 * 10**18, // 15,000 SKILL max coverage
            250 * 10**18 // 250 SKILL deductible
        );
        
        // Payment Protection Insurance
        _createPolicy(
            InsuranceType.PaymentProtection,
            150, // 1.5% premium
            100000 * 10**18, // 100,000 SKILL max coverage
            0 // No deductible for payment protection
        );
    }
    
    /**
     * @dev Create new insurance policy
     */
    function _createPolicy(
        InsuranceType _type,
        uint256 _premiumRate,
        uint256 _coverageLimit,
        uint256 _deductible
    ) internal {
        policyCounter++;
        policies[policyCounter] = InsurancePolicy({
            policyType: _type,
            premiumRate: _premiumRate,
            coverageLimit: _coverageLimit,
            deductible: _deductible,
            isActive: true,
            totalPremiums: 0,
            totalClaims: 0
        });
        
        emit PolicyCreated(policyCounter, _type);
    }
    
    /**
     * @dev Purchase insurance for a project
     */
    function purchaseInsurance(
        uint256 policyId,
        uint256 projectId,
        uint256 coverageAmount
    ) external nonReentrant {
        InsurancePolicy storage policy = policies[policyId];
        require(policy.isActive, "Policy not active");
        require(coverageAmount <= policy.coverageLimit, "Coverage exceeds limit");
        require(coverageAmount > 0, "Coverage must be greater than 0");
        
        // Verify project exists and user is participant
        SkillFiEscrow.Project memory project = escrow.getProject(projectId);
        require(project.id != 0, "Project does not exist");
        require(
            msg.sender == project.client || msg.sender == project.freelancer,
            "Not project participant"
        );
        
        // Calculate premium
        uint256 premium = (coverageAmount * policy.premiumRate) / 10000;
        require(premium > 0, "Premium too low");
        
        // Transfer premium
        skillToken.safeTransferFrom(msg.sender, address(this), premium);
        
        // Create user policy
        userPolicyCounter++;
        userPolicies[userPolicyCounter] = UserPolicy({
            policyId: policyId,
            projectId: projectId,
            policyholder: msg.sender,
            coverageAmount: coverageAmount,
            premiumPaid: premium,
            purchaseTime: block.timestamp,
            expiryTime: block.timestamp + 365 days, // 1 year coverage
            isActive: true
        });
        
        // Update tracking
        userPolicyIds[msg.sender].push(userPolicyCounter);
        projectPolicies[projectId].push(userPolicyCounter);
        policy.totalPremiums += premium;
        
        // Add to insurance pool
        insurancePool.totalFunds += premium;
        insurancePool.availableFunds += premium;
        
        emit PolicyPurchased(userPolicyCounter, msg.sender, projectId, coverageAmount);
    }
    
    /**
     * @dev Submit insurance claim
     */
    function submitClaim(
        uint256 userPolicyId,
        uint256 claimAmount,
        string memory evidence
    ) external nonReentrant {
        UserPolicy storage userPolicy = userPolicies[userPolicyId];
        require(userPolicy.isActive, "Policy not active");
        require(userPolicy.policyholder == msg.sender, "Not policy holder");
        require(block.timestamp <= userPolicy.expiryTime, "Policy expired");
        require(claimAmount <= userPolicy.coverageAmount, "Claim exceeds coverage");
        
        InsurancePolicy storage policy = policies[userPolicy.policyId];
        require(claimAmount > policy.deductible, "Claim below deductible");
        
        claimCounter++;
        InsuranceClaim storage claim = claims[claimCounter];
        claim.userPolicyId = userPolicyId;
        claim.claimant = msg.sender;
        claim.claimAmount = claimAmount;
        claim.evidence = evidence;
        claim.status = ClaimStatus.Submitted;
        claim.submissionTime = block.timestamp;
        claim.reviewDeadline = block.timestamp + REVIEW_PERIOD;
        
        // Assign reviewers
        _assignReviewers(claimCounter);
        
        emit ClaimSubmitted(claimCounter, userPolicyId, msg.sender, claimAmount);
    }
    
    /**
     * @dev Assign reviewers to claim
     */
    function _assignReviewers(uint256 claimId) internal {
        require(authorizedReviewers.length >= MIN_REVIEWERS, "Insufficient reviewers");
        
        InsuranceClaim storage claim = claims[claimId];
        
        // Simple random assignment (in production, use more sophisticated method)
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, claimId)));
        for (uint256 i = 0; i < MIN_REVIEWERS; i++) {
            uint256 index = (seed + i) % authorizedReviewers.length;
            claim.reviewers.push(authorizedReviewers[index]);
        }
        
        claim.status = ClaimStatus.UnderReview;
    }
    
    /**
     * @dev Review insurance claim
     */
    function reviewClaim(uint256 claimId, bool approve) external onlyAuthorizedReviewer {
        InsuranceClaim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.UnderReview, "Claim not under review");
        require(block.timestamp <= claim.reviewDeadline, "Review period expired");
        require(!claim.reviewerVotes[msg.sender], "Already reviewed");
        
        // Check if reviewer is assigned
        bool isAssigned = false;
        for (uint256 i = 0; i < claim.reviewers.length; i++) {
            if (claim.reviewers[i] == msg.sender) {
                isAssigned = true;
                break;
            }
        }
        require(isAssigned, "Not assigned to this claim");
        
        claim.reviewerVotes[msg.sender] = true;
        
        if (approve) {
            claim.approvalVotes++;
        } else {
            claim.rejectionVotes++;
        }
        
        emit ClaimReviewed(claimId, msg.sender, approve);
        
        // Check if review is complete
        if (claim.approvalVotes + claim.rejectionVotes == claim.reviewers.length) {
            _resolveClaim(claimId);
        }
        
        // Reward reviewer
        skillToken.mint(msg.sender, REVIEWER_REWARD);
    }
    
    /**
     * @dev Resolve claim based on reviews
     */
    function _resolveClaim(uint256 claimId) internal {
        InsuranceClaim storage claim = claims[claimId];
        UserPolicy storage userPolicy = userPolicies[claim.userPolicyId];
        InsurancePolicy storage policy = policies[userPolicy.policyId];
        
        uint256 payoutAmount = 0;
        
        if (claim.approvalVotes > claim.rejectionVotes) {
            // Claim approved
            claim.status = ClaimStatus.Approved;
            payoutAmount = claim.claimAmount - policy.deductible;
            
            // Check if sufficient funds available
            if (payoutAmount <= insurancePool.availableFunds) {
                claim.status = ClaimStatus.Paid;
                insurancePool.availableFunds -= payoutAmount;
                policy.totalClaims += payoutAmount;
                
                // Transfer payout
                skillToken.safeTransfer(claim.claimant, payoutAmount);
            }
        } else {
            // Claim rejected
            claim.status = ClaimStatus.Rejected;
        }
        
        // Deactivate policy after claim
        userPolicy.isActive = false;
        
        emit ClaimResolved(claimId, claim.status, payoutAmount);
    }
    
    /**
     * @dev Force resolve expired claims
     */
    function resolveExpiredClaim(uint256 claimId) external {
        InsuranceClaim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.UnderReview, "Claim not under review");
        require(block.timestamp > claim.reviewDeadline, "Review period not expired");
        
        // Auto-reject if not enough reviews
        if (claim.approvalVotes + claim.rejectionVotes < MIN_REVIEWERS) {
            claim.status = ClaimStatus.Rejected;
            emit ClaimResolved(claimId, ClaimStatus.Rejected, 0);
        } else {
            _resolveClaim(claimId);
        }
    }
    
    /**
     * @dev Deposit funds to insurance pool
     */
    function depositToPool(uint256 amount) external {
        skillToken.safeTransferFrom(msg.sender, address(this), amount);
        insurancePool.totalFunds += amount;
        insurancePool.availableFunds += amount;
        
        emit FundsDeposited(msg.sender, amount);
    }
    
    /**
     * @dev Get user's policies
     */
    function getUserPolicies(address user) external view returns (uint256[] memory) {
        return userPolicyIds[user];
    }
    
    /**
     * @dev Get project's policies
     */
    function getProjectPolicies(uint256 projectId) external view returns (uint256[] memory) {
        return projectPolicies[projectId];
    }
    
    /**
     * @dev Get claim reviewers
     */
    function getClaimReviewers(uint256 claimId) external view returns (address[] memory) {
        return claims[claimId].reviewers;
    }
    
    /**
     * @dev Check if reviewer voted on claim
     */
    function hasReviewerVoted(uint256 claimId, address reviewer) external view returns (bool) {
        return claims[claimId].reviewerVotes[reviewer];
    }
    
    /**
     * @dev Get insurance pool stats
     */
    function getPoolStats() external view returns (
        uint256 totalFunds,
        uint256 availableFunds,
        uint256 utilizationRate,
        uint256 reserveRatio
    ) {
        uint256 utilization = insurancePool.totalFunds > 0 ? 
            ((insurancePool.totalFunds - insurancePool.availableFunds) * 10000) / insurancePool.totalFunds : 0;
        
        return (
            insurancePool.totalFunds,
            insurancePool.availableFunds,
            utilization,
            insurancePool.reserveRatio
        );
    }
    
    /**
     * @dev Admin functions
     */
    function addReviewer(address reviewer) external onlyOwner {
        require(!isAuthorizedReviewer[reviewer], "Already authorized");
        authorizedReviewers.push(reviewer);
        isAuthorizedReviewer[reviewer] = true;
        
        emit ReviewerAdded(reviewer);
    }
    
    function removeReviewer(address reviewer) external onlyOwner {
        require(isAuthorizedReviewer[reviewer], "Not authorized");
        isAuthorizedReviewer[reviewer] = false;
        
        // Remove from array
        for (uint256 i = 0; i < authorizedReviewers.length; i++) {
            if (authorizedReviewers[i] == reviewer) {
                authorizedReviewers[i] = authorizedReviewers[authorizedReviewers.length - 1];
                authorizedReviewers.pop();
                break;
            }
        }
    }
    
    function createPolicy(
        InsuranceType _type,
        uint256 _premiumRate,
        uint256 _coverageLimit,
        uint256 _deductible
    ) external onlyOwner {
        _createPolicy(_type, _premiumRate, _coverageLimit, _deductible);
    }
    
    function updatePolicy(
        uint256 policyId,
        uint256 _premiumRate,
        uint256 _coverageLimit,
        uint256 _deductible,
        bool _isActive
    ) external onlyOwner {
        InsurancePolicy storage policy = policies[policyId];
        policy.premiumRate = _premiumRate;
        policy.coverageLimit = _coverageLimit;
        policy.deductible = _deductible;
        policy.isActive = _isActive;
    }
    
    function updatePoolSettings(
        uint256 _reserveRatio,
        uint256 _minReserve
    ) external onlyOwner {
        insurancePool.reserveRatio = _reserveRatio;
        insurancePool.minReserve = _minReserve;
    }
    
    /**
     * @dev Emergency withdraw (only when pool is over-funded)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(
            insurancePool.availableFunds - amount >= insurancePool.minReserve,
            "Would breach minimum reserve"
        );
        
        insurancePool.totalFunds -= amount;
        insurancePool.availableFunds -= amount;
        skillToken.safeTransfer(owner(), amount);
    }
}