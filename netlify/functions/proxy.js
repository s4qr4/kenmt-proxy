// Magnific API Proxy — Netlify Functions
  const MAGNIFIC_BASE = "https://api.magnific.com";

  const MODEL_CREATE_PATH = {
    "kling-2.6-std": "/v1/ai/video/kling-v2-6-motion-control-std",
    "kling-2.6-pro": "/v1/ai/video/kling-v2-6-motion-control-pro",
    "kling-3-std":   "/v1/ai/video/kling-v3-motion-control-std",
    "kling-3-pro":   "/v1/ai/video/kling-v3-motion-control-pro",
  };

  const MODEL_STATUS_PATH = {
    "kling-2.6-std":     "/v1/ai/image-to-video/kling-v2-6",
    "kling-2.6-pro":     "/v1/ai/image-to-video/kling-v2-6",
    "kling-3-std":       "/v1/ai/video/kling-v3-motion-control-std",
    "kling-3-pro":       "/v1/ai/video/kling-v3-motion-control-pro",
    "kling-2.6-std-i2v": "/v1/ai/image-to-video/kling-v2-6",
    "kling-2.6-pro-i2v": "/v1/ai/image-to-video/kling-v2-6",
    "kling-3-std-i2v":   "/v1/ai/video/kling-v3-std",
    "kling-3-pro-i2v":   "/v1/ai/video/kling-v3-pro",
    "kling-4k-i2v":      "/v1/ai/video/kling-4k-i2v",
    "seedance-1.5-pro":  "/v1/ai/video/seedance-1-5-pro-720p",
  };

  const I2V_CREATE_PATH = {
    "kling-2.6-std-i2v": "/v1/ai/image-to-video/kling-v2-6",
    "kling-2.6-pro-i2v": "/v1/ai/image-to-video/kling-v2-6-pro",
    "kling-3-std-i2v":   "/v1/ai/video/kling-v3-std",
    "kling-3-pro-i2v":   "/v1/ai/video/kling-v3-pro",
    "kling-4k-i2v":      "/v1/ai/video/kling-4k-i2v",
    "seedance-1.5-pro":  "/v1/ai/video/seedance-1-5-pro-720p",
  };

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-proxy-api-key",
    "Access-Control-Max-Age": "86400",
  };

  function jsonRes(data, statusCode = 200) {
    return {
      statusCode,
      headers: { "Content-Type": "application/json", ...CORS },
      body: JSON.stringify(data),
    };
  }

  exports.handler = async (event) => {
    const rawPath = event.path || "/";
    const path = rawPath.replace(/^/.netlify\/functions\/proxy/, "") || "/";
    const method = event.httpMethod;

    if (method === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

    if (method === "GET" && (path === "/" || path === "/health")) {
      return jsonRes({ status: true, ok: true, runtime: "netlify" });
    }

    try {
      if (method === "POST" && path === "/generate") {
        const apiKey = event.headers["x-proxy-api-key"];
        if (!apiKey) return jsonRes({ error: "Missing x-proxy-api-key header." }, 400);
        let body;
        try { body = JSON.parse(event.body || "{}"); } catch { return jsonRes({ error: "Invalid JSON body." }, 400); }
        const { model, ...rest } = body;
        const createPath = MODEL_CREATE_PATH[model];
        if (!createPath) return jsonRes({ error: "Unknown model: " + model }, 400);
        const res = await fetch(MAGNIFIC_BASE + createPath, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-magnific-api-key": apiKey },
          body: JSON.stringify(rest),
        });
        return jsonRes(await res.json(), res.status);
      }

      if (method === "POST" && path === "/i2v") {
        const apiKey = event.headers["x-proxy-api-key"];
        if (!apiKey) return jsonRes({ error: "Missing x-proxy-api-key header." }, 400);
        let body;
        try { body = JSON.parse(event.body || "{}"); } catch { return jsonRes({ error: "Invalid JSON body." }, 400); }
        const { model, image_base64, aspect_ratio, ...rest } = body;
        const createPath = I2V_CREATE_PATH[model];
        if (!createPath) return jsonRes({ error: "Unknown i2v model: " + model }, 400);
        const isSeedance = (model || "").startsWith("seedance");
        const apiBody = { image: image_base64, ...rest, ...(isSeedance && aspect_ratio ? { aspect_ratio } : {}) };
        const res = await fetch(MAGNIFIC_BASE + createPath, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-magnific-api-key": apiKey },
          body: JSON.stringify(apiBody),
        });
        return jsonRes(await res.json(), res.status);
      }

      if (method === "POST" && path === "/music") {
        const apiKey = event.headers["x-proxy-api-key"];
        if (!apiKey) return jsonRes({ error: "Missing x-proxy-api-key header." }, 400);
        let body;
        try { body = JSON.parse(event.body || "{}"); } catch { return jsonRes({ error: "Invalid JSON body." }, 400); }
        const res = await fetch(MAGNIFIC_BASE + "/v1/ai/music-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-magnific-api-key": apiKey },
          body: JSON.stringify(body),
        });
        return jsonRes(await res.json(), res.status);
      }

      const musicStatusMatch = path.match(/^\/music-status\/([^\/]+)$/);
      if (method === "GET" && musicStatusMatch) {
        const apiKey = event.headers["x-proxy-api-key"];
        if (!apiKey) return jsonRes({ error: "Missing x-proxy-api-key header." }, 400);
        const taskId = decodeURIComponent(musicStatusMatch[1]);
        const res = await fetch(
          MAGNIFIC_BASE + "/v1/ai/music-generation/" + encodeURIComponent(taskId),
          { headers: { "x-magnific-api-key": apiKey } }
        );
        return jsonRes(await res.json(), res.status);
      }

      const statusMatch = path.match(/^\/status\/([^\/]+)\/([^\/]+)$/);
      if (method === "GET" && statusMatch) {
        const apiKey = event.headers["x-proxy-api-key"];
        if (!apiKey) return jsonRes({ error: "Missing x-proxy-api-key header." }, 400);
        const model = decodeURIComponent(statusMatch[1]);
        const taskId = decodeURIComponent(statusMatch[2]);
        const basePath = MODEL_STATUS_PATH[model];
        if (!basePath) return jsonRes({ error: "Unknown model: " + model }, 400);
        const res = await fetch(
          MAGNIFIC_BASE + basePath + "/" + encodeURIComponent(taskId),
          { headers: { "x-magnific-api-key": apiKey } }
        );
        return jsonRes(await res.json(), res.status);
      }

      return jsonRes({ error: "Not found." }, 404);
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Internal error." }, 500);
    }
  };
  