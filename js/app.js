import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.10.0/+esm";

const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

let provider;
let currentAccount;
let usdtContract;
let blockListener;
let usdtDecimals;

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connectBtn");
  const walletInfo = document.getElementById("walletInfo");
  const statusText = document.getElementById("statusText");
  const walletAddress = document.getElementById("walletAddress");
  const networkName = document.getElementById("networkName");
  const ethBalanceEl = document.getElementById("ethBalance");
  const usdtBalanceEl = document.getElementById("usdtBalance");
  const loader = document.getElementById("loader");
  const complete = document.getElementById("complete");
  const warning = document.getElementById("metamask-warning");

  /* =========================
     WALLET DETECTION (ROBUSTA)
  ========================== */

  function checkExtension() {
    if (typeof window.ethereum !== "undefined") {
      warning.classList.add("hidden");
      connectBtn.classList.remove("hidden");
      console.log("Wallet installed");
      checkIfAlreadyConnected();
    } else {
      warning.classList.remove("hidden");
      connectBtn.classList.add("hidden");
      console.log("Wallet no installed");
    }
  }

  if (window.ethereum) {
    checkExtension();
  } else {
    window.addEventListener("ethereum#initialized", checkExtension, {
      once: true,
    });
    setTimeout(checkExtension, 1000);
  }

  /* =========================
     UI HELPERS
  ========================== */

  function showLoader() {
    loader.classList.remove("hidden");
    complete.classList.add("hidden");
  }

  function hideLoader() {
    loader.classList.add("hidden");
  }

  function showComplete() {
    complete.classList.remove("hidden");
    setTimeout(() => {
      complete.classList.add("hidden");
    }, 2000);
  }

  function shortenAddress(address) {
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  /* =========================
     BALANCES
  ========================== */

  async function loadETHBalance() {
    try {
      const balance = await provider.getBalance(currentAccount);
      const formatted = ethers.formatEther(balance);
      ethBalanceEl.innerText = parseFloat(formatted).toFixed(4) + " ETH";
    } catch (error) {
      console.error("ETH balance error:", error);
      ethBalanceEl.innerText = "Error";
    }
  }

  async function loadUSDTBalance() {
    try {
      const balance = await usdtContract.balanceOf(currentAccount);
      const formatted = ethers.formatUnits(balance, usdtDecimals);
      usdtBalanceEl.innerText = parseFloat(formatted).toFixed(2) + " USDT";
    } catch (error) {
      console.error("USDT balance error:", error);
      usdtBalanceEl.innerText = "Error";
    }
  }

  /* =========================
     NETWORK
  ========================== */

  async function switchToMainnet() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
    } catch (error) {
      console.error("Switch error:", error);
      throw error;
    }
  }

  /* =========================
     WALLET SETUP
  ========================== */

  async function setupWallet() {
    try {
      let network = await provider.getNetwork();

      if (network.chainId !== 1n) {
        try {
          await switchToMainnet();
        } catch {
          statusText.innerText = "Please switch to Ethereum Mainnet ⚠️";
          return;
        }
      }

      network = await provider.getNetwork();
      networkName.innerText = network.name;

      usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
      usdtDecimals = await usdtContract.decimals();

      walletInfo.classList.remove("hidden");
      statusText.innerText = "Connected ✅";
      walletAddress.innerText = shortenAddress(currentAccount);
      connectBtn.innerText = "Connected";

      await loadETHBalance();
      await loadUSDTBalance();

      if (blockListener) {
        provider.off("block", blockListener);
      }

      blockListener = async () => {
        await loadETHBalance();
        await loadUSDTBalance();
      };

      provider.on("block", blockListener);
    } catch (error) {
      console.error("Setup error:", error);
    }
  }

  /* =========================
     CONNECT WALLET
  ========================== */

  async function connectWallet() {
    try {
      if (!window.ethereum) return;

      showLoader();
      statusText.innerText = "Connecting...";

      provider = new ethers.BrowserProvider(window.ethereum);

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      currentAccount = await signer.getAddress();

      await setupWallet();

      hideLoader();
      showComplete();
    } catch (error) {
      console.error("Connection error:", error);
      hideLoader();

      if (error.code === 4001) {
        statusText.innerText = "User rejected connection ❌";
      } else {
        statusText.innerText = "Connection failed ❌";
      }
    }
  }

  /* =========================
     AUTO RECONNECT
  ========================== */

  async function checkIfAlreadyConnected() {
    if (!window.ethereum) return;

    provider = new ethers.BrowserProvider(window.ethereum);

    const accounts = await provider.listAccounts();

    if (accounts.length > 0) {
      const signer = await provider.getSigner();
      currentAccount = await signer.getAddress();
      await setupWallet();
    }
  }

  /* =========================
     EVENTS
  ========================== */

  connectBtn.addEventListener("click", connectWallet);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (accounts.length === 0) {
        window.location.reload();
      } else {
        currentAccount = accounts[0];
        walletAddress.innerText = shortenAddress(currentAccount);
        await loadETHBalance();
        await loadUSDTBalance();
      }
    });

    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });
  }
});
