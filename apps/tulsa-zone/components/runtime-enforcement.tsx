import { PolicySummaryEmphasis } from "@/components/policy-summary-emphasis";
import React from "react";
import { createHash } from "node:crypto";
import { v5Ui, v5SourceLink, v5ProcedureName, v5Obligation, v5Display, v5DayUnit, v5RecordLink, v5MinimumPeriod } from "@/lib/enforcement-v5-ui";

import type { SupportedLocale } from "@/lib/i18n";


const groups = ["trigger", "response", "outcomes", "appeal", "support"] as const;
const copy: Record<SupportedLocale, string[]> = {
 en: ["What happens if AI use raises a concern?", "Triggers, process & your options", "When a concern arises", "How you can respond", "Possible outcomes", "Review & appeal", "Support & adjustments", "Detection evidence", "Official evidence", "Scope", "General misconduct framework", "AI-specific source", "Source guidance", "Collection & version notes", "Published source-based additions. English summaries and original-language quotations are shown separately from the reviewed record. These are possible processes and outcomes, not automatic penalties for AI use. Present applicability has not been independently confirmed; check the source scope and version.", "View reviewed claims", "Collected", "Conditions & exceptions"],
 zh: ["AI 使用引发疑虑后，会发生什么？", "触发条件、处理流程与应对选择", "哪些行为会引发疑虑", "如何回应与说明", "可能的处理结果", "复核与申诉", "支持与合理调整", "检测证据", "官方原文证据", "适用范围", "一般违规处理框架", "AI 明示条款", "来源指导", "采集与版本说明", "已发布的来源补充。英文摘要与原语言引文和已审核记录分开展示。这里列出可能的程序与结果，不是使用 AI 的自动处罚；现行适用性尚未独立确认，请核对来源的适用范围和版本。", "查看已审核主张", "采集日期", "条件与例外"],
 fr: ["Que se passe-t-il si l’usage de l’IA suscite un doute ?", "Déclencheurs, procédure et options", "Quand un doute apparaît", "Comment répondre", "Résultats possibles", "Réexamen et recours", "Soutien et aménagements", "Preuves de détection", "Preuves officielles", "Portée", "Cadre général des manquements", "Disposition explicite sur l’IA", "Conseils de la source", "Collecte et versions", "Compléments publiés fondés sur des sources. Les résumés anglais et citations originales sont séparés du dossier vérifié. Les procédures et résultats possibles ne sont pas des sanctions automatiques liées à l’IA. L’applicabilité actuelle n’a pas été confirmée indépendamment ; vérifiez la portée et la version de la source.", "Voir les affirmations examinées", "Collecté", "Conditions et exceptions"],
 pl: ["Co się dzieje, gdy użycie AI budzi wątpliwości?", "Przesłanki, procedura i możliwości", "Kiedy pojawia się wątpliwość", "Jak odpowiedzieć", "Możliwe wyniki", "Weryfikacja i odwołanie", "Wsparcie i dostosowania", "Dowody wykrywania", "Oficjalne dowody", "Zakres", "Ogólne procedury naruszeń", "Zapis dotyczący AI", "Zalecenia źródła", "Zbiór i wersje", "Opublikowane uzupełnienia oparte na źródłach. Podsumowania angielskie i oryginalne cytaty są oddzielone od sprawdzonego rejestru. Możliwe procedury i wyniki nie oznaczają automatycznych kar za AI. Aktualne zastosowanie nie zostało niezależnie potwierdzone; sprawdź zakres i wersję źródła.", "Zobacz sprawdzone twierdzenia", "Zebrano", "Warunki i wyjątki"],
 es: ["¿Qué ocurre si el uso de IA genera dudas?", "Motivos, proceso y opciones", "Cuándo surge una duda", "Cómo responder", "Resultados posibles", "Revisión y recurso", "Apoyo y ajustes", "Pruebas de detección", "Pruebas oficiales", "Ámbito", "Marco general de infracciones", "Disposición sobre IA", "Orientación de la fuente", "Recopilación y versiones", "Complementos publicados basados en fuentes. Los resúmenes en inglés y las citas originales se separan del registro revisado. Los procesos y resultados posibles no son sanciones automáticas por usar IA. La aplicabilidad actual no se ha confirmado de forma independiente; compruebe el ámbito y la versión de la fuente.", "Ver afirmaciones revisadas", "Recopilado", "Condiciones y excepciones"],
 nl: ["Wat gebeurt er als AI-gebruik vragen oproept?", "Aanleiding, procedure en opties", "Wanneer vragen ontstaan", "Hoe je kunt reageren", "Mogelijke uitkomsten", "Herziening en beroep", "Ondersteuning en aanpassingen", "Detectiebewijs", "Officieel bewijs", "Reikwijdte", "Algemene overtredingsprocedure", "Bepaling over AI", "Advies uit de bron", "Verzameling en versies", "Gepubliceerde brongebaseerde aanvullingen. Engelse samenvattingen en oorspronkelijke citaten staan los van het beoordeelde dossier. Mogelijke procedures en uitkomsten zijn geen automatische straffen voor AI. De huidige toepasselijkheid is niet onafhankelijk bevestigd; controleer de bronreikwijdte en versie.", "Bekijk beoordeelde claims", "Verzameld", "Voorwaarden en uitzonderingen"],
 ms: ["Apakah yang berlaku jika penggunaan AI menimbulkan kebimbangan?", "Pencetus, proses dan pilihan", "Apabila kebimbangan timbul", "Cara memberikan respons", "Hasil yang mungkin", "Semakan dan rayuan", "Sokongan dan penyesuaian", "Bukti pengesanan", "Bukti rasmi", "Skop", "Rangka kerja salah laku umum", "Peruntukan berkaitan AI", "Panduan sumber", "Pengumpulan dan versi", "Tambahan berasaskan sumber yang diterbitkan. Ringkasan Inggeris dan petikan asal dipisahkan daripada rekod yang disemak. Proses dan hasil bukan hukuman automatik bagi penggunaan AI. Pemakaian semasa belum disahkan secara bebas; semak skop dan versi sumber.", "Lihat dakwaan yang disemak", "Dikumpulkan", "Syarat dan pengecualian"]
};

export function EnforcementTaskEntrances({ locale }: { locale: SupportedLocale }) {
 const u = v5Ui(locale);
 return <nav className="enforcement-task-entrances" aria-label={u[0]}>
  <a href="#quick-guide"><strong>{u[0]}</strong><span>{u[2]}</span><span className="enforcement-task-arrow" aria-hidden="true">↓</span></a>
  <a href="#enforcement-evidence"><strong>{u[1]}</strong><span>{u[3]}</span><span className="enforcement-task-arrow" aria-hidden="true">↓</span></a>
 </nav>;
}

export function EnforcementV4Refresh({ slug, locale, records }: { slug: string; locale: SupportedLocale; records: any[] }) {
 if (!records) return null;
 const l = copy[locale], u = v5Ui(locale), dc = v5Display(locale);
 const dates = Array.from(new Set(records.flatMap(f => f.evidence.map((e:any) => e.retrievedAt.slice(0,10))))).sort();
 return <section id="enforcement-evidence" className="enforcement-refresh">
  <header className="enforcement-refresh-heading"><div><h2>{l[0]}</h2><p className="enforcement-refresh-scope">{u[10]}: {dates.join(" / ")} · {u[11]}</p></div><a href="#claims">{v5RecordLink(locale)} ↗</a></header>
  <nav className="enforcement-refresh-nav" aria-label={l[1]}>{groups.map((g,i) => records.some(f => f.group===g || g === "support" && f.group === "detection") ? <a key={g} href={`#enforcement-group-${g}`}>{l[i+2]}{g === "support" && records.some(f => f.group === "detection") ? ` · ${l[7]}` : ""}</a> : null)}</nav>
  {locale !== "en" && locale !== "zh" ? <p className="policy-reference-language-note">{u[15]}</p> : null}
  <div className="enforcement-refresh-grid">{groups.map((g,i) => {
   const facts = records.filter(f=>f.group===g || g === "support" && f.group === "detection"); if(!facts.length) return null;
   return <section className="enforcement-refresh-group" key={g} id={`enforcement-group-${g}`}><h3>{l[i+2]}{g === "support" && facts.some(f=>f.group === "detection") ? ` · ${l[7]}` : ""}</h3>
    {facts.map(f => <article key={f.id} className="enforcement-refresh-fact" id={`enforcement-fact-${f.id}`}>
     <div className="enforcement-refresh-tags"><span>{f.appliesToAI === "general_misconduct_framework" ? l[10] : l[11]}</span><span>{f.sourceNature === "support_service" ? l[6] : f.sourceNature === "official_guidance" ? u[13] : u[12]}</span>{f.group === "detection" ? <span>{l[7]}</span> : null}</div>
     <div className="enforcement-interpretation"><p className="enforcement-interpretation-label">{u[4]}</p><p lang={locale === "zh" ? "zh" : "en"} data-i18n="preserve">{locale === "zh" && createHash("sha256").update(f.statement).digest("hex") === f.translationSourceHash ? <PolicySummaryEmphasis text={f.localSummary.zh} phrases={f.emphasis.zh} policy /> : <PolicySummaryEmphasis text={f.statement} phrases={f.emphasis.en} policy />}</p></div>
     {f.deadlines.length > 0 ? <div className="enforcement-deadlines">{f.deadlines.map((d:any,j:number) => <div key={j} className={`enforcement-deadline${d.normativity === "endeavour" ? " enforcement-deadline--target" : ""}`}>
      <strong><span lang={locale === "zh" ? "zh" : "en"} data-i18n="preserve">{v5ProcedureName(d.procedure, locale)}</span> · {d.direction === "at_least_duration" ? "≥ " : ""}{d.value} {v5DayUnit(d.unit, locale)}</strong>
      <p className="enforcement-deadline-obligation">{d.actor === "校方" ? dc.institution : dc.student} · {v5Obligation(d.normativity, locale)}</p>
      {locale === "zh" ? <><p>{d.actor} · {d.direction === "at_least_duration" ? `${v5MinimumPeriod(locale)}；起算：` : d.direction === "within" ? "起算：" : d.direction === "at_least_before" ? "至少提前；参照日期：" : "不迟于此前；参照日期："}<strong className="policy-summary-emphasis">{d.trigger ?? u[9]}</strong></p><p>{d.dayDefinition}；{d.exceptions}</p></> : <p lang={locale} data-i18n="preserve">{d.direction === "at_least_duration" ? v5MinimumPeriod(locale) : d.direction === "within" ? dc.within : d.direction === "at_least_before" ? dc.before : dc.noLater}{d.trigger === null ? ` · ${u[9]}` : ""}. {dc.context}</p>}
     </div>)}</div> : null}
     <p className="enforcement-refresh-scope">{l[9]}: <span lang="en" data-i18n="preserve">{f.scope.unit || f.scope.audience}{f.scope.qualifiers.length ? ` · ${f.scope.qualifiers.join(" · ")}` : ""}</span></p>
     {(g === "response" || g === "trigger") && records.some(f=>f.group === "detection") ? <p><a href="#enforcement-group-support">{l[7]} · {l[6]}</a></p> : null}
     <details id={`enforcement-${f.id}`}><summary>{u[5]}</summary>
      {locale === "zh" ? <><h4>{u[6]}</h4><p lang="en" data-i18n="preserve">{f.statement}</p></> : null}
      <p>{l[9]}: <span lang="en" data-i18n="preserve">{f.scope.audience} · {f.scope.level}</span></p>
      {(f.conditions.length > 0 || f.exceptions.length > 0) && <div><h4>{l[17]}</h4>{[...f.conditions,...f.exceptions].map((c,j)=><p key={j} lang={/[\u3400-\u9fff]/.test(typeof c === "string" ? c : c.description) ? "zh" : "en"} data-i18n="preserve">{typeof c === "string" ? c : c.description}</p>)}</div>}
      {f.evidence.map((e:any,j:number)=><div key={`${e.sourceId}-${j}`}><blockquote lang={"sourceLanguage" in e && typeof e.sourceLanguage === "string" && e.sourceLanguage ? e.sourceLanguage : "und"} data-i18n="preserve">{e.quote}</blockquote><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">{v5SourceLink(locale)} ↗</a><p className="enforcement-refresh-scope">{l[16]}: {e.retrievedAt.slice(0,10)} · {e.lineStart}–{e.lineEnd}<br/>SHA-256: <code>{e.sourceSnapshotHash}</code></p></div>)}
     </details>
    </article>)}
   </section>;
  })}</div>
  <details className="enforcement-refresh-notes"><summary>{l[13]}</summary><p>{l[14]}</p><p>{u[14]}</p><p>{dc.notes}</p></details>
 </section>;
}
