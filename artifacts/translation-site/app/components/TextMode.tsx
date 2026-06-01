"use client";

import { useState, useRef } from "react";
import styles from "./TextMode.module.css";

type Direction = "en-ar" | "ar-en";

export default function TextMode() {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<Direction>("en-ar");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isArabicResult = direction === "en-ar";

  async function handleTranslate() {
    setError("");
    setResult("");
    setLoading(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("direction", direction);
        res = await fetch("/api/translate-file", { method: "POST", body: fd });
      } else {
        if (!text.trim()) {
          setError("Please enter some text or upload a file.");
          setLoading(false);
          return;
        }
        res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, direction }),
        });
      }
      const data = await res.json() as { translation?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Unknown error");
      setResult(data.translation ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setText("");
  }

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.directionRow}>
        <label className={styles.radio}>
          <input
            type="radio"
            value="en-ar"
            checked={direction === "en-ar"}
            onChange={() => setDirection("en-ar")}
          />
          <span>English → Arabic</span>
        </label>
        <label className={styles.radio}>
          <input
            type="radio"
            value="ar-en"
            checked={direction === "ar-en"}
            onChange={() => setDirection("ar-en")}
          />
          <span>Arabic → English</span>
        </label>
      </div>

      <div className={styles.inputSection}>
        <textarea
          className={styles.textarea}
          placeholder={
            direction === "en-ar"
              ? "Type or paste English text here…"
              : "اكتب أو الصق النص العربي هنا…"
          }
          dir={direction === "ar-en" ? "rtl" : "ltr"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) clearFile();
          }}
          rows={7}
          disabled={!!file}
        />

        <div className={styles.uploadRow}>
          <label className={styles.uploadLabel}>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf,.docx,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className={styles.fileInput}
            />
            📎 {file ? file.name : "Upload file (txt, pdf, docx, png, jpg)"}
          </label>
          {file && (
            <button className={styles.clearBtn} onClick={clearFile}>
              ✕
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.btn}
        onClick={handleTranslate}
        disabled={loading}
      >
        {loading ? <span className={styles.spinner} /> : null}
        {loading ? "Translating…" : "Translate"}
      </button>

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>Translation</span>
            <button className={styles.copyBtn} onClick={handleCopy}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p
            className={styles.resultText}
            dir={isArabicResult ? "rtl" : "ltr"}
            lang={isArabicResult ? "ar" : "en"}
          >
            {result}
          </p>
        </div>
      )}
    </div>
  );
}
