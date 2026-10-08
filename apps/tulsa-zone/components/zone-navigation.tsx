"use client";
import {useEffect} from "react";
export function ZoneNavigation(){useEffect(()=>{const click=(e:MouseEvent)=>{const a=(e.target as Element)?.closest('a');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute('download'))return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname!==location.pathname){e.preventDefault();e.stopPropagation();location.assign(u.href);}};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[]);return null;}
