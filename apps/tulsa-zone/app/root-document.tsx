import { RootDocument as Original } from "../../web/app/root-document";
import { ZoneNavigation } from "../components/zone-navigation";
export function RootDocument({children,locale}:any){return <Original locale={locale}>{children}<ZoneNavigation/></Original>;}
