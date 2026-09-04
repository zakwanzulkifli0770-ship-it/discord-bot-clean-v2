require('dotenv').config()
const express = require('express')
const OpenAI = require('openai')
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')

function parseIds(value) {
  return (value || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
}

const TOKEN = process.env.TOKEN
const OWNER_ID = process.env.OWNER_ID || "857317617148231690"
const ADMIN_IDS = parseIds(process.env.ADMIN_IDS)
const MOD_IDS = parseIds(process.env.MOD_IDS)
const DASHBOARD_CHANNEL_ID = process.env.DASHBOARD_CHANNEL_ID || "884579927557558303"
const AI_COOLDOWN_MS = Number(process.env.AI_COOLDOWN_MS) || 15000
const AI_MAX_PROMPT_LENGTH = Number(process.env.AI_MAX_PROMPT_LENGTH) || 1500
const PORT = Number(process.env.PORT) || 3000
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna"
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || TEXT_MODEL

let openaiClient

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
    if (!apiKey) {
      const error = new Error('OPENAI_API_KEY is missing')
      error.code = 'MISSING_OPENAI_KEY'
      throw error
    }

    openaiClient = new OpenAI({ apiKey })
  }

  return openaiClient
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

function getUserRole(userId) {
  if (userId === OWNER_ID) return "owner"
  if (ADMIN_IDS.includes(userId)) return "admin"
  if (MOD_IDS.includes(userId)) return "mod"
  return "user"
}

async function getOpenAIReply(prompt) {
  const response = await getOpenAIClient().responses.create({
    model: TEXT_MODEL,
    instructions: 'Answer clearly and helpfully. Keep responses concise unless detail is requested.',
    input: prompt
  })

  const reply = response.output_text?.trim()
  if (!reply) throw new Error('OpenAI returned an empty response')
  return reply
}

function splitDiscordMessage(text) {
  const chunks = []
  for (let index = 0; index < text.length; index += 2000) {
    chunks.push(text.slice(index, index + 2000))
  }
  return chunks
}

function getAiPrompt(message) {
  const content = message.content.trim()
  const commandMatch = content.match(/^!(ai|ask)(?:\s+|$)/i)

  if (commandMatch) {
    return content.slice(commandMatch[0].length).trim()
  }

  if (client.user && message.mentions.has(client.user)) {
    return content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .trim()
  }

  return null
}

// =======================
// VARIABLES
// =======================
let dashboardMessage
let statusInterval
let dashboardInterval
const aiCooldowns = new Map()
const activeAiRequests = new Set()

// =======================
// BUTTON PANEL
// =======================
function getControlPanel() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('refresh')
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('status')
      .setLabel('📊 Status')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('ai')
      .setLabel('🤖 AI Test')
      .setStyle(ButtonStyle.Secondary)
  )
}

// =======================
// READY EVENT
// =======================
client.on('clientReady', async () => {
  console.log(`Bot online sebagai ${client.user.tag}`)

  // 🔥 AUTO STATUS ROTATION
  const statuses = [
    "THE OWNER OF ZYR BOT 👑",
    "AI Assistant 🤖",
    "Monitoring system 📊",
    "Grinding Discord bots 💻"
  ]

  let statusIndex = 0

  clearInterval(statusInterval)
  clearInterval(dashboardInterval)

  const updatePresence = () => {
    client.user.setPresence({
      activities: [{ name: statuses[statusIndex], type: 3 }],
      status: "online"
    })

    statusIndex = (statusIndex + 1) % statuses.length
  }

  updatePresence()
  statusInterval = setInterval(updatePresence, 10000)

  // =======================
  // DASHBOARD
  // =======================
  const channel = await client.channels.fetch(DASHBOARD_CHANNEL_ID)
    .catch(err => {
      console.log("Channel error:", err.message)
      return null
    })

  if (!channel?.isTextBased()) {
    return console.log("Dashboard channel tak jumpa atau bukan channel teks")
  }

  try {
    if (dashboardMessage) {
      await dashboardMessage.fetch()
    } else {
      dashboardMessage = await channel.send({
        content: "Loading dashboard...",
        components: [getControlPanel()]
      })
    }

    updateDashboard()
    dashboardInterval = setInterval(updateDashboard, 10000)
  } catch (err) {
    dashboardMessage = null
    console.log("Dashboard error:", err.message)
  }
})

// =======================
// DASHBOARD UPDATE
// =======================
function updateDashboard() {
  if (!dashboardMessage) return

  dashboardMessage.edit({
    content:
`🤖 BOT DASHBOARD

🟢 Status: ONLINE
📡 Ping: ${client.ws.ping}ms
⏱ Uptime: ${Math.floor(process.uptime())}s
📅 Time: ${new Date().toLocaleString()}`,
    components: [getControlPanel()]
  }).catch(err => console.log("Dashboard edit error:", err))
}

