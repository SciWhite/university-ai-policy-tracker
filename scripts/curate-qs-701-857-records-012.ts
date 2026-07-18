import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, any>;
type Spec = {
  row: number;
  url: string;
  tool: string;
  rawToolName: string;
  anchors: string[];
  language?: string;
  audience?: string;
  obtain?: string;
  cost?: string;
  selfHosted?: boolean;
  forceFirecrawl?: boolean;
};

const RUN_ID = "uapt-ai-tools-qs-701-857-20260719-012";
const DISCOVERY = "staging/ai-tools/audits/qs-701-857-discovery-20260719-012.json";
const OUTPUT = "staging/ai-tools/audits/qs-701-857-confirmed-records-20260719-012.json";
const SNAPSHOT_ROOT = `staging/ai-tools/audits/snapshots/${RUN_ID}`;
const specs: Spec[] = [];
const add = (row:number,url:string,tool:string,rawToolName:string,anchors:string|string[],options:Partial<Spec>={}) => specs.push({row,url,tool,rawToolName,anchors:Array.isArray(anchors)?anchors:[anchors],...options});

const AUBURN = "https://libguides.auburn.edu/c.php?g=1444337&p=10730449";
add(705,AUBURN,"adobe_firefly","Adobe Firefly","students and employees have access to Adobe Creative Cloud including generative AI such as Adobe Firefly",{audience:"Auburn students and employees",obtain:"Use Auburn's Adobe Creative Cloud access."});
add(705,AUBURN,"microsoft_copilot","Microsoft Copilot","Auburn University is a Microsoft Campus that uses Microsoft's Copilot as an integrated application tool",{obtain:"Use Auburn's supported Microsoft environment."});

add(706,"https://libguides.acu.edu.au/ai-tools","microsoft_copilot","Microsoft Copilot for the web","Microsoft Copilot for the web is available to all students via Outlook or by signing in to Office or Microsoft 365 Copilot with your ACU account",{audience:"All ACU students",obtain:"Sign in with an ACU account."});
add(713,"https://libguides.napier.ac.uk/c.php?g=717851&p=5204061","microsoft_copilot","Microsoft Copilot","If you are logged in with a University account, you will see a shield next to New Chat that tells you that Enterprise Data Protection applies to this chat",{obtain:"Sign in with an Edinburgh Napier University account."});
add(715,"https://oraprdnt.uqtr.uquebec.ca/portail/docs/GSC3939/O0007213862_Programme_intensif____Guide_du_participant__1_.pdf","microsoft_copilot","Copilot Chat",["composantes de la licence institutionnelle","Copilot chat"],{language:"fr",audience:"UQTR intensive-program participants",obtain:"Use the institutional Copilot licence described by UQTR."});
add(718,"https://hub.wpi.edu/news/1268/zoom-ai-companion","zoom_ai_companion","Zoom AI Companion","Zoom AI Companion options are available to all WPI Zoom accounts",{audience:"All WPI Zoom account holders",obtain:"Enable the option in a WPI Zoom account."});
add(729,"https://www.k-state.edu/news/articles/2025/05/zoom-artificial-intelligence-integration.html","zoom_ai_companion","Zoom AI Companion",["Zoom AI Companion","licensed and approved AI notetaker and tool within Zoom for all K-State users"],{audience:"All K-State users",obtain:"Use the licensed K-State Zoom environment."});

const KKU = "https://library.kku.ac.th/english-aiclinic/";
for (const [tool,raw] of [["chatgpt","ChatGPT Plus"],["scispace","SciSpace Pro"],["claude","Claude Premium"],["google_ai_pro","Google AI Pro"],["grammarly","Grammarly Pro"]]) add(730,KKU,tool,raw,["Khon Kaen University Library now offers the AI Clinic",raw],{audience:"KKU students, faculty, researchers, and staff",obtain:"Visit the AI Clinic in Room 3202 of the Information Center Building.",cost:"Library-mediated premium access; no individual price is stated."});

const KMUTT = "https://www.lib.kmutt.ac.th/en/newsletter/%F0%9F%93%A3-elevate-your-research-to-the-next-level-with-ai-tools-%E2%9C%A8/";
for (const [tool,raw] of [["chatgpt","ChatGPT"],["gemini","Gemini"],["claude","Claude"]]) add(731,KMUTT,tool,raw,["These leading AI tools are available free of charge for all KMUTT students and staff",raw],{audience:"All KMUTT students and staff",obtain:"Use the AI Corner in Klinics 1 Room at the KMUTT Library.",cost:"Free at the library AI Corner."});
add(733,"https://www.mtu.edu/it/policies-compliance/generative-ai/","gemini","Google Gemini","The basic Google Gemini application is available to all MTU faculty, staff and students at no cost",{audience:"All MTU faculty, staff, and students",obtain:"Sign in with an MTU account.",cost:"No cost."});

