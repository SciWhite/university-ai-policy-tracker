import {ChangeIndexEventsPage} from "@/components/change-index-events-page";
import {normalizeLocale} from "@/lib/i18n";
import Original,{generateMetadata} from "../../../../web/app/(default)/changes/page";
import {V6ChangeNote} from "@zone/components/v6-change-note";
export {generateMetadata};
export const dynamic="force-dynamic";
export default async function Page(props:any){const params=await props.params;const events=await ChangeIndexEventsPage({locale:normalizeLocale(params?.locale)});if(events)return events;return <><V6ChangeNote locale={params?.locale}/>{await Original(props)}</>}
