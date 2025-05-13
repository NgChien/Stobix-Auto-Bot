require('dotenv').config();
const axios = require('axios');
const ethers = require('ethers');
const fs = require('fs');
const { setTimeout: setTimeoutPromise } = require('timers/promises');
const { HttpsProxyAgent } = require('https-proxy-agent');
const crypto = require('crypto');
const chalk = require('chalk');
const readline = require('readline');

// Configure chalk to use colors
chalk.level = 3; // Enable all colors

// Color palette for UI
const COLORS = {
  GREEN: '#00ff00',
  YELLOW: '#ffff00',
  RED: '#ff0000',
  WHITE: '#ffffff',
  GRAY: '#808080',
  CYAN: '#00ffff',
  MAGENTA: '#ff00ff',
  BLUE: '#0000ff',
  PURPLE: '#800080',
  ORANGE: '#ffa500',
};

// HTTP headers for Stobix API
const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/json',
  'origin': 'https://app.stobix.com',
  'referer': 'https://app.stobix.com/',
  'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
};

// MetaMask SDK headers
const metamaskHeaders = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'origin': 'https://app.stobix.com',
  'referer': 'https://app.stobix.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
};

// Utility functions
function colorText(text, color) {
  return `{${color}-fg}${text}{/}`;
}

function showSpinner(message, completionMessage = 'Done!', duration = 60) {
  const spinnerStyles = [
    ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    ['-', '=', '≡'],
    ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
    ['★', '☆', '✦', '✧'],
  ];
  const spinner = spinnerStyles[Math.floor(Math.random() * spinnerStyles.length)];
  let i = 0;
  process.stdout.write(chalk.yellow(`${message} ${spinner[0]}`));
  const interval = setInterval(() => {
    process.stdout.write(`\r${chalk.yellow(`${message} ${spinner[i++ % spinner.length]}`)}`);
  }, duration);
  return () => {
    clearInterval(interval);
    process.stdout.write(`\r${chalk.green(completionMessage)}\n`);
  };
}

async function getInput(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(chalk.magenta(promptText), (answer) => {
      rl.close();
      // Only take the first 2 digits
      const cleanInput = answer.trim().replace(/[^0-9]/g, '');
      resolve(cleanInput);
    });
  });
}

async function getInputWithConfirm(promptText) {
  while (true) {
    const input = await getInput(promptText);
    const confirm = await getInput(`You entered "${input}". Is this correct? (y/n): `);
    if (confirm.toLowerCase() === 'y') return input;
  }
}

function loadReferralCode() {
  try {
    const code = fs.readFileSync('code.txt', 'utf8').trim();
    if (!code) {
      console.log(chalk.red('Mã giới thiệu trong code.txt đang trống.'));
      return null;
    }
    console.log(chalk.blue(`Dùng mã giới thiệu: ${code}`));
    return code;
  } catch (error) {
    console.log(chalk.red(`Lỗi khi đọc code.txt: ${error.message}`));
    return null;
  }
}

function showBanner() {
  console.log(chalk.yellow('STOBIX'));
  console.log(chalk.green('Phát triển bởi: MRBIP\n'));
}

function showMenu() {
  console.log(chalk.cyan('=== MENU CHỨC NĂNG ==='));
  console.log(chalk.yellow('1. Tự động nhiệm vụ (Chỉ khai thác)'));
  console.log(chalk.yellow('2. Tự động giới thiệu (Tạo ví mới)'));
  console.log(chalk.yellow('3. Khai thác ví giới thiệu (Từ refwallet.txt)'));
  console.log(chalk.yellow('4. Thoát'));
}

function updateInfoPanel(status, details = {}) {
  console.log(chalk.cyan('\n=== THÔNG TIN HỆ THỐNG ==='));
  console.log(chalk.green(`Trạng thái: ${status}`));
  if (details.currentAccount) {
    console.log(chalk.blue(`Tài khoản: ${details.currentAccount}/${details.totalAccounts}`));
  }
  if (details.wallet) {
    console.log(chalk.blue(`Ví: ${details.wallet.slice(0, 6)}...${details.wallet.slice(-4)}`));
  }
  console.log(chalk.blue('Mạng: Stobix API (Base Chain, ID: 8453)'));
  console.log(chalk.cyan('==================\n'));
}

