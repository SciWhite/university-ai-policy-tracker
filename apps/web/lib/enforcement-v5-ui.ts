import type { SupportedLocale } from "@/lib/i18n";
// Shared task and evidence controls; policy translations are tracked separately.
const labels: Record<SupportedLocale, string[]> = {
 en: ["I’m preparing to submit", "I received a concern about AI use", "Use rules and task instructions", "Responses, review and support", "Site interpretation", "View original text and conditions", "English source summary", "Time window", "Institution’s response target", "Starting point not specified", "Supplement collected", "Current applicability not independently confirmed", "Formal procedure", "Official guidance", "Source-text comparison; not an official translation", "Policy summary is currently available in English"],
 zh: ["我准备提交作业", "我收到 AI 使用疑虑", "查看使用规则与任务要求", "查看回应、复核与支持", "本站解读", "查看原文与适用条件", "英文来源摘要", "提交或回应期限", "校方回复目标", "起算尚未明确", "补充资料采集", "现行适用性未独立确认", "正式程序", "官方指导", "按所存原文核对；不是官方译文", "政策摘要目前提供英文"],
 fr: ["Je prépare un devoir", "L’usage de l’IA soulève un doute", "Règles et consignes", "Réponse, recours et soutien", "Interprétation du site", "Voir le texte original et les conditions", "Résumé anglais de la source", "Délai", "Objectif de réponse de l’établissement", "Point de départ non précisé", "Complément collecté", "Applicabilité actuelle non confirmée indépendamment", "Procédure formelle", "Conseils officiels", "Comparaison au texte conservé ; traduction non officielle", "Résumé disponible actuellement en anglais"],
 pl: ["Przygotowuję pracę", "Otrzymano zastrzeżenie dotyczące AI", "Zasady i instrukcje zadania", "Odpowiedź, odwołanie i wsparcie", "Interpretacja serwisu", "Zobacz oryginał i warunki", "Angielskie podsumowanie źródła", "Termin", "Docelowy czas odpowiedzi uczelni", "Początek terminu nieokreślony", "Zebrano uzupełnienie", "Aktualne zastosowanie niepotwierdzone niezależnie", "Formalna procedura", "Oficjalne wskazówki", "Porównano z zapisanym tekstem; tłumaczenie nieoficjalne", "Podsumowanie jest obecnie dostępne po angielsku"],
 es: ["Voy a entregar un trabajo", "He recibido dudas sobre el uso de IA", "Normas e instrucciones", "Respuesta, revisión y apoyo", "Interpretación del sitio", "Ver original y condiciones", "Resumen inglés de la fuente", "Plazo", "Objetivo de respuesta institucional", "Inicio del plazo no especificado", "Complemento recopilado", "Aplicabilidad actual no confirmada de forma independiente", "Procedimiento formal", "Orientación oficial", "Comparado con el original guardado; traducción no oficial", "Resumen disponible actualmente en inglés"],
 nl: ["Ik bereid een opdracht voor", "Ik ontving vragen over AI-gebruik", "Regels en opdrachtinstructies", "Reactie, herziening en ondersteuning", "Interpretatie van de site", "Bekijk oorspronkelijke tekst en voorwaarden", "Engelse bronsamenvatting", "Termijn", "Streeftermijn van de instelling", "Startpunt niet gespecificeerd", "Aanvulling verzameld", "Huidige toepasselijkheid niet onafhankelijk bevestigd", "Formele procedure", "Officiële richtlijnen", "Vergeleken met opgeslagen tekst; geen officiële vertaling", "Samenvatting momenteel beschikbaar in het Engels"],
 ms: ["Saya bersedia menghantar tugasan", "Saya menerima kebimbangan tentang AI", "Peraturan dan arahan tugasan", "Respons, semakan dan sokongan", "Tafsiran laman", "Lihat teks asal dan syarat", "Ringkasan sumber bahasa Inggeris", "Tempoh", "Sasaran respons institusi", "Titik mula tidak dinyatakan", "Tambahan dikumpulkan", "Pemakaian semasa belum disahkan secara bebas", "Prosedur rasmi", "Panduan rasmi", "Disemak dengan teks tersimpan; bukan terjemahan rasmi", "Ringkasan kini tersedia dalam bahasa Inggeris"]
};
export const v5Ui = (locale: SupportedLocale) => labels[locale];

const sourceLinks: Record<SupportedLocale,string> = {
 en:"View official source", zh:"查看官方来源", fr:"Voir la source officielle", pl:"Zobacz oficjalne źródło", es:"Ver fuente oficial", nl:"Bekijk officiële bron", ms:"Lihat sumber rasmi"
};
export const v5SourceLink = (locale: SupportedLocale) => sourceLinks[locale];

