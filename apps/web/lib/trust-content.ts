import type { SupportedLocale } from "./i18n";
export const trustContent = {
  "en": {
    "labels": [
      "Contact",
      "Support",
      "Privacy",
      "Terms",
      "AI policy in ChatGPT",
      "Support and privacy",
      "Disable website analytics",
      "Enable website analytics",
      "Website analytics are disabled.",
      "Website analytics are enabled.",
      "Install in ChatGPT",
      "Public directory listing is not available yet.",
      "English is the canonical text; translations assist reading."
    ],
    "contact": [
      "University AI Policy Tracker is independently operated by Samsong. Contact support@eduaipolicy.org for support, privacy requests or corrections.",
      "For a correction, include the university, page or claim ID and official source URL. Do not send student records, private coursework or sensitive personal information."
    ],
    "support": [
      "After public directory publication, search for University AI Policy Tracker in a supported ChatGPT plugin directory, install it, and ask about your university. Availability can depend on your account, region, workspace and client. No separate website account or API key is required.",
      "Give the full university name and country. If several schools match, choose one before reading its policy. Check whether evidence applies to your course, assessment, faculty, staff or students.",
      "Answers should link to both the tracker evidence and the official university source. Missing evidence does not mean there is no rule. Tool access does not establish permission to use it in an assessment.",
      "For a fault, email the university, tool name, approximate time and a short description. Remove prompts containing private information. We do not promise a fixed response time."
    ],
    "privacy": [
      "Website analytics: we use first-party visitor and session identifiers, page paths, interaction categories, coarse country/device information and referral/campaign attribution to understand use and improve the service. Analytics are stored in Supabase. Use the control below to stop non-essential collection in this browser and remove its analytics identifiers; the preference remains. Analytics records are retained for a rolling 13 months.",
      "MCP statistics: we retain only daily aggregates of university, topic, outcome and latency for 13 months. We do not retain raw prompts, assignment content, user identity or per-call event histories. ChatGPT and your installed client have their own privacy practices.",
      "Infrastructure and security: Cloudflare and our OCI-hosted server process requests to deliver and protect the service. Infrastructure logs can contain network addresses and request metadata; this is separate from analytics. Nginx access logs rotate daily and retain 14 rotations. Other provider and system log retention follows the actual infrastructure configuration.",
      "Support email: messages sent to support@eduaipolicy.org are processed by our business email provider and kept as needed to handle your request. Ask for deletion or clarification by email. Do not send private coursework. The mailbox provider and its settings are confirmed before directory submission."
    ],
    "terms": [
      "This is an independent public reference service, not an official university statement. Linked original university policies and course or assessment instructions govern; the tracker does not grant permission or provide legal or academic-integrity advice.",
      "Evidence can have a limited audience, unit or effective period. A retrieval date is not an effective date. We cannot guarantee completeness or uninterrupted availability. Request corrections using the official source.",
      "Tracker metadata uses CC BY 4.0 with attribution. Original source documents retain their owners’ rights and terms. Use the read-only service reasonably; do not interfere with availability or try to access unpublished material."
    ],
    "mcp": [
      "Ask what your school says about AI use, disclosure, exams, privacy and institutional tools. The service queries all eligible published university records and preserves their evidence and scope.",
      "Resolve the school, retrieve student policy, then verify claim evidence when needed. Each answer should include a tracker link and official source link. Unpublished research is excluded.",
      "The remote endpoint is https://eduaipolicy.org/api/mcp. Public-directory availability is shown below. The earlier REST alpha manifest and tool catalog remain available for compatibility."
    ]
  },
  "zh": {
    "labels": [
      "联系",
      "支持",
      "隐私",
      "使用条款",
      "在 ChatGPT 查询学校 AI 政策",
      "支持与隐私",
      "关闭网站分析",
      "开启网站分析",
      "网站分析已关闭。",
      "网站分析已开启。",
      "在 ChatGPT 安装",
      "公开目录条目尚未开放。",
      "英文为规范正文，译文帮助理解。"
    ],
    "contact": [
      "University AI Policy Tracker 由 Samsong 独立运营。支持、隐私请求和数据纠错请联系 support@eduaipolicy.org。",
      "纠错时请提供学校、页面或声明 ID，以及学校官方来源链接。请勿发送学生记录、私人作业或敏感个人信息。"
    ],
    "support": [
      "公开目录发布后，在支持的 ChatGPT 插件目录搜索 University AI Policy Tracker 并安装，即可询问学校政策。可用性可能取决于账号、地区、工作区和客户端。无需另注册网站账号或提供 API Key。",
      "请提供学校全名和国家。同名学校需先确认，再查询政策。核查证据是否适用于你的课程、考核、院系、教职员工或学生。",
      "回答应同时链接网站证据与学校官方来源。证据不足不代表学校没有规定；学校提供某种工具也不代表允许在作业或考试中使用。",
      "故障报告请通过邮箱提供学校、工具名称、大致时间和简短描述，去除提示词中的私人信息。我们不承诺固定回复时限。"
    ],
    "privacy": [
      "网站分析：使用第一方访客和会话标识、页面路径、交互类别、粗粒度国家及设备信息、来源与活动归因，了解使用情况并改进服务。分析数据存储在 Supabase。下方开关可停止此浏览器的非必要采集并清除分析标识，保留退出偏好。分析记录滚动保留 13 个月。",
      "MCP 统计：仅保留按日聚合的学校、主题、结果和延迟，保留 13 个月。不保留原始提示词、作业内容、用户身份或逐调用历史。ChatGPT 和所用客户端有各自的隐私规则。",
      "基础设施与安全：Cloudflare 和 OCI 上的服务器为提供与保护服务处理请求。基础设施日志可能包含网络地址和请求元数据，与分析数据分开。Nginx 访问日志每日轮换，保留 14 次轮换；其他服务商及系统日志以实际配置为准。",
      "支持邮件：发送至 support@eduaipolicy.org 的邮件由商业邮箱服务商处理，并按处理请求所需保留。可通过邮箱要求删除或询问处理方式。不要发送私人作业。邮箱服务商及设置会在目录提交前确认。"
    ],
    "terms": [
      "本站为独立公共参考服务，不是学校官方声明。学校原文以及课程和考核要求具有决定作用；本站不授予使用权限，也不提供法律或学术诚信建议。",
      "证据可能只适用于特定人群、院系或时期。抓取日期不是生效日期。本站无法保证覆盖完整或服务持续可用；纠错请提供官方来源。",
      "网站整理的元数据采用 CC BY 4.0，使用时需署名。学校原文保留权利人的版权和条款。请合理使用只读服务，不干扰服务或尝试获取未公开资料。"
    ],
    "mcp": [
      "查询学校对 AI 使用、披露、考试、隐私和机构工具的规定。服务覆盖所有符合门槛的正式发布记录，并保留证据和适用范围。",
      "先确定学校，再查询学生政策，必要时核查声明证据。回答应同时提供网站和学校官方链接。未发布的研究资料不参与回答。",
      "远程端点为 https://eduaipolicy.org/api/mcp。公开目录状态见下方；此前的 REST alpha manifest 和工具目录继续保留兼容。"
    ]
  },
  "fr": {
    "labels": [
      "Contact",
      "Assistance",
      "Confidentialité",
      "Conditions",
      "Les règles IA dans ChatGPT",
      "Assistance et confidentialité",
      "Désactiver les statistiques",
      "Activer les statistiques",
      "Les statistiques sont désactivées.",
      "Les statistiques sont activées.",
      "Installer dans ChatGPT",
      "La fiche du répertoire public n’est pas encore disponible.",
      "Le texte anglais fait référence ; les traductions facilitent la lecture."
    ],
    "contact": [
      "University AI Policy Tracker est exploité indépendamment par Samsong. Écrivez à support@eduaipolicy.org pour l’assistance, la confidentialité ou les corrections.",
      "Pour une correction, indiquez l’université, la page ou l’identifiant de l’affirmation et le lien officiel. N’envoyez pas de dossiers étudiants, de travaux privés ni de données personnelles sensibles."
    ],
    "support": [
      "Après publication dans le répertoire public, recherchez University AI Policy Tracker dans un répertoire de plugins ChatGPT compatible et installez-le. La disponibilité peut dépendre du compte, de la région, de l’espace de travail et du client. Aucun compte supplémentaire ni clé API n’est requis.",
      "Précisez le nom complet et le pays. En cas d’ambiguïté, choisissez l’établissement avant la consultation. Vérifiez le cours, l’évaluation, la faculté et le public concernés.",
      "Les réponses doivent relier les preuves du tracker et la source officielle. Une preuve insuffisante ne signifie pas une absence de règle. L’accès à un outil n’autorise pas son usage dans une évaluation.",
      "Signalez les erreurs par courriel avec l’université, l’outil, l’heure approximative et une description courte. Retirez les informations privées des requêtes. Aucun délai fixe de réponse n’est garanti."
    ],
    "privacy": [
      "Statistiques du site : identifiants internes de visiteur et de session, chemins de pages, catégories d’interactions, pays et appareil approximatifs, provenance et attribution des campagnes nous aident à améliorer le service. Elles sont stockées dans Supabase pendant 13 mois glissants. Le bouton ci-dessous arrête la collecte non essentielle et efface les identifiants de ce navigateur ; votre choix reste enregistré.",
      "MCP : seules des statistiques quotidiennes par université, sujet, résultat et latence sont conservées pendant 13 mois. Nous ne conservons ni requêtes brutes, ni travaux, ni identité, ni historique individuel des appels. ChatGPT et votre client appliquent leurs propres règles de confidentialité.",
      "Infrastructure et sécurité : Cloudflare et notre serveur OCI traitent les requêtes. Les journaux peuvent contenir des adresses réseau et des métadonnées, séparément des statistiques. Les journaux d’accès Nginx tournent chaque jour et conservent 14 rotations. Les autres journaux suivent les configurations effectives.",
      "Courriels : notre fournisseur de messagerie professionnelle traite les messages adressés à support@eduaipolicy.org, conservés selon les besoins du traitement. Demandez leur suppression ou des précisions par courriel. N’envoyez pas de travaux privés. Le fournisseur et les réglages seront confirmés avant la soumission au répertoire."
    ],
    "terms": [
      "Ce service indépendant est une référence publique, pas une déclaration officielle d’université. Les sources originales et les instructions des cours ou évaluations font autorité. Le tracker ne donne aucune permission ni conseil juridique ou d’intégrité académique.",
      "Une preuve peut concerner un public, une unité ou une période limitée. La date de collecte n’est pas la date d’effet. L’exhaustivité et la disponibilité permanente ne sont pas garanties. Utilisez une source officielle pour demander une correction.",
      "Les métadonnées du tracker sont sous CC BY 4.0 avec attribution. Les documents originaux gardent leurs droits et conditions. Utilisez raisonnablement le service en lecture seule, sans perturber sa disponibilité ni chercher des contenus non publiés."
    ],
    "mcp": [
      "Consultez les règles de votre université sur l’IA, la déclaration, les examens, la confidentialité et les outils institutionnels. Tous les dossiers publiés admissibles sont consultables avec leurs preuves et leur portée.",
      "Identifiez l’université, consultez ses règles, puis vérifiez les preuves au besoin. Les réponses doivent citer le tracker et la source officielle. Les recherches non publiées sont exclues.",
      "Le point d’accès distant est https://eduaipolicy.org/api/mcp. Le statut du répertoire figure ci-dessous. Le manifeste REST alpha et le catalogue historique restent disponibles."
    ]
  },
  "pl": {
    "labels": [
      "Kontakt",
      "Pomoc",
      "Prywatność",
      "Warunki",
      "Zasady AI w ChatGPT",
      "Pomoc i prywatność",
      "Wyłącz analitykę strony",
      "Włącz analitykę strony",
      "Analityka jest wyłączona.",
      "Analityka jest włączona.",
      "Zainstaluj w ChatGPT",
      "Wpis w publicznym katalogu nie jest jeszcze dostępny.",
      "Tekst angielski jest podstawowy; tłumaczenia pomagają w lekturze."
    ],
    "contact": [
      "University AI Policy Tracker prowadzi niezależnie Samsong. W sprawach pomocy, prywatności i korekt pisz na support@eduaipolicy.org.",
      "Przy korekcie podaj uczelnię, stronę lub identyfikator twierdzenia oraz oficjalne źródło. Nie wysyłaj dokumentacji studentów, prywatnych prac ani wrażliwych danych."
    ],
    "support": [
      "Po publikacji w publicznym katalogu znajdź University AI Policy Tracker w obsługiwanym katalogu wtyczek ChatGPT i zainstaluj. Dostępność zależy od konta, regionu, przestrzeni roboczej i klienta. Dodatkowe konto ani klucz API nie są wymagane.",
      "Podaj pełną nazwę uczelni i kraj. Przy kilku dopasowaniach najpierw wybierz uczelnię. Sprawdź zakres kursu, oceny, wydziału i odbiorców.",
      "Odpowiedzi powinny zawierać dowody trackera i oficjalne źródło. Brak wystarczających dowodów nie oznacza braku zasad. Dostęp do narzędzia nie oznacza zgody na jego użycie przy ocenianiu.",
      "Zgłoś błąd e-mailem, podając uczelnię, narzędzie, przybliżony czas i krótki opis. Usuń prywatne dane z zapytań. Nie gwarantujemy stałego czasu odpowiedzi."
    ],
    "privacy": [
      "Analityka strony: własne identyfikatory odwiedzających i sesji, ścieżki stron, typy interakcji, przybliżony kraj i urządzenie oraz źródła i kampanie pomagają ulepszać usługę. Dane przechowuje Supabase przez 13 miesięcy. Przycisk poniżej zatrzymuje zbędne zbieranie danych w tej przeglądarce i usuwa identyfikatory; preferencja pozostaje.",
      "MCP: przez 13 miesięcy zapisujemy tylko dzienne agregaty uczelni, tematu, wyniku i opóźnienia. Nie zapisujemy surowych zapytań, prac, tożsamości ani historii pojedynczych wywołań. ChatGPT i klient mają własne zasady prywatności.",
      "Infrastruktura i bezpieczeństwo: żądania przetwarzają Cloudflare i nasz serwer OCI. Osobne logi infrastruktury mogą zawierać adresy sieciowe i metadane. Logi dostępu Nginx rotują codziennie, zachowując 14 rotacji. Inne logi podlegają rzeczywistym ustawieniom.",
      "E-mail: dostawca firmowej poczty przetwarza wiadomości do support@eduaipolicy.org. Przechowujemy je według potrzeb obsługi. Możesz zażądać usunięcia lub wyjaśnień e-mailem. Nie wysyłaj prywatnych prac. Dostawcę i ustawienia potwierdzamy przed zgłoszeniem do katalogu."
    ],
    "terms": [
      "To niezależny publiczny serwis informacyjny, nie oficjalne stanowisko uczelni. Wiążące są źródła uczelni i instrukcje kursów lub oceniania. Tracker nie udziela zgody ani porad prawnych lub dotyczących uczciwości akademickiej.",
      "Dowody mogą dotyczyć określonej grupy, jednostki lub okresu. Data pobrania nie jest datą wejścia w życie. Nie gwarantujemy kompletności ani ciągłości działania. Korekty zgłaszaj z oficjalnym źródłem.",
      "Metadane trackera są na licencji CC BY 4.0 z uznaniem autorstwa. Oryginalne dokumenty zachowują prawa właścicieli. Korzystaj rozsądnie z usługi odczytu, nie zakłócaj jej działania i nie próbuj uzyskać nieopublikowanych materiałów."
    ],
    "mcp": [
      "Sprawdź zasady uczelni dotyczące AI, ujawniania użycia, egzaminów, prywatności i narzędzi. Dostępne są wszystkie opublikowane rekordy spełniające kryteria, z dowodami i zakresem.",
      "Najpierw ustal uczelnię, potem pobierz zasady, a w razie potrzeby dowody. Odpowiedź powinna zawierać tracker i oficjalne źródło. Nieopublikowane badania są wyłączone.",
      "Zdalny adres to https://eduaipolicy.org/api/mcp. Status katalogu znajduje się poniżej. Dotychczasowy manifest REST alpha i katalog narzędzi pozostają dostępne."
    ]
  },
  "es": {
    "labels": [
      "Contacto",
      "Ayuda",
      "Privacidad",
      "Condiciones",
      "Políticas de IA en ChatGPT",
      "Ayuda y privacidad",
      "Desactivar analítica",
      "Activar analítica",
      "La analítica está desactivada.",
      "La analítica está activada.",
      "Instalar en ChatGPT",
      "La ficha del directorio público aún no está disponible.",
      "El texto inglés es el canónico; las traducciones facilitan la lectura."
    ],
    "contact": [
      "Samsong gestiona University AI Policy Tracker de forma independiente. Escribe a support@eduaipolicy.org para ayuda, privacidad o correcciones.",
      "Indica universidad, página o identificador de afirmación y fuente oficial. No envíes expedientes estudiantiles, trabajos privados ni datos personales sensibles."
    ],
    "support": [
      "Tras la publicación pública, busca University AI Policy Tracker en un directorio compatible de plugins ChatGPT e instálalo. La disponibilidad depende de cuenta, región, espacio de trabajo y cliente. No necesitas otra cuenta ni clave API.",
      "Indica nombre completo y país. Si hay varias coincidencias, elige antes de consultar. Comprueba el alcance del curso, evaluación, facultad y destinatarios.",
      "Las respuestas deben enlazar pruebas del tracker y fuentes oficiales. Evidencia insuficiente no significa ausencia de reglas. El acceso a una herramienta no autoriza usarla en una evaluación.",
      "Informa de fallos por correo con universidad, herramienta, hora aproximada y descripción breve. Elimina información privada de las consultas. No garantizamos un plazo fijo de respuesta."
    ],
    "privacy": [
      "Analítica web: identificadores propios de visitante y sesión, rutas, categorías de interacción, país y dispositivo aproximados, procedencia y campañas ayudan a mejorar el servicio. Supabase conserva estos datos durante 13 meses móviles. El control inferior detiene la recopilación no esencial en este navegador y elimina identificadores; mantiene tu preferencia.",
      "MCP: conservamos 13 meses únicamente agregados diarios por universidad, tema, resultado y latencia. No guardamos consultas originales, tareas, identidad ni historial individual de llamadas. ChatGPT y el cliente tienen sus propias políticas de privacidad.",
      "Infraestructura y seguridad: Cloudflare y nuestro servidor OCI procesan peticiones. Los registros separados pueden incluir direcciones de red y metadatos. Nginx rota los registros de acceso diariamente y mantiene 14 rotaciones. Otros registros siguen la configuración real.",
      "Correo: nuestro proveedor de correo empresarial procesa mensajes a support@eduaipolicy.org, conservados según sea necesario para atenderlos. Solicita eliminación o aclaraciones por correo. No envíes tareas privadas. El proveedor y los ajustes se confirman antes del envío al directorio."
    ],
    "terms": [
      "Servicio público independiente de referencia, no declaración oficial universitaria. Rigen los documentos oficiales y las instrucciones del curso o evaluación. El tracker no otorga permiso ni asesoramiento jurídico o de integridad académica.",
      "Las pruebas pueden limitarse a un público, unidad o periodo. La fecha de recopilación no es la de vigencia. No garantizamos exhaustividad ni disponibilidad continua. Solicita correcciones con una fuente oficial.",
      "Metadatos bajo CC BY 4.0 con atribución. Los documentos originales conservan sus derechos y condiciones. Usa razonablemente el servicio de lectura, sin interferir ni intentar acceder a materiales no publicados."
    ],
    "mcp": [
      "Consulta reglas sobre IA, declaración, exámenes, privacidad y herramientas institucionales. Se consultan todos los registros publicados admisibles, conservando pruebas y alcance.",
      "Identifica la universidad, consulta su política y verifica pruebas cuando haga falta. La respuesta debe enlazar tracker y fuente oficial. La investigación no publicada queda excluida.",
      "El endpoint remoto es https://eduaipolicy.org/api/mcp. Abajo aparece el estado del directorio. Se conservan el manifiesto REST alpha y el catálogo anterior."
    ]
  },
  "nl": {
    "labels": [
      "Contact",
      "Ondersteuning",
      "Privacy",
      "Voorwaarden",
      "AI-beleid in ChatGPT",
      "Ondersteuning en privacy",
      "Websiteanalyse uitschakelen",
      "Websiteanalyse inschakelen",
      "Websiteanalyse staat uit.",
      "Websiteanalyse staat aan.",
      "Installeren in ChatGPT",
      "De openbare directoryvermelding is nog niet beschikbaar.",
      "De Engelse tekst is leidend; vertalingen ondersteunen het lezen."
    ],
    "contact": [
      "Samsong beheert University AI Policy Tracker onafhankelijk. Mail support@eduaipolicy.org voor ondersteuning, privacyvragen of correcties.",
      "Vermeld universiteit, pagina of claim-ID en de officiële bron. Stuur geen studentendossiers, privéopdrachten of gevoelige persoonsgegevens."
    ],
    "support": [
      "Zoek na openbare publicatie University AI Policy Tracker in een ondersteunde ChatGPT-plugindirectory en installeer. Beschikbaarheid hangt af van account, regio, werkruimte en client. Geen extra account of API-sleutel nodig.",
      "Geef volledige naam en land. Kies bij meerdere matches eerst de instelling. Controleer voor welke cursus, beoordeling, faculteit en doelgroep het bewijs geldt.",
      "Antwoorden horen trackerbewijs en officiële bronnen te koppelen. Onvoldoende bewijs betekent niet dat er geen regel is. Toegang tot een hulpmiddel is geen toestemming bij een beoordeling.",
      "Meld fouten per mail met universiteit, hulpmiddel, geschatte tijd en korte beschrijving. Verwijder privégegevens uit prompts. We beloven geen vaste reactietijd."
    ],
    "privacy": [
      "Websiteanalyse: eigen bezoeker- en sessie-ID’s, paginapaden, interactiecategorieën, globaal land/apparaat en herkomst/campagnes helpen de dienst verbeteren. Supabase bewaart deze gegevens 13 maanden. De knop hieronder stopt niet-noodzakelijke verzameling in deze browser en verwijdert analyse-ID’s; de voorkeur blijft.",
      "MCP: we bewaren 13 maanden alleen dagelijkse totalen per universiteit, onderwerp, resultaat en vertraging. Geen ruwe prompts, opdrachten, identiteit of individuele aanroepgeschiedenis. ChatGPT en je client hebben eigen privacyregels.",
      "Infrastructuur en beveiliging: Cloudflare en onze OCI-server verwerken verzoeken. Afzonderlijke logs kunnen netwerkadressen en metadata bevatten. Nginx-toegangslogs roteren dagelijks en bewaren 14 rotaties. Andere logs volgen de feitelijke configuratie.",
      "E-mail: onze zakelijke mailprovider verwerkt berichten aan support@eduaipolicy.org. Bewaring duurt zolang nodig voor afhandeling. Vraag verwijdering of uitleg per mail. Stuur geen privéopdrachten. Provider en instellingen worden vóór directoryinzending bevestigd."
    ],
    "terms": [
      "Onafhankelijke openbare referentiedienst, geen officiële universiteitsverklaring. Originele bronnen en cursus- of beoordelingsinstructies zijn bepalend. De tracker geeft geen toestemming of juridisch dan wel academisch-integriteitsadvies.",
      "Bewijs kan beperkt zijn tot een doelgroep, eenheid of periode. Ophaaldatum is geen ingangsdatum. Volledigheid en voortdurende beschikbaarheid zijn niet gegarandeerd. Vraag correcties met een officiële bron.",
      "Trackermetadata vallen onder CC BY 4.0 met naamsvermelding. Brondocumenten behouden eigen rechten en voorwaarden. Gebruik de leesdienst redelijk, verstoor haar niet en probeer geen ongepubliceerde informatie te verkrijgen."
    ],
    "mcp": [
      "Zoek regels over AI, vermelding, examens, privacy en institutionele hulpmiddelen. Alle geschikte gepubliceerde records zijn beschikbaar met bewijs en reikwijdte.",
      "Identificeer de universiteit, lees het beleid en controleer zo nodig bewijs. Antwoorden koppelen tracker en officiële bron. Ongepubliceerd onderzoek is uitgesloten.",
      "Het externe endpoint is https://eduaipolicy.org/api/mcp. Hieronder staat de directorystatus. Het eerdere REST-alpha-manifest en de catalogus blijven beschikbaar."
    ]
  },
  "ms": {
    "labels": [
      "Hubungi",
      "Sokongan",
      "Privasi",
      "Terma",
      "Dasar AI dalam ChatGPT",
      "Sokongan dan privasi",
      "Matikan analitik laman",
      "Aktifkan analitik laman",
      "Analitik laman dimatikan.",
      "Analitik laman diaktifkan.",
      "Pasang dalam ChatGPT",
      "Penyenaraian direktori awam belum tersedia.",
      "Teks Inggeris ialah rujukan utama; terjemahan membantu pembacaan."
    ],
    "contact": [
      "University AI Policy Tracker dikendalikan secara bebas oleh Samsong. Hubungi support@eduaipolicy.org untuk sokongan, permintaan privasi atau pembetulan.",
      "Nyatakan universiti, halaman atau ID dakwaan serta URL sumber rasmi. Jangan hantar rekod pelajar, tugasan peribadi atau maklumat peribadi sensitif."
    ],
    "support": [
      "Selepas penerbitan awam, cari University AI Policy Tracker dalam direktori plugin ChatGPT yang disokong dan pasangkannya. Ketersediaan bergantung pada akaun, rantau, ruang kerja dan klien. Tiada akaun laman tambahan atau kunci API diperlukan.",
      "Berikan nama penuh universiti dan negara. Jika terdapat beberapa padanan, pilih dahulu. Semak skop kursus, penilaian, fakulti serta golongan yang berkaitan.",
      "Jawapan patut memautkan bukti tracker dan sumber universiti rasmi. Bukti tidak mencukupi bukan bermaksud tiada peraturan. Akses alat bukan kebenaran menggunakannya dalam penilaian.",
      "Laporkan masalah melalui e-mel dengan universiti, alat, anggaran masa dan penerangan ringkas. Buang maklumat peribadi daripada prompt. Tiada tempoh jawapan tetap dijanjikan."
    ],
    "privacy": [
      "Analitik laman: pengecam pelawat dan sesi pihak pertama, laluan halaman, kategori interaksi, negara/peranti secara umum serta sumber/kempen membantu penambahbaikan. Data disimpan dalam Supabase selama 13 bulan bergulir. Kawalan di bawah menghentikan pengumpulan tidak perlu dan membuang pengecam analitik pelayar ini; pilihan anda kekal.",
      "MCP: hanya agregat harian universiti, topik, hasil dan kependaman disimpan selama 13 bulan. Kami tidak menyimpan prompt asal, tugasan, identiti atau sejarah setiap panggilan. ChatGPT dan klien mempunyai amalan privasi sendiri.",
      "Infrastruktur dan keselamatan: Cloudflare dan pelayan OCI memproses permintaan. Log berasingan boleh mengandungi alamat rangkaian dan metadata. Log akses Nginx diputar setiap hari dengan 14 putaran disimpan. Log lain mengikut konfigurasi sebenar.",
      "E-mel sokongan: penyedia e-mel perniagaan memproses mesej kepada support@eduaipolicy.org dan menyimpannya mengikut keperluan permintaan. Minta pemadaman atau penjelasan melalui e-mel. Jangan hantar tugasan peribadi. Penyedia dan tetapan disahkan sebelum penghantaran direktori."
    ],
    "terms": [
      "Perkhidmatan rujukan awam bebas, bukan kenyataan rasmi universiti. Sumber asal dan arahan kursus atau penilaian menjadi rujukan utama. Tracker tidak memberikan kebenaran atau nasihat undang-undang atau integriti akademik.",
      "Bukti boleh terhad kepada golongan, unit atau tempoh tertentu. Tarikh pengambilan bukan tarikh kuat kuasa. Kelengkapan dan ketersediaan berterusan tidak dijamin. Sertakan sumber rasmi untuk pembetulan.",
      "Metadata tracker menggunakan CC BY 4.0 dengan atribusi. Dokumen asal mengekalkan hak dan terma pemilik. Gunakan perkhidmatan baca sahaja secara munasabah, jangan mengganggu atau cuba mendapatkan bahan belum diterbitkan."
    ],
    "mcp": [
      "Semak dasar AI, pengisytiharan, peperiksaan, privasi dan alat institusi. Semua rekod diterbitkan yang layak boleh dicari, dengan bukti dan skop dikekalkan.",
      "Kenal pasti universiti, baca dasar pelajar, kemudian sahkan bukti jika perlu. Jawapan memautkan tracker dan sumber rasmi. Penyelidikan belum diterbitkan dikecualikan.",
      "Endpoint jauh ialah https://eduaipolicy.org/api/mcp. Status direktori dipaparkan di bawah. Manifest REST alpha dan katalog terdahulu masih tersedia."
    ]
  }
} as const;
export type TrustPageKind = "contact" | "support" | "privacy" | "terms" | "mcp";
export function getTrustContent(locale: SupportedLocale) { return trustContent[locale]; }
export const trustIntroductions = {
  en: ["Questions, corrections and privacy requests.", "Get help finding and checking your university’s AI rules.", "How we handle website analytics, policy queries and support messages.", "How to use the tracker and its evidence.", "Find your university’s AI rules, with links to the evidence."],
  zh: ["咨询、数据纠错与隐私请求。", "帮助你查找和核对学校的 AI 规定。", "了解网站分析、政策查询和支持邮件的数据处理方式。", "了解如何使用本站与政策证据。", "查找学校的 AI 规定，并核对原文证据。"],
  fr: ["Questions, corrections et demandes de confidentialité.", "Obtenez de l’aide pour trouver et vérifier les règles IA de votre université.", "Notre traitement des statistiques, des recherches de politiques et des messages d’assistance.", "Comment utiliser le tracker et ses preuves.", "Trouvez les règles IA de votre université avec des liens vers les preuves."],
  pl: ["Pytania, poprawki i wnioski dotyczące prywatności.", "Pomoc w znalezieniu i sprawdzeniu zasad AI na Twojej uczelni.", "Jak przetwarzamy analitykę, zapytania o zasady i wiadomości do pomocy.", "Jak korzystać z trackera i materiałów źródłowych.", "Znajdź zasady AI swojej uczelni wraz z odnośnikami do źródeł."],
  es: ["Preguntas, correcciones y solicitudes de privacidad.", "Ayuda para encontrar y verificar las normas de IA de tu universidad.", "Cómo tratamos la analítica, las consultas de políticas y los mensajes de soporte.", "Cómo utilizar el tracker y sus pruebas.", "Encuentra las normas de IA de tu universidad con enlaces a las fuentes."],
  nl: ["Vragen, correcties en privacyverzoeken.", "Hulp bij het vinden en controleren van de AI-regels van je universiteit.", "Hoe we statistieken, beleidsvragen en supportberichten verwerken.", "Hoe je de tracker en het bronmateriaal gebruikt.", "Vind de AI-regels van je universiteit met links naar het bronmateriaal."],
  ms: ["Soalan, pembetulan dan permintaan privasi.", "Bantuan untuk mencari dan menyemak peraturan AI universiti anda.", "Cara kami mengendalikan analitik, pertanyaan dasar dan mesej sokongan.", "Cara menggunakan tracker dan buktinya.", "Cari peraturan AI universiti anda dengan pautan kepada bukti."]
} as const;
