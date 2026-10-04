"use client";
import { useEffect, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n";
const labels = {
  en:["Support email provider","Retention"], zh:["支持邮箱服务商","保留设置"], fr:["Fournisseur de messagerie","Conservation"],
  pl:["Dostawca poczty","Przechowywanie"], es:["Proveedor de correo","Conservación"], nl:["Mailprovider","Bewaring"], ms:["Penyedia e-mel","Penyimpanan"]
} as const;
export function SupportMailboxDetails({locale}:{locale:SupportedLocale}) {
  const [details,setDetails]=useState<{provider:string;retention:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/plugin/status",{cache:"no-store",signal:controller.signal}).then(r=>r.json()).then(data=>{
      if(typeof data.supportMailbox?.provider === "string" && typeof data.supportMailbox?.retention === "string")setDetails(data.supportMailbox);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  return details ? <><dl><dt>{labels[locale][0]}</dt><dd>{details.provider}</dd><dt>{labels[locale][1]}</dt><dd lang="en">{details.retention}</dd></dl><p><a href="https://www.zoho.com/mail/help/data-deletion-policy.html" target="_blank" rel="noreferrer" lang="en">Zoho Mail deletion policy</a></p></> : null;
}
