"use client";

import { useState, useRef } from "react";
import styles from "./VideoMode.module.css";

type SrtMode = "en" | "ar" | "dual";

export default function VideoMode() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SrtMode>("dual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [srtBlob, setSrtBlob] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSrtBlob(null);
    setError("");
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleProcess() {
    if (!file) {
      setError("Please upload a video file first.");
      return;
    }
    setError("");
    setSrtBlob(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      fd.append("mode", mode);
      const res = await fetch("/api/generate-srt", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Processing failed");
      }
      const blob = await res.blob();
      setSrtBlob(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!srtBlob) return;
    const url = URL.createObjectURL(srtBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const modeOptions: { value: SrtMode; label: string; desc: string }[] = [
    { value: "en", label: "English Only", desc: "Transcription only" },
    { value: "ar", label: "Arabic Only", desc: "Translated to Arabic" },
    { value: "dual", label: "Dual (EN + AR)", desc: "Both languages per entry" },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.uploadArea}>
        <label className={styles.dropZone}>
          <input
            ref={fileRef}
            type="file"
            accept=".mp4,.mkv,.avi,.mov,video/*"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
          {file ? (
            <div className={styles.fileInfo}>
              <span className={styles.fileIcon}>🎬</span>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.uploadIcon}>📤</span>
              <span className={styles.uploadText}>
                Click to upload a video
              </span>
              <span className={styles.uploadHint}>mp4, mkv, avi, mov</span>
            </div>
          )}
        </label>
      </div>

      <div className={styles.modeSection}>
        <p className={styles.modeLabel}>Subtitle Language</p>
        <div className={styles.modeGrid}>
          {modeOptions.map((opt) => (
            <label
              key={opt.value}
              className={`${styles.modeCard} ${mode === opt.value ? styles.selected : ""}`}
            >
              <input
                type="radio"
                name="srt-mode"
                value={opt.value}
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
                className={styles.modeInput}
              />
              <span className={styles.modeTitle}>{opt.label}</span>
              <span className={styles.modeDesc}>{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.btn}
        onClick={handleProcess}
        disabled={loading || !file}
      >
        {loading ? (
          <>
            <span className={styles.spinner} />
            Processing… (this may take a while)
          </>
        ) : (
          "Process Video"
        )}
      </button>

      {loading && (
        <div className={styles.progressNote}>
          Transcribing audio with Whisper
          {mode !== "en" ? " and translating…" : "…"}
        </div>
      )}

      {srtBlob && (
        <div className={styles.done}>
          <span className={styles.doneIcon}>✅</span>
          <span>Subtitles ready!</span>
          <button className={styles.downloadBtn} onClick={handleDownload}>
            ⬇ Download SRT
          </button>
        </div>
      )}
    </div>
  );
}
