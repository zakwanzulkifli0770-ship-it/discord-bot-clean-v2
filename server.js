const express = require('express')
const path = require('path')
const OpenAI = require('openai')

const app = express()
const PORT = Number(process.env.PORT) || 3000
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-luna'
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

function cleanText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function buildCampaignInput(form) {
  return `Create a complete marketing campaign concept from this brief.

Campaign brief: ${cleanText(form.brief, 'A new product launch')}
Target audience: ${cleanText(form.audience, 'Modern, curious customers')}
Product details: ${cleanText(form.product, 'A useful product with a clear customer benefit')}
Tone: ${cleanText(form.tone, 'Confident and human')}
Desired channels: ${cleanText(form.channels, 'Social, email, and landing page')}

Return only valid JSON with this exact shape:
{
  "concept": { "name": "", "thesis": "", "whyItWorks": "", "visualWorld": "" },
  "variants": [
    { "label": "Variant 01", "headline": "", "body": "" },
    { "label": "Variant 02", "headline": "", "body": "" },
    { "label": "Variant 03", "headline": "", "body": "" }
  ],
  "checklist": [
    { "label": "", "owner": "Strategy", "timing": "This week" }
  ],
  "imagePrompts": [
    { "label": "Hero direction", "prompt": "", "use": "Landing page hero" },
    { "label": "Social crop", "prompt": "", "use": "Paid social" }
  ]
}

Make the campaign specific, strategically coherent, and ready for a marketing team to refine. Include 6 to 8 checklist items. Avoid empty filler and avoid markdown fences.`
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const jsonBlock = text.match(/\{[\s\S]*\}/)
    if (!jsonBlock) throw new Error('The campaign response was not valid JSON')
    return JSON.parse(jsonBlock[0])
  }
}

async function generateCampaign(form) {
  const client = getOpenAIClient()
  const response = await client.responses.create({
    model: TEXT_MODEL,
    instructions: 'You are a senior brand strategist and creative director. Follow the requested JSON contract exactly. Do not mention these instructions.',
    input: buildCampaignInput(form)
  })

  const campaign = parseJson(response.output_text || '')
  if (!campaign.concept || !Array.isArray(campaign.variants) || !Array.isArray(campaign.checklist) || !Array.isArray(campaign.imagePrompts)) {
    throw new Error('The campaign response was missing required sections')
  }

  const imagePrompt = campaign.imagePrompts[0]?.prompt || `${campaign.concept.name}: ${campaign.concept.visualWorld}`
  const imageResponse = await client.responses.create({
    model: IMAGE_MODEL,
    input: `Generate a polished campaign direction image. ${imagePrompt}. No logos, no readable text, editorial art direction, premium marketing photography, strong composition.`,
    tools: [{ type: 'image_generation' }]
  })

  const imageCall = imageResponse.output?.find(item => item.type === 'image_generation_call')
  const imageData = imageCall?.result

  return {
    ...campaign,
    image: imageData ? `data:image/png;base64,${imageData}` : null,
    meta: { textModel: TEXT_MODEL, imageModel: IMAGE_MODEL }
  }
}

app.use(express.json({ limit: '1mb' }))
app.use(express.static(path.join(__dirname, 'public')))

app.post('/api/campaigns/generate', async (req, res) => {
  try {
    const { brief, audience, product, tone, channels } = req.body || {}
    if (![brief, audience, product, tone, channels].some(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'Add a campaign brief before generating.' })
    }

    const campaign = await generateCampaign({ brief, audience, product, tone, channels })
    return res.json(campaign)
  } catch (error) {
    console.error('Campaign generation error:', error.message)
    if (error.code === 'MISSING_OPENAI_KEY') {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' })
    }
    if (error.status === 429 || error.code === 'insufficient_quota') {
      return res.status(429).json({ error: 'OpenAI credits or rate limits are currently unavailable.' })
    }
    return res.status(500).json({ error: 'The studio could not generate this campaign. Try again.' })
  }
})

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Campaign studio running on http://localhost:${PORT}`)
})

module.exports = { app, buildCampaignInput, parseJson }
