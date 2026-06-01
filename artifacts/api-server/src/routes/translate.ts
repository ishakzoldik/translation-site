import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const GROQ_BASE = "https://api.groq.com/openai/v1";

function groqHeaders() {
  return {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<string> {
  const ext = path.extname(originalname).toLowerCase();

  if (mimetype === "text/plain" || ext === ".txt") {
    return buffer.toString("utf-8");
  }

  if (ext === ".pdf" || mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    ext === ".docx" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mimetype.startsWith("image/") ||
    [".png", ".jpg", ".jpeg"].includes(ext)
  ) {
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimetype};base64,${base64}`;

    const response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: "Extract all text from this image exactly as it appears.",
              },
            ],
          },
        ],
      }),
    });
    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? "";
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}

router.post("/translate", async (req, res) => {
  try {
    const { text, direction } = req.body as {
      text: string;
      direction: "en-ar" | "ar-en";
    };

    if (!text || !direction) {
      res.status(400).json({ error: "text and direction are required" });
      return;
    }

    const systemPrompt =
      direction === "en-ar"
        ? "You are a professional translator. Translate the following English text to Arabic. Return only the translated text, nothing else."
        : "You are a professional translator. Translate the following Arabic text to English. Return only the translated text, nothing else.";

    const response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) {
      res.status(500).json({ error: data.error.message });
      return;
    }

    const translation = data.choices[0]?.message?.content ?? "";
    res.json({ translation });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Translation failed" });
  }
});

router.post("/translate-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { direction } = req.body as { direction: "en-ar" | "ar-en" };
    if (!direction) {
      res.status(400).json({ error: "direction is required" });
      return;
    }

    const text = await extractTextFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    const systemPrompt =
      direction === "en-ar"
        ? "You are a professional translator. Translate the following English text to Arabic. Return only the translated text, nothing else."
        : "You are a professional translator. Translate the following Arabic text to English. Return only the translated text, nothing else.";

    const response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) {
      res.status(500).json({ error: data.error.message });
      return;
    }

    const translation = data.choices[0]?.message?.content ?? "";
    res.json({ translation });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Translation from file failed" });
  }
});

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    const segments = await transcribeBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );
    res.json({ segments });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

export async function transcribeBuffer(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Promise<Array<{ start: number; end: number; text: string }>> {
  const tmpFile = path.join(os.tmpdir(), `audio-${Date.now()}-${originalname}`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimetype });
    formData.append("file", blob, originalname);
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");

    const response = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: formData,
    });

    const data = (await response.json()) as {
      segments?: Array<{ start: number; end: number; text: string }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.segments ?? [];
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

router.post("/generate-srt", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No video file provided" });
      return;
    }

    const mode = (req.body as { mode: string }).mode as
      | "en"
      | "ar"
      | "dual";

    if (!mode) {
      res.status(400).json({ error: "mode is required" });
      return;
    }

    const segments = await transcribeBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );

    let srt = "";

    if (mode === "en") {
      srt = buildSrt(segments.map((s) => ({ ...s, lines: [s.text.trim()] })));
    } else if (mode === "ar") {
      const translated = await translateSegments(segments, "en-ar");
      srt = buildSrt(
        translated.map((s) => ({ ...s, lines: [s.translation.trim()] })),
      );
    } else {
      const translated = await translateSegments(segments, "en-ar");
      srt = buildSrt(
        translated.map((s) => ({
          ...s,
          lines: [s.text.trim(), s.translation.trim()],
        })),
      );
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="subtitles.srt"`,
    );
    res.send(srt);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "SRT generation failed" });
  }
});

async function translateSegments(
  segments: Array<{ start: number; end: number; text: string }>,
  direction: "en-ar" | "ar-en",
): Promise<Array<{ start: number; end: number; text: string; translation: string }>> {
  const BATCH = 20;
  const results: Array<{
    start: number;
    end: number;
    text: string;
    translation: string;
  }> = [];

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);
    const numbered = batch
      .map((s, idx) => `${i + idx + 1}. ${s.text}`)
      .join("\n");

    const systemPrompt =
      direction === "en-ar"
        ? "You are an expert Arabic translator. Translate each numbered English line to Modern Standard Arabic. CRITICAL RULES: 1) Use ONLY pure Arabic words - NEVER use Persian words (like شما، نزد، هر), NEVER use Urdu words, NEVER use French or any foreign language. 2) For the word 'you' always use أنت or أنتِ or أنتم. 3) For 'I' always use أنا. 4) Use natural Egyptian or Levantine Arabic if the original is conversational. 5) Keep the same numbering format. 6) Return ONLY the numbered Arabic translations, nothing else, no explanations."
        : "You are a professional translator. Translate each numbered line from Arabic to English. Keep the same numbering format. Return ONLY the numbered translations, nothing else.";

    const response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: numbered },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = data.choices[0]?.message?.content ?? "";
    const lines = raw.split("\n").filter((l) => l.trim());

    batch.forEach((seg, batchIdx) => {
      const globalIdx = i + batchIdx + 1;
      const line =
        lines.find((l) => l.startsWith(`${globalIdx}.`)) ?? "";
      const translation = line.replace(/^\d+\.\s*/, "").trim();
      results.push({ ...seg, translation });
    });
  }

  return results;
}

function pad2(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, "0")}`;
}

function buildSrt(
  entries: Array<{ start: number; end: number; lines: string[] }>,
): string {
  return entries
    .map((e, i) => {
      const header = `${i + 1}\n${formatSrtTime(e.start)} --> ${formatSrtTime(e.end)}`;
      const body = e.lines.join("\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");
}

export default router;