add(743,"https://www.uab.edu/it/home/tech-solutions/ai/copilot-with-data-protection","microsoft_copilot","Microsoft Copilot with Data Protection","Students, faculty and staff with a UAB campus email address can access Copilot",{audience:"UAB campus students, faculty, and staff",obtain:"Sign in with a BlazerID and password."});
add(743,"https://www.uab.edu/it/home/tech-solutions/ai/copilot-365","microsoft_copilot_for_m365","Microsoft 365 Copilot","It is available to campus faculty and staff for an annual subscription",{audience:"UAB campus faculty and staff",obtain:"Request Microsoft 365 Copilot through UAB IT.",cost:"Annual subscription."});
add(743,"https://www.uab.edu/it/news/item/uab-chatgpt-service-now-available","chatgpt","ChatGPT Edu","UAB's new ChatGPT Service provides approved access to OpenAI's ChatGPT",{audience:"UAB campus faculty and staff",obtain:"Request a license in the IT Service Portal and sign in with a uab.edu email address.",cost:"$63 per month at the cited launch price."});
add(743,"https://www.uab.edu/it/news/item/ai-assistant-now-available-for-zoom","zoom_ai_companion","Zoom AI Companion",["Zoom AI Companion","available for free beginning Aug. 5 for UAB campus staff and faculty who have a Zoom account"],{audience:"UAB campus staff and faculty with Zoom accounts",obtain:"Use the UAB Zoom account.",cost:"Free for eligible account holders."});

const UARK = "https://news.uark.edu/articles/80623/more-ai-tools-and-resources-approved-and-available-for-campus";
add(745,UARK,"microsoft_copilot","Copilot Chat","Copilot Chat (already included with Microsoft account)",{obtain:"Use a UARK Microsoft account.",cost:"No additional cost."});
add(745,UARK,"microsoft_copilot_for_m365","Copilot for Microsoft 365","Copilot for Microsoft 365 (for purchase by units)",{obtain:"Academic colleges or units purchase licenses."});
add(745,UARK,"chatgpt","OpenAI ChatGPT Edu","OpenAI ChatGPT Edu (for purchase by units)",{obtain:"Academic colleges or units request licenses."});
const UARK_GOOGLE = "https://news.uark.edu/articles/80668/it-services-launches-google-gemini-notebooklm-as-additional-university-approved-ai-tools";
for (const [tool,raw] of [["gemini","Google Gemini for Education"],["notebooklm","Google NotebookLM"]]) add(745,UARK_GOOGLE,tool,raw,["approved for the U of A campus community at no extra cost to current employees and students",raw],{audience:"Current U of A employees and students",obtain:"Log in with UARK credentials.",cost:"No extra cost."});

add(748,"https://www.du.edu/it/index.php/services/software/software-catalog/bc3d23c61b8486501f05433fbd4bcb92","microsoft_copilot","Microsoft O365 Copilot Web Chat","Microsoft Copilot Chat is available at no cost to all DU students, faculty, and benefitted staff as part of our enterprise Microsoft Office 365 license",{audience:"DU students, faculty, and benefitted staff",obtain:"Sign in with DU credentials.",cost:"No cost."});
add(748,"https://www.du.edu/it/index.php/services/software/software-catalog/4ef256821b8c46501f05433fbd4bcb7d","zoom_ai_companion","Zoom AI Companion","Zoom AI Companion is available at no cost to all DU students, faculty and staff as part of our enterprise Zoom license",{audience:"All DU students, faculty, and staff",obtain:"Use the DU Zoom account.",cost:"No cost."});