// Load proxies
function loadProxies() {
  try {
    const proxies = fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(p => p.trim());
    if (proxies.length === 0) {
      console.log(chalk.yellow('Không tìm thấy proxy trong proxies.txt. Tiếp tục mà không dùng proxy.'));
      return [];
    }
    console.log(chalk.blue(`Đã nạp ${proxies.length} proxy`));
    return proxies.map(proxy => {
      proxy = proxy.trim();
      if (!proxy.startsWith('http')) {
        proxy = `http://${proxy}`;
      }
      return proxy;
    });
  } catch (error) {
    console.log(chalk.red(`Lỗi khi tải proxy: ${error.message}`));
    return [];
  }
}

// Stobix API functions
async function getNonce(address, proxyAgent, silent = false) {
  const stopSpinner = silent ? () => {} : showSpinner('Fetching nonce...', 'Nonce fetched!');
  try {
    // First request MetaMask SDK
    const metamaskPayload = {
      id: crypto.randomUUID(),
      event: "sdk_rpc_request",
      sdkVersion: "0.32.0",
      dappId: "app.stobix.com",
      from: "extension",
      method: "eth_requestAccounts",
      platform: "web-desktop",
      source: "wagmi",
      title: "wagmi",
      url: "https://app.stobix.com"
    };

    await axios.post('https://metamask-sdk.api.cx.metamask.io/evt', 
      metamaskPayload,
      { 
        headers: metamaskHeaders, 
        httpsAgent: proxyAgent,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      }
    );

    const response = await axios.post('https://api.stobix.com/v1/auth/nonce', 
      { address },
      { 
        headers, 
        httpsAgent: proxyAgent,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      }
    );
    if (!silent) stopSpinner();
    return response.data.nonce;
  } catch (error) {
    if (!silent) stopSpinner();
    console.log(chalk.red(`Failed to fetch nonce: ${error.message}`));
    throw error;
  }
}

async function verifySignature(nonce, signature, proxyAgent, silent = false) {
  const stopSpinner = silent ? () => {} : showSpinner('Verifying signature...', 'Signature verified!');
  try {
    const response = await axios.post('https://api.stobix.com/v1/auth/web3/verify',
      { nonce, signature, chain: 8453 },
      { 
        headers, 
        httpsAgent: proxyAgent,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 500; // Accept all status codes less than 500
        }
      }
    );
    if (!silent) {
      stopSpinner();
      console.log(chalk.green('Token retrieved'));
    }
    return response.data.token;
  } catch (error) {
    if (!silent) stopSpinner();
    console.log(chalk.red(`Failed to verify signature: ${error.message}`));
    throw error;
  }
}

async function claimTask(token, taskId, proxyAgent) {
  const stopSpinner = showSpinner(`Claiming task ${taskId}...`, `Task ${taskId} claimed!`);
  try {
    const response = await axios.post('https://api.stobix.com/v1/loyalty/tasks/claim',
      { taskId },
      { headers: { ...headers, authorization: `Bearer ${token}` }, httpsAgent: proxyAgent }
    );
    stopSpinner();
    console.log(chalk.green(`Claimed task ${taskId}: ${response.data.points} points`));
    return true;
  } catch (error) {
    stopSpinner();
    if (error.response && error.response.status === 400) {
      console.log(chalk.yellow(`Task ${taskId}: already claimed`));
      return false;
    }
    console.log(chalk.red(`Failed to claim task ${taskId}: ${error.message}`));
    return false;
  }
}

async function checkMiningStatus(token, walletAddress, proxyAgent, silent = false) {
  const stopSpinner = silent ? () => {} : showSpinner('Checking mining status...', 'Mining status checked!');
  try {
    const response = await axios.get('https://api.stobix.com/v1/loyalty',
      { headers: { ...headers, authorization: `Bearer ${token}` }, httpsAgent: proxyAgent }
    );
    const miningClaimAt = response.data.user.miningClaimAt;
    if (miningClaimAt) {
      if (!silent) {
        stopSpinner();
        console.log(chalk.blue(`Mining status for ${walletAddress}: claimAt ${miningClaimAt}`));
      }
      return miningClaimAt;
    }
    throw new Error('No miningClaimAt found in response');
  } catch (error) {
    if (!silent) stopSpinner();
    console.log(chalk.yellow(`Failed to check mining status for ${walletAddress}: ${error.message}`));
    const fallbackClaimAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    if (!silent) {
      console.log(chalk.blue(`Using fallback claimAt: ${fallbackClaimAt}`));
    }
    return fallbackClaimAt;
  }
}

