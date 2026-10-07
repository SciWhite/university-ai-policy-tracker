import Image from "next/image";
import data from "@/lib/eth-enforcement-preview-data.json";
import { translatePolicyReferenceUi as t } from "@/lib/policy-reference-ui";
import { PolicyReferenceInteractions } from "@/components/policy-reference-interactions";
import type { SupportedLocale } from "@/lib/i18n";

export function isEthEnforcementPreview(slug: string, layout: unknown, environment = process.env.NODE_ENV) {
  return slug === "eth-zurich" && (environment === "production" || layout === "reference-v4");
}
const labels = {
 en: ["AI use, academic integrity & evidence", "Independent source-backed sample", "Collected", "Scope", "Official guidance", "Evidence & scope", "This evidence sample has not been checked for present effectiveness. Policy summaries remain in English; official evidence is shown in its original language.", "Not established in this collection", "Specific penalties and appeal deadlines were not established. This is an evidence gap, not a finding that no rules exist.", "Teaching guidance; assignment and supervisor instructions govern permission.", "Read the lecturer’s instructions, agree how AI will be used, and disclose it clearly."],
 zh: ["AI 使用、学术诚信与证据", "独立官方证据样板", "采集日期", "适用范围", "官方指导", "证据与范围", "本证据样板尚未核实当前有效性。政策摘要保留英文，官方证据保留原语言。", "本轮尚未建立的结论", "尚未核实具体处罚和申诉期限。这是证据缺口，不表示不存在相关规定。", "教学指导；具体许可取决于作业要求和导师指引。", "先读教师要求，约定 AI 使用方式，再清楚披露。"],
 fr: ["IA, intégrité académique et preuves", "Échantillon indépendant fondé sur des sources", "Collecte", "Champ d’application", "Conseils officiels", "Preuves et portée", "L’actualité de cet échantillon de preuves n’a pas été vérifiée. Les résumés restent en anglais et les preuves dans leur langue originale.", "Points non établis", "Les sanctions précises et délais de recours ne sont pas établis. Cela ne signifie pas qu’aucune règle existe.", "Conseils pédagogiques ; les consignes du devoir et du responsable déterminent l’autorisation.", "Lisez les consignes, convenez de l’usage de l’IA et déclarez-le clairement."],
 pl: ["AI, uczciwość akademicka i dowody", "Niezależna próbka oparta na źródłach", "Data zebrania", "Zakres", "Oficjalne wytyczne", "Dowody i zakres", "Aktualność tej próbki dowodów nie została sprawdzona. Podsumowania są po angielsku, dowody w języku oryginału.", "Nieustalone kwestie", "Nie ustalono konkretnych kar ani terminów odwołań. Brak dowodów nie oznacza braku zasad.", "Wytyczne dydaktyczne; o zgodzie decydują instrukcje zadania i prowadzącego.", "Przeczytaj instrukcje, uzgodnij użycie AI i jasno je ujawnij."],
 es: ["IA, integridad académica y pruebas", "Muestra independiente basada en fuentes", "Recopilación", "Ámbito", "Orientación oficial", "Pruebas y alcance", "No se ha comprobado la vigencia actual de esta muestra de evidencia. Los resúmenes siguen en inglés y las pruebas en su idioma original.", "Aspectos no establecidos", "No se han establecido sanciones concretas ni plazos de recurso. Esto no significa que no existan reglas.", "Orientación docente; las instrucciones de la tarea y del supervisor determinan el permiso.", "Lee las instrucciones, acuerda el uso de IA y decláralo claramente."],
 nl: ["AI, academische integriteit en bewijs", "Onafhankelijke brongebaseerde steekproef", "Verzameld", "Reikwijdte", "Officiële richtlijnen", "Bewijs en reikwijdte", "De huidige geldigheid van deze bewijssteekproef is niet gecontroleerd. Samenvattingen blijven Engels; bewijs blijft in de oorspronkelijke taal.", "Niet vastgesteld", "Specifieke sancties en beroepstermijnen zijn niet vastgesteld. Dat betekent niet dat er geen regels bestaan.", "Onderwijsrichtlijnen; instructies voor de opdracht en van de begeleider bepalen de toestemming.", "Lees de instructies, spreek het AI-gebruik af en vermeld het duidelijk."],
 ms: ["AI, integriti akademik dan bukti", "Sampel bebas berasaskan sumber", "Dikumpulkan", "Skop", "Panduan rasmi", "Bukti dan skop", "Kesahan semasa sampel bukti ini belum diperiksa. Ringkasan kekal dalam bahasa Inggeris dan bukti dalam bahasa asal.", "Perkara yang belum dipastikan", "Hukuman khusus dan tempoh rayuan belum dipastikan. Kekurangan bukti tidak bermakna tiada peraturan.", "Panduan pengajaran; arahan tugasan dan penyelia menentukan kebenaran.", "Baca arahan, persetujui penggunaan AI dan nyatakannya dengan jelas."]
} satisfies Record<SupportedLocale, string[]>;
const art = "/assets/policy-scenes/eth-zurich-muse-preview/";
export function EthEnforcementPreview({ locale }: { locale: SupportedLocale }) {
 const l = labels[locale];
 const doChecks = [["Check the lecturer’s rules for this course and assessment.",3], ["Agree the originality declaration with your supervisor in advance.",4], ["Declare which AI tools were used for which parts of your work.",5]] as const;
 const dontChecks = [["Do not use AI tools contrary to the lecturer’s instructions.",1], ["Do not conceal AI use where disclosure is required.",1], ["Do not treat an AI detector result as reliable proof on its own.",2]] as const;
 // Stable IDs point directly to visible source evidence; no invented student snapshot.
 const ids = [data[0].id,data[1].id,data[2].id,data[3].id,data[4].id];
 const target = (n: number) => `#claim-${ids[n-1]}`;
 return <main className="page-shell page-shell--wide policy-reference" data-policy-layout="reference-v4">
  <div className="policy-reference-body">
   <nav className="policy-reference-nav policy-reference-nav--rail" aria-label={t("On this page",locale)}><p>{t("On this page",locale)}</p><a href="#quick-guide">{t("At a glance",locale)}</a><a href="#claims">{l[5]}</a><a href="#sources">{t("Official sources",locale)}</a><a href="#record-info">{t("About this record",locale)}</a></nav>
   <div className="policy-reference-content">
    <header><p className="student-policy__eyebrow">Switzerland · Zürich</p><h1>ETH Zurich</h1><p>{l[0]}</p><p className="policy-reference-language-note">{l[1]} · {l[2]}: 2026-10-02</p></header>
    <section className="policy-reference-hero" id="quick-guide">
     <div className="policy-reference-intro"><p className="policy-reference-scope">{l[9]}</p><h2>{l[10]}</h2></div>
     <div className="policy-reference-actions">{([['do',doChecks],['dont',dontChecks]] as const).map(([kind,checks])=><article key={kind} className={`policy-reference-action policy-reference-action--${kind}`}><h3>{t(kind==='do'?'Do':"Don't",locale)}</h3><ul lang="en" data-i18n="preserve">{checks.map(([text,n])=><li key={text}><a href={target(n)}>{text}</a></li>)}</ul><Image className="policy-reference-action-art" src={art+kind+".webp"} width={1024} height={1024} alt={kind==='do'?'Check and disclose: consult your lecturer and declare AI use':'Do not assume: avoid unauthorised AI use and over-reliance on detectors'} sizes="(max-width: 900px) 100vw, 480px" unoptimized /></article>)}</div>
     <figure className="policy-reference-art"><Image src={art+"hero.webp"} width={1024} height={1024} alt="Student checking academic instructions at ETH Zurich" preload unoptimized /></figure>
    </section>
    <section id="claims"><h2>{l[5]}</h2>{data.map(f=><article key={f.id} className="eth-preview-evidence"><p className="student-policy__eyebrow">{l[4]}</p><p lang="en" data-i18n="preserve">{f.statement}</p><details id={`claim-${f.id}`}><summary>{t("Official sources",locale)} · {l[3]}</summary><p lang="en" data-i18n="preserve">{f.scope.level === 'unknown' ? 'Teaching advice for lecturers; no specific adopted course policy established.' : 'ETH Zurich guidance; follow the applicable course and supervisor instructions.'}</p>{f.evidence.map(e=><div key={e.sourceId}><blockquote lang="en" data-i18n="preserve">{e.quote}</blockquote><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">{t("Official sources",locale)} ↗</a><p className="policy-reference-language-note">{l[2]}: {e.retrievedAt.slice(0,10)} · SHA-256: <code>{e.sourceSnapshotHash}</code></p></div>)}</details></article>)}</section>
    <section id="sources"><h2>{t("Official sources",locale)}</h2><ul>{Array.from(new Set(data.flatMap(f=>f.evidence.map(e=>e.sourceUrl)))).map(url=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url.includes('.pdf')?'ETH · Generative AI in Teaching and Learning (PDF)':'ETH · Academic integrity'}</a></li>)}</ul></section>
    <section id="record-info"><h2>{l[7]}</h2><p>{l[8]}</p><p className="policy-reference-language-note">{l[6]}</p></section>
   </div>
  </div><PolicyReferenceInteractions />
 </main>;
}
