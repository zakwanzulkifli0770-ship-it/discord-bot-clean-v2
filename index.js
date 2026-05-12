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

let dashboardMessage

client.once('ready', async () => {
  console.log(`Bot online sebagai ${client.user.tag}`)

  const channel = await client.channels.fetch("884579927557558303")
    .catch(err => console.log("Channel error:", err))

  if (!channel) return console.log("Channel tak jumpa")

  dashboardMessage = await channel.send("Loading dashboard...")

  updateDashboard()
  setInterval(updateDashboard, 10000)
})

function updateDashboard() {
  if (!dashboardMessage) return

  dashboardMessage.edit(
`🤖 BOT DASHBOARD

🟢 Status: ONLINE
📡 Ping: ${client.ws.ping}ms
⏱ Uptime: ${Math.floor(process.uptime())}s
📅 Time: ${new Date().toLocaleString()}
`
  )
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return
  if (!message.content.startsWith("!ai")) return

  const prompt = message.content.slice(4)

  message.channel.send("🧠 Thinking...")

  try {
    const res = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_KEY}`,
        "Content-Type": "application/json"
      }
    })

    message.channel.send(res.data.choices[0].message.content)

  } catch (err) {
    console.log(err)
    message.channel.send("❌ AI error")
  }
})

client.login(process.env.TOKEN)