import "dotenv/config";
import { Client } from "discord.js-selfbot-v13";
import fs from "fs";
import inquirer from "inquirer";
import axios from "axios";
import { execSync } from "child_process";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const localPkg = require("./package.json");

const configPath = "./config.json";

// Auto-update check
async function checkForUpdate() {
  try {
    const { data: remotePkg } = await axios.get(
      "https://raw.githubusercontent.com/lawerth/owo-auto-cookie-sender/main/package.json"
    );

    if (remotePkg.version !== localPkg.version) {
      console.log(`📢 New version available: v${remotePkg.version} (Current: v${localPkg.version})`);
      const { update } = await inquirer.prompt([
        {
          type: "confirm",
          name: "update",
          message: "Would you like to update?",
          default: true,
        },
      ]);

      if (update) {
        console.log("🔄 Updating...");
        execSync("git pull", { stdio: "inherit" });
        console.log("✅ Update complete. Continuing...\n");
      }
    }
  } catch (err) {
    console.log("⚠️ Update check failed: " + err.message);
  }
}

// Load all tokens
const tokens = Object.entries(process.env)
  .filter(([key]) => key.startsWith("TOKEN"))
  .map(([_, value]) => value);

let saved = {
  channelId: "",
  userId: "",
  interval: 5,
  type: "cookie",
  channelName: "",
  userName: ""
};

// Load or create config
if (fs.existsSync(configPath)) {
  try {
    const file = fs.readFileSync(configPath, "utf8");
    saved = { ...saved, ...JSON.parse(file) };
    console.log("💾 Previous settings loaded.\n");
  } catch {
    console.log("⚠️ Failed to read settings, loading defaults.");
  }
} else {
  fs.writeFileSync(configPath, JSON.stringify(saved, null, 2));
  console.log("🆕 Config file created.\n");
}

// Prompt helpers
async function askWithDefault(message, defaultValue) {
  const answer = await inquirer.prompt([
    {
      type: "input",
      name: "response",
      message,
      default: defaultValue,
    },
  ]);
  return answer.response.trim() || defaultValue;
}

async function askChoice(message, choices, defaultValue) {
  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "response",
      message,
      choices,
      default: defaultValue,
    },
  ]);
  return answer.response;
}

(async () => {
  await checkForUpdate();

  const firstClient = new Client();
  await firstClient.login(tokens[0]);

  const channelId = await askWithDefault(`What is the channel ID?${saved.channelName ? ` (${saved.channelName})` : ""}: `, saved.channelId);
  const userId = await askWithDefault(`What is the user ID?${saved.userName ? ` (${saved.userName})` : ""}: `, saved.userId);
  const interval = parseInt(await askWithDefault("Send interval? (seconds): ", saved.interval.toString())) * 1000;

  const typeChoices = [
    { name: "Cookie", value: "cookie" },
    { name: "Clover", value: "clover" },
    { name: "Cookie & Clover", value: "both" },
  ];
  const type = await askChoice("What should be sent?: ", typeChoices, saved.type);

  let channelName = "";
  let userName = "";

  try {
    const channel = await firstClient.channels.fetch(channelId);
    channelName = channel.name || channel.id;
  } catch {
    channelName = "Unknown";
  }

  try {
    const user = await firstClient.users.fetch(userId);
    userName = user.username || user.id;
  } catch {
    userName = "Unknown";
  }

  firstClient.destroy();

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      { channelId, userId, interval: interval / 1000, type, channelName, userName },
      null,
      2
    )
  );

  const messagesToSend = [];
  if (type === "cookie" || type === "both") {
    messagesToSend.push(`owo cookie ${userId}`);
  }
  if (type === "clover" || type === "both") {
    messagesToSend.push(`owo clover ${userId}`);
  }

  for (const token of tokens) {
    const client = new Client();
    try {
      await client.login(token);
      console.log(`✅ Logged in as: ${client.user.username}`);

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.log("❌ Channel not found. Skipping token.");
        client.destroy();
        continue;
      }

      for (const msg of messagesToSend) {
        await channel.send(msg);
        console.log(`📤 Message sent: "${msg}"`);
        await new Promise((res) => setTimeout(res, 1000));
      }

      client.destroy();
      console.log(`👋 Logged out: ${client.user.username}`);
      await new Promise((res) => setTimeout(res, interval));
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      client.destroy();
    }
  }

  console.log("🎉 All tasks completed.");
  process.exit(0);
})();
