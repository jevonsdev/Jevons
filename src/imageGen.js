/**
 * imageGen.js — AI image generation via fal.ai (FLUX.1 Schnell)
 *
 * Jev autonomously decides what image to generate — this module just
 * executes the request. The creative prompt comes from Jev itself via openrouter.js.
 */

const FAL_API_KEY = import.meta.env.VITE_FAL_API_KEY || '';
const FAL_ENDPOINT = 'https://fal.run/fal-ai/flux/schnell';

/**
 * Generate a token logo using fal.ai FLUX.1 Schnell.
 * @param {string} prompt - The image generation prompt crafted by Jev
 * Returns { success, imageUrl, error? }
 */
export async function generateTokenLogo(prompt) {
  if (!FAL_API_KEY) {
    return { success: false, error: 'No fal.ai API key configured (VITE_FAL_API_KEY)' };
  }

  if (!prompt) {
    return { success: false, error: 'No prompt provided' };
  }

  try {
    const response = await fetch(FAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square',       // 1:1 — ideal for token icons
        num_inference_steps: 4,     // Schnell is optimized for 1–4 steps
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `fal.ai API error ${response.status}: ${errText}` };
    }

    const data = await response.json();
    const imageUrl = data?.images?.[0]?.url || null;

    if (!imageUrl) {
      return { success: false, error: 'No image URL returned by fal.ai' };
    }

    return { success: true, imageUrl };
  } catch (err) {
    return { success: false, error: `Image generation failed: ${err.message}` };
  }
}