add(753,"https://support.uidaho.edu/TDClient/40/Portal/KB/Article/3610/How-to-access-Microsoft-Copilot","microsoft_copilot","Microsoft Copilot",["Microsoft Copilot","Useful for: Students, Faculty, Staff"],{audience:"University of Idaho students, faculty, and staff",obtain:"Sign in with a University of Idaho work or school account."});
add(753,"https://support.uidaho.edu/TDClient/40/Portal/KB/Article/3998/How-to-sign-in-to-Anthropic-Claude-AI","claude","Anthropic Claude Enterprise","An Enterprise organization has been created with the Anthropic Claude AI service named \"UIdaho\"",{audience:"Eligible University of Idaho employees",obtain:"Request access and sign in with an @uidaho.edu employee account."});
add(753,"https://support.uidaho.edu/TDClient/40/Portal/KB/Article/3024/Zoom-AI-Companion","zoom_ai_companion","Zoom AI Companion","Zoom AI Companion is enabled and approved for UofI work accounts",{audience:"University of Idaho work-account holders",obtain:"Enable it in a U of I Zoom work account."});

add(758,"https://service.louisville.edu/TDClient/277/Portal/KB/Article/20086/AI-GenAI-Tools-How-to-Access-and-Use-GenAI-Tools-at-UofL","microsoft_copilot_for_m365","Microsoft 365 Copilot",["Some tools require specific permissions or paid licenses (e.g., Microsoft 365 Copilot)","You need an active UofL login credentials"],{obtain:"Use UofL credentials and obtain the required paid licence."});
add(759,"https://guides.lib.olemiss.edu/c.php?g=1362389&p=10062387","microsoft_copilot","Microsoft Copilot","UM affiliates have access to Copilot through their olemiss.edu email",{audience:"University of Mississippi affiliates",obtain:"Use an olemiss.edu email account."});

add(760,"https://www.umkc.edu/is/resources/ai-tools/copilot.html","microsoft_copilot","Copilot Basic","Included with all UMKC Faculty, Staff, and Student accounts",{audience:"All UMKC faculty, staff, and students",obtain:"Use standard UM System credentials.",cost:"No additional purchase required."});
add(760,"https://www.umkc.edu/is/resources/ai-tools/copilot.html","microsoft_copilot_for_m365","M365 Copilot Premium",["M365 Copilot Premium","Annual paid subscription required"],{audience:"Eligible UMKC employees and student employees",obtain:"Submit the AI License Order form.",cost:"$189 annual subscription at the cited price."});
add(760,"https://www.umkc.edu/is/resources/ai-tools/chatgpt.html","chatgpt","OpenAI ChatGPT","Faculty and Staff can purchase licenses for ChatGPT by submitting the AI License Order form",{audience:"UMKC faculty, staff, and eligible student employees",obtain:"Submit the AI License Order form."});
add(760,"https://www.umkc.edu/is/resources/ai-tools/","zoom_ai_companion","Zoom AI Companion","Zoom AI Companion is included with all UMKC Faculty and Staff Zoom accounts",{audience:"UMKC faculty and staff",obtain:"Use a UMKC Zoom account.",cost:"No additional purchase required."});

add(764,"https://www.unr.edu/ai/students/copilot-chat","microsoft_copilot","Microsoft 365 Copilot Chat","currently available to University of Nevada, Reno students, faculty, and staff",{audience:"University of Nevada, Reno students, faculty, and staff",obtain:"Sign in with a University email and password."});

const UNCC = "https://oneit.charlotte.edu/innovation/artificial-intelligence/ai-software-guidance/";
add(767,UNCC,"adobe_firefly","Adobe Creative Cloud Firefly",["Adobe Creative Cloud Firefly with @charlotte.edu","Approved Campus-wide software available to faculty, and staff and in labs for students"],{audience:"UNC Charlotte faculty, staff, and students in labs",obtain:"Use the campus Adobe software path."});
add(767,UNCC,"gemini","Google Gemini","Google Gemini in browser with @charlotte.edu Approved Campus-wide browser generative AI tool",{obtain:"Sign in with an @charlotte.edu account."});
add(767,UNCC,"notebooklm","Google NotebookLM","Google NotebookLM with @charlotte.edu Approved Campus-wide generative AI research study guide",{obtain:"Sign in with an @charlotte.edu account."});
add(767,UNCC,"microsoft_copilot","Microsoft Copilot","Microsoft Copilot in browser with @charlotte.edu Approved Campus-wide browser generative AI tool",{obtain:"Sign in with an @charlotte.edu account."});
add(767,UNCC,"zoom_ai_companion","Zoom AI Companion","Zoom AI Companion with @charlotte.edu Approved Campus-wide conferencing and phone software",{obtain:"Use the UNC Charlotte Zoom environment."});

