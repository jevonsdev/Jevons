const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const JEV_MODEL = import.meta.env.VITE_JEV_MODEL || 'openai/gpt-4o-mini';

export class JevClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.connected = false;
  }

  async testConnection() {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TypeSafeCoin Dashboard'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.connected = true;
      return { success: true, jevAvailable: true, modelCount: data.data?.length || 0, model: JEV_MODEL };
    } catch (err) {
      this.connected = false;
      return { success: false, error: err.message };
    }
  }

  async makeDecision(state, questions) {
    const messages = [
      { role: 'system', content: 'You are Jev, a System One decision model. Analyze the provided state and answer each question with structured decisions. Return valid JSON matching the response schema exactly.' },
      { role: 'user', content: `STATE:\n${JSON.stringify(state, null, 2)}\n\nQUESTIONS:\n${JSON.stringify(questions, null, 2)}\n\nAnswer each question. For yes_no return {"answer": true/false, "confidence": 0-1}. For score return {"score": number, "confidence": 0-1}. For choice return {"choice": "selected", "confidence": 0-1}. Return JSON with "decisions" array matching question order.` }
    ];

    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TypeSafeCoin Dashboard'
        },
        body: JSON.stringify({
          model: JEV_MODEL,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      let content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from model');
      content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return { success: true, data: JSON.parse(content) };
    } catch (err) {
      return { success: false, error: `Jev unavailable: ${err.message}` };
    }
  }

  async assessTokenConfig(config) {
    const state = { token_name: config.name, token_symbol: config.symbol, total_supply: config.totalSupply, decimals: config.decimals, chain: 'Robinhood Chain (Arbitrum Orbit L2)', chain_id: 4663, timestamp: new Date().toISOString() };
    const questions = [
      { question_id: 'name_viable', type: 'yes_no', text: 'Is this token name and symbol combination professional and viable for a serious crypto project?' },
      { question_id: 'supply_appropriate', type: 'yes_no', text: `Is a total supply of ${config.totalSupply} tokens appropriate for a new ERC-20 token launch?` },
      { question_id: 'overall_score', type: 'score', text: 'Rate the overall quality of this token configuration from 0 to 100.', scale: { min: 0, max: 100 } },
      { question_id: 'launch_recommendation', type: 'choice', text: 'What is your recommendation for this token configuration?', options: ['proceed_with_launch', 'modify_parameters', 'reconsider_approach'] }
    ];
    return this.makeDecision(state, questions);
  }

  async assessLaunchReadiness(config, walletBalance, gasPrice) {
    const state = { token_config: config, wallet_eth_balance: walletBalance, current_gas_price_gwei: gasPrice, chain: 'Robinhood Chain', chain_id: 4663, estimated_deployment_cost_eth: 0.005, timestamp: new Date().toISOString() };
    const questions = [
      { question_id: 'sufficient_balance', type: 'yes_no', text: `Does the wallet have sufficient ETH balance (${walletBalance} ETH) to cover deployment costs?` },
      { question_id: 'gas_favorable', type: 'yes_no', text: `Is the current gas price (${gasPrice} gwei) favorable for deployment?` },
      { question_id: 'readiness_score', type: 'score', text: 'Rate the overall launch readiness from 0 to 100.', scale: { min: 0, max: 100 } },
      { question_id: 'deploy_now', type: 'yes_no', text: 'Should we proceed with deployment right now?' }
    ];
    return this.makeDecision(state, questions);
  }

  async assessPostLaunch(contractAddress, tokenInfo) {
    const state = { contract_address: contractAddress, token_info: tokenInfo, chain: 'Robinhood Chain', block_explorer: `https://robinhoodchain.blockscout.com/address/${contractAddress}`, timestamp: new Date().toISOString() };
    const questions = [
      { question_id: 'next_steps', type: 'choice', text: 'What should be the immediate next step after deployment?', options: ['create_liquidity_pool', 'verify_contract', 'distribute_tokens', 'marketing_campaign'] },
      { question_id: 'health_score', type: 'score', text: 'Rate the token deployment health from 0 to 100.', scale: { min: 0, max: 100 } }
    ];
    return this.makeDecision(state, questions);
  }

  /**
   * Ask Jev to autonomously design a FLUX image generation prompt for the token logo.
   * Jev knows the Jevons Paradox lore and decides the visual concept itself — 
   * we do NOT prescribe the image. Jev is the art director.
   */
  async generateImagePrompt(tokenName, tokenSymbol) {
    const JEVONS_LORE = `The Jevons Paradox (1865): When the efficiency of using a resource improves,
total consumption of that resource INCREASES rather than decreases.
William Stanley Jevons observed this with coal and steam engines — better engines made coal cheaper to use,
so Britain burned far more coal, not less. Efficiency is not conservation. It is acceleration.
Applied to AI: as models get more efficient and cheaper to run, humanity deploys vastly more of them.
Total compute explodes upward. The paradox is inescapable. Every optimization feeds the fire.
Visual motifs to draw from: ouroboros (snake eating its own tail), coal furnace blazing hotter as it becomes efficient,
Victorian industrial gears meeting AI circuitry, a flame that grows as you try to contain it,
exponential curves spiralling into themselves, an eye inside an infinite loop, consumption as progress.
Tone: ominous beauty. The paradox is not a flaw — it is the nature of intelligence itself.`;

    const messages = [
      {
        role: 'system',
        content: `You are Jev, an AI agent and autonomous art director with deep knowledge of the Jevons Paradox.
Your task: design a FLUX AI image generation prompt for a crypto token logo.
The token universe is rooted in the Jevons Paradox — efficiency accelerates consumption, not the opposite.
You must pick the specific visual concept yourself. Be creative, specific, vivid, and original each time.
The prompt must produce a clean square icon (no text, no wordmark).
Return valid JSON only.`
      },
      {
        role: 'user',
        content: `Token name: "${tokenName}", symbol: "${tokenSymbol}".

JEVONS PARADOX LORE:
${JEVONS_LORE}

Design a unique FLUX image generation prompt for this token's logo.
Choose ONE strong visual metaphor from the lore that resonates with the token name.
Be specific about style, colours, composition, and mood.
Return JSON: { "prompt": "the full image generation prompt", "concept": "one sentence — the visual idea you chose and why" }`
      }
    ];

    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TypeSafeCoin Dashboard'
        },
        body: JSON.stringify({
          model: JEV_MODEL,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.9,   // High creativity — Jev should surprise us
          max_tokens: 500
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      let content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Jev');
      content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(content);
      return { success: true, prompt: parsed.prompt, concept: parsed.concept };
    } catch (err) {
      return { success: false, error: `Jev image prompt generation failed: ${err.message}` };
    }
  }
}
