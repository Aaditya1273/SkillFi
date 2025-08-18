// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SkillToken
 * @dev ERC20 token for the SkillFi platform with governance features
 */
contract SkillToken is ERC20, ERC20Burnable, ERC20Permit, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million tokens
    
    // Minting limits
    uint256 public constant MINT_CAP_PER_YEAR = 50_000_000 * 10**18; // 5% of max supply
    uint256 public lastMintTimestamp;
    uint256 public mintedThisYear;
    
    // Platform addresses
    address public platformTreasury;
    address public stakingContract;
    address public marketplaceContract;
    
    mapping(address => bool) public minters;
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event PlatformAddressUpdated(string indexed addressType, address indexed newAddress);
    
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }
    
    constructor(
        address _platformTreasury
    ) ERC20("SkillFi Token", "SKILL") ERC20Permit("SkillFi Token") {
        platformTreasury = _platformTreasury;
        lastMintTimestamp = block.timestamp;
        
        // Mint initial supply to treasury
        _mint(_platformTreasury, INITIAL_SUPPLY);
    }
    
    /**
     * @dev Mint tokens with yearly cap restriction
     */
    function mint(address to, uint256 amount) external onlyMinter whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        
        // Reset yearly counter if a year has passed
        if (block.timestamp >= lastMintTimestamp + 365 days) {
            lastMintTimestamp = block.timestamp;
            mintedThisYear = 0;
        }
        
        require(mintedThisYear + amount <= MINT_CAP_PER_YEAR, "Exceeds yearly mint cap");
        
        mintedThisYear += amount;
        _mint(to, amount);
    }
    
    /**
     * @dev Add authorized minter
     */
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove authorized minter
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Update platform addresses
     */
    function setPlatformTreasury(address _treasury) external onlyOwner {
        platformTreasury = _treasury;
        emit PlatformAddressUpdated("treasury", _treasury);
    }
    
    function setStakingContract(address _staking) external onlyOwner {
        stakingContract = _staking;
        emit PlatformAddressUpdated("staking", _staking);
    }
    
    function setMarketplaceContract(address _marketplace) external onlyOwner {
        marketplaceContract = _marketplace;
        emit PlatformAddressUpdated("marketplace", _marketplace);
    }
    
    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Override transfer functions to include pause functionality
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}