add(770,"https://its.uri.edu/2025/09/26/microsoft-365-copilot-chat/","microsoft_copilot","Microsoft 365 Copilot Chat","All faculty, staff, and students at URI have access to the base level of this tool through the Microsoft 365 suite",{audience:"All URI faculty, staff, and students",obtain:"Use the URI Microsoft 365 account."});
add(770,"https://its.uri.edu/2023/08/24/ai-images-adobe-firefly/","adobe_firefly","Adobe Firefly","URI faculty have free access to the Adobe Firefly AI image generator bot",{audience:"URI faculty",obtain:"Use the URI Adobe access instructions.",cost:"Free."});
add(773,"https://provost.utsa.edu/academicinnovation/docs/genai_faculty_guide/utsa-faculty_generativeai_guidelines.pdf","microsoft_copilot","Microsoft Copilot","Faculty, staff and students can use the Microsoft CoPilot license to get started with generative AI",{audience:"UTSA faculty, staff, and students",obtain:"Use the campus-wide Microsoft Copilot licence."});

const UVM = "https://www.uvm.edu/ai/supported-and-approved-ai-tools";
add(776,UVM,"microsoft_copilot","Microsoft Copilot",["Microsoft Copilot","Available to faculty, staff, and students"],{audience:"UVM faculty, staff, and students",obtain:"Sign in with a UVM NetID."});
add(776,UVM,"microsoft_copilot_for_m365","Microsoft Copilot for M365",["Microsoft Copilot for M365","Available to faculty, staff upon request via Tech Team"],{audience:"UVM faculty and staff",obtain:"Request through the UVM Tech Team."});
add(776,UVM,"teams_premium","Microsoft Teams Premium",["Microsoft Teams Premium","Availability : UVM employees (upon request)"],{audience:"UVM employees",obtain:"Request through UVM."});
add(776,UVM,"institutional_ai_service","VACC Research Computing AI","Run open-source large language models on high-performance computing systems",{audience:"UVM researchers",obtain:"Request access to VACC Research Computing AI.",selfHosted:true});
add(776,UVM,"institutional_ai_service","VACC Transcription Service","VACC has a locally hosted transcription service available",{obtain:"Use the VACC locally hosted transcription service.",selfHosted:true});

add(778,"https://www.uwyo.edu/infotech/news/articles/archive/2024/new_ai_microsoft_copilot.asp","microsoft_copilot_for_m365","Microsoft 365 Copilot","UW faculty and staff can access advanced features through a paid subscription",{audience:"University of Wyoming faculty and staff",obtain:"Purchase through the university software-access path.",cost:"$30 per month at the cited price."});
add(778,"https://www.uwyo.edu/infotech/news/articles/archive/2024/zoom_ai_companion.asp","zoom_ai_companion","Zoom AI Companion",["Zoom AI Companion","available at no additional cost with","Zoom Enterprise License"],{obtain:"Use the University of Wyoming Zoom Enterprise environment.",cost:"No additional cost."});

const USU = "https://www.usu.edu/ai/tools";
add(789,USU,"microsoft_copilot","Microsoft Copilot with Data Protection",["Microsoft Copilot with Data Protection","Available for any current USU student, faculty, or staff"],{audience:"Current USU students, faculty, and staff",obtain:"Sign in with a USU school account.",cost:"No additional cost."});
add(789,USU,"zoom_ai_companion","Zoom AI Companion",["Zoom AI Companion","Available for any current USU student, faculty, or staff"],{audience:"Current USU students, faculty, and staff",obtain:"Use a USU Zoom account."});
add(789,USU,"box_ai","Box AI","Box AI is available via the box.usu.edu website interface",{audience:"Current USU students, faculty, and staff",obtain:"Use box.usu.edu.",cost:"Free to use."});
add(789,USU,"gemini","Google Gemini","You must be logged in using your USU.EDU email address",{audience:"Current USU students, faculty, and staff",obtain:"Sign in with a USU.EDU email address."});
add(789,USU,"notebooklm","Google NotebookLM","Available for any current USU student, faculty, or staff member with your @usu.edu email address",{audience:"Current USU students, faculty, and staff",obtain:"Sign in with an @usu.edu email address."});
add(789,USU,"microsoft_copilot_for_m365","Microsoft Copilot for Microsoft 365","available as a purchased add-on per A# account for a cost of $30/month",{obtain:"Purchase with a USU index number.",cost:"$30 per month with annual commitment at the cited price."});
add(789,USU,"claude","Claude Teams","Available in two paid subscription options, billed to a department index",{obtain:"Request a managed USU Claude Teams seat.",cost:"Department-paid subscription."});
add(789,USU,"chatgpt","ChatGPT Business","Available as a paid subscription at $20/user/month, billed to a department index",{obtain:"Request access to the managed USU workspace.",cost:"$20 per user per month at the cited price."});

