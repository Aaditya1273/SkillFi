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
 * @dev Decentralized insurance system for project protection and risk mitigation
 */
contract SkillFiInsurance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    SkillToken public immutable skillToken;
    SkillFiEscrow public immutable escrow;
    
    // Insurance types
    enum InsuranceType {
        ProjectCompletion,  // Protects against project non-completion
        QualityAssurance,   // Protects against poor quality work
        TimeDelay,          // Protects against project delays
        PaymentDefault,     // Protects against payment defaults
        DisputeResolution   // Covers dispute resolution costs
    }
    
    // Claim status
    enum ClaimStatus {
        Pending,
        UnderReview,
        Approved,
        Rejected,
        Paid
    }
    
    struct InsurancePolicy {
        uint256 id;
        uint256 projectId;
        address policyholder;
        InsuranceType insuranceType;
        uint256 coverageAmount;
        uint256 premium;
        uint256 deductible;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool hasClaimed;
    }
    
    struct InsuranceClaim {
        uint256 id;
        uint256 policyId;
        address claimant;
        uint256 claimAmount;
        string evidence;
        ClaimStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        address reviewer;
        string reviewNotes;
    }
    
    struct InsurancePool {
        uint256 totalFunds;
        uint256 totalClaims;
        uint256 totalPremiums;
        uint256 reserveRatio; // Basis points (e.g., 2000 = 20%)
        uint256 maxCoveragePerPolicy;
        bool isActive;
    }
    
    struct RiskAssessment {
        uint256 userRiskScore;     // 0-1000 (lower is better)
        uint256 projectRiskScore;  // 0-1000 (lower is better)
        uint256 baselineRisk;      // Platform baseline risk
        mapping(InsuranceType => uint256) typePremiumRates; // Basis points
    }
    
    mapping(uint256 => InsurancePolicy) public policies;
    mapping(uint256 => InsuranceClaim) public claims;
    mapping(address => uint256[]) public userPolicies;
    mapping(uint256 => uint256[]) public projectPolicies;
    mapping(InsuranceType => InsurancePool) public insurancePools;
    mapping(address => RiskAssessment) public riskAssessments;
    
    uint256 public policyCounter;
    uint256 public claimCounter;
    
    // Risk factors
    uint256 public constant MAX_RISK_SCORE = 1000;
    uint256 public constant BASE_PREMIUM_RATE = 500; // 5% base premium
    uint256 public constant MIN_COVERAGE_PERIOD = 7 days;
    uint256 public constant MAX_COVERAGE_PERIOD = 365 days;
    
    // Events
    event PolicyCreated(
        uint256 indexed policyId,
        uint256 indexed projectId,
        address indexed policyholder,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 premium
    );
    
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 claimAmount
    );
    
    event ClaimProcessed(
        uint256 indexed claimId,
        ClaimStatus status,
        uint256 payoutAmount
    );
    
    event RiskScoreUpdated(address indexed user, uint256 newScore);
    event PremiumPaid(uint256 indexed policyId, uint256 amount);
    
    modifier validPolicy(uint256 policyId) {
        require(policies[policyId].id != 0, "Policy does not exist");
        _;
    }
    
    modifier validClaim(uint256 claimId) {
        require(claims[claimId].id != 0, "Claim does not exist");
        _;
    }
    
    constructor(
        address _skillToken,
        address _escrow
    ) {
        skillToken = SkillToken(_skillToken);
        escrow = SkillFiEscrow(_escrow);
        
        // Initialize insurance pools
        _initializeInsurancePools();
        
        // Set baseline risk assessment
        riskAssessments[address(0)].baselineRisk = 100; // 10% baseline risk
    }
    
    /**
     * @dev Initialize insurance pools with default parameters
     */
    function _initializeInsurancePools() internal {
        // Project Completion Insurance
        insurancePools[InsuranceType.ProjectCompletion] = InsurancePool({
            totalFunds: 0,
            totalClaims: 0,
            totalPremiums: 0,
            reserveRatio: 2000, // 20%
            maxCoveragePerPolicy: 100000 * 10**18, // 100,000 SKILL
            isActive: true
        });
        
        // Quality Assurance Insurance
        insurancePools[InsuranceType.QualityAssurance] = InsurancePool({
            totalFunds: 0,
            totalClaims: 0,
            totalPremiums: 0,
            reserveRatio: 1500, // 15%
            maxCoveragePerPolicy: 50000 * 10**18, // 50,000 SKILL
            isActive: true
        });
        
        // Time Delay Insurance
        insurancePools[InsuranceType.TimeDelay] = InsurancePool({
            totalFunds: 0,
            totalClaims: 0,
            totalPremiums: 0,
            reserveRatio: 1000, // 10%
            maxCoveragePerPolicy: 25000 * 10**18, // 25,000 SKILL
            isActive: true
        });
        
        // Payment Default Insurance
        insurancePools[InsuranceType.PaymentDefault] = InsurancePool({
            totalFunds: 0,
            totalClaims: 0,
            totalPremiums: 0,
            reserveRatio: 2500, // 25%
            maxCoveragePerPolicy: 200000 * 10**18, // 200,000 SKILL
            isActive: true
        });
        
        // Dispute Resolution Insurance
        insurancePools[InsuranceType.DisputeResolution] = InsurancePool({
            totalFunds: 0,
            totalClaims: 0,
            totalPremiums: 0,
            reserveRatio: 500, // 5%
            maxCoveragePerPolicy: 10000 * 10**18, // 10,000 SKILL
            isActive: true
        });
    }
    
    /**
     * @dev Purchase insurance policy for a project
     */
    function purchaseInsurance(
        uint256 projectId,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 coveragePeriod
    ) external nonReentrant returns (uint256) {
        require(coverageAmount > 0, "Coverage amount must be greater than 0");
        require(coveragePeriod >= MIN_COVERAGE_PERIOD, "Coverage period too short");
        require(coveragePeriod <= MAX_COVERAGE_PERIOD, "Coverage period too long");
        
        InsurancePool storage pool = insurancePools[insuranceType];
        require(pool.isActive, "Insurance type not active");
        require(coverageAmount <= pool.maxCoveragePerPolicy, "Coverage exceeds maximum");
        
        // Verify project exists and user is involved
        SkillFiEscrow.Project memory project = escrow.getProject(projectId);
        require(project.id != 0, "Project does not exist");
        require(
            msg.sender == project.client || msg.sender == project.freelancer,
            "Not authorized for this project"
        );
        
        // Calculate premium based on risk assessment
        uint256 premium = _calculatePremium(msg.sender, projectId, insuranceType, coverageAmount, coveragePeriod);
        uint256 deductible = _calculateDeductible(coverageAmount, insuranceType);
        
        // Transfer premium
        skillToken.safeTransferFrom(msg.sender, address(this), premium);
        
        // Create policy
        policyCounter++;
        uint256 policyId = policyCounter;
        
        policies[policyId] = InsurancePolicy({
            id: policyId,
            projectId: projectId,
            policyholder: msg.sender,
            insuranceType: insuranceType,
            coverageAmount: coverageAmount,
            premium: premium,
            deductible: deductible,
            startTime: block.timestamp,
            endTime: block.timestamp + coveragePeriod,
            isActive: true,
            hasClaimed: false
        });
        
        // Update tracking
        userPolicies[msg.sender].push(policyId);
        projectPolicies[projectId].push(policyId);
        
        // Update pool
        pool.totalPremiums += premium;
        pool.totalFunds += premium;
        
        emit PolicyCreated(policyId, projectId, msg.sender, insuranceType, coverageAmount, premium);
        emit PremiumPaid(policyId, premium);
        
        return policyId;
    }
    
    /**
     * @dev Submit insurance claim
     */
    function submitClaim(
        uint256 policyId,
        uint256 claimAmount,
        string memory evidence
    ) external validPolicy(policyId) nonReentrant returns (uint256) {
        InsurancePolicy storage policy = policies[policyId];
        require(msg.sender == policy.policyholder, "Not policy holder");
        require(policy.isActive, "Policy not active");
        require(!policy.hasClaimed, "Already claimed");
        require(block.timestamp <= policy.endTime, "Policy expired");
        require(claimAmount <= policy.coverageAmount, "Claim exceeds coverage");
        require(claimAmount > policy.deductible, "Claim below deductible");
        
        claimCounter++;
        uint256 claimId = claimCounter;
        
        claims[claimId] = InsuranceClaim({
            id: claimId,
            policyId: policyId,
            claimant: msg.sender,
            claimAmount: claimAmount,
            evidence: evidence,
            status: ClaimStatus.Pending,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            reviewer: address(0),
            reviewNotes: ""
        });
        
        policy.hasClaimed = true;
        
        emit ClaimSubmitted(claimId, policyId, msg.sender, claimAmount);
        
        return claimId;
    }
    
    /**
     * @dev Process insurance claim (admin function)
     */
    function processClaim(
        uint256 claimId,
        ClaimStatus decision,
        uint256 payoutAmount,
        string memory reviewNotes
    ) external onlyOwner validClaim(claimId) nonReentrant {
        InsuranceClaim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.Pending || claim.status == ClaimStatus.UnderReview, "Claim already processed");
        
        claim.status = decision;
        claim.reviewedAt = block.timestamp;
        claim.reviewer = msg.sender;
        claim.reviewNotes = reviewNotes;
        
        if (decision == ClaimStatus.Approved && payoutAmount > 0) {
            InsurancePolicy storage policy = policies[claim.policyId];
            InsurancePool storage pool = insurancePools[policy.insuranceType];
            
            // Ensure payout doesn't exceed coverage minus deductible
            uint256 maxPayout = policy.coverageAmount - policy.deductible;
            if (payoutAmount > maxPayout) {
                payoutAmount = maxPayout;
            }
            
            // Ensure pool has sufficient funds
            require(pool.totalFunds >= payoutAmount, "Insufficient pool funds");
            
            // Transfer payout
            skillToken.safeTransfer(claim.claimant, payoutAmount);
            
            // Update pool
            pool.totalFunds -= payoutAmount;
            pool.totalClaims += payoutAmount;
            
            claim.status = ClaimStatus.Paid;
        }
        
        emit ClaimProcessed(claimId, decision, payoutAmount);
    }
    
    /**
     * @dev Calculate premium based on risk factors
     */
    function _calculatePremium(
        address user,
        uint256 projectId,
        InsuranceType insuranceType,
        uint256 coverageAmount,
        uint256 coveragePeriod
    ) internal view returns (uint256) {
        // Get user risk score
        uint256 userRisk = _getUserRiskScore(user);
        
        // Get project risk score
        uint256 projectRisk = _getProjectRiskScore(projectId);
        
        // Base premium rate for insurance type
        uint256 basePremiumRate = _getBasePremiumRate(insuranceType);
        
        // Risk adjustment (higher risk = higher premium)
        uint256 riskMultiplier = 10000 + ((userRisk + projectRisk) * 50); // Up to 10% increase
        
        // Time adjustment (longer coverage = higher premium)
        uint256 timeMultiplier = 10000 + ((coveragePeriod * 100) / 365 days); // Up to 10% increase for 1 year
        
        // Calculate final premium
        uint256 basePremium = (coverageAmount * basePremiumRate) / 10000;
        uint256 adjustedPremium = (basePremium * riskMultiplier * timeMultiplier) / (10000 * 10000);
        
        return adjustedPremium;
    }
    
    /**
     * @dev Calculate deductible (typically 5-10% of coverage)
     */
    function _calculateDeductible(uint256 coverageAmount, InsuranceType insuranceType) internal pure returns (uint256) {
        uint256 deductibleRate;
        
        if (insuranceType == InsuranceType.ProjectCompletion) {
            deductibleRate = 1000; // 10%
        } else if (insuranceType == InsuranceType.QualityAssurance) {
            deductibleRate = 750;  // 7.5%
        } else if (insuranceType == InsuranceType.TimeDelay) {
            deductibleRate = 500;  // 5%
        } else if (insuranceType == InsuranceType.PaymentDefault) {
            deductibleRate = 1000; // 10%
        } else {
            deductibleRate = 500;  // 5%
        }
        
        return (coverageAmount * deductibleRate) / 10000;
    }
    
    /**
     * @dev Get user risk score based on history
     */
    function _getUserRiskScore(address user) internal view returns (uint256) {
        // Get user reputation from escrow
        (,,,, uint256 completedProjects, uint256 totalEarned,) = escrow.userReputations(user);
        uint256 rating = escrow.getUserRating(user);
        
        uint256 riskScore = 500; // Start with medium risk
        
        // Adjust based on completed projects (more projects = lower risk)
        if (completedProjects > 50) {
            riskScore -= 200;
        } else if (completedProjects > 20) {
            riskScore -= 100;
        } else if (completedProjects > 5) {
            riskScore -= 50;
        }
        
        // Adjust based on rating (higher rating = lower risk)
        if (rating >= 45) { // 4.5+ rating
            riskScore -= 150;
        } else if (rating >= 40) { // 4.0+ rating
            riskScore -= 100;
        } else if (rating >= 35) { // 3.5+ rating
            riskScore -= 50;
        } else if (rating < 30) { // Below 3.0 rating
            riskScore += 200;
        }
        
        // Adjust based on total earned (higher earnings = lower risk)
        if (totalEarned > 100000 * 10**18) {
            riskScore -= 100;
        } else if (totalEarned > 50000 * 10**18) {
            riskScore -= 50;
        }
        
        // Ensure within bounds
        if (riskScore > MAX_RISK_SCORE) riskScore = MAX_RISK_SCORE;
        if (riskScore < 0) riskScore = 0;
        
        return riskScore;
    }
    
    /**
     * @dev Get project risk score based on characteristics
     */
    function _getProjectRiskScore(uint256 projectId) internal view returns (uint256) {
        SkillFiEscrow.Project memory project = escrow.getProject(projectId);
        
        uint256 riskScore = 300; // Base project risk
        
        // Adjust based on project value (higher value = higher risk)
        if (project.totalAmount > 50000 * 10**18) {
            riskScore += 200;
        } else if (project.totalAmount > 20000 * 10**18) {
            riskScore += 100;
        } else if (project.totalAmount > 5000 * 10**18) {
            riskScore += 50;
        }
        
        // Adjust based on deadline (tight deadlines = higher risk)
        if (project.deadline > 0) {
            uint256 timeToDeadline = project.deadline - block.timestamp;
            if (timeToDeadline < 7 days) {
                riskScore += 150;
            } else if (timeToDeadline < 30 days) {
                riskScore += 100;
            } else if (timeToDeadline < 90 days) {
                riskScore += 50;
            }
        }
        
        return riskScore > MAX_RISK_SCORE ? MAX_RISK_SCORE : riskScore;
    }
    
    /**
     * @dev Get base premium rate for insurance type
     */
    function _getBasePremiumRate(InsuranceType insuranceType) internal pure returns (uint256) {
        if (insuranceType == InsuranceType.ProjectCompletion) {
            return 800;  // 8%
        } else if (insuranceType == InsuranceType.QualityAssurance) {
            return 600;  // 6%
        } else if (insuranceType == InsuranceType.TimeDelay) {
            return 400;  // 4%
        } else if (insuranceType == InsuranceType.PaymentDefault) {
            return 1000; // 10%
        } else {
            return 300;  // 3%
        }
    }
    
    /**
     * @dev Get policy details
     */
    function getPolicy(uint256 policyId) external view returns (InsurancePolicy memory) {
        return policies[policyId];
    }
    
    /**
     * @dev Get claim details
     */
    function getClaim(uint256 claimId) external view returns (InsuranceClaim memory) {
        return claims[claimId];
    }
    
    /**
     * @dev Get user's policies
     */
    function getUserPolicies(address user) external view returns (uint256[] memory) {
        return userPolicies[user];
    }
    
    /**
     * @dev Get project's policies
     */
    function getProjectPolicies(uint256 projectId) external view returns (uint256[] memory) {
        return projectPolicies[projectId];
    }
    
    /**
     * @dev Admin functions
     */
    function updateInsurancePool(
        InsuranceType insuranceType,
        uint256 reserveRatio,
        uint256 maxCoveragePerPolicy,
        bool isActive
    ) external onlyOwner {
        InsurancePool storage pool = insurancePools[insuranceType];
        pool.reserveRatio = reserveRatio;
        pool.maxCoveragePerPolicy = maxCoveragePerPolicy;
        pool.isActive = isActive;
    }
    
    function addFundsToPool(InsuranceType insuranceType, uint256 amount) external onlyOwner {
        skillToken.safeTransferFrom(msg.sender, address(this), amount);
        insurancePools[insuranceType].totalFunds += amount;
    }
    
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        skillToken.safeTransfer(owner(), amount);
    }
}