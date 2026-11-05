"use client";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/i18n";
import { pluginExampleQuestions, pluginPromotionCopy } from "@/lib/plugin-promotion";
import styles from "./trust-page.module.css";
import { useReadingUiText } from "./reading-ui-text-provider";
import { applyAcceptedReadingUiText } from "@/lib/reading-ui-text";
export function PluginGetStarted({ locale }: { locale: SupportedLocale }) {
 const uiText=useReadingUiText(); const text=applyAcceptedReadingUiText(pluginPromotionCopy(locale),uiText); const [feedback,setFeedback]=useState("");
 async function copy(question:string) {
  try { await navigator.clipboard.writeText(question);setFeedback(text.copied); }
  catch { setFeedback(text.fallback); }
 }
 return <section id="try" className={styles.getStarted}>
  <h2>{text.start}</h2><ol>{text.steps.map(step=><li key={step}>{step}</li>)}</ol><p>{text.note}</p>
  <h2>{text.examples}</h2><ul className={styles.questions}>{pluginExampleQuestions.map(source=>uiText[source]??source).map((question,index)=><li key={pluginExampleQuestions[index]}>
   <p lang={question===pluginExampleQuestions[index]?"en":undefined}>{question}</p><button type="button" onClick={()=>void copy(question)} aria-label={text.copy+": "+question}>{text.copy}</button>
  </li>)}</ul><span role="status" aria-live="polite">{feedback}</span>
 </section>;
}