add(814,"https://tech.calpoly.edu/space/CPKB/2709323777","chatgpt","ChatGPT Edu","For students, faculty, and staff, this service is made possible through the CSU AI initiative through July 2026",{audience:"Current Cal Poly students, faculty, and staff",obtain:"Join the Cal Poly ChatGPT Edu workspace.",forceFirecrawl:true});
add(814,"https://tech.calpoly.edu/space/CPKB/2850226180","microsoft_copilot","Microsoft 365 Copilot Chat","Copilot Chat is a secure AI chat experience available with Microsoft 365 EDU licenses at no extra cost",{obtain:"Sign in with a Cal Poly Microsoft 365 EDU account.",cost:"No extra cost.",forceFirecrawl:true});
add(814,"https://tech.calpoly.edu/space/CPKB/2638708737","zoom_ai_companion","Zoom AI Companion","Zoom AI Companion is an AI assistant available to students, faculty, and staff",{audience:"Cal Poly students, faculty, and staff",obtain:"Use the Cal Poly Zoom environment.",forceFirecrawl:true});
add(814,"https://tech.calpoly.edu/space/CPKB/3342893057","aws_kiro","AWS Kiro Pro","Access is available to all students and faculty now",{audience:"Cal Poly students and faculty",obtain:"Verify eligibility through the Kiro website.",forceFirecrawl:true});

add(824,"https://it.doshisha.ac.jp/files/joki/page/Soft_MS_t.pdf","microsoft_copilot_for_m365","Microsoft 365 Copilot",["Microsoft 365 Copilot(月額約3,000円)","公費振替で受付いたします"],{language:"ja",audience:"Eligible Doshisha faculty and staff",obtain:"Contact the IT Support Office for a public-funds transfer.",cost:"Approximately JPY 3,000 per month at the cited price."});

add(845,"https://hawaii.edu/google/gemini/","gemini","Google Gemini","All faculty, staff, and students at UH can use Gemini as a Core Google Workspace App",{audience:"All UH faculty, staff, and students",obtain:"Use a Google@UH account."});
add(845,"https://hawaii.edu/google/notebooklm/","notebooklm","NotebookLM","All faculty, staff, and students at UH can use NotebookLM as a Core Google Workspace App",{audience:"All UH faculty, staff, and students",obtain:"Use a Google@UH account."});
add(845,"https://www.hawaii.edu/sitelic/google/","google_ai_pro","Google AI Pro for Education","Google AI Pro for Education licenses provides faculty and staff the use of Gemini in their Google@UH core apps",{audience:"UH faculty and staff",obtain:"Purchase a named annual licence through the UH site licence program.",cost:"$204 per year at the cited price."});

const UMSL = "https://www.umsl.edu/technology/resources/artificial-intelligence.html";
add(846,UMSL,"microsoft_copilot","Microsoft 365 Copilot Chat","Microsoft 365 CoPilot Chat (included with University login)",{obtain:"Sign in through SSO@umsystem.edu."});
add(846,UMSL,"microsoft_copilot_for_m365","Microsoft 365 Copilot",["Microsoft 365 Copilot (Paid Version)","Requires an extra add-on paid license"],{obtain:"Purchase through ITS.",cost:"Paid add-on licence."});
add(846,UMSL,"chatgpt","ChatGPT Education","This version is part of a contract between the University and ChatGPT",{audience:"UMSL faculty and staff",obtain:"Submit the AI License Order form and use the UM System Education workspace."});
add(846,UMSL,"teams_premium","Microsoft Teams Premium",["Microsoft Teams Premium","Available to purchase through IT Procurement"],{obtain:"Purchase through IT Procurement."});
add(846,UMSL,"zoom_ai_companion","Zoom AI Companion",["Zoom AI Companion","Approved when accessed via Single Sign-On and SSO@umsystem.edu"],{obtain:"Use SSO@umsystem.edu."});
add(846,UMSL,"grammarly","Grammarly for Education",["Grammarly for Education","Grammarly for Education is approved"],{obtain:"Use the university-approved Education instance."});
add(846,UMSL,"gemini","Google Gemini","Google Gemini AI-powered language model for text generation Approved when accessed via Single Sign-On and SSO@umsystem.edu",{obtain:"Use SSO@umsystem.edu."});
add(846,UMSL,"notebooklm","NotebookLM","NotebookLM AI-Powered research and note-taking tool by Google. Approved when accessed via Single Sign-On and SSO@umsystem.edu",{obtain:"Use SSO@umsystem.edu."});