function getHelpMessage() {
  return `
🤖 **ZYR BOT COMMANDS**

**AI**
• !ai <soalan> atau !ask <soalan>
• Mention bot untuk bertanya
• Cooldown: ${AI_COOLDOWN_MS / 1000}s setiap pengguna

**UTILITY**
• !help - Papar arahan
• !ping - Semak latency bot
• Tekan butang dashboard untuk kawalan staff
`
}

// =======================
// BUTTON INTERACTIONS (MULTI-ADMIN LOCK)
// =======================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return

  const role = getUserRole(interaction.user.id)

  // ❌ NO ACCESS
  if (role === "user") {
    return interaction.reply({
      content: "⛔ You are not allowed to use this control panel.",
      ephemeral: true
    })
  }

  // =======================
  // REFRESH (MOD+)
  // =======================
  if (interaction.customId === 'refresh') {
    updateDashboard()
    return interaction.reply({
      content: `🔄 Dashboard refreshed (${role})`,
      ephemeral: true
    })
  }

  // =======================
  // STATUS (ALL ADMINS)
  // =======================
  if (interaction.customId === 'status') {
    return interaction.reply({
      content:
`🟢 ROLE: ${role.toUpperCase()}
📡 Ping: ${client.ws.ping}ms
⏱ Uptime: ${Math.floor(process.uptime())}s`,
      ephemeral: true
    })
  }

  // =======================
  // AI TEST (MOD+)
  // =======================
  if (interaction.customId === 'ai') {
    return interaction.reply({
      content: `🤖 AI is ready. Ask me in this server with !ai your question, !ask your question, or mention me. (${role})`,
      ephemeral: true
    })
  }

  // =======================
  // SHUTDOWN (OWNER ONLY)
  // =======================
  if (interaction.customId === 'shutdown') {
    if (role !== "owner") {
      return interaction.reply({
        content: "⛔ Only OWNER can shutdown bot",
        ephemeral: true
      })
    }

    await interaction.reply({
      content: "🛑 Shutting down bot...",
      ephemeral: true
    })

    process.exit(0)
  }
})

// =======================
// AI COMMAND
// =======================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return

  const command = message.content.trim().match(/^!(help|commands|ping)(?:\s|$)/i)?.[1]?.toLowerCase()
  if (command === 'help' || command === 'commands') {
    return message.reply(getHelpMessage())
  }

  if (command === 'ping') {
    return message.reply(`🏓 Pong! Discord latency: ${client.ws.ping}ms`)
  }

  const prompt = getAiPrompt(message)
  if (prompt === null) return

  if (!prompt) {
    return message.reply("Ask a question after `!ai`, `!ask`, or your mention of me.")
  }

  if (prompt.length > AI_MAX_PROMPT_LENGTH) {
    return message.reply(`❌ Soalan terlalu panjang. Had maksimum ialah ${AI_MAX_PROMPT_LENGTH} aksara.`)
  }

  const requestKey = `${message.guildId || 'dm'}:${message.author.id}`
  const cooldownUntil = aiCooldowns.get(requestKey) || 0
  if (cooldownUntil > Date.now()) {
    const seconds = Math.ceil((cooldownUntil - Date.now()) / 1000)
    return message.reply(`⏳ Sila tunggu ${seconds}s sebelum bertanya lagi.`)
  }

  if (activeAiRequests.has(requestKey)) {
    return message.reply("🧠 Soalan anda masih sedang diproses. Tunggu jawapan sebelumnya selesai.")
  }

  aiCooldowns.set(requestKey, Date.now() + AI_COOLDOWN_MS)
  activeAiRequests.add(requestKey)

  const thinkingMsg = await message.channel.send("🧠 Thinking...")

  try {
    const reply = await getOpenAIReply(prompt)
    const chunks = splitDiscordMessage(reply)

    await thinkingMsg.edit(chunks[0])
    for (const chunk of chunks.slice(1)) {
      await message.channel.send(chunk)
    }
  } catch (err) {
    const apiError = err.response?.data?.error?.message
    console.error('OpenAI error:', apiError || err.message)

    if (err.code === 'MISSING_OPENAI_KEY') {
      await thinkingMsg.edit("❌ AI belum dikonfigurasi. Tambah OPENAI_KEY dalam fail .env.")
    } else if (err.response?.data?.error?.code === 'insufficient_quota') {
      await thinkingMsg.edit("❌ Kredit OpenAI telah habis. Tambah kredit di https://platform.openai.com/settings/organization/billing/")
    } else if (err.response?.status === 429) {
      await thinkingMsg.edit("❌ OpenAI sedang terlalu sibuk. Cuba lagi sebentar.")
    } else {
      await thinkingMsg.edit("❌ AI tidak dapat menjawab sekarang. Cuba lagi sebentar.")
    }
  } finally {
    activeAiRequests.delete(requestKey)
  }
})


// =======================
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error)
})

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error)
})

// LOGIN
// =======================
if (!TOKEN) {
  console.error('Missing TOKEN in .env')
  process.exitCode = 1
} else {
  client.login(TOKEN).catch(error => {
    console.error('Discord login failed:', error.message)
    process.exitCode = 1
  })
}