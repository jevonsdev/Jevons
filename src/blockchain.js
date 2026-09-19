import { ethers } from 'ethers';

// ═══ Persistent Funds Wallet (Treasury) ═══
// Loaded from VITE_FUNDS_PRIVATE_KEY env var, or generated and saved to localStorage.
// This wallet is the agent's permanent funding source — the user funds it once,
// and the agent auto-transfers ETH to fresh launch wallets as needed.

export class FundsWallet {
  constructor(rpcUrl) {
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = null;
    this.address = null;
    this.loaded = false;
  }

  /**
   * Load or generate the funds wallet.
   * Priority: env var > localStorage > generate new.
   * Returns { address, privateKey, isNew }
   */
  load(envPrivateKey = '') {
    let privateKey = envPrivateKey;
    let isNew = false;

    if (!privateKey) {
      // Try localStorage
      privateKey = localStorage.getItem('typesafe_funds_pk') || '';
    }

    if (!privateKey) {
      // Generate a new one and persist
      const newWallet = ethers.Wallet.createRandom();
      privateKey = newWallet.privateKey;
      localStorage.setItem('typesafe_funds_pk', privateKey);
      isNew = true;
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.address = this.wallet.address;
    this.loaded = true;

    return {
      address: this.address,
      privateKey,
      isNew,
    };
  }

  async getBalance() {
    if (!this.address) return '0';
    const balance = await this.provider.getBalance(this.address);
    return ethers.formatEther(balance);
  }

  /**
   * Send ETH from funds wallet to a target address.
   * @param {string} to — target address
   * @param {bigint|string} amountWei — amount in wei (bigint or hex string)
   * @returns {{ success, txHash, error }}
   */
  async sendFunds(to, amountWei) {
    if (!this.wallet) return { success: false, error: 'Funds wallet not loaded' };

    try {
      const tx = await this.wallet.sendTransaction({
        to,
        value: amountWei,
      });
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const CHAIN_CONFIG = {
  chainId: 4663,
  chainIdHex: '0x1237',
  name: 'Robinhood Chain',
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  blockExplorer: 'https://robinhoodchain.blockscout.com',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
};

export const TESTNET_CONFIG = {
  chainId: 46630,
  chainIdHex: '0xB626',
  name: 'Robinhood Chain Testnet',
  rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  blockExplorer: 'https://testnet.robinhoodchain.blockscout.com',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
};

const ERC20_ABI = [
  'constructor(string name, string symbol, uint256 initialSupply)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// Pre-compiled minimal ERC-20 bytecode (mints entire supply to deployer)
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162000c7838038062000c78833981016040819052620000349162000213565b8282600362000044838262000310565b50600462000053828262000310565b505050620000683382620000716401000000000262000079811b17901c565b505050620003fa565b6001600160a01b038216620000a45760405163ec442f0560e01b81526000600482015260240160405180910390fd5b620000b860008383620000bc60201b60201c565b5050565b6001600160a01b038316620000eb578060026000828254620000df9190620003dc565b90915550620001609050565b6001600160a01b038316600090815260208190526040902054818110156200014157604051634b14e2f160e11b81526001600160a01b038516600482015260248101829052604481018390526064015b60405180910390fd5b6001600160a01b03841660009081526020819052604090209082900390555b6001600160a01b0382166200017e576002805482900390556200019d565b6001600160a01b03821660009081526020819052604090208054820190555b816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051620001e291815260200190565b60405180910390a3505050565b634e487b7160e01b600052604160045260246000fd5b805160208201516001600160401b0381111562000226576200022662000205565b604051601f8201601f191681016001600160401b0381118282101715620002515762000251620001ef565b604052919050565b600080600060608486031215620002295762000229600080fd5b83516001600160401b038111156200024157620002416200001ef565b8401601f810186136200025357600080fd5b80516001600160401b038111156200026f576200026f620001ef565b62000284601f8201601f191660200162000205565b8181528760208385010111156200029a57600080fd5b620002ad826020830160208601620002e4565b60209690960151949694955050505050565b600081518084526020808501945080840160005b838110156200030457815187529582019590820190600101620002d3565b509495945050505050565b60008190508160005260206000209050919050565b601f82111562000372576000816000526020600020601f850160051c8101602086101562000349575080fd5b601f850160051c820191505b818110156200036a5782815560010162000355565b505050505050565b81516001600160401b038111156200038e576200038e620001ef565b620003a6816200039f845462000310565b8462000324565b602080601f831160018114620003de5760008415620003c55750858301515b600019600386901b1c1916600185901b1785556200036a565b600085815260208120601f198616915b828110156200040f57888601518255948401946001909101908401620003ee565b50858210156200042e5787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b608051610828620004506000396000505061082860006000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461012957806370a082311461013c57806395d89b4114610165578063a457c2d71461016d578063a9059cbb14610180578063dd62ed3e1461019357600080fd5b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100ef57806323b872dd14610101578063313ce56714610114575b600080fd5b6100b66101cc565b6040516100c3919061057a565b60405180910390f35b6100df6100da3660046105e4565b61025e565b60405190151581526020016100c3565b6002545b6040519081526020016100c3565b6100df61010f36600461060e565b610278565b60126040516100c39190610652565b6100df6101373660046105e4565b61029c565b6100f361014a36600461066a565b6001600160a01b031660009081526020819052604090205490565b6100b66102be565b6100df61017b3660046105e4565b6102cd565b6100df61018e3660046105e4565b61034d565b6100f36101a136600461068c565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6060600380546101db906106bf565b80601f0160208091040260200160405190810160405280929190818152602001828054610207906106bf565b80156102545780601f1061022957610100808354040283529160200191610254565b820191906000526020600020905b81548152906001019060200180831161023757829003601f168201915b5050505050905090565b60003361026c81858561035b565b60019150505b92915050565b60003361028685828561036d565b6102918585856103eb565b506001949350505050565b60003361026c8185856102af8383610449565b6102b991906106f9565b61035b565b6060600480546101db906106bf565b600033816102db8286610449565b9050838110156103405760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b606482015260840161013857600080fd5b610291828686840361035b565b60003361026c8185856103eb565b610368838383600161047b565b505050565b6001600160a01b03838116600090815260016020908152604080832093861683529290522054600019811461035b57818110156103dc57604051637dc7a0d960e11b81526001600160a01b0384166004820152602481018290526044810183905260640161013857600080fd5b6103e58484848403600061047b565b50505050565b6001600160a01b03831661041557604051634b637e8f60e11b81526000600482015260240161013857600080fd5b6001600160a01b03821661043f5760405163ec442f0560e01b81526000600482015260240161013857600080fd5b6103688383836104c4565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6001600160a01b0384166104a55760405163e602df0560e01b81526000600482015260240161013857600080fd5b6001600160a01b0383166103e557604051634a1406b160e11b81526000600482015260240161013857600080fd5b505050565b6001600160a01b0383166104ef5780600260008282546104e791906106f9565b909155505050565b6001600160a01b038316600090815260208190526040902054818110156105435760405163391434e360e21b81526001600160a01b0385166004820152602481018290526044810183905260640161013857600080fd5b6001600160a01b038085166000908152602081905260408082208585039055918516815290812080548492906104e79084906106f9565b600060208083528351808285015260005b818110156105a75785810183015185820160400152820161058b565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b03811681146105df57600080fd5b919050565b600080604083850312156105f757600080fd5b610600836105c8565b946020939093013593505050565b60008060006060848603121561062357600080fd5b61062c846105c8565b925061063a602085016105c8565b9150604084013590509250925092565b60ff811681146106595761065957600080fd5b50565b602081016102728284610652565b60006020828403121561067c57600080fd5b610685826105c8565b9392505050565b6000806040838503121561069f57600080fd5b6106a8836105c8565b91506106b6602084016105c8565b90509250929050565b600181811c908216806106d357607f821691505b6020821081036106f357634e487b7160e01b600052602260045260246000fd5b50919050565b8082018082111561027257634e487b7160e01b600052601160045260246000fdfea264697066735822';

export class BlockchainClient {
  constructor(useTestnet = false) {
    this.config = useTestnet ? TESTNET_CONFIG : CHAIN_CONFIG;
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.signer = null;
    this.address = null;
    this.connected = false;
  }

  async connectWithMetaMask() {
    if (!window.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: this.config.chainIdHex }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: this.config.chainIdHex, chainName: this.config.name, nativeCurrency: this.config.nativeCurrency, rpcUrls: [this.config.rpcUrl], blockExplorerUrls: [this.config.blockExplorer] }] });
        } else throw switchError;
      }
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.address = accounts[0];
      this.connected = true;
      return { success: true, address: this.address };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async connectWithPrivateKey(privateKey) {
    try {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, this.provider);
      this.signer = wallet;
      this.address = wallet.address;
      this.connected = true;
      return { success: true, address: this.address };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async generateWallet() {
    try {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const wallet = ethers.Wallet.createRandom().connect(this.provider);
      this.signer = wallet;
      this.address = wallet.address;
      this.connected = true;
      return { success: true, address: this.address, privateKey: wallet.privateKey };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async connectReadOnly() {
    try {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      this.connected = true;
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async getBalance() {
    if (!this.address || !this.provider) return '0';
    const balance = await this.provider.getBalance(this.address);
    return ethers.formatEther(balance);
  }

  async getGasPrice() {
    if (!this.provider) return '0';
    const feeData = await this.provider.getFeeData();
    return ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
  }

  async getBlockNumber() {
    if (!this.provider) return 0;
    return this.provider.getBlockNumber();
  }

  async deployToken(name, symbol, totalSupply, decimals = 18) {
    if (!this.signer) throw new Error('Wallet not connected');
    const factory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, this.signer);
    const supplyWei = ethers.parseUnits(totalSupply.toString(), decimals);
    const contract = await factory.deploy(name, symbol, supplyWei);
    const receipt = await contract.deploymentTransaction().wait();
    return {
      contractAddress: await contract.getAddress(),
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `${this.config.blockExplorer}/address/${await contract.getAddress()}`
    };
  }

  async getTokenInfo(contractAddress) {
    if (!this.provider) throw new Error('Not connected');
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([contract.name(), contract.symbol(), contract.decimals(), contract.totalSupply()]);
    let balance = '0';
    if (this.address) {
      const rawBalance = await contract.balanceOf(this.address);
      balance = ethers.formatUnits(rawBalance, decimals);
    }
    return { name, symbol, decimals: Number(decimals), totalSupply: ethers.formatUnits(totalSupply, decimals), balance };
  }

  async estimateDeployGas(name, symbol, totalSupply, decimals = 18) {
    if (!this.provider) throw new Error('Not connected');
    try {
      const factory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, this.signer || this.provider);
      const supplyWei = ethers.parseUnits(totalSupply.toString(), decimals);
      const deployTx = await factory.getDeployTransaction(name, symbol, supplyWei);
      const gasEstimate = await this.provider.estimateGas(deployTx);
      const feeData = await this.provider.getFeeData();
      const gasCostWei = gasEstimate * (feeData.gasPrice || 0n);
      return { gasUnits: gasEstimate.toString(), gasPriceGwei: ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'), totalCostEth: ethers.formatEther(gasCostWei) };
    } catch {
      return { gasUnits: '1500000', gasPriceGwei: '0.1', totalCostEth: '0.00015' };
    }
  }

  getExplorerUrl(addressOrTx, type = 'address') {
    return `${this.config.blockExplorer}/${type}/${addressOrTx}`;
  }

  // ═══ Pons V2 Integration ═══

  /**
   * Query how many launch configs exist and get the first enabled one.
   */
  async getPonsLaunchConfig() {
    if (!this.provider) throw new Error('Not connected');
    const factory = new ethers.Contract(PONS_V2_FACTORY, PONS_FACTORY_ABI, this.provider);
    const count = await factory.launchConfigCount();
    
    // Find the first enabled config
    for (let i = 0; i < count; i++) {
      const config = await factory.getLaunchConfig(i);
      if (config.enabled) {
        return { id: i, config };
      }
    }
    throw new Error('No enabled Pons launch configs found');
  }

  /**
   * Get the current Pons launch fee (in native ETH wei).
   */
  async getPonsLaunchFee() {
    if (!this.provider) throw new Error('Not connected');
    const factory = new ethers.Contract(PONS_V2_FACTORY, PONS_FACTORY_ABI, this.provider);
    const fee = await factory.launchFee();
    return fee;
  }

  /**
   * Launch a token on Pons V2 via the Factory directly.
   * This mints a new token directly into a bonding curve.
   * We call factory.launchToken instead of the router's launchAndBuy
   * because the direct factory call is more reliable and we don't
   * need an initial buy bundled in the same tx.
   */
  async launchOnPons(name, symbol, description = '', launchConfigId = 0, logoUrl = '') {
    if (!this.signer) throw new Error('Wallet not connected');

    // Get launch fee
    const launchFee = await this.getPonsLaunchFee();

    // Build TokenParams struct
    const tokenParams = {
      name,
      symbol,
      logo: logoUrl || '',  // AI-generated logo URL (fal.ai → IPFS or direct CDN)
      description: description || `${name} — launched by Jev on TypeSafe`,
      socials: {
        x: 'https://x.com/jevonsterminal',
        telegram: '',
        discord: '',
        website: 'https://typesafe.ai',
        farcaster: ''
      },
      creatorFeeRecipient: this.address,
      creatorTaxBps: 0,
      buybackEnabled: false,
      expectedEconomics: ethers.ZeroHash, // Waive the economics check
      salt: ethers.hexlify(ethers.randomBytes(32))
    };

    // Call factory.launchToken directly (no bundled buy needed)
    const factory = new ethers.Contract(PONS_V2_FACTORY, PONS_FACTORY_ABI, this.signer);

    const tx = await factory.launchToken(
      tokenParams,
      launchConfigId,
      ethers.ZeroAddress, // pairToken = native ETH
      { value: launchFee }
    );

    const receipt = await tx.wait();

    // Parse TokenLaunched event from the factory
    const factoryIface = new ethers.Interface(PONS_FACTORY_ABI);
    let tokenAddress = null;
    let curveAddress = null;

    for (const log of receipt.logs) {
      try {
        const parsed = factoryIface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'TokenLaunched') {
          tokenAddress = parsed.args.token;
          curveAddress = parsed.args.curve;
          break;
        }
      } catch { /* not from factory */ }
    }

    return {
      tokenAddress,
      curveAddress,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      launchFee: ethers.formatEther(launchFee),
      explorerUrl: tokenAddress ? `${this.config.blockExplorer}/address/${tokenAddress}` : null,
      ponsUrl: tokenAddress ? `https://www.ponsfamily.com/launchpad/${tokenAddress}` : null,
    };
  }

  // ═══ Buyback & Burn ═══

  /**
   * Read the state of a Pons V2 bonding curve.
   */
  async getCurveState(curveAddress) {
    if (!this.provider) throw new Error('Not connected');
    const curve = new ethers.Contract(curveAddress, PONS_CURVE_ABI, this.provider);
    const [quoteFeeBalance, creatorTaxBalance, graduated, token, deployer, feeEscrow, trackedQuote, trackedTokens] =
      await Promise.all([
        curve.quoteFeeBalance(),
        curve.creatorTaxBalance(),
        curve.graduated(),
        curve.token(),
        curve.deployer(),
        curve.feeEscrow(),
        curve.trackedQuote(),
        curve.trackedTokens(),
      ]);
    return {
      quoteFeeBalance,
      creatorTaxBalance,
      graduated,
      token,
      deployer,
      feeEscrow,
      trackedQuote,
      trackedTokens,
      quoteFeeBalanceEth: ethers.formatEther(quoteFeeBalance),
      creatorTaxBalanceEth: ethers.formatEther(creatorTaxBalance),
    };
  }

  /**
   * Step 1: Sweep accrued fees from the bonding curve → Fee Escrow.
   * This is permissionless — anyone can call it.
   */
  async sweepCurveFees(curveAddress, signerOverride = null) {
    const signer = signerOverride || this.signer;
    if (!signer) throw new Error('No signer available');
    const curve = new ethers.Contract(curveAddress, PONS_CURVE_ABI, signer);
    const tx = await curve.sweepFees(0); // minBuybackTokensOut = 0
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Step 2: Claim creator's ETH from the Fee Escrow.
   * Must be called by the original deployer wallet (creatorFeeRecipient).
   */
  async claimFeesFromEscrow(feeEscrowAddress, signerOverride = null) {
    const signer = signerOverride || this.signer;
    if (!signer) throw new Error('No signer available');
    const escrow = new ethers.Contract(feeEscrowAddress, PONS_FEE_ESCROW_ABI, signer);
    const tx = await escrow['claim()']();
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Check claimable balance in the Fee Escrow for an address.
   */
  async getEscrowBalance(feeEscrowAddress, walletAddress) {
    if (!this.provider) throw new Error('Not connected');
    const escrow = new ethers.Contract(feeEscrowAddress, PONS_FEE_ESCROW_ABI, this.provider);
    const balance = await escrow.balanceOf(walletAddress);
    return { balance, balanceEth: ethers.formatEther(balance) };
  }

  /**
   * Step 3: Buy tokens on the bonding curve with ETH.
   */
  async buyOnCurve(curveAddress, ethAmount, minTokensOut = 0, recipient, signerOverride = null) {
    const signer = signerOverride || this.signer;
    if (!signer) throw new Error('No signer available');
    const curve = new ethers.Contract(curveAddress, PONS_CURVE_ABI, signer);
    const tx = await curve.buy(ethAmount, minTokensOut, recipient, { value: ethAmount });
    const receipt = await tx.wait();

    // Parse CurveBuy event
    const iface = new ethers.Interface(PONS_CURVE_ABI);
    let tokensOut = 0n;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'CurveBuy') {
          tokensOut = parsed.args.tokensOut;
          break;
        }
      } catch { /* not from curve */ }
    }

    return {
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      tokensOut,
      tokensOutFormatted: ethers.formatEther(tokensOut), // 18 decimals
    };
  }

  /**
   * Step 4: Burn tokens by sending to 0xdead.
   */
  async burnTokens(tokenAddress, amount, signerOverride = null) {
    const signer = signerOverride || this.signer;
    if (!signer) throw new Error('No signer available');
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await token.transfer(BURN_ADDRESS, amount);
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      burned: amount,
      burnedFormatted: ethers.formatEther(amount),
    };
  }

  /**
   * Swap ETH → token via Uniswap V4 Universal Router (for post-graduation buyback).
   * Uses V4_SWAP command with SWAP_EXACT_IN_SINGLE action.
   */
  async swapOnV4(tokenAddress, ethAmount, recipient, signerOverride = null) {
    const signer = signerOverride || this.signer;
    if (!signer) throw new Error('No signer available');

    // Determine currency0/currency1 ordering (V4 requires sorted by address)
    const NATIVE = '0x0000000000000000000000000000000000000000';
    const tokenAddr = tokenAddress.toLowerCase();
    const nativeIsZero = NATIVE < tokenAddr;
    const currency0 = nativeIsZero ? NATIVE : tokenAddress;
    const currency1 = nativeIsZero ? tokenAddress : NATIVE;
    const zeroForOne = nativeIsZero; // true if swapping currency0 (ETH) → currency1 (token)

    // Pons V2 graduated pool params (from factory launch config 0)
    const poolFee = 0; // Hook charges fees via afterSwap, pool fee is 0
    const tickSpacing = 200;
    const hooks = PONS_V2_MEME_HOOK;

    // V4_SWAP command = 0x10
    const V4_SWAP = 0x10;
    // Actions: SWAP_EXACT_IN_SINGLE=0x06, SETTLE_ALL=0x0c, TAKE_ALL=0x0f
    const SWAP_EXACT_IN_SINGLE = 0x06;
    const SETTLE_ALL = 0x0c;
    const TAKE_ALL = 0x0f;

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // V4Router ExactInputSingleParams struct definition
    const ExactInputSingleParams = 'tuple(tuple(address,address,uint24,int24,address) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)';

    // Encode the PoolKey struct
    const poolKeyTuple = [currency0, currency1, poolFee, tickSpacing, hooks];

    // Encode SWAP_EXACT_IN_SINGLE params as a struct (requires wrapping in an extra array)
    const swapParamsStruct = abiCoder.encode(
      [ExactInputSingleParams],
      [[poolKeyTuple, zeroForOne, ethAmount, 0, '0x']]
    );

    // Encode SETTLE_ALL params: (address currency, uint256 maxAmount)
    const settleParams = abiCoder.encode(
      ['address', 'uint256'],
      [NATIVE, ethAmount]
    );

    // Encode TAKE_ALL params: (address currency, uint256 minAmount)
    const takeParams = abiCoder.encode(
      ['address', 'uint256'],
      [tokenAddress, 0]
    );

    // Actions bytes
    const actions = ethers.solidityPacked(
      ['uint8', 'uint8', 'uint8'],
      [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
    );

    // V4_SWAP input: abi.encode(bytes actions, bytes[] params)
    const v4SwapInput = abiCoder.encode(
      ['bytes', 'bytes[]'],
      [actions, [swapParamsStruct, settleParams, takeParams]]
    );

    // Universal Router SWEEP command = 0x04
    // (address token, address recipient, uint256 amountMin)
    const SWEEP = 0x04;
    const sweepInput = abiCoder.encode(
      ['address', 'address', 'uint256'],
      [tokenAddress, recipient, 0]
    );

    // Universal Router execute(bytes commands, bytes[] inputs, uint256 deadline)
    const commands = ethers.solidityPacked(['uint8', 'uint8'], [V4_SWAP, SWEEP]);
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min

    const router = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, signer);
    const tx = await router.execute(commands, [v4SwapInput, sweepInput], deadline, { value: ethAmount });
    const receipt = await tx.wait();

    // Try to parse Transfer event to find tokens received
    const iface = new ethers.Interface(ERC20_ABI);
    let tokensOut = 0n;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'Transfer' && parsed.args.to.toLowerCase() === recipient.toLowerCase()) {
          tokensOut = parsed.args.value;
        }
      } catch { /* not an ERC20 transfer */ }
    }

    return {
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      tokensOut,
      tokensOutFormatted: ethers.formatEther(tokensOut),
    };
  }

  /**
   * Create a temporary signer from a private key (for deployer wallet operations).
   * Does NOT change this.signer — returns the wallet instance.
   */
  createTempSigner(privateKey) {
    const provider = this.provider || new ethers.JsonRpcProvider(this.config.rpcUrl);
    return new ethers.Wallet(privateKey, provider);
  }
}