const UWB = "https://www.aiweb.zcu.cz/en/ai-at-the-university/";
add(851,UWB,"microsoft_copilot","Microsoft Copilot",["Employees and students at the University of West Bohemia in Pilsen have standard access to artificial intelligence tools, through Microsoft Office 365 and Google Workspace licenses","Copilot tool"],{audience:"University of West Bohemia employees and students",obtain:"Use the university Microsoft Office 365 licence."});
add(851,UWB,"gemini","Google Gemini","Google Workspace includes the Gemini tool",{audience:"University of West Bohemia employees and students",obtain:"Use the university Google Workspace licence."});

const PACIFIC = "https://www.pacific.edu/dental/faculty-and-research/resources";
add(852,PACIFIC,"microsoft_copilot","Microsoft Copilot",["Indicates that we have licenses through the Dugoni School or the university","CoPilot : Microsoft's chatbot; log in with Pacific credentials"],{obtain:"Sign in with Pacific credentials."});
add(852,PACIFIC,"scopus_ai","Scopus AI",["Indicates that we have licenses through the Dugoni School or the university","Scopus AI : GenAI for literature review that has been integrated into library databases; log in with Pacific credentials"],{obtain:"Sign in with Pacific credentials."});
add(852,PACIFIC,"chatgpt","ChatGPT",["Indicates that we have licenses through the Dugoni School or the university","ChatGPT : Chat, upload files, and perform data analysis"],{obtain:"Use the Dugoni School or university licence."});
add(852,PACIFIC,"osmosis_ai","Osmosis AI",["Indicates that we have licenses through the Dugoni School or the university","Osmosis AI"],{obtain:"Sign in with Pacific credentials."});
add(852,PACIFIC,"thinglink_ai","ThingLink AI",["Indicates that we have licenses through the Dugoni School or the university","ThingLink AI"],{obtain:"Use the Dugoni School or university licence."});

const WALAILAK = "https://library.wu.ac.th/?page_id=30382";
add(855,WALAILAK,"gemini","Gemini",["AI Tools for Learning and Research Support Provides access to Artificial Intelligence (AI) tools","Gemini is an AI assistant developed by Google","Contact us to request services at: Library staff"],{obtain:"Request service from Walailak University Library staff."});
add(855,WALAILAK,"perplexity","Perplexity AI",["Perplexity AI is an AI-powered search tool","Contact us to request services at: Library staff"],{obtain:"Request service from Walailak University Library staff."});

