"use client";
import {useEffect} from "react";
import {saveDiscoveryPosition, requestDiscoveryPosition} from "@/lib/discovery-return-state";
export function ZoneNavigation(){useEffect(()=>{const click=(e:MouseEvent)=>{const a=(e.target as Element)?.closest('a');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute('download'))return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname!==location.pathname){
  // Capture-phase hard navigation bypasses React click handlers. Save/restore
  // discovery state before leaving the document, including across zones.
  if(u.searchParams.has('returnTo'))saveDiscoveryPosition(location.pathname+location.search,a);
  if(a.closest('.discovery-return'))requestDiscoveryPosition(u.pathname+u.search);
  e.preventDefault();e.stopPropagation();location.assign(u.href);
}};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[]);return null;}
