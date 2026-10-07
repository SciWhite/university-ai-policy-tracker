import React from "react";

// Names identify a tool, not permission to use it for an assessment.
export const policyToolNames = [
 "Microsoft Copilot Chat", "Microsoft Copilot", "Copilot Chat", "Copilot", "Gemini", "NotebookLM",
 "dAIsy", "ELM", "ChatGPT", "Turnitin", "Inspera", "DeepSeek", "Grammarly"
] as const;

// Shared scanning vocabulary for site-authored guidance. Original quotations never use this component.
export const sampleActionPhrases = [
 ...policyToolNames,
 "Category 1", "Category 2", "Category 3", "Category 4", "Lane 1", "Lane 2", "Secure", "Open", "AI Required", "No Assistance", "Simple editing assistance",
 "明确允许", "明确书面允许", "书面许可", "明确许可", "本课程", "本任务", "任务指定类别优先", "更严格的规则", "课程单元的 AI 规则", "受限数据", "敏感数据", "患者数据", "个人信息", "High Risk MIT data", "High Risk", "restricted data", "personal information", "patient data", "confidential data",
 "不实质改变内容或含义", "内容与含义", "自己表达的内容与含义", "任务说明明确允许翻译工具", "2027 年", "注明并不替代课程许可", "不等于允许使用翻译工具", "不等于当前任务许可", "不代表当前许可", "不代表当前任务许可", "访问权不等于", "工具访问权不等于", "不是自动处罚", "不是学生提交期限", "不是申诉期限", "不是提交期限", "不是全校统一", "不是所有案件", "并非每项 COD 决定都可申诉",
 "does not grant assessment permission", "does not by itself authorise its use", "does not replace the task rule", "does not override", "not assignment permission", "not assessment permission", "not proof of academic misconduct", "not a finding", "not automatic", "cannot be the sole basis", "not the sole basis", "not available", "not enabled", "not reliable",
 "task-specific category takes precedence", "specifically allow translation tools", "does not substantively change the content or meaning", "written permission", "express permission", "explicit permission", "explicitly authorised", "explicitly authorized", "permitted use must be disclosed", "proper acknowledgement", "proper attribution", "implementation by 2027",
 "Harvard College", "Stanford Law School", "Law School", "PWR", "MD/MSPA", "HGSE", "Yale School of Public Health", "Yale College", "YSPH", "Harris School of Public Policy", "Harris", "Vancouver", "Okanagan", "non-Honours", "本科生", "仅 YSPH", "仅 Harris", "仅 Vancouver", "法学院", "公共卫生学院",
 "Honor Council", "Honor Committee", "Committee on Discipline", "COD", "CAPI", "Academic Misconduct Panel", "Appeal Committee", "ANU Appeals Committee", "Dean Review", "Dean", "Registrar", "Provost", "Secretary", "SAMOS/CAMOS", "Academic Misconduct Officers", "Board of Examiners", "Proctors", "OSCCS", "OCS", "Conduct & Integrity Office", "AIO", "Early Resolution", "Review Committee", "Formal Inquiry", "Exploratory Interview", "Investigatory Viva", "viva voce", "SAIF", "Student Academic Integrity Fellow", "SRC", "SUPRA", "AUSA", "Arc@UNSW", "UQ Union", "The Advice Place", "Downtown Legal Services", "Student Care Advocates", "SRC Advice Centre", "balance of probabilities", "clear and persuasive evidence",
 "independent", "confidential", "free", "support person", "legal representation", "reconsideration", "Reconsideration", "Appeal", "Review", "Academic Appeals", "Request for Review", "substantive", "new evidence", "procedural error", "procedural irregularity", "grounds", "reasonable adjustments", "免费", "保密", "独立", "支持人", "法律代理", "合理调整", "重大新信息", "重要新证据", "程序错误", "不同路径", "两条不同路径", "书面回应", "书面提交", "收到决定", "决定发送", "决定发出", "材料发送", "邮件发送", "不是 Dean", "不是自动恢复学籍", "不能成为案件唯一依据", "功能不可用不等于", "未启用", "不一定构成确凿证据", "不能直接视为已经认定违规", "不要把报告旗标等同最终认定"
] as const;

const prohibitionMarkers = [
 "must not", "shall not", "may not", "strictly prohibited", "strictly prohibit", "prohibits", "is prohibited",
 "Don't use", "Don't submit", "Don't put", "Don't enter", "Don't present", "Do not use", "Do not submit", "Do not put", "Do not enter", "Do not present",
 "不得", "禁止", "不允许", "不可使用", "不要向", "不要用", "不要使用", "未经允许，不用", "没有授权，不用", "不使用未获批准"
] as const;