async function main(){
  const [ranking,discovery,key]=await Promise.all([json("data/rankings/qs-world-university-rankings-2026-top-1000.json"),json(DISCOVERY),firecrawlKey()]);
  const rankingByRow=new Map<number,Json>(ranking.universities.map((row:Json)=>[row.rowNumber,row]));
  const discoveryByRow=new Map<number,Json>(discovery.rows.map((row:Json)=>[row.qsRow,row]));
  await mkdir(SNAPSHOT_ROOT,{recursive:true});
  let supplementalFetches=0; let firecrawlFetches=0;
  for(const spec of specs){
    const row=discoveryByRow.get(spec.row);if(!row)throw new Error(`Missing discovery row ${spec.row}`);
    let page=(row.pages??[]).find((value:Json)=>canonical(value.requestedUrl)===canonical(spec.url)||canonical(value.finalUrl)===canonical(spec.url));
    let text=page?.snapshotPath?visible(await readFile(page.snapshotPath,"utf8")):"";
    if(spec.forceFirecrawl||!page||!spec.anchors.every(anchor=>includes(text,anchor))){
      const cached=spec.forceFirecrawl?await cachedSupplemental(row,spec.url):null;
      const fetched=cached&&spec.anchors.every(anchor=>includes(cached.text,anchor))?cached.page:await fetchPage(key,row,spec.url,spec.forceFirecrawl??false); supplementalFetches+=1;if(fetched.provider.startsWith("firecrawl"))firecrawlFetches+=1;
      row.pages=[...(row.pages??[]).filter((value:Json)=>canonical(value.requestedUrl)!==canonical(spec.url)&&canonical(value.finalUrl)!==canonical(spec.url)),fetched];
      row.candidateUrls=[...new Set([...(row.candidateUrls??[]),spec.url])];page=fetched;text=visible(await readFile(fetched.snapshotPath,"utf8"));
    }
    for(const anchor of spec.anchors)if(!includes(text,anchor))throw new Error(`Anchor missing row ${spec.row} ${spec.rawToolName}: ${anchor}`);
  }
  for(const row of discovery.rows)row.semanticCandidateCount=(row.pages??[]).filter((page:Json)=>page.fetchStatus==="ok"&&(page.semanticSignals?.productTerms?.length??0)>0&&(page.semanticSignals?.accessTerms?.length??0)>0).length;
  discovery.generatedAt=new Date().toISOString();discovery.supplementalReview={generatedAt:discovery.generatedAt,sourceSpecs:specs.length,supplementalFetches,firecrawlFetches,policy:"Targeted source completion only; the original 785 query traces remain immutable."};

  const records:Json[]=[];
  for(const spec of specs){
    const row=discoveryByRow.get(spec.row)!;const rank=rankingByRow.get(spec.row)!;const page=(row.pages??[]).find((value:Json)=>canonical(value.requestedUrl)===canonical(spec.url)||canonical(value.finalUrl)===canonical(spec.url));if(!page?.snapshotPath)throw new Error(`Missing selected page ${spec.url}`);
    const text=visible(await readFile(page.snapshotPath,"utf8"));const snippets=spec.anchors.map(anchor=>actual(text,anchor));const evidence=snippets.map(snippet=>({sourceUrl:page.finalUrl||spec.url,sourceTitle:page.title||"Official university AI tools source",sourceLanguage:spec.language||language(page.language),evidenceSnippet:snippet,evidenceSnippetOriginal:snippet,snapshotHash:page.snapshotHash,snapshotPath:page.snapshotPath,sourceFetchedAt:page.fetchedAt,reviewState:"agent_reviewed"}));
    records.push({universitySlug:row.canonicalSlug,universityName:rank.name,qsRow:spec.row,qsRank:rank.rankNumber,tool:spec.tool,rawToolName:spec.rawToolName,description:`${rank.name} provides or institutionally supports ${spec.rawToolName}.`,howToObtain:spec.obtain??"Use the official university access path.",costToUser:spec.cost??"No individual price is stated.",availability:"allowed",endorsementType:spec.selfHosted?"self_hosted_system":"institutionally_licensed_or_procured",institutionalRelationship:spec.selfHosted?"Institution-operated or locally hosted AI service.":"Official university licence, provision, subscription, procurement route, or supported access path.",accessAudience:spec.audience??`${rank.name} eligible students, faculty, staff, or account holders`,accessStatus:"Current according to the cited official source.",evidenceAsOf:"2026-07-19",reviewState:"agent_reviewed",reviewOrigin:"qs-701-857-20260719-012-full-semantic-review",evidence});
  }
  const ids=records.map(id);if(new Set(ids).size!==records.length){const dup=ids.filter((value,index)=>ids.indexOf(value)!==index);throw new Error(`Duplicate record ids: ${dup.join(", ")}`);}
  records.sort((a,b)=>a.qsRow-b.qsRow||a.tool.localeCompare(b.tool)||a.rawToolName.localeCompare(b.rawToolName));
  const output={schemaVersion:"uapt-ai-tools-records-v1",runId:RUN_ID,generatedAt:new Date().toISOString(),reviewState:"agent_reviewed",summary:{records:records.length,universities:new Set(records.map(record=>record.universitySlug)).size,sources:new Set(records.flatMap(record=>record.evidence.map((item:Json)=>item.sourceUrl))).size,supplementalFetches,firecrawlFetches},records};
  await Promise.all([writeFile(DISCOVERY,`${JSON.stringify(discovery,null,2)}\n`),writeFile(OUTPUT,`${JSON.stringify(output,null,2)}\n`)]);
  console.log(JSON.stringify(output.summary,null,2));
}