// Source procedures retain their proper names; local action suffixes have an explicit English fallback.
const procedureNames: Record<string,string> = {
 "Academic Misconduct Appeal：结果通知":"Academic Misconduct Appeal: outcome notification",
 "Poor academic practice：书面回应":"Poor academic practice: written response",
 "Suspected academic misconduct：回应":"Suspected academic misconduct: response",
 "UDP：书面回应":"UDP: written response",
 "UDP：陪同人通知":"UDP: Supporter notice",
 "UDP：扩大陪同人资格申请":"UDP: expanded Supporter eligibility request"
};
export const v5ProcedureName = (procedure:string, locale:SupportedLocale) => locale === "zh" ? procedure : procedureNames[procedure] ?? procedure;
const obligations: Record<SupportedLocale,Record<string,string>> = {
 en:{ordinarily:"Ordinarily required",must:"Required when using this procedure",should:"Should submit",may:"Optional request",endeavour:"Institution’s response target"},
 zh:{ordinarily:"通常须提交",must:"采用此程序时须遵守",should:"应提交",may:"可申请",endeavour:"校方回复目标"},
 fr:{ordinarily:"Normalement requis",must:"Obligatoire dans cette procédure",should:"À soumettre",may:"Demande facultative",endeavour:"Objectif de réponse de l’établissement"},
 pl:{ordinarily:"Zwykle wymagane",must:"Wymagane w tej procedurze",should:"Należy złożyć",may:"Wniosek opcjonalny",endeavour:"Docelowy czas odpowiedzi uczelni"},
 es:{ordinarily:"Normalmente obligatorio",must:"Obligatorio en este procedimiento",should:"Se debería presentar",may:"Solicitud opcional",endeavour:"Objetivo de respuesta institucional"},
 nl:{ordinarily:"Gewoonlijk vereist",must:"Verplicht bij deze procedure",should:"Dient ingediend te worden",may:"Optioneel verzoek",endeavour:"Streeftermijn van de instelling"},
 ms:{ordinarily:"Biasanya diperlukan",must:"Diperlukan bagi prosedur ini",should:"Patut dihantar",may:"Permohonan pilihan",endeavour:"Sasaran respons institusi"}
};
export const v5Obligation = (value:string,locale:SupportedLocale) => obligations[locale][value] ?? value;