// ═══ Pons V2 Contract Addresses ═══
const PONS_V2_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// ═══ Minimal ABI fragments for Pons V2 ═══
const PONS_FACTORY_ABI = [
  'function launchConfigCount() view returns (uint256)',
  'function getLaunchConfig(uint256 id) view returns (tuple(uint256 supply, uint256 curveFeeBps, uint256 phantomQuote, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, bool enabled))',
  'function launchFee() view returns (uint256)',
  'function launchEnabled() view returns (bool)',
  'function launchToken(tuple(string name, string symbol, string logo, string description, tuple(string x, string telegram, string discord, string website, string farcaster) socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 expectedEconomics, bytes32 salt) params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)',
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
];

// ═══ Pons V2 Bonding Curve ABI ═══
const PONS_CURVE_ABI = [
  // Read state
  'function quoteFeeBalance() view returns (uint256)',
  'function creatorTaxBalance() view returns (uint256)',
  'function graduated() view returns (bool)',
  'function token() view returns (address)',
  'function deployer() view returns (address)',
  'function feeEscrow() view returns (address)',
  'function trackedQuote() view returns (uint256)',
  'function trackedTokens() view returns (uint256)',
  'function buybackEnabled() view returns (bool)',
  'function pairToken() view returns (address)',
  // Sweep fees (permissionless)
  'function sweepFees(uint256 minBuybackTokensOut) external',
  // Buy/Sell on curve
  'function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)',
  // Events
  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)',
  'event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)',
  'event FeesSwept(uint256 protocolAmount, uint256 buybackAmount, uint256 creatorAmount)',
];

// ═══ Pons V2 Fee Escrow ABI ═══
const PONS_FEE_ESCROW_ABI = [
  'function claim() external returns (uint256 amount)',
  'function claim(uint256 amount) external returns (uint256)',
  'function balanceOf(address recipient) view returns (uint256)',
];

// ═══ Uniswap V4 Universal Router (Robinhood Chain) ═══
const UNIVERSAL_ROUTER = '0x8876789976decbfcbbbe364623c63652db8c0904';
const PONS_V2_MEME_HOOK = '0xe5e702641ea86f4ae6cc3cdaed2b886f976be044';

const UNIVERSAL_ROUTER_ABI = [
  'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) payable',
];