async function fetchPage(key:string,row:Json,url:string,forceFirecrawl:boolean){
  const fetchedAt=new Date().toISOString();let text="";let finalUrl=url;let title="Official university AI tools source";let sourceLanguage="und";let provider="http_supplemental";let status=200;
  if(!forceFirecrawl){try{const response=await fetch(url,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0 (compatible; UAPT-Audit/2.0; +https://eduaipolicy.org)"},signal:AbortSignal.timeout(25_000)});status=response.status;finalUrl=response.url||url;const type=response.headers.get("content-type")??"";if(response.ok&&/text\/(?:html|plain)/i.test(type)){const html=await response.text();title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()||title;text=htmlToText(html);}else if(response.ok&&/application\/pdf/i.test(type)){const converted=spawnSync("pdftotext",["-","-"],{input:Buffer.from(await response.arrayBuffer()),maxBuffer:30_000_000});if(converted.status===0)text=converted.stdout.toString("utf8");}}catch{/* Firecrawl fallback below. */}}
  if(forceFirecrawl||text.trim().length<200){provider="firecrawl_scrape_v2_targeted";const response=await fetch("https://api.firecrawl.dev/v2/scrape",{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true}),signal:AbortSignal.timeout(60_000)});const body:any=await response.json().catch(()=>({}));if(!response.ok||!body?.data?.markdown)throw new Error(`Targeted Firecrawl fetch failed ${url}: ${body?.error??response.status}`);text=String(body.data.markdown);finalUrl=body.data.metadata?.sourceURL??body.data.metadata?.url??url;title=body.data.metadata?.title??title;sourceLanguage=body.data.metadata?.language??sourceLanguage;status=body.data.metadata?.statusCode??response.status;}
  text=visible(text);const snapshotPath=path.join(SNAPSHOT_ROOT,`${row.qsRow}-supplemental-${slug(new URL(finalUrl).hostname+new URL(finalUrl).pathname)}-${hash(finalUrl).slice(0,10)}.md`);await writeFile(snapshotPath,text);
  return {requestedUrl:url,finalUrl,title,language:sourceLanguage,provider,fetchedAt,fetchStatus:"ok",httpStatus:status,snapshotPath,snapshotHash:hash(text),semanticSignals:{productTerms:[],accessTerms:["institutional access"]},evidenceWindows:[],error:null};
}

async function cachedSupplemental(row:Json,url:string):Promise<{page:Json;text:string}|null>{
  const snapshotPath=path.join(SNAPSHOT_ROOT,`${row.qsRow}-supplemental-${slug(new URL(url).hostname+new URL(url).pathname)}-${hash(url).slice(0,10)}.md`);
  try{const raw=await readFile(snapshotPath,"utf8");const text=visible(raw);return {text,page:{requestedUrl:url,finalUrl:url,title:"Official university AI tools source",language:"und",provider:"firecrawl_scrape_v2_targeted_cached",fetchedAt:new Date().toISOString(),fetchStatus:"ok",httpStatus:200,snapshotPath,snapshotHash:hash(raw),semanticSignals:{productTerms:[],accessTerms:["institutional access"]},evidenceWindows:[],error:null}};}catch{return null;}
}

function id(record:Json){return `${record.universitySlug}:${record.tool}:${record.rawToolName}`;}
function includes(text:string,anchor:string){return text.toLocaleLowerCase().includes(visible(anchor).toLocaleLowerCase());}
function actual(text:string,anchor:string){const normalized=visible(anchor);const index=text.toLocaleLowerCase().indexOf(normalized.toLocaleLowerCase());if(index<0)throw new Error(`Missing anchor ${anchor}`);return text.slice(index,index+normalized.length);}
function canonical(value:string){try{const url=new URL(value);url.hash="";return `${url.hostname.toLowerCase().replace(/^www\./,"")}${url.pathname.replace(/\/$/,"")}${url.search}`;}catch{return value;}}
function htmlToText(value:string){return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&#8217;/g,"'").replace(/&#160;/g," ").replace(/\s+/g," ").trim();}
function visible(value:string|Buffer){return String(value).normalize("NFKC").replace(/[*_#`|]/g," ").replace(/\[([^\]]+)\]\([^\)]+\)/g,"$1").replace(/[\u00a0\s]+/g," ").trim();}
function slug(value:string){return value.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,120);}
function language(value:unknown){const code=String(value??"und").toLowerCase().split("-")[0];return /^[a-z]{2,3}$/.test(code)?code:"und";}
function hash(value:string|Uint8Array){return createHash("sha256").update(value).digest("hex");}
async function json(file:string):Promise<Json>{return JSON.parse(await readFile(file,"utf8"));}
async function firecrawlKey(){const config=await readFile("/Users/newvolume/.codex/config.toml","utf8");const key=config.match(/^\s*FIRECRAWL_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];if(!key)throw new Error("FIRECRAWL_API_KEY unavailable");return key;}

void main().catch(error=>{console.error(error);process.exitCode=1;});