async function startMining(token, walletAddress, proxyAgent, silent = false) {
  const stopSpinner = silent ? () => {} : showSpinner('Starting mining...', 'Mining started!');
  try {
    const response = await axios.post('https://api.stobix.com/v1/loyalty/points/mine',
      {},
      { headers: { ...headers, authorization: `Bearer ${token}` }, httpsAgent: proxyAgent }
    );
    const { amount, claimAt } = response.data;
    if (!silent) {
      stopSpinner();
      console.log(chalk.green(`Mining started for ${walletAddress}: ${amount} points`));
    }
    return claimAt;
  } catch (error) {
    if (!silent) stopSpinner();
    if (error.response && error.response.status === 400 && error.response.data.error === 'Already mining') {
      console.log(chalk.yellow(`Wallet ${walletAddress}: already mining`));
      const claimAt = await checkMiningStatus(token, walletAddress, proxyAgent, silent);
      return claimAt;
    }
    console.log(chalk.red(`Failed to start mining for ${walletAddress}: ${error.message}`));
    throw error;
  }
}

async function visitReferral(ref, proxyAgent) {
  const stopSpinner = showSpinner(`Visiting referral link ${ref}...`, `Referral link visited!`);
  try {
    await axios.get(`https://stobix.com/invite/${ref}`, { 
      headers, 
      httpsAgent: proxyAgent,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept all status codes less than 500
      }
    });
    stopSpinner();
    console.log(chalk.green(`Visited referral link: ${ref}`));
  } catch (error) {
    stopSpinner();
    console.log(chalk.red(`Failed to visit referral link: ${error.message}`));
  }
}

async function retry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(chalk.hex('#FFA500')(`Retrying (${i + 1}/${retries}) after ${delay}ms...`));
      await setTimeoutPromise(delay);
    }
  }
}

function displayTimeLeft(claimAt, address) {
  const claimTime = new Date(claimAt).getTime();
  const now = Date.now();
  const timeLeft = claimTime - now;
  if (timeLeft <= 0) {
    console.log(chalk.magenta(`Mining ready for wallet ${address}`));
    return;
  }
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  console.log(chalk.cyan(`Time left for wallet ${address}: ${hours}h ${minutes}m ${seconds}s`));
}

// Auto Task: Mining only
async function autoTask() {
  updateInfoPanel('Auto Task');
  // Đọc private key từ file key.txt, mỗi dòng là một private key
  let privateKeys = [];
  try {
    if (!fs.existsSync('key.txt')) {
      console.log(chalk.red('Không tìm thấy file key.txt. Vui lòng tạo file này và thêm private key vào mỗi dòng.'));
      return [];
    }
    privateKeys = fs.readFileSync('key.txt', 'utf8').split('\n').map(line => line.trim()).filter(line => line);
  } catch (err) {
    console.log(chalk.red('Lỗi khi đọc file key.txt: ' + err.message));
    return [];
  }

  if (privateKeys.length === 0) {
    console.log(chalk.red('Không tìm thấy private key nào trong file key.txt. Vui lòng thêm ít nhất một private key.'));
    return [];
  }

  const proxies = loadProxies();
  const wallets = [];

  console.log(chalk.blue(`Tìm thấy ${privateKeys.length} private key. Bắt đầu khai thác...`));
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
    try {
      const signer = new ethers.Wallet(privateKey);
      const walletAddress = signer.address;
      updateInfoPanel('Processing Wallet', { currentAccount: i + 1, totalAccounts: privateKeys.length, wallet: walletAddress });
      console.log(chalk.cyan(`[${i + 1}/${privateKeys.length}] Mining for wallet: ${walletAddress}`));
      let proxyAgent = null;
      if (proxy) {
        try {
          proxyAgent = new HttpsProxyAgent(proxy);
          console.log(chalk.gray(`Using proxy: ${proxy}`));
        } catch (error) {
          console.log(chalk.yellow(`Invalid proxy ${proxy}. Proceeding without proxy.`));
        }
      }
      const nonce = await retry(() => getNonce(walletAddress, proxyAgent));
      const message = `Sign this message to authenticate: ${nonce}`;
      const signature = await signer.signMessage(message);
      const token = await retry(() => verifySignature(nonce, signature, proxyAgent));
      const claimAt = await retry(() => startMining(token, walletAddress, proxyAgent));
      displayTimeLeft(claimAt, walletAddress);
      wallets.push({ privateKey, proxy, address: walletAddress, claimAt });
    } catch (error) {
      console.log(chalk.red(`Error mining for wallet at index ${i + 1}: ${error.message}`));
    }
    if (i < privateKeys.length - 1) {
      console.log(chalk.gray('Waiting 5 seconds before next wallet...'));
      const stopSpinner = showSpinner('Waiting...', 'Proceeding to next wallet!');
      await setTimeoutPromise(5000);
      stopSpinner();
    }
  }
  console.log(chalk.green(`Processed ${wallets.length} wallets for mining.`));
  return wallets;
}

