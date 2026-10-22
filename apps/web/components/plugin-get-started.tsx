"use client";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n";
import { pluginExampleQuestions, pluginPromotionCopy } from "@/lib/plugin-promotion";
import styles from "./trust-page.module.css";
export function PluginGetStarted({ locale }: { locale: SupportedLocale }) {
 const text=pluginPromotionCopy(locale); const [feedback,setFeedback]=useState("");
 async function copy(question:string) {
  try { await navigator.clipboard.writeText(question);setFeedback(text.copied); }
  catch { setFeedback(text.fallback); }
 }
 return <section id="try" className={styles.getStarted}>
  <h2>{text.start}</h2><ol>{text.steps.map(step=><li key={step}>{step}</li>)}</ol><p>{text.note}</p>
  <h2>{text.examples}</h2><ul className={styles.questions}>{pluginExampleQuestions.map(question=><li key={question}>
   <p lang="en">{question}</p><button type="button" onClick={()=>void copy(question)} aria-label={text.copy+": "+question}>{text.copy}</button>
  </li>)}</ul><span role="status" aria-live="polite">{feedback}</span>
 </section>;
}
