import React from 'react';
import {createHash} from 'node:crypto';
import type {SupplementRecord} from '@/lib/policy-supplements';
import type {PolicyClaim} from '@uapt/shared';
import type {SupportedLocale} from '@/lib/i18n';
import {getApprovedPolicySupplements} from '@/lib/policy-supplements';
import {PolicySummaryEmphasis,policyToolNames} from './policy-summary-emphasis';
const copy:Record<SupportedLocale,readonly string[]>={
 en:['More policy information','Collected material awaiting review','These are collected candidates, not approved advice. Scope, meaning and current applicability still require review. Summaries and quotations remain in their original language.','Scope','Recorded topic','Recorded wording strength','Original source and archived quotation','Collected','Archive hash','Lines','Supplementary policy material','Other official information','Browse additional reviewed claims','Research','Security and procurement','Other reviewed information'],
 zh:['更多政策信息','已采集资料 · 待核准','以下是采集候选，不是已核准的行动建议。适用范围、含义与现行有效性仍须审核；摘要及引文保留原语言。','记录的适用范围','记录的主题','记录的约束程度','官方来源与存档引文','采集日期','存档哈希','行号','补充政策资料','其他官方资料','查看更多已审核主张','研究','安全与采购','其他已审核信息'],
 fr:['Autres informations','Documents collectés à vérifier','Ces candidats ne sont pas des conseils approuvés. La portée, le sens et la validité actuelle restent à vérifier. Résumés et citations conservent leur langue originale.','Portée enregistrée','Sujet enregistré','Modalité enregistrée','Source officielle et citation archivée','Collecté','Empreinte d’archive','Lignes','Documents complémentaires','Autres documents officiels','Autres assertions vérifiées','Recherche','Sécurité et achats','Autres informations vérifiées'],
 pl:['Dodatkowe informacje','Zebrane materiały do weryfikacji','To kandydaci, nie zatwierdzone porady. Zakres, znaczenie i aktualność wymagają weryfikacji. Podsumowania i cytaty zachowują oryginalny język.','Zapisany zakres','Zapisany temat','Zapisana modalność','Oficjalne źródło i archiwalny cytat','Zebrano','Hash archiwum','Wiersze','Materiały uzupełniające','Inne oficjalne materiały','Dodatkowe sprawdzone twierdzenia','Badania','Bezpieczeństwo i zakupy','Inne sprawdzone informacje'],
 es:['Más información','Material recopilado pendiente de revisión','Son candidatos, no consejos aprobados. El ámbito, significado y vigencia requieren revisión. Resúmenes y citas conservan el idioma original.','Ámbito registrado','Tema registrado','Modalidad registrada','Fuente oficial y cita archivada','Recopilado','Hash del archivo','Líneas','Material complementario','Otros documentos oficiales','Más afirmaciones revisadas','Investigación','Seguridad y compras','Otra información revisada'],
 nl:['Meer informatie','Verzameld materiaal ter beoordeling','Dit zijn kandidaten, geen goedgekeurd advies. Reikwijdte, betekenis en actuele geldigheid moeten worden beoordeeld. Samenvattingen en citaten behouden hun oorspronkelijke taal.','Vastgelegde reikwijdte','Vastgelegd onderwerp','Vastgelegde modaliteit','Officiële bron en gearchiveerd citaat','Verzameld','Archiefhash','Regels','Aanvullend materiaal','Andere officiële documenten','Meer beoordeelde beweringen','Onderzoek','Beveiliging en inkoop','Andere beoordeelde informatie'],
 ms:['Maklumat tambahan','Bahan dikumpul menunggu semakan','Ini calon, bukan nasihat yang diluluskan. Skop, makna dan kesahan semasa masih perlu disemak. Ringkasan dan petikan mengekalkan bahasa asal.','Skop direkodkan','Topik direkodkan','Modaliti direkodkan','Sumber rasmi dan petikan arkib','Dikumpulkan','Hash arkib','Baris','Bahan tambahan','Dokumen rasmi lain','Dakwaan tambahan yang disemak','Penyelidikan','Keselamatan dan perolehan','Maklumat lain yang disemak']
};
const reviewedCopy:Record<SupportedLocale,readonly string[]>={
 en:['Published source-based additions','These tracker summaries are based on retained official-source material. Present applicability has not been independently confirmed. English summaries and original-language quotations are retained unless a checked Chinese summary is available.','Assessment permission','Disclosure','Privacy and student work','AI grading and human oversight','Access and adjustments'],
 zh:['已发布的来源摘要','这些摘要依据留存的官方来源材料；现行适用性尚未独立确认。其余摘要保留原语言，官方引文始终保留原文。','作业与考试许可','使用披露','隐私与学生作品','AI 评分与人工监督','工具可及性与合理调整'],
 fr:['Compléments fondés sur des sources publiés','Ces résumés du site reposent sur des documents officiels conservés. Leur applicabilité actuelle n’a pas été confirmée de manière indépendante. Les résumés anglais et les citations originales sont conservés, sauf résumé chinois vérifié.','Autorisation en évaluation','Déclaration','Vie privée et travaux étudiants','Notation par IA et contrôle humain','Accès et aménagements'],
 pl:['Opublikowane uzupełnienia oparte na źródłach','Podsumowania serwisu opierają się na zachowanych materiałach oficjalnych. Ich aktualne zastosowanie nie zostało niezależnie potwierdzone. Zachowano podsumowania angielskie i oryginalne cytaty, poza sprawdzonymi podsumowaniami chińskimi.','Zezwolenie w ocenianiu','Ujawnienie użycia','Prywatność i prace studentów','Ocenianie przez AI i nadzór człowieka','Dostęp i dostosowania'],
 es:['Complementos publicados basados en fuentes','Estos resúmenes del sitio se basan en material oficial conservado. Su aplicabilidad actual no se ha confirmado de forma independiente. Se mantienen los resúmenes en inglés y las citas originales, salvo los resúmenes chinos revisados.','Permiso en evaluaciones','Declaración','Privacidad y trabajos estudiantiles','Calificación por IA y supervisión humana','Acceso y ajustes'],
 nl:['Gepubliceerde brongebaseerde aanvullingen','Deze samenvattingen van de site zijn gebaseerd op bewaard officieel materiaal. De huidige toepasselijkheid is niet onafhankelijk bevestigd. Engelse samenvattingen en oorspronkelijke citaten blijven behouden, behalve gecontroleerde Chinese samenvattingen.','Toestemming bij beoordeling','Vermelding van gebruik','Privacy en studentenwerk','AI-beoordeling en menselijk toezicht','Toegang en aanpassingen'],
 ms:['Tambahan berasaskan sumber yang diterbitkan','Ringkasan ini berasaskan bahan rasmi yang disimpan. Pemakaian semasa belum disahkan secara bebas. Ringkasan Inggeris dan petikan asal dikekalkan kecuali ringkasan Cina yang telah disemak.','Kebenaran pentaksiran','Pendedahan penggunaan','Privasi dan kerja pelajar','Pemarkahan AI dan pengawasan manusia','Akses dan penyesuaian']
};
const processCopy:Record<SupportedLocale,readonly string[]>={
 en:['Boundaries and concerns','Investigation and response','Possible outcomes','Review and appeal','Support','Detection evidence','General misconduct framework; not automatic consequences of AI use','AI-specific provision'],
 zh:['边界与疑虑','调查与回应','可能的处理结果','复核与申诉','支持渠道','检测证据','通用违规处理框架；不是使用 AI 的自动后果','AI 明示条款'],
 fr:['Limites et doutes','Enquête et réponse','Résultats possibles','Réexamen et recours','Soutien','Preuves de détection','Cadre général des manquements ; pas de conséquences automatiques de l’IA','Disposition explicite sur l’IA'],
 pl:['Granice i wątpliwości','Dochodzenie i odpowiedź','Możliwe wyniki','Weryfikacja i odwołanie','Wsparcie','Dowody wykrywania','Ogólne procedury naruszeń; nie automatyczne skutki użycia AI','Zapis dotyczący AI'],
 es:['Límites y dudas','Investigación y respuesta','Resultados posibles','Revisión y recurso','Apoyo','Pruebas de detección','Marco general de infracciones; no son consecuencias automáticas de la IA','Disposición explícita sobre IA'],
 nl:['Grenzen en vragen','Onderzoek en reactie','Mogelijke uitkomsten','Herziening en beroep','Ondersteuning','Detectiebewijs','Algemene overtredingsprocedure; geen automatische gevolgen van AI-gebruik','Bepaling over AI'],
 ms:['Batasan dan kebimbangan','Siasatan dan respons','Hasil yang mungkin','Semakan dan rayuan','Sokongan','Bukti pengesanan','Rangka kerja salah laku umum; bukan akibat automatik penggunaan AI','Peruntukan khusus AI']
};
const designCopy:Record<SupportedLocale,string>={en:'Assessment design',zh:'评价设计指导',fr:'Conception des évaluations',pl:'Projektowanie oceniania',es:'Diseño de evaluaciones',nl:'Ontwerp van beoordelingen',ms:'Reka bentuk pentaksiran'};
const summaryCopy:Record<SupportedLocale,string>={en:'Site summary · original evidence below',zh:'本站解读 · 官方原文见下方',fr:'Résumé du site · preuve originale ci-dessous',pl:'Podsumowanie serwisu · oryginał poniżej',es:'Resumen del sitio · original abajo',nl:'Samenvatting van de site · origineel hieronder',ms:'Ringkasan laman · bukti asal di bawah'};
const sourceCopy:Record<SupportedLocale,string>={en:'Source guidance · retain its recorded scope',zh:'来源指导 · 以记录的适用范围为限',fr:'Conseils de la source · portée enregistrée',pl:'Wskazówki źródła · zachowaj zapisany zakres',es:'Orientación de la fuente · ámbito registrado',nl:'Bronadvies · vastgelegde reikwijdte',ms:'Panduan sumber · ikut skop direkodkan'};
const metadataCopy:Record<SupportedLocale,readonly string[]>={
 en:['Scope not established','Students','Teachers','Instructors','Descriptive statement','Prohibited','Required','Recommended'],
 zh:['适用层级尚未确立','学生','教师','教师','描述性说明','禁止','须遵守','建议'],
 fr:['Portée non établie','Étudiants','Enseignants','Enseignants','Énoncé descriptif','Interdit','Obligatoire','Recommandé'],
 pl:['Zakres nieustalony','Studenci','Nauczyciele','Prowadzący','Stwierdzenie opisowe','Zabronione','Wymagane','Zalecane'],
 es:['Ámbito sin establecer','Estudiantes','Docentes','Docentes','Descripción','Prohibido','Obligatorio','Recomendado'],
 nl:['Reikwijdte niet vastgesteld','Studenten','Docenten','Docenten','Beschrijving','Verboden','Verplicht','Aanbevolen'],
 ms:['Skop belum ditetapkan','Pelajar','Guru','Pengajar','Pernyataan deskriptif','Dilarang','Diperlukan','Disyorkan']
};
const topicNames=['assessment_permission','disclosure','privacy_data','ai_grading','accessibility','misconduct_classification','procedure','sanctions','appeal','support','detection','assessment_design'];
function supplementTopicLabel(topic:string,locale:SupportedLocale){const i=topicNames.indexOf(topic);return i<0?topic:i<5?reviewedCopy[locale][i+2]:i<11?processCopy[locale][i-5]:designCopy[locale];}
function SupplementCard({record:r,locale,reviewed}:{record:SupplementRecord;locale:SupportedLocale;reviewed:boolean}) {
 const u=copy[locale];const f=r.fact;
 const m=metadataCopy[locale];const audience=m[{students:1,teachers:2,instructors:3}[f.scope.audience as 'students']??-1]??f.scope.audience;
 const modality=m[{descriptive:4,prohibited:5,must:6,should:7,recommended:7}[f.modality as 'descriptive']??-1]??f.modality;
 const translated=locale==='zh'&&f.localSummary?.zh&&f.translationSourceHash===createHash('sha256').update(f.statement).digest('hex');
 const text=translated ? f.localSummary!.zh : f.statement;
 return <article id={`supplement-${f.id}`} className={`policy-supplements__record${reviewed?' policy-supplements__record--reviewed':''}`}>
  <p className="muted">{f.appliesToAI === "general_misconduct_framework" ? processCopy[locale][6] : f.appliesToAI === "explicit_ai" ? processCopy[locale][7] : sourceCopy[locale]}</p>
  {reviewed?<p className="muted">{summaryCopy[locale]}</p>:null}
  <p data-i18n="preserve"><PolicySummaryEmphasis text={text} phrases={reviewed?(translated?f.emphasis?.zh:[])??[]:policyToolNames} policy={reviewed}/></p>
  <dl><dt>{u[3]}</dt><dd data-i18n="preserve">{[audience,f.scope.level==='unknown'?m[0]:f.scope.level,f.scope.unit,...f.scope.qualifiers??[]].filter(Boolean).join(' · ')}</dd><dt>{u[4]}</dt><dd>{supplementTopicLabel(f.topic,locale)}</dd><dt>{u[5]}</dt><dd>{modality}</dd></dl>
  <details><summary>{u[6]}</summary>{f.evidence.map((e,j)=><div key={j}><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">{u[6]} ↗</a><blockquote lang={e.sourceLanguage || 'und'} data-i18n="preserve">{e.quote}</blockquote><p>{u[7]}: <time dateTime={e.retrievedAt}>{e.retrievedAt.slice(0,10)}</time> · {u[9]}: {e.lineStart}–{e.lineEnd}</p><p>{u[8]}: <code>{e.sourceSnapshotHash}</code></p></div>)}</details>
 </article>;
}
export async function PolicySupplements({slug,locale,claims}:{slug:string;locale:SupportedLocale;claims:PolicyClaim[]}) {
 const records=getApprovedPolicySupplements(slug);const u=copy[locale];const v=reviewedCopy[locale];
 const reviewed=records.filter(r=>['prior_local_review_retained','current_local_source_review'].includes(r.semanticReview));
 const topics=['assessment_permission','disclosure','privacy_data','ai_grading','accessibility','misconduct_classification','procedure','sanctions','appeal','support','detection','assessment_design'];
 const topicLabel=(i:number)=>i<5?v[i+2]:i<11?processCopy[locale][i-5]:designCopy[locale];
 const groups=[['research'],['security_review','procurement'],['other']];
 const links=groups.map(types=>claims.filter(c=>c.id&&types.includes(c.claimType)));
 if(!records.length&&!links.some(g=>g.length))return null;
 return <section id="policy-supplements" className="student-record-section policy-supplements" aria-labelledby="policy-supplements-title">
  <h2 id="policy-supplements-title">{u[0]}</h2>
  {reviewed.length?<div className="policy-supplements__reviewed"><h3>{v[0]} ({reviewed.length})</h3><p className="muted">{v[1]}</p>
   <nav aria-label={v[0]}>{topics.map((topic,i)=>reviewed.some(r=>r.fact.topic===topic)?<a key={topic} href={`#supplement-topic-${topic}`}>{topicLabel(i)}</a>:null)}</nav>
   {topics.map((topic,i)=>{const fs=reviewed.filter(r=>r.fact.topic===topic);return fs.length?<section id={`supplement-topic-${topic}`} key={topic}><h3>{topicLabel(i)}</h3>{fs.map(r=><SupplementCard key={r.key} record={r} locale={locale} reviewed/>)}</section>:null;})}
  </div>:null}
  {links.some(g=>g.length)?<details><summary>{u[12]}</summary>{links.map((group,i)=>group.length?<section key={i}><h3>{u[13+i]}</h3><ul>{group.map(c=><li key={c.id}><a href={`#claim-${c.id}`} data-i18n="preserve"><PolicySummaryEmphasis text={c.claimText} policy/></a></li>)}</ul></section>:null)}</details>:null}
 </section>;
}