const escapeRegex = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function literalPresent(text:string,phrase:string) {
 return /[A-Za-z]/.test(phrase[0]) && /[A-Za-z]/.test(phrase.at(-1) ?? "")
  ? new RegExp(`(?<![A-Za-z])${escapeRegex(phrase)}(?![A-Za-z])`).test(text)
  : text.includes(phrase);
}

/** Suggestions are literal text spans, never HTML, translations or rewritten policy statements. */
export function policyHighlights(text:string): {phrases:string[];dangerPhrases:string[]} {
 const phrases = sampleActionPhrases.filter(p=>literalPresent(text,p)) as string[];
 // Keep the number with its unit, including the College/business/calendar distinction.
 const times=text.match(/\b(?:\d+|three|five|seven|ten|fourteen|twenty(?:-one)?|forty-five)\s+(?:(?:College\s+)?(?:working|business|calendar)\s+)?days\b|\d+\s*(?:个\s*)?(?:College\s*)?(?:工作日|日历日|天)|\d+\s*年/g) ?? [];
 const scopes=text.match(/(?:仅|只适用)[^：:；;。\n]{2,35}(?=[：:；;。]|$)/g) ?? [];
 const dangerPhrases=prohibitionMarkers.filter(p=>literalPresent(text,p)) as string[];
 return {phrases:[...new Set([...times,...scopes,...phrases])],dangerPhrases};
}

// Classify each occurrence, so one real prohibition cannot colour a negated mention elsewhere.
function isNegated(text:string,start:number) {
 const before=text.slice(Math.max(0,start-48),start);
 return /(?:\bnot\s+|\bnot universally\s+|\b(?:does not mean|does not imply|not a rule that)[^;.!?]{0,32}|(?:不是|并非|不代表|不等于|没有|不意味着)[^；;。.!?]{0,32})$/.test(before);
}
function hasLiteralBoundary(text:string,start:number,part:string) {
 return !(/[A-Za-z]/.test(part[0]) && /[A-Za-z]/.test(text[start-1] ?? "")) &&
  !(/[A-Za-z]/.test(part.at(-1) ?? "") && /[A-Za-z]/.test(text[start+part.length] ?? ""));
}
function ToolText({text}:{text:string}) {
 const pattern=new RegExp(policyToolNames.map(escapeRegex).join("|"),"g");
 const parts:React.ReactNode[]=[];let cursor=0;
 for(const match of text.matchAll(pattern)) {
  const start=match.index!;
  if(!hasLiteralBoundary(text,start,match[0]))continue;
  parts.push(text.slice(cursor,start),<span className="policy-summary-emphasis--tool" key={start}>{match[0]}</span>);
  cursor=start+match[0].length;
 }
 parts.push(text.slice(cursor));return <>{parts}</>;
}

/** Exact phrases only. Preserve the complete selectable text, punctuation and reading order. */
export function PolicySummaryEmphasis({ text, phrases = [], dangerPhrases = [], policy = false }: {
 text:string;phrases?:readonly string[];dangerPhrases?:readonly string[];policy?:boolean;
}) {
 const automatic=policy ? policyHighlights(text) : {phrases:[],dangerPhrases:[]};
 const danger=[...new Set([...dangerPhrases,...automatic.dangerPhrases])];
 const authored=phrases.filter(p=>p && literalPresent(text,p));
 // Authored context has priority; avoid turning a whole paragraph into bold text.
 const extras=automatic.phrases.filter(p=>!authored.some(a=>a.includes(p))).slice(0,Math.max(0,4-authored.length));
 const tools=policy ? policyToolNames.filter(p=>literalPresent(text,p)) : [];
 const available=[...new Set([...authored,...extras,...tools,...danger])].filter(p=>p && literalPresent(text,p)).sort((a,b)=>b.length-a.length);
 if(!available.length)return <>{text}</>;
 const pattern=new RegExp(available.map(escapeRegex).join("|"),"g");
 const parts:React.ReactNode[]=[];let cursor=0;
 for(const match of text.matchAll(pattern)) {
  const part=match[0],start=match.index!;
  if(!hasLiteralBoundary(text,start,part))continue;
  parts.push(text.slice(cursor,start));
  const activeDanger=danger.some(p=>part.startsWith(p)) && !isNegated(text,start);
  const tone=activeDanger ? "danger" : policyToolNames.some(name=>part===name) ? "tool" : "neutral";
  parts.push(<strong className={`policy-summary-emphasis${tone!=="neutral" ? ` policy-summary-emphasis--${tone}` : ""}`} key={start}>
   {policy && tone==="neutral" ? <ToolText text={part}/> : part}
  </strong>);
  cursor=start+part.length;
 }
 parts.push(text.slice(cursor));return <>{parts}</>;
}
