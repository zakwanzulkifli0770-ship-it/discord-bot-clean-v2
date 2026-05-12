require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const axios = require('axios')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

// =======================
// DASHBOARD VARIABLES
// =======================
let dashboardMessage

// =======================
// READY EVENT
// =======================
client.once('ready', async () => {
  console.log(`Bot online sebagai ${client.user.tag}`)

  // 🔥 CUSTOM ACTIVITY (BOT STATUS)
  const statuses = [
    "AI Assistant 🤖",
    "Monitoring system 📊",
    "Helping users 💬",
    "Running dashboard ⚡"
  ]

  let i = 0

  setInterval(() => {
    client.user.setPresence({
      activities: [
        {
          name: statuses[i],
          type: 0
        }
      ],
      status: "online"
    })

    i = (i + 1) % statuses.length
  }, 10000)

  // =======================
  // DASHBOARD CHANNEL
  // =======================
  const channel = await client.channels.fetch("884579927557558303")
    .catch(err => console.log("Channel error:", err))

  if (!channel) return console.log("Channel tak jumpa")

  dashboardMessage = await channel.send("Loading dashboard...")

  updateDashboard()
  setInterval(updateDashboard, 10000)
})

// =======================
// DASHBOARD FUNCTION
// =======================
function updateDashboard() {
  if (!dashboardMessage) return

  dashboardMessage.edit(
`🤖 BOT DASHBOARD

🟢 Status: ONLINE
📡 Ping: ${client.ws.ping}ms
⏱ Uptime: ${Math.floor(process.uptime())}s
📅 Time: ${new Date().toLocaleString()}
`
  ).catch(err => console.log("Dashboard edit error:", err))
}

// =======================
// AI CHAT COMMAND
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
// LOGIN BOT
// =======================
client.login(process.env.TOKEN)