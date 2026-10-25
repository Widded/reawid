// Supabase Edge Function: ocr-proxy
// Serves as a secure backend proxy to keep GROQ_API_KEY and OPENROUTER_API_KEY off the client bundle.
// Deploy via: supabase functions deploy ocr-proxy --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      imageBase64,
      provider = "groq",
      model,
      systemPrompt,
      userPrompt = "Lütfen bu görseldeki kitap sayfasını kurallara harfiyen uyarak metne dönüştür.",
      temperature = 0.1
    } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64 payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let resultText = "";
    let usedProvider = provider;
    let usedModel = model;

    if (provider === "groq") {
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (!groqKey) {
        return new Response(JSON.stringify({ error: "Server missing GROQ_API_KEY secret" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      usedModel = model || "llama-3.2-11b-vision-preview";
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: usedModel,
          temperature,
          max_tokens: 3500,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: imageBase64 } }
              ]
            }
          ]
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(`Groq API returned ${resp.status}: ${JSON.stringify(errJson)}`);
      }

      const data = await resp.json();
      resultText = data?.choices?.[0]?.message?.content || "";

    } else if (provider === "openrouter") {
      const orKey = Deno.env.get("OPENROUTER_API_KEY");
      if (!orKey) {
        return new Response(JSON.stringify({ error: "Server missing OPENROUTER_API_KEY secret" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      usedModel = model || "google/gemma-4-26b-a4b-it:free";
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${orKey}`,
          "HTTP-Referer": "https://reawid.app",
          "X-Title": "Reawid Reader",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: usedModel,
          temperature,
          max_tokens: 4000,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: imageBase64 } }
              ]
            }
          ]
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(`OpenRouter API returned ${resp.status}: ${JSON.stringify(errJson)}`);
      }

      const data = await resp.json();
      resultText = data?.choices?.[0]?.message?.content || "";
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    return new Response(JSON.stringify({
      success: true,
      text: resultText,
      provider: usedProvider,
      model: usedModel
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
