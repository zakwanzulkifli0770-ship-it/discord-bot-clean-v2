require('dotenv').config()
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')

const axios = require('axios')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

// =======================
// MULTI-ADMIN SYSTEM
// =======================
const OWNER_ID = "857317617148231690"

function getUserRole(userId) {
  if (userId === OWNER_ID) return "owner"
  if (ADMIN_IDS.includes(userId)) return "admin"
  if (MOD_IDS.includes(userId)) return "mod"
  return "user"
}

// =======================
// VARIABLES
// =======================
let dashboardMessage

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
client.once('ready', async () => {
  console.log(`Bot online sebagai ${client.user.tag}`)

  // 🔥 AUTO STATUS ROTATION
  const statuses = [
    "THE OWNER OF ZYR BOT 👑",
    "AI Assistant 🤖",
    "Monitoring system 📊",
    "Grinding Discord bots 💻"
  ]

  let i = 0

  setInterval(() => {
    client.user.setPresence({
      activities: [{ name: statuses[i], type: 3 }],
      status: "online"
    })

    i = (i + 1) % statuses.length
  }, 10000)

  // =======================
  // DASHBOARD
  // =======================
  const channel = await client.channels.fetch("884579927557558303")
    .catch(err => console.log("Channel error:", err))

  if (!channel) return console.log("Channel tak jumpa")

  dashboardMessage = await channel.send({
    content: "Loading dashboard...",
    components: [getControlPanel()]
  })

  updateDashboard()
  setInterval(updateDashboard, 10000)
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
      content: `🤖 AI system active (${role})`,
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
client.on('messageCreate', async (message) => {
  if (message.author.bot) return
  if (!message.content.startsWith("!ai")) return

  const prompt = message.content.slice(4).trim()

  message.channel.send("🧠 Thinking...")

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    message.channel.send(res.data.choices[0].message.content)

  } catch (err) {
    console.log(err)
    message.channel.send("❌ AI error")
  }
})

// =======================
// LOGIN
// =======================
client.login(process.env.TOKEN)