const displayCopy: Record<SupportedLocale,{day:string;workingDay:string;unspecifiedDay:string;student:string;institution:string;within:string;before:string;noLater:string;context:string;notes:string;review:string;method:string}> = {
 en:{day:"days",workingDay:"working days",unspecifiedDay:"days (type unspecified)",student:"Student",institution:"Institution",within:"Within the stated period",before:"At least this many days before the hearing",noLater:"No later than this many days before the hearing",context:"Check the source summary and original text for the starting point, scope and exceptions.",notes:"Hashes allow comparison of saved content; they do not certify current validity or immutability. These topics are not a mandatory sequence.",review:"AI-assisted review",method:"Review method"},
 zh:{day:"天",workingDay:"工作日",unspecifiedDay:"日（类型未明确）",student:"学生",institution:"校方",within:"在规定期限内",before:"至少提前",noLater:"不迟于此前",context:"请结合来源摘要和原文核对起算、适用范围及例外。",notes:"哈希仅用于核对所存内容，不证明现行有效性或不可篡改。这些主题不表示每个学生都会经历的流程。",review:"AI 辅助审核",method:"审核方式说明"},
 fr:{day:"jours",workingDay:"jours ouvrables",unspecifiedDay:"jours (type non précisé)",student:"Étudiant",institution:"Établissement",within:"Dans le délai indiqué",before:"Au moins ce nombre de jours avant l’audience",noLater:"Au plus tard ce nombre de jours avant l’audience",context:"Vérifiez le point de départ, la portée et les exceptions dans le résumé et le texte original.",notes:"Les empreintes permettent de comparer les textes conservés ; elles ne certifient ni leur validité actuelle ni leur immuabilité. Ces thèmes ne sont pas une séquence obligatoire.",review:"Examen assisté par IA",method:"Méthode d’examen"},
 pl:{day:"dni",workingDay:"dni roboczych",unspecifiedDay:"dni (typ nieokreślony)",student:"Student",institution:"Uczelnia",within:"W podanym terminie",before:"Co najmniej tyle dni przed posiedzeniem",noLater:"Nie później niż tyle dni przed posiedzeniem",context:"Początek terminu, zakres i wyjątki sprawdź w podsumowaniu oraz oryginale.",notes:"Skróty pozwalają porównać zapisane teksty; nie potwierdzają ich aktualności ani niezmienności. Tematy nie tworzą obowiązkowej sekwencji.",review:"Weryfikacja wspomagana AI",method:"Metoda weryfikacji"},
 es:{day:"días",workingDay:"días hábiles",unspecifiedDay:"días (tipo no especificado)",student:"Estudiante",institution:"Institución",within:"Dentro del plazo indicado",before:"Al menos este número de días antes de la audiencia",noLater:"A más tardar este número de días antes de la audiencia",context:"Compruebe el inicio, el ámbito y las excepciones en el resumen y el original.",notes:"Los hashes permiten comparar textos guardados; no certifican vigencia ni inmutabilidad. Los temas no forman una secuencia obligatoria.",review:"Revisión asistida por IA",method:"Método de revisión"},
 nl:{day:"dagen",workingDay:"werkdagen",unspecifiedDay:"dagen (type niet gespecificeerd)",student:"Student",institution:"Instelling",within:"Binnen de vermelde termijn",before:"Minstens dit aantal dagen vóór de hoorzitting",noLater:"Uiterlijk dit aantal dagen vóór de hoorzitting",context:"Controleer startpunt, reikwijdte en uitzonderingen in de samenvatting en oorspronkelijke tekst.",notes:"Hashes maken vergelijking van opgeslagen teksten mogelijk; ze bevestigen geen actuele geldigheid of onveranderlijkheid. De onderwerpen vormen geen verplichte volgorde.",review:"AI-ondersteunde beoordeling",method:"Beoordelingsmethode"},
 ms:{day:"hari",workingDay:"hari bekerja",unspecifiedDay:"hari (jenis tidak dinyatakan)",student:"Pelajar",institution:"Institusi",within:"Dalam tempoh yang dinyatakan",before:"Sekurang-kurangnya bilangan hari ini sebelum pendengaran",noLater:"Tidak lewat daripada bilangan hari ini sebelum pendengaran",context:"Semak titik mula, skop dan pengecualian dalam ringkasan serta teks asal.",notes:"Hash membolehkan perbandingan teks tersimpan; ia tidak mengesahkan kesahan semasa atau ketidakbolehubahan. Tema ini bukan urutan wajib.",review:"Semakan dibantu AI",method:"Kaedah semakan"}
};
export const v5Display = (locale:SupportedLocale)=>displayCopy[locale];
export function v5DayUnit(unit:string,locale:SupportedLocale) {
 const calendarDays: Record<SupportedLocale,string> = {en:"calendar days",zh:"日历日",fr:"jours calendaires",pl:"dni kalendarzowych",es:"días naturales",nl:"kalenderdagen",ms:"hari kalendar"};
 if(unit === "日历日") return calendarDays[locale];
 if(unit === "周") {const weeks:Record<SupportedLocale,string>={en:"weeks",zh:"周",fr:"semaines",pl:"tygodnie",es:"semanas",nl:"weken",ms:"minggu"};return weeks[locale];}
 if(unit === "大学工作日" || unit === "Code working days") {const qualifier:Record<SupportedLocale,string>={en:"as defined by the University Code",zh:"按大学程序定义",fr:"définis par le règlement universitaire",pl:"według regulaminu uczelni",es:"según el reglamento universitario",nl:"volgens het universiteitsreglement",ms:"mengikut peraturan universiti"};return `${displayCopy[locale].workingDay} (${qualifier[locale]})`;}
 if(unit === "business days") { const business:Record<SupportedLocale,string>={en:"business days",zh:"business days（程序定义）",fr:"jours ouvrables (selon la procédure)",pl:"dni roboczych (według procedury)",es:"días hábiles (según el procedimiento)",nl:"werkdagen (volgens de procedure)",ms:"hari bekerja (mengikut prosedur)"}; return business[locale]; }
 if(unit === "Chapter 11 定义日") { const defined:Record<SupportedLocale,string>={en:"days as defined in Chapter 11",zh:"Chapter 11 定义日",fr:"jours définis au chapitre 11",pl:"dni w rozumieniu rozdziału 11",es:"días definidos en el capítulo 11",nl:"dagen volgens hoofdstuk 11",ms:"hari mengikut takrif Bab 11"}; return defined[locale]; }
 const c=displayCopy[locale];return unit === "College 工作日" ? `College ${c.workingDay}` : unit === "工作日" ? c.workingDay : unit === "日（类型未明确）" ? c.unspecifiedDay : c.day;
}

const recordLinks:Record<SupportedLocale,string>={en:"Compare published university record",zh:"对比已发布的大学记录",fr:"Comparer la fiche universitaire publiée",pl:"Porównaj opublikowany profil uczelni",es:"Comparar la ficha universitaria publicada",nl:"Vergelijk het gepubliceerde universiteitsprofiel",ms:"Bandingkan rekod universiti yang diterbitkan"};
export const v5RecordLink=(locale:SupportedLocale)=>recordLinks[locale];

const minimumPeriods:Record<SupportedLocale,string>={en:"Minimum response period",zh:"至少给予的回应时间",fr:"Délai de réponse minimal",pl:"Minimalny czas na odpowiedź",es:"Plazo mínimo para responder",nl:"Minimale reactietermijn",ms:"Tempoh minimum untuk memberi respons"};
export const v5MinimumPeriod=(locale:SupportedLocale)=>minimumPeriods[locale];
