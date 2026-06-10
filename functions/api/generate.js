// functions/api/generate.js

// Helper to handle CORS for frontend access
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // 1. Get API Keys from Cloudflare Environment Variables
    // In Cloudflare Dashboard, go to Settings -> Environment variables
    // Add a variable named GEMINI_API_KEYS containing your keys separated by commas
    const keysString = env.GEMINI_API_KEYS || "";
    const API_KEYS = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (API_KEYS.length === 0) {
        return new Response(JSON.stringify({ error: "Backend error: GEMINI_API_KEYS environment variable is not set." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // 2. Parse the payload from the client
    let payload;
    try {
        payload = await request.json();
    } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // 3. Multi-Key Rotation Logic
    let startIndex = Math.floor(Math.random() * API_KEYS.length);
    
    for (let i = 0; i < API_KEYS.length; i++) {
        const keyIndex = (startIndex + i) % API_KEYS.length; 
        const currentKey = API_KEYS[keyIndex];
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${currentKey}`;
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // 4. Fallback/Retry Logic on 429
            if (response.status === 429) {
                console.log(`[PROXY] Key index ${keyIndex} hit 429, switching to next key... (Attempt ${i+1}/${API_KEYS.length})`);
                continue; // Move to the next key
            }

            const resultData = await response.text();
            
            return new Response(resultData, {
                status: response.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (error) {
            if (i === API_KEYS.length - 1) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }
    }

    // 5. Exhaustion
    return new Response(JSON.stringify({ error: "All proxy keys exhausted (429 Rate Limit)" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}
