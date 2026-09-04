require('dotenv').config()
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')

const axios = require('axios')

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
  if (!process.env.OPENAI_KEY) {
    const error = new Error('OPENAI_KEY is missing')
    error.code = 'MISSING_OPENAI_KEY'
    throw error
  }

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  )

  const reply = response.data.choices?.[0]?.message?.content?.trim()
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

  const prompt = getAiPrompt(message)
  if (prompt === null) return

  if (!prompt) {
    return message.reply("Ask a question after `!ai`, `!ask`, or your mention of me.")
  }

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