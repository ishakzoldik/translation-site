"use client";

import { useState } from "react";
import TextMode from "./components/TextMode";
import VideoMode from "./components/VideoMode";
import styles from "./page.module.css";

export default function Home() {
  const [tab, setTab] = useState<"text" | "video">("text");

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🌐 Translation Studio</h1>
        <p className={styles.subtitle}>English ↔ Arabic · Text & Video</p>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "text" ? styles.active : ""}`}
          onClick={() => setTab("text")}
        >
          📝 Text Mode
        </button>
        <button
          className={`${styles.tab} ${tab === "video" ? styles.active : ""}`}
          onClick={() => setTab("video")}
        >
          🎬 Video Mode
        </button>
      </div>

      <main className={styles.main}>
        {tab === "text" ? <TextMode /> : <VideoMode />}
      </main>
    </div>
  );
}