// Auto Referral: Create wallets and process tasks, save to refwallet.txt
async function autoReferral() {
  updateInfoPanel('Auto Referral');
  const referralCode = loadReferralCode();
  if (!referralCode || !referralCode.trim()) {
    console.log(chalk.red('Referral code in code.txt is empty or missing.'));
    return [];
  }

  const accountCountInput = await getInput('Số tài khoản muốn tạo: ');
  const accountCount = parseInt(accountCountInput);
  
  if (isNaN(accountCount) || accountCount <= 0) {
    console.log(chalk.red('Invalid number of accounts. Please enter a positive number.'));
    return [];
  }

  console.log(chalk.blue(`Creating ${accountCount} accounts...`));
  const proxies = loadProxies();
  const wallets = [];
  let refWalletIndex = 1;
  if (fs.existsSync('refwallet.txt')) {
    // Find the last index used
    const lines = fs.readFileSync('refwallet.txt', 'utf8').split('\n').filter(Boolean);
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const match = lastLine.match(/PRIVATE_KEY_(\d+)=/);
      if (match) refWalletIndex = parseInt(match[1]) + 1;
    }
  }

  for (let i = 0; i < accountCount; i++) {
    updateInfoPanel('Processing Referral', { currentAccount: i + 1, totalAccounts: accountCount });
    console.log(chalk.cyan(`[${i + 1}/${accountCount}] Đang tạo ví mới...`));
    const stopSpinner = showSpinner('Đang tạo ví...', 'Đã tạo ví!');
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey;
    stopSpinner();
    console.log(chalk.white(`Đã tạo ví: ${address.slice(0, 6)}...${address.slice(-4)}`));
    // Lưu vào refwallet.txt: mỗi dòng là một private key thuần
    fs.appendFileSync('refwallet.txt', `${privateKey}\n`);
    try {
      const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
      let proxyAgent = null;
      if (proxy) {
        try {
          proxyAgent = new HttpsProxyAgent(proxy);
          console.log(chalk.gray(`Using proxy: ${proxy}`));
        } catch (error) {
          console.log(chalk.yellow(`Invalid proxy ${proxy}. Proceeding without proxy.`));
        }
      }
      await visitReferral(referralCode, proxyAgent);
      const nonce = await retry(() => getNonce(address, proxyAgent));
      const message = `Sign this message to authenticate: ${nonce}`;
      const signature = await wallet.signMessage(message);
      const token = await retry(() => verifySignature(nonce, signature, proxyAgent));
      const tasks = [
        'follow_x',
        'join_discord',
        'join_telegram_channel',
        'join_telegram_chat'
      ];
      let tasksCompleted = 0;
      for (const task of tasks) {
        const success = await claimTask(token, task, proxyAgent);
        if (success) tasksCompleted++;
        await setTimeoutPromise(2000);
      }
      console.log(chalk.magenta(`Completed ${tasksCompleted}/${tasks.length} tasks for ${address}`));
      const claimAt = await retry(() => startMining(token, address, proxyAgent));
      wallets.push({ privateKey, proxy, address, claimAt });
    } catch (error) {
      console.log(chalk.red(`Failed to process wallet: ${error.message}`));
    }
    if (i < accountCount - 1) {
      const delay = Math.floor(Math.random() * 5000) + 5000;
      console.log(chalk.gray(`Waiting ${(delay / 1000).toFixed(1)} seconds before next account...`));
      const stopDelaySpinner = showSpinner('Waiting...', 'Proceeding to next account!');
      await setTimeoutPromise(delay);
      stopDelaySpinner();
    }
  }
  updateInfoPanel('Referral Completed', { currentAccount: accountCount, totalAccounts: accountCount });
  console.log(chalk.green(`All accounts processed! ${wallets.length} wallets created and saved to refwallet.txt.`));
  return wallets;
}

