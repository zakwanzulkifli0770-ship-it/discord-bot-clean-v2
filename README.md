# Signal / Campaign Studio

A full-stack campaign concept studio for marketing teams. Enter a brief, audience, product details, tone, and channels to generate a campaign concept, three copy variants, a launch checklist, image prompts, and a generated campaign visual.

The repository also contains the existing Discord bot. The two runtimes are separate:

- `node index.js` runs the Discord bot.
- `npm run studio` runs the web studio at `http://localhost:3000`.

## Setup

1. Install Node.js 18+.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` from `.env.example` and add a server-side key:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-5.6-luna
PORT=3000
```

`OPENAI_KEY` is still accepted by the Discord bot for backwards compatibility, but the studio uses `OPENAI_API_KEY` as its documented variable.

## Run

Start the campaign studio:

```bash
npm run studio
```

Start the Discord bot separately:

```bash
npm start
```

For a persistent deployment, run each process under a process manager such as PM2 or deploy the studio to a Node-compatible host. Keep the environment variable configured in the host's secret manager; never commit `.env` or put the key in browser JavaScript.

## Client / server boundary

The browser only calls `POST /api/campaigns/generate` with campaign form fields. `server.js` constructs the OpenAI client and performs both Responses API calls. The `OPENAI_API_KEY` is read only on the server and is never returned to the client. The response contains campaign JSON and an image data URL for rendering.

## OpenAI flow

1. `server.js` calls `client.responses.create` with `OPENAI_TEXT_MODEL` and a code-managed prompt.
2. The response uses `response.output_text`; it is parsed into the campaign contract.
3. A second `client.responses.create` call uses the `image_generation` tool to create the lead visual.
4. The first `image_generation_call` result is returned as a PNG data URL.

The implementation follows the current Responses API pattern and avoids legacy Chat Completions calls.

## Tuning later

- **Model:** change `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL` in `.env`. Cost-sensitive text defaults to `gpt-5.6-luna`; review the model catalog before changing it.
- **Prompt:** edit `buildCampaignInput()` in `server.js`. Keep the JSON contract stable or update the renderer in `public/app.js` together.
- **Image settings:** adjust the image-generation input and `tools` array in `generateCampaign()` in `server.js`. The image-generation tool currently returns one hero direction.
- **UI:** edit `public/index.html`, `public/styles.css`, and `public/app.js`. The browser has no OpenAI SDK or secret access.

## Validation plan

Run the static checks:

```bash
npm test
```

Then start `npm run studio` and verify:

- The empty state appears before submission.
- A valid brief shows the loading state and then concept, variants, checklist, prompts, and image.
- A server without `OPENAI_API_KEY` shows a clear configuration error.
- An OpenAI quota or rate-limit response shows a retryable error.
- The layout remains usable at desktop and narrow mobile widths.
- `git grep` contains no committed secret and `.env` remains ignored.

For production, add API-level tests around `buildCampaignInput`, `parseJson`, and the route error mapping, plus a small fixture-based evaluation set for campaign quality before changing prompts or models.

## References

- [OpenAI models](https://developers.openai.com/api/docs/models)
- [OpenAI text generation with Responses](https://developers.openai.com/api/docs/guides/text)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
