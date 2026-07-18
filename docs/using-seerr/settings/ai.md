---
title: AI Settings
description: Configure AI-powered recommendations and natural-language search.
sidebar_position: 8
---

# AI Settings

AI Settings lets you opt into personalized recommendations and natural-language search, powered by a large language model. Both features are entirely optional and are **disabled** by default — Seerr continues to work exactly as it did before until you turn them on.

The engine speaks to any OpenAI-compatible endpoint, so you can use a hosted provider such as OpenAI or OpenRouter, or run everything locally with Ollama, LM Studio, or LiteLLM.

:::warning
When AI features are enabled, Seerr sends the requesting user's request history, watchlist, and library metadata (titles, years, genres, and ratings) to the configured AI provider in order to generate recommendations and interpret searches. **Do not enable these features unless you are comfortable with your provider receiving this data.** A self-hosted provider such as Ollama keeps this traffic entirely on your own network.
:::

## Enable AI Features

This is the master switch for all AI functionality. When disabled, none of the settings below take effect and no data is sent to any provider.

This setting is **disabled** by default.

## Provider Configuration

Configure the OpenAI-compatible endpoint Seerr will use to generate recommendations and interpret searches.

- **AI Provider** — Choose your provider type. Selecting **Ollama (Local)** adjusts the expected base URL and hides the API key field, since Ollama does not require authentication.
- **Base URL** — The root URL of the provider's API. For OpenAI this is `https://api.openai.com/v1`; for a local Ollama instance, `http://localhost:11434/v1`.
- **Model** — The model name to use (for example, `gpt-4o-mini`, `mistral`, or whatever your local provider exposes).
- **API Key** — The key for your provider. This is not required for Ollama. Once saved, the field is masked; leave it blank on subsequent edits to keep the existing key. If you would rather provide the key out of band, Seerr falls back to the `OPENAI_API_KEY` environment variable.

Use **Test Connection** to verify your settings before saving. It sends a minimal request to the provider and reports whether a valid response came back, along with the round-trip latency.

## Recommendations

When enabled, Seerr generates a "Recommended for You" slider on the Discover page and a dedicated recommendations page, personalized per user from their requests, watchlist, and available library.

![The Recommended for You discover page](/img/seerr-ai-recommend.png)

Recommendations are produced by a background job (the AI Recommendations Sync job, every 6 hours by default) rather than on demand. You can also trigger it manually from the Jobs & Cache settings tab to populate the slider sooner after first enabling it.

- **Enable Recommendations** — Turns the recommendations slider and page on or off independently of the master toggle above.
- **Slider Title** — The heading shown above the slider on the Discover page. Defaults to "Recommended for You".
- **Max Results** — The maximum number of titles to generate per user, between 1 and 50.
- **Minimum Rating** — The minimum TMDb rating (0.0–10.0) a recommendation must meet; higher values surface better-rated titles at the cost of fewer results. Defaults to 7.
- **Recommendation TTL (days)** — How long a recommendation lives before it expires. Titles that are re-recommended on a later run are kept alive, while stale ones age out after this many days, so the list refreshes gradually rather than being replaced wholesale.

## AI Search

When enabled, an "AI Search" toggle is added to the search page. Regular keyword search remains the default and does not use the AI provider at all; switching to AI Search interprets a natural-language query ("90s psychological thrillers", "feel-good anime about friendship") using the configured model, resolves it to TMDb results, and shows an "AI interpretation" badge describing how the query was parsed.

This setting is **disabled** by default.

## Feedback

On recommendation cards, each user can rate a title with three quick actions, revealed by hovering over the card:

- 👍 **More like this** — biases future recommendations toward similar content.
- 👁️ **Already watched** — removes the card and excludes the title from future recommendations.
- 👎 **Not interested** — removes the card and excludes the title from future recommendations.

Dislike and "already watched" take effect immediately in the current list; like is recorded quietly to refine the next generation run.