// Referral Mining: Mine wallets from refwallet.txt
async function referralMining() {
  updateInfoPanel('Referral Mining');
  if (!fs.existsSync('refwallet.txt')) {
    console.log(chalk.red('Không tìm thấy file refwallet.txt. Vui lòng chạy chức năng Tự động giới thiệu trước.'));
    return [];
  }
  // Đọc mỗi dòng là một private key thuần
  const privateKeys = fs.readFileSync('refwallet.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
  if (privateKeys.length === 0) {
    console.log(chalk.red('Không tìm thấy private key nào trong refwallet.txt.'));
    return [];
  }
  const proxies = loadProxies();
  const wallets = [];
  console.log(chalk.blue(`Tìm thấy ${privateKeys.length} ví giới thiệu. Bắt đầu khai thác...`));
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
    try {
      const signer = new ethers.Wallet(privateKey);
      const walletAddress = signer.address;
      updateInfoPanel('Referral Mining', { currentAccount: i + 1, totalAccounts: privateKeys.length, wallet: walletAddress });
      console.log(chalk.cyan(`[${i + 1}/${privateKeys.length}] Đang khai thác cho ví giới thiệu: ${walletAddress}`));
      let proxyAgent = null;
      if (proxy) {
        try {
          proxyAgent = new HttpsProxyAgent(proxy);
          console.log(chalk.gray(`Đang sử dụng proxy: ${proxy}`));
        } catch (error) {
          console.log(chalk.yellow(`Proxy không hợp lệ ${proxy}. Tiếp tục mà không dùng proxy.`));
        }
      }
      const nonce = await retry(() => getNonce(walletAddress, proxyAgent));
      const message = `Sign this message to authenticate: ${nonce}`;
      const signature = await signer.signMessage(message);
      const token = await retry(() => verifySignature(nonce, signature, proxyAgent));
      const claimAt = await retry(() => startMining(token, walletAddress, proxyAgent));
      displayTimeLeft(claimAt, walletAddress);
      wallets.push({ privateKey, proxy, address: walletAddress, claimAt });
    } catch (error) {
      console.log(chalk.red(`Lỗi khai thác cho ví giới thiệu ở vị trí ${i + 1}: ${error.message}`));
    }
    if (i < privateKeys.length - 1) {
      console.log(chalk.gray('Đang chờ 5 giây trước khi chuyển sang ví tiếp theo...'));
      const stopSpinner = showSpinner('Đang chờ...', 'Chuyển sang ví tiếp theo!');
      await setTimeoutPromise(5000);
      stopSpinner();
    }
  }
  console.log(chalk.green(`Đã xử lý ${wallets.length} ví giới thiệu để khai thác.`));
  return wallets;
}

function mainMenu() {
  showBanner();
  showMenu();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(chalk.cyan('\nLựa chọn option: '), async (option) => {
    if (option === '1') {
      console.log(chalk.green('\n[Auto Task (Mining Only) selected]\n'));
      await autoTask();
      rl.close();
      setTimeout(mainMenu, 1000);
    } else if (option === '2') {
      console.log(chalk.green('\n[Auto Referral selected]\n'));
      await autoReferral();
      rl.close();
      setTimeout(mainMenu, 1000);
    } else if (option === '3') {
      console.log(chalk.green('\n[Referral Mining selected]\n'));
      await referralMining();
      rl.close();
      setTimeout(mainMenu, 1000);
    } else if (option === '4') {
      console.log(chalk.yellow('\nExiting...'));
      rl.close();
      process.exit(0);
    } else {
      console.log(chalk.red('\nInvalid option!'));
      rl.close();
      setTimeout(mainMenu, 1000);
    }
  });
}

mainMenu();
