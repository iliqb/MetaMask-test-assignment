import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.10.0/+esm";

const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

// Minimal ABI: only the ERC20 methods required for balance display
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

let provider;
let currentAccount;
let usdtContract;
let blockListener;

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connectBtn");
  const walletInfo = document.getElementById("walletInfo");
  const statusText = document.getElementById("statusText");
  const walletAddress = document.getElementById("walletAddress");
  const networkName = document.getElementById("networkName");
  const ethBalanceEl = document.getElementById("ethBalance");
  const usdtBalanceEl = document.getElementById("usdtBalance");

  function shortenAddress(address) {
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  async function loadETHBalance() {
    try {
      const balance = await provider.getBalance(currentAccount); // Returns balance in wei (BigInt)
      const formatted = ethers.formatEther(balance); // Convert wei → ETH
      ethBalanceEl.innerText = parseFloat(formatted).toFixed(4) + " ETH";
    } catch (error) {
      console.error("ETH balance error:", error);
      ethBalanceEl.innerText = "Error";
    }
  }

  async function loadUSDTBalance() {
    try {
      const balance = await usdtContract.balanceOf(currentAccount); // Raw token balance
      const decimals = await usdtContract.decimals(); // Needed for proper unit conversion
      const formatted = ethers.formatUnits(balance, decimals);
      usdtBalanceEl.innerText = parseFloat(formatted).toFixed(2) + " USDT";
    } catch (error) {
      console.error("USDT balance error:", error);
      usdtBalanceEl.innerText = "Error";
    }
  }

  async function switchToMainnet() {
    try {
      // Forces wallet to switch to Ethereum Mainnet (chainId 0x1)
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
    } catch (error) {
      console.error("Network switch error:", error);
      throw error;
    }
  }

  async function setupWallet() {
    const network = await provider.getNetwork();

    // Ensure the app runs only on Ethereum Mainnet
    if (network.chainId !== 1n) {
      await switchToMainnet();
    }

    const updatedNetwork = await provider.getNetwork();
    networkName.innerText = updatedNetwork.name;

    // Instantiate USDT contract connected to the provider
    usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);

    walletInfo.classList.remove("hidden");
    statusText.innerText = "Connected ✅";
    walletAddress.innerText = shortenAddress(currentAccount);
    connectBtn.innerText = "Connected";

    await loadETHBalance();
    await loadUSDTBalance();

    // Prevent duplicate block listeners
    if (blockListener) {
      provider.off("block", blockListener);
    }

    // Re-fetch balances on every new block
    blockListener = async () => {
      await loadETHBalance();
      await loadUSDTBalance();
    };

    provider.on("block", blockListener);
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("MetaMask not installed");
        return;
      }

      // BrowserProvider connects ethers.js to the injected wallet (MetaMask)
      provider = new ethers.BrowserProvider(window.ethereum);

      // Request account access from the user
      const accounts = await provider.send("eth_requestAccounts", []);
      currentAccount = accounts[0];

      await setupWallet();
    } catch (error) {
      console.error("Connection error:", error);
      statusText.innerText = "Connection failed ❌";
    }
  }

  async function checkIfAlreadyConnected() {
    if (!window.ethereum) return;

    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();

    // Auto-initialize if wallet was previously authorized
    if (accounts.length > 0) {
      currentAccount = accounts[0].address;
      await setupWallet();
    }
  }

  connectBtn.addEventListener("click", connectWallet);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (accounts.length === 0) {
        window.location.reload(); // Wallet disconnected
      } else {
        currentAccount = accounts[0];
        walletAddress.innerText = shortenAddress(currentAccount);
        await loadETHBalance();
        await loadUSDTBalance();
      }
    });

    window.ethereum.on("chainChanged", () => {
      window.location.reload(); // Reinitialize app on network change
    });
  }

  checkIfAlreadyConnected();
});
