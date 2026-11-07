import type { SupportedLocale } from "./i18n";
import type { ReadingLocale } from "./language-catalog";
import { canonicalUniversitySlug } from "./canonical-university-slug";

export type InstitutionLocale = Exclude<ReadingLocale, "en">;

export interface InstitutionLocalizationRecord {
  name?: string;
  aliases?: Partial<Record<InstitutionLocale, string[]>>;
  displayNames?: Partial<Record<InstitutionLocale, string>>;
}

const records: Record<string, InstitutionLocalizationRecord> = {
  "aalborg-university": {
    displayNames: {
      "da": "Aalborg Universitet",
    },
  },
  "aalto-university": {
    name: "Aalto University",
    displayNames: {
      "fi": "Aalto-yliopisto",
    },
  },
  "aarhus-university": {
    name: "Aarhus University",
    displayNames: {
      "da": "Aarhus Universitet",
    },
  },
  "abo-akademi-university": {
    name: "Abo Akademi University",
    displayNames: {
      "fi": "Åbo Akademi",
    },
  },
  "adam-mickiewicz-university-poznan": {
    name: "Adam Mickiewicz University, Poznań",
    displayNames: {
      "pl": "Uniwersytet im. Adama Mickiewicza w Poznaniu",
    },
    aliases: {
      "pl": ["UAM","Uniwersytet Adama Mickiewicza","UAM Poznań"],
    },
  },
  "agh-university-of-krakow": {
    name: "AGH University of Krakow",
    displayNames: {
      "pl": "Akademia Górniczo-Hutnicza w Krakowie",
    },
    aliases: {
      "pl": ["AGH","AGH Kraków"],
    },
  },
  "ain-shams-university": {
    displayNames: {
      "ar": "جامعة عين شمس",
    },
  },
  "airlangga-university": {
    displayNames: {
      "id": "Universitas Airlangga",
    },
  },
  "aix-marseille-university": {
    name: "Aix-Marseille University",
    displayNames: {
      "fr": "Aix-Marseille Université",
    },
    aliases: {
      "fr": ["AMU","Université d'Aix-Marseille"],
    },
  },
  "albert-ludwigs-universitat-freiburg": {
    displayNames: {
      "de": "Albert-Ludwigs-Universität Freiburg",
    },
  },
  "alexandria-university": {
    name: "Alexandria University",
    displayNames: {
      "ar": "جامعة الإسكندرية",
    },
  },
  "american-university-of-beirut": {
    name: "American University of Beirut (AUB)",
    displayNames: {
      "ar": "الجامعة الأميركية في بيروت",
    },
  },
  "american-university-of-sharjah": {
    name: "American University of Sharjah",
    displayNames: {
      "ar": "الجامعة الأمريكية في الشارقة",
    },
  },
  "amirkabir-university-of-technology": {
    name: "Amirkabir University of Technology",
    displayNames: {
      "fa": "دانشگاه صنعتی امیرکبیر",
    },
  },
  "ankara-university": {
    displayNames: {
      "tr": "Ankara Üniversitesi",
    },
  },
  "aristotle-university-of-thessaloniki": {
    name: "Aristotle University of Thessaloniki",
    displayNames: {
      "el": "Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης",
    },
  },
  "ataturk-university": {
    name: "Ataturk University",
    displayNames: {
      "tr": "Atatürk Üniversitesi",
    },
  },
  "autonomous-university-of-barcelona": {
    displayNames: {
      "es": "Universidad Autónoma de Barcelona",
    },
  },
  "autonomous-university-of-madrid": {
    displayNames: {
      "es": "Universidad Autónoma de Madrid",
    },
  },
  "banaras-hindu-university": {
    displayNames: {
      "hi": "काशी हिन्दू विश्वविद्यालय",
    },
  },
  "bandung-institute-of-technology-itb": {
    displayNames: {
      "id": "Institut Teknologi Bandung",
    },
  },
  "bangladesh-university-of-engineering-and-technology": {
    name: "Bangladesh University of Engineering and Technology",
    displayNames: {
      "bn": "বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়",
    },
  },
  "bar-ilan-university": {
    name: "Bar-Ilan University",
    displayNames: {
      "he": "אוניברסיטת בר-אילן",
    },
  },
  "bauman-moscow-state-technical-university": {
    name: "Bauman Moscow State Technical University",
    displayNames: {
      "ru": "Московский государственный технический университет имени Н. Э. Баумана",
    },
  },
  "beihang-university-former-buaa": {
    displayNames: {
      "zh": "北京航空航天大学",
    },
    aliases: {
      "zh": ["北航","北京航空航天"],
    },
  },
  "beijing-institute-of-technology": {
    displayNames: {
      "zh": "北京理工大学",
    },
    aliases: {
      "zh": ["北理工"],
    },
  },
  "beijing-jiaotong-university": {
    displayNames: {
      "zh": "北京交通大学",
    },
    aliases: {
      "zh": ["北交大"],
    },
  },
  "beijing-normal-university": {
    displayNames: {
      "zh": "北京师范大学",
    },
    aliases: {
      "zh": ["北师大"],
    },
  },
  "beijing-university-of-technology": {
    displayNames: {
      "zh": "北京工业大学",
    },
    aliases: {
      "zh": ["北工大"],
    },
  },
  "belarusian-state-university": {
    name: "Belarusian State University",
    displayNames: {
      "ru": "Белорусский государственный университет",
    },
  },
  "ben-gurion-university-of-the-negev": {
    name: "Ben-Gurion University of The Negev",
    displayNames: {
      "he": "אוניברסיטת בן-גוריון בנגב",
    },
  },
  "bilkent-university": {
    name: "Bilkent University",
    displayNames: {
      "tr": "Bilkent Üniversitesi",
    },
  },
  "bina-nusantara-university-binus": {
    displayNames: {
      "id": "Universitas Bina Nusantara",
    },
  },
  "bogazici-universitesi": {
    name: "Bogaziçi Üniversitesi",
    displayNames: {
      "tr": "Boğaziçi Üniversitesi",
    },
  },
  "braunschweig-university-of-technology": {
    displayNames: {
      "de": "Technische Universität Braunschweig",
    },
  },
  "brno-university-of-technology": {
    name: "Brno University of Technology",
    displayNames: {
      "cs": "Vysoké učení technické v Brně",
    },
  },
  "cairo-university": {
    name: "Cairo University",
    displayNames: {
      "ar": "جامعة القاهرة",
    },
  },
  "central-south-university": {
    displayNames: {
      "zh": "中南大学",
    },
    aliases: {
      "zh": ["中南"],
    },
  },
  "chalmers-university-of-technology": {
    name: "Chalmers University of Technology",
    displayNames: {
      "sv": "Chalmers tekniska högskola",
    },
  },
  "chang-gung-university": {
    name: "Chang Gung University",
    displayNames: {
      "zh": "長庚大學",
      "zh-Hant": "長庚大學",
    },
    aliases: {
      "zh": ["长庚大学","長庚","长庚"],
    },
  },
  "charles-university": {
    name: "Charles University",
    displayNames: {
      "cs": "Univerzita Karlova",
    },
  },
  "chiang-mai-university": {
    displayNames: {
      "th": "มหาวิทยาลัยเชียงใหม่",
    },
  },
  "chiba-university": {
    name: "Chiba University",
    displayNames: {
      "ja": "千葉大学",
    },
  },
  "china-agricultural-university": {
    displayNames: {
      "zh": "中国农业大学",
    },
    aliases: {
      "zh": ["中国农大"],
    },
  },
  "china-medical-university": {
    name: "China Medical University",
    displayNames: {
      "zh": "中國醫藥大學",
      "zh-Hant": "中國醫藥大學",
    },
    aliases: {
      "zh": ["中国医药大学","中醫大","中医大"],
    },
  },
  "china-university-of-geosciences": {
    displayNames: {
      "zh": "中国地质大学",
    },
    aliases: {
      "zh": ["地大"],
    },
  },
  "china-university-of-mining-and-technology": {
    displayNames: {
      "zh": "中国矿业大学",
    },
    aliases: {
      "zh": ["矿大"],
    },
  },
  "china-university-of-petroleum-beijing": {
    displayNames: {
      "zh": "中国石油大学（北京）",
    },
    aliases: {
      "zh": ["中国石油大学北京","中石大"],
    },
  },
  "chongqing-university": {
    displayNames: {
      "zh": "重庆大学",
    },
    aliases: {
      "zh": ["重大"],
    },
  },
  "chonnam-national-university": {
    name: "Chonnam National University",
    displayNames: {
      "ko": "전남대학교",
    },
  },
  "chulalongkorn-university": {
    name: "Chulalongkorn University",
    displayNames: {
      "th": "จุฬาลงกรณ์มหาวิทยาลัย",
    },
  },
  "chung-ang-university-cau": {
    name: "Chung-Ang University (CAU)",
    displayNames: {
      "ko": "중앙대학교",
    },
  },
  "chungnam-national-university": {
    name: "Chungnam National University",
    displayNames: {
      "ko": "충남대학교",
    },
  },
  "city-university-of-hong-kong": {
    name: "City University of Hong Kong (CityUHK)",
    displayNames: {
      "zh": "香港城市大學",
      "zh-Hant": "香港城市大學",
    },
    aliases: {
      "zh": ["香港城市大学","城大","CityUHK"],
    },
  },
  "complutense-university-of-madrid": {
    displayNames: {
      "es": "Universidad Complutense de Madrid",
    },
  },
  "concordia-university": {
    name: "Concordia University",
    displayNames: {
      "fr": "Université Concordia",
    },
    aliases: {
      "fr": ["Concordia Montréal"],
    },
  },
  "cuhk": {
    name: "The Chinese University of Hong Kong (CUHK)",
    displayNames: {
      "zh": "香港中文大學",
      "zh-Hant": "香港中文大學",
    },
    aliases: {
      "zh": ["香港中文大学","港中大","CUHK"],
    },
  },
  "czech-technical-university-in-prague": {
    name: "Czech Technical University in Prague",
    displayNames: {
      "cs": "České vysoké učení technické v Praze",
    },
  },
  "czech-university-of-life-sciences-in-prague": {
    name: "Czech University of Life Sciences in Prague",
    displayNames: {
      "cs": "Česká zemědělská univerzita v Praze",
    },
  },
  "daegu-gyeongbuk-institute-of-science-and-technology-dgist": {
    name: "Daegu Gyeongbuk Institute of Science and Technology (DGIST)",
    displayNames: {
      "ko": "대구경북과학기술원",
    },
  },
  "dalian-university-of-technology": {
    displayNames: {
      "zh": "大连理工大学",
    },
    aliases: {
      "zh": ["大工"],
    },
  },
  "delft-university-of-technology": {
    name: "Delft University of Technology",
    displayNames: {
      "nl": "Technische Universiteit Delft",
    },
  },
  "diponegoro-university": {
    name: "Diponegoro University",
    displayNames: {
      "id": "Universitas Diponegoro",
    },
  },
  "dongguk-university": {
    name: "Dongguk University",
    displayNames: {
      "ko": "동국대학교",
    },
  },
  "donghua-university": {
    displayNames: {
      "zh": "东华大学",
    },
  },
  "doshisha-university": {
    name: "Doshisha University",
    displayNames: {
      "ja": "同志社大学",
    },
  },
  "duy-tan-university": {
    name: "Duy Tan University",
    displayNames: {
      "vi": "Đại học Duy Tân",
    },
  },
  "east-china-normal-university": {
    displayNames: {
      "zh": "华东师范大学",
    },
    aliases: {
      "zh": ["华东师大"],
    },
  },
  "east-china-university-of-science-and-technology": {
    displayNames: {
      "zh": "华东理工大学",
    },
    aliases: {
      "zh": ["华理"],
    },
  },
  "eberhard-karls-universitat-tubingen": {
    name: "Eberhard Karls Universität Tübingen",
    displayNames: {
      "de": "Eberhard Karls Universität Tübingen",
    },
  },
  "ecole-des-ponts-paristech": {
    displayNames: {
      "fr": "École des Ponts ParisTech",
    },
  },
  "ecole-normale-superieure-de-lyon": {
    name: "École Normale Supérieure de Lyon",
    displayNames: {
      "fr": "École normale supérieure de Lyon",
    },
    aliases: {
      "fr": ["ENS de Lyon","ENS Lyon"],
    },
  },
  "eindhoven-university-of-technology": {
    name: "Eindhoven University of Technology",
    displayNames: {
      "nl": "Technische Universiteit Eindhoven",
    },
  },
  "eotvos-lorand-university": {
    name: "Eötvös Loránd University",
    displayNames: {
      "hu": "Eötvös Loránd Tudományegyetem",
    },
  },
  "epfl": {
    name: "EPFL – École polytechnique fédérale de Lausanne",
    displayNames: {
      "fr": "École polytechnique fédérale de Lausanne",
    },
    aliases: {
      "fr": ["EPFL","Polytechnique Lausanne"],
    },
  },
  "erasmus-university-rotterdam": {
    name: "Erasmus University Rotterdam",
    displayNames: {
      "nl": "Erasmus Universiteit Rotterdam",
    },
  },
  "eth-zurich": {
    name: "ETH Zurich",
    displayNames: {
      "de": "ETH Zürich",
    },
  },
  "ewha-womans-university": {
    name: "Ewha Womans University",
    displayNames: {
      "ko": "이화여자대학교",
    },
  },
  "ferdowsi-university-of-mashhad": {
    displayNames: {
      "fa": "دانشگاه فردوسی مشهد",
    },
  },
  "freie-universitaet-berlin": {
    name: "Freie Universitaet Berlin",
    displayNames: {
      "de": "Freie Universität Berlin",
    },
  },
  "friedrich-alexander-universitat-erlangen-nurnberg": {
    name: "Friedrich-Alexander-Universität Erlangen-Nürnberg",
    displayNames: {
      "de": "Friedrich-Alexander-Universität Erlangen-Nürnberg",
    },
  },
  "friedrich-schiller-universitat-jena": {
    displayNames: {
      "de": "Friedrich-Schiller-Universität Jena",
    },
  },
  "fudan-university": {
    displayNames: {
      "zh": "复旦大学",
    },
    aliases: {
      "zh": ["复旦"],
    },
  },
  "gadjah-mada-university": {
    name: "Gadjah Mada University",
    displayNames: {
      "id": "Universitas Gadjah Mada",
    },
  },
  "gazi-universitesi": {
    name: "Gazi Üniversitesi",
    displayNames: {
      "tr": "Gazi Üniversitesi",
    },
  },
  "gdansk-university-of-technology": {
    name: "Gdańsk University of Technology",
    displayNames: {
      "pl": "Politechnika Gdańska",
    },
    aliases: {
      "pl": ["PG","Politechnika Gdanska"],
    },
  },
  "georg-august-universitat-gottingen": {
    displayNames: {
      "de": "Georg-August-Universität Göttingen",
    },
  },
  "ghent-university": {
    name: "Ghent University",
    displayNames: {
      "nl": "Universiteit Gent",
    },
  },
  "goethe-university-frankfurt": {
    displayNames: {
      "de": "Goethe-Universität Frankfurt",
    },
  },
  "gwangju-institute-of-science-and-technology-gist": {
    name: "Gwangju Institute of Science and Technology (GIST)",
    displayNames: {
      "ko": "광주과학기술원",
    },
  },
  "hacettepe-university": {
    name: "Hacettepe University",
    displayNames: {
      "tr": "Hacettepe Üniversitesi",
    },
  },
  "hamad-bin-khalifa-university": {
    name: "Hamad Bin Khalifa University (HBKU)",
    displayNames: {
      "ar": "جامعة حمد بن خليفة",
    },
  },
  "hanoi-university-of-science-and-technology": {
    displayNames: {
      "vi": "Đại học Bách khoa Hà Nội",
    },
  },
  "hanyang-university": {
    name: "Hanyang University",
    displayNames: {
      "ko": "한양대학교",
    },
  },
  "harbin-institute-of-technology": {
    displayNames: {
      "zh": "哈尔滨工业大学",
    },
    aliases: {
      "zh": ["哈工大"],
    },
  },
  "hasselt-university": {
    name: "Hasselt University",
    displayNames: {
      "nl": "Universiteit Hasselt",
    },
  },
  "hebrew-university-of-jerusalem": {
    displayNames: {
      "he": "האוניברסיטה העברית בירושלים",
    },
  },
  "hiroshima-university": {
    name: "Hiroshima University",
    displayNames: {
      "ja": "広島大学",
    },
  },
  "hkust": {
    name: "The Hong Kong University of Science and Technology",
    displayNames: {
      "zh": "香港科技大學",
      "zh-Hant": "香港科技大學",
    },
    aliases: {
      "zh": ["香港科技大学","港科大","HKUST"],
    },
  },
  "hokkaido-university": {
    name: "Hokkaido University",
    displayNames: {
      "ja": "北海道大学",
    },
  },
  "hong-kong-baptist-university": {
    name: "Hong Kong Baptist University",
    displayNames: {
      "zh": "香港浸會大學",
      "zh-Hant": "香港浸會大學",
    },
    aliases: {
      "zh": ["香港浸会大学","浸大","HKBU"],
    },
  },
  "hong-kong-metropolitan-university": {
    name: "Hong Kong Metropolitan University",
    displayNames: {
      "zh": "香港都會大學",
      "zh-Hant": "香港都會大學",
    },
    aliases: {
      "zh": ["香港都会大学","都大","HKMU"],
    },
  },
  "hse-university": {
    name: "HSE University",
    displayNames: {
      "ru": "Национальный исследовательский университет «Высшая школа экономики»",
    },
  },
  "huazhong-agricultural-university": {
    displayNames: {
      "zh": "华中农业大学",
    },
    aliases: {
      "zh": ["华中农大"],
    },
  },
  "huazhong-university-of-science-and-technology": {
    displayNames: {
      "zh": "华中科技大学",
    },
    aliases: {
      "zh": ["华科","华中大"],
    },
  },
  "hufs-hankuk-korea-university-of-foreign-studies": {
    name: "HUFS - Hankuk (Korea) University of Foreign Studies",
    displayNames: {
      "ko": "한국외국어대학교",
    },
  },
  "humboldt-universitat-zu-berlin": {
    name: "Humboldt-Universität zu Berlin",
    displayNames: {
      "de": "Humboldt-Universität zu Berlin",
    },
  },
  "hunan-university": {
    displayNames: {
      "zh": "湖南大学",
    },
  },
  "imam-abdulrahman-bin-faisal-university-iau": {
    name: "Imam Abdulrahman Bin Faisal University (IAU)",
    displayNames: {
      "ar": "جامعة الإمام عبد الرحمن بن فيصل",
    },
  },
  "indian-institute-of-science": {
    name: "Indian Institute of Science",
    displayNames: {
      "hi": "भारतीय विज्ञान संस्थान",
    },
  },
  "indian-institute-of-technology-bombay": {
    name: "Indian Institute of Technology Bombay (IITB)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान बॉम्बे",
    },
  },
  "indian-institute-of-technology-delhi": {
    name: "Indian Institute of Technology Delhi (IITD)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान दिल्ली",
    },
  },
  "indian-institute-of-technology-gandhinagar-iitgn": {
    name: "Indian Institute of Technology Gandhinagar (IITGN)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान गांधीनगर",
    },
  },
  "indian-institute-of-technology-guwahati-iitg": {
    name: "Indian Institute of Technology Guwahati (IITG)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान गुवाहाटी",
    },
  },
  "indian-institute-of-technology-hyderabad-iith": {
    name: "Indian Institute of Technology Hyderabad (IITH)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान हैदराबाद",
    },
  },
  "indian-institute-of-technology-kanpur": {
    name: "Indian Institute of Technology Kanpur (IITK)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान कानपुर",
    },
  },
  "indian-institute-of-technology-kharagpur": {
    name: "Indian Institute of Technology Kharagpur (IIT-KGP)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान खड़गपुर",
    },
  },
  "indian-institute-of-technology-madras": {
    name: "Indian Institute of Technology Madras (IITM)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान मद्रास",
    },
  },
  "indian-institute-of-technology-roorkee-iitr": {
    name: "Indian Institute of Technology Roorkee (IITR)",
    displayNames: {
      "hi": "भारतीय प्रौद्योगिकी संस्थान रुड़की",
    },
  },
  "inha-university": {
    name: "Inha University",
    displayNames: {
      "ko": "인하대학교",
    },
  },
  "institut-national-des-sciences-appliquees-de-lyon-insa": {
    name: "Institut National des Sciences Appliquées de Lyon (INSA)",
    displayNames: {
      "fr": "Institut national des sciences appliquées de Lyon",
    },
    aliases: {
      "fr": ["INSA Lyon"],
    },
  },
  "institut-polytechnique-de-paris": {
    name: "Institut Polytechnique de Paris",
    displayNames: {
      "fr": "Institut Polytechnique de Paris",
    },
    aliases: {
      "fr": ["IP Paris"],
    },
  },
  "instituto-politecnico-nacional-ipn": {
    displayNames: {
      "es": "Instituto Politécnico Nacional",
    },
  },
  "ipb-university-bogor-agricultural-university": {
    displayNames: {
      "id": "IPB University",
    },
  },
  "iran-university-of-science-and-technology": {
    name: "Iran University of Science and Technology",
    displayNames: {
      "fa": "دانشگاه علم و صنعت ایران",
    },
  },
  "istanbul-technical-university": {
    displayNames: {
      "tr": "İstanbul Teknik Üniversitesi",
    },
  },
  "istanbul-university": {
    name: "Istanbul University",
    displayNames: {
      "tr": "İstanbul Üniversitesi",
    },
  },
  "itmo-university": {
    displayNames: {
      "ru": "Университет ИТМО",
    },
  },
  "jagiellonian-university": {
    name: "Jagiellonian University",
    displayNames: {
      "pl": "Uniwersytet Jagielloński",
    },
    aliases: {
      "pl": ["UJ","Uniwersytet Jagiellonski"],
    },
  },
  "jamia-millia-islamia": {
    name: "Jamia Millia Islamia",
    displayNames: {
      "hi": "जामिया मिलिया इस्लामिया",
    },
  },
  "jawaharlal-nehru-university": {
    displayNames: {
      "hi": "जवाहरलाल नेहरू विश्वविद्यालय",
    },
  },
  "jilin-university": {
    displayNames: {
      "zh": "吉林大学",
    },
    aliases: {
      "zh": ["吉大"],
    },
  },
  "johannes-gutenberg-universitat-mainz": {
    name: "Johannes Gutenberg Universität Mainz",
    displayNames: {
      "de": "Johannes Gutenberg-Universität Mainz",
    },
  },
  "johannes-kepler-university-linz": {
    name: "Johannes Kepler University Linz",
    displayNames: {
      "de": "Johannes Kepler Universität Linz",
    },
  },
  "julius-maximilians-universitat-wurzburg": {
    name: "Julius-Maximilians-Universität Würzburg",
    displayNames: {
      "de": "Julius-Maximilians-Universität Würzburg",
    },
  },
  "justus-liebig-university-giessen": {
    name: "Justus-Liebig-University Giessen",
    displayNames: {
      "de": "Justus-Liebig-Universität Gießen",
    },
  },
  "kanazawa-university": {
    name: "Kanazawa University",
    displayNames: {
      "ja": "金沢大学",
    },
  },
  "kaohsiung-medical-university": {
    name: "Kaohsiung Medical University",
    displayNames: {
      "zh": "高雄醫學大學",
      "zh-Hant": "高雄醫學大學",
    },
    aliases: {
      "zh": ["高雄医学大学","高醫","高医"],
    },
  },
  "kasetsart-university": {
    displayNames: {
      "th": "มหาวิทยาลัยเกษตรศาสตร์",
    },
  },
  "kaunas-university-of-technology": {
    name: "Kaunas University of Technology",
    displayNames: {
      "lt": "Kauno technologijos universitetas",
    },
  },
  "kazan-federal-university": {
    displayNames: {
      "ru": "Казанский федеральный университет",
    },
  },
  "keio-university": {
    name: "Keio University",
    displayNames: {
      "ja": "慶應義塾大学",
    },
  },
  "kfupm": {
    name: "KFUPM",
    displayNames: {
      "ar": "جامعة الملك فهد للبترول والمعادن",
    },
  },
  "khalifa-university": {
    name: "Khalifa University",
    displayNames: {
      "ar": "جامعة خليفة",
    },
  },
  "khon-kaen-university": {
    name: "Khon Kaen University",
    displayNames: {
      "th": "มหาวิทยาลัยขอนแก่น",
    },
  },
  "king-abdulaziz-university-kau": {
    displayNames: {
      "ar": "جامعة الملك عبد العزيز",
    },
  },
  "king-faisal-university": {
    name: "King Faisal University",
    displayNames: {
      "ar": "جامعة الملك فيصل",
    },
  },
  "king-khalid-university": {
    displayNames: {
      "ar": "جامعة الملك خالد",
    },
  },
  "king-mongkut-s-university-of-technology-thonburi": {
    name: "King Mongkut's University of Technology Thonburi",
    displayNames: {
      "th": "มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี",
    },
  },
  "king-saud-university": {
    name: "King Saud University",
    displayNames: {
      "ar": "جامعة الملك سعود",
    },
  },
  "kit-karlsruhe-institute-of-technology": {
    name: "KIT, Karlsruhe Institute of Technology",
    displayNames: {
      "de": "Karlsruher Institut für Technologie",
    },
  },
  "kobe-university": {
    name: "Kobe University",
    displayNames: {
      "ja": "神戸大学",
    },
  },
  "koc-university": {
    displayNames: {
      "tr": "Koç Üniversitesi",
    },
  },
  "konkuk-university": {
    name: "Konkuk University",
    displayNames: {
      "ko": "건국대학교",
    },
  },
  "korea-university": {
    name: "Korea University",
    displayNames: {
      "ko": "고려대학교",
    },
  },
  "kth-royal-institute-of-technology": {
    name: "KTH Royal Institute of Technology",
    displayNames: {
      "sv": "Kungliga Tekniska högskolan",
    },
  },
  "ku-leuven": {
    name: "KU Leuven",
    displayNames: {
      "nl": "KU Leuven",
    },
  },
  "kuwait-university": {
    name: "Kuwait University",
    displayNames: {
      "ar": "جامعة الكويت",
    },
  },
  "kyoto-university": {
    name: "Kyoto University",
    displayNames: {
      "ja": "京都大学",
    },
  },
  "kyung-hee-university": {
    name: "Kyung Hee University",
    displayNames: {
      "ko": "경희대학교",
    },
  },
  "kyushu-university": {
    name: "Kyushu University",
    displayNames: {
      "ja": "九州大学",
    },
  },
  "lanzhou-university": {
    displayNames: {
      "zh": "兰州大学",
    },
    aliases: {
      "zh": ["兰大"],
    },
  },
  "lappeenranta-lahti-university-of-technology-lut": {
    name: "Lappeenranta-Lahti University of Technology LUT",
    displayNames: {
      "fi": "Lappeenrannan–Lahden teknillinen yliopisto LUT",
    },
  },
  "leibniz-university-hannover": {
    name: "Leibniz University Hannover",
    displayNames: {
      "de": "Leibniz Universität Hannover",
    },
  },
  "leiden-university": {
    name: "Leiden University",
    displayNames: {
      "nl": "Universiteit Leiden",
    },
  },
  "linkoping-university": {
    name: "Linköping University",
    displayNames: {
      "sv": "Linköpings universitet",
    },
  },
  "lomonosov-moscow-state-university": {
    name: "Lomonosov Moscow State University",
    displayNames: {
      "ru": "Московский государственный университет имени М. В. Ломоносова",
    },
  },
  "ludwig-maximilians-universitat-munchen": {
    name: "Ludwig-Maximilians-Universität München",
    displayNames: {
      "de": "Ludwig-Maximilians-Universität München",
    },
  },
  "lund-university": {
    name: "Lund University",
    displayNames: {
      "sv": "Lunds universitet",
    },
  },
  "maastricht-university": {
    name: "Maastricht University",
    displayNames: {
      "nl": "Universiteit Maastricht",
    },
  },
  "mahidol-university": {
    name: "Mahidol University",
    displayNames: {
      "th": "มหาวิทยาลัยมหิดล",
    },
  },
  "marche-polytechnic-university": {
    displayNames: {
      "it": "Università Politecnica delle Marche",
    },
  },
  "masaryk-university": {
    name: "Masaryk University",
    displayNames: {
      "cs": "Masarykova univerzita",
    },
  },
  "mcgill-university": {
    name: "McGill University",
    displayNames: {
      "fr": "Université McGill",
    },
    aliases: {
      "fr": ["McGill Montréal","McGill Montreal"],
    },
  },
  "middle-east-technical-university": {
    name: "Middle East Technical University",
    displayNames: {
      "tr": "Orta Doğu Teknik Üniversitesi",
    },
  },
  "moscow-institute-of-physics-and-technology-mipt": {
    displayNames: {
      "ru": "Московский физико-технический институт",
    },
  },
  "nagasaki-university": {
    name: "Nagasaki University",
    displayNames: {
      "ja": "長崎大学",
    },
  },
  "nagoya-university": {
    name: "Nagoya University",
    displayNames: {
      "ja": "名古屋大学",
    },
  },
  "nanjing-university": {
    displayNames: {
      "zh": "南京大学",
    },
    aliases: {
      "zh": ["南大"],
    },
  },
  "nanjing-university-of-aeronautics-and-astronautics": {
    displayNames: {
      "zh": "南京航空航天大学",
    },
    aliases: {
      "zh": ["南航"],
    },
  },
  "nankai-university": {
    displayNames: {
      "zh": "南开大学",
    },
    aliases: {
      "zh": ["南开"],
    },
  },
  "nanyang-technological-university": {
    displayNames: {
      "zh": "南洋理工大学",
    },
    aliases: {
      "zh": ["南大","NTU Singapore"],
    },
  },
  "national-and-kapodistrian-university-of-athens": {
    name: "National and Kapodistrian University of Athens",
    displayNames: {
      "el": "Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών",
    },
  },
  "national-central-university": {
    name: "National Central University",
    displayNames: {
      "zh": "國立中央大學",
      "zh-Hant": "國立中央大學",
    },
    aliases: {
      "zh": ["国立中央大学","中央大學","中央大学"],
    },
  },
  "national-cheng-kung-university": {
    name: "National Cheng Kung University (NCKU)",
    displayNames: {
      "zh": "國立成功大學",
      "zh-Hant": "國立成功大學",
    },
    aliases: {
      "zh": ["国立成功大学","成大","NCKU"],
    },
  },
  "national-chengchi-university": {
    name: "National Chengchi University",
    displayNames: {
      "zh": "國立政治大學",
      "zh-Hant": "國立政治大學",
    },
    aliases: {
      "zh": ["国立政治大学","政大"],
    },
  },
  "national-chung-hsing-university": {
    name: "National Chung Hsing University",
    displayNames: {
      "zh": "國立中興大學",
      "zh-Hant": "國立中興大學",
    },
    aliases: {
      "zh": ["国立中兴大学","中興大學","中兴大学"],
    },
  },
  "national-research-nuclear-university-mephi": {
    displayNames: {
      "ru": "Национальный исследовательский ядерный университет «МИФИ»",
    },
  },
  "national-sun-yat-sen-university": {
    name: "National Sun Yat-sen University",
    displayNames: {
      "zh": "國立中山大學",
      "zh-Hant": "國立中山大學",
    },
    aliases: {
      "zh": ["国立中山大学","中山大學","中山大学"],
    },
  },
  "national-taipei-university-of-technology": {
    name: "National Taipei University of Technology",
    displayNames: {
      "zh": "國立臺北科技大學",
      "zh-Hant": "國立臺北科技大學",
    },
    aliases: {
      "zh": ["国立台北科技大学","臺北科技大學","台北科技大学","北科大"],
    },
  },
  "national-taiwan-normal-university-ntnu": {
    name: "National Taiwan Normal University (NTNU)",
    displayNames: {
      "zh": "國立臺灣師範大學",
      "zh-Hant": "國立臺灣師範大學",
    },
    aliases: {
      "zh": ["国立台湾师范大学","臺師大","台师大","NTNU"],
    },
  },
  "national-taiwan-university": {
    name: "National Taiwan University (NTU)",
    displayNames: {
      "zh": "國立臺灣大學",
      "zh-Hant": "國立臺灣大學",
    },
    aliases: {
      "zh": ["国立台湾大学","臺大","台大","NTU"],
    },
  },
  "national-taiwan-university-of-science-and-technology-taiwan-tech": {
    name: "National Taiwan University of Science and Technology (Taiwan Tech)",
    displayNames: {
      "zh": "國立臺灣科技大學",
      "zh-Hant": "國立臺灣科技大學",
    },
    aliases: {
      "zh": ["国立台湾科技大学","臺科大","台科大","Taiwan Tech"],
    },
  },
  "national-technical-university-of-athens": {
    name: "National Technical University of Athens",
    displayNames: {
      "el": "Εθνικό Μετσόβιο Πολυτεχνείο",
    },
  },
  "national-technical-university-of-ukraine-igor-sikorsky-kyiv-polytechnic-institute": {
    name: "National Technical University of Ukraine \"Igor Sikorsky Kyiv Polytechnic Institute\"",
    displayNames: {
      "uk": "Національний технічний університет України «Київський політехнічний інститут імені Ігоря Сікорського»",
    },
  },
  "national-tsing-hua-university": {
    name: "National Tsing Hua University - NTHU",
    displayNames: {
      "zh": "國立清華大學",
      "zh-Hant": "國立清華大學",
    },
    aliases: {
      "zh": ["国立清华大学","清大","NTHU"],
    },
  },
  "national-university-of-sciences-and-technology-nust-islamabad": {
    name: "National University of Sciences & Technology (NUST) Islamabad",
    displayNames: {
      "ur": "نیشنل یونیورسٹی آف سائنسز اینڈ ٹیکنالوجی",
    },
  },
  "national-university-of-singapore": {
    displayNames: {
      "zh": "新加坡国立大学",
    },
    aliases: {
      "zh": ["新国大","国大","NUS"],
    },
  },
  "national-yang-ming-chiao-tung-university": {
    name: "National Yang Ming Chiao Tung University (NYCU Taiwan)",
    displayNames: {
      "zh": "國立陽明交通大學",
      "zh-Hant": "國立陽明交通大學",
    },
    aliases: {
      "zh": ["国立阳明交通大学","陽明交大","阳明交大","NYCU"],
    },
  },
  "nicolaus-copernicus-university": {
    displayNames: {
      "pl": "Uniwersytet Mikołaja Kopernika w Toruniu",
    },
  },
  "northwest-agriculture-and-forestry-university": {
    displayNames: {
      "zh": "西北农林科技大学",
    },
    aliases: {
      "zh": ["西农","西北农林"],
    },
  },
  "northwestern-polytechnical-university": {
    displayNames: {
      "zh": "西北工业大学",
    },
    aliases: {
      "zh": ["西工大"],
    },
  },
  "norwegian-university-of-life-sciences-nmbu": {
    displayNames: {
      "nb": "Norges miljø- og biovitenskapelige universitet",
    },
  },
  "norwegian-university-of-science-and-technology-ntnu": {
    displayNames: {
      "nb": "Norges teknisk-naturvitenskapelige universitet",
    },
  },
  "novosibirsk-state-university": {
    name: "Novosibirsk State University",
    displayNames: {
      "ru": "Новосибирский государственный университет",
    },
  },
  "obuda-university": {
    name: "Obuda University",
    displayNames: {
      "hu": "Óbudai Egyetem",
    },
  },
  "ocean-university-of-china": {
    displayNames: {
      "zh": "中国海洋大学",
    },
    aliases: {
      "zh": ["中国海大"],
    },
  },
  "osaka-metropolitan-university": {
    name: "Osaka Metropolitan University",
    displayNames: {
      "ja": "大阪公立大学",
    },
  },
  "osaka-university": {
    name: "Osaka University",
    displayNames: {
      "ja": "大阪大学",
    },
  },
  "palacky-university-olomouc": {
    name: "Palacký University Olomouc",
    displayNames: {
      "cs": "Univerzita Palackého v Olomouci",
    },
  },
  "panjab-university": {
    name: "Panjab University",
    displayNames: {
      "hi": "पंजाब विश्वविद्यालय",
    },
  },
  "peking-university": {
    displayNames: {
      "zh": "北京大学",
    },
    aliases: {
      "zh": ["北大","北京大学"],
    },
  },
  "philipps-universitat-marburg": {
    name: "Philipps-Universität Marburg",
    displayNames: {
      "de": "Philipps-Universität Marburg",
    },
  },
  "pohang-university-of-science-and-technology": {
    name: "Pohang University of Science And Technology (POSTECH)",
    displayNames: {
      "ko": "포항공과대학교",
    },
  },
  "politecnico-di-milano": {
    name: "Politecnico di Milano",
    displayNames: {
      "it": "Politecnico di Milano",
    },
  },
  "politecnico-di-torino": {
    name: "Politecnico di Torino",
    displayNames: {
      "it": "Politecnico di Torino",
    },
  },
  "pontificia-universidad-catolica-de-chile": {
    name: "Pontificia Universidad Católica de Chile (UC)",
    displayNames: {
      "es": "Pontificia Universidad Católica de Chile",
    },
  },
  "pontificia-universidad-catolica-del-peru": {
    displayNames: {
      "es": "Pontificia Universidad Católica del Perú",
    },
  },
  "pontificia-universidad-javeriana": {
    name: "Pontificia Universidad Javeriana",
    displayNames: {
      "es": "Pontificia Universidad Javeriana",
    },
  },
  "prince-of-songkla-university": {
    displayNames: {
      "th": "มหาวิทยาลัยสงขลานครินทร์",
    },
  },
  "pusan-national-university": {
    name: "Pusan National University",
    displayNames: {
      "ko": "부산대학교",
    },
  },
  "qatar-university": {
    name: "Qatar University",
    displayNames: {
      "ar": "جامعة قطر",
    },
  },
  "quaid-i-azam-university": {
    name: "Quaid-i-Azam University",
    displayNames: {
      "ur": "قائداعظم یونیورسٹی",
    },
  },
  "rUDN-university": {
    displayNames: {
      "ru": "Российский университет дружбы народов",
    },
  },
  "radboud-university": {
    name: "Radboud University",
    displayNames: {
      "nl": "Radboud Universiteit",
    },
  },
  "ritsumeikan-university": {
    name: "Ritsumeikan University",
    displayNames: {
      "ja": "立命館大学",
    },
  },
  "rudn-university": {
    name: "RUDN University",
    displayNames: {
      "ru": "Российский университет дружбы народов",
    },
  },
  "ruhr-universitat-bochum": {
    name: "Ruhr-Universität Bochum",
    displayNames: {
      "de": "Ruhr-Universität Bochum",
    },
  },
  "rwth-aachen-university": {
    name: "RWTH Aachen University",
    displayNames: {
      "de": "RWTH Aachen",
    },
  },
  "saarland-university": {
    name: "Saarland University",
    displayNames: {
      "de": "Universität des Saarlandes",
    },
  },
  "sabanci-university": {
    name: "Sabanci University",
    displayNames: {
      "tr": "Sabancı Üniversitesi",
    },
  },
  "saint-joseph-university-of-beirut-usj": {
    name: "Saint Joseph University of Beirut (USJ)",
    displayNames: {
      "ar": "جامعة القديس يوسف في بيروت",
    },
  },
  "saint-petersburg-state-university": {
    name: "Saint Petersburg State University",
    displayNames: {
      "ru": "Санкт-Петербургский государственный университет",
    },
  },
  "sapienza-university-of-rome": {
    name: "Sapienza University of Rome",
    displayNames: {
      "it": "Sapienza Università di Roma",
    },
  },
  "sciences-po": {
    name: "Sciences Po",
    displayNames: {
      "fr": "Sciences Po",
    },
    aliases: {
      "fr": ["Institut d'études politiques de Paris"],
    },
  },
  "scuola-normale-superiore-di-pisa": {
    displayNames: {
      "it": "Scuola Normale Superiore",
    },
  },
  "scuola-superiore-sant-anna-pisa": {
    displayNames: {
      "it": "Scuola Superiore Sant'Anna",
    },
  },
  "sejong-university": {
    name: "Sejong University",
    displayNames: {
      "ko": "세종대학교",
    },
  },
  "sepuluh-nopember-institute-of-technology-its": {
    displayNames: {
      "id": "Institut Teknologi Sepuluh Nopember",
    },
  },
  "shandong-university": {
    displayNames: {
      "zh": "山东大学",
    },
    aliases: {
      "zh": ["山大"],
    },
  },
  "shanghai-jiao-tong-university": {
    displayNames: {
      "zh": "上海交通大学",
    },
    aliases: {
      "zh": ["上海交大","上交","上交大"],
    },
  },
  "shanghai-university": {
    displayNames: {
      "zh": "上海大学",
    },
    aliases: {
      "zh": ["上大"],
    },
  },
  "sharif-university-of-technology": {
    name: "Sharif University of Technology",
    displayNames: {
      "fa": "دانشگاه صنعتی شریف",
    },
  },
  "shenzhen-university": {
    displayNames: {
      "zh": "深圳大学",
    },
    aliases: {
      "zh": ["深大"],
    },
  },
  "shiraz-university": {
    displayNames: {
      "fa": "دانشگاه شیراز",
    },
  },
  "sichuan-university": {
    displayNames: {
      "zh": "四川大学",
    },
    aliases: {
      "zh": ["川大"],
    },
  },
  "snu": {
    name: "Seoul National University",
    displayNames: {
      "ko": "서울대학교",
    },
  },
  "sogang-university": {
    displayNames: {
      "ko": "서강대학교",
    },
  },
  "soochow-university": {
    displayNames: {
      "zh": "苏州大学",
    },
    aliases: {
      "zh": ["苏大"],
    },
  },
  "sorbonne-university": {
    name: "Sorbonne University",
    displayNames: {
      "fr": "Sorbonne Université",
    },
    aliases: {
      "fr": ["La Sorbonne"],
    },
  },
  "south-china-university-of-technology": {
    displayNames: {
      "zh": "华南理工大学",
    },
    aliases: {
      "zh": ["华南理工"],
    },
  },
  "southeast-university": {
    displayNames: {
      "zh": "东南大学",
    },
    aliases: {
      "zh": ["东大"],
    },
  },
  "southern-university-of-science-and-technology-sustech": {
    displayNames: {
      "zh": "南方科技大学",
    },
    aliases: {
      "zh": ["南科大"],
    },
  },
  "stockholm-university": {
    name: "Stockholm University",
    displayNames: {
      "sv": "Stockholms universitet",
    },
  },
  "sultan-qaboos-university": {
    name: "Sultan Qaboos University",
    displayNames: {
      "ar": "جامعة السلطان قابوس",
    },
  },
  "sun-yat-sen-university": {
    displayNames: {
      "zh": "中山大学",
    },
    aliases: {
      "zh": ["中大"],
    },
  },
  "sungkyunkwan-university": {
    name: "Sungkyunkwan University (SKKU)",
    displayNames: {
      "ko": "성균관대학교",
    },
  },
  "taipei-medical-university-tmu": {
    name: "Taipei Medical University (TMU)",
    displayNames: {
      "zh": "臺北醫學大學",
      "zh-Hant": "臺北醫學大學",
    },
    aliases: {
      "zh": ["台北医学大学","北醫","北医","TMU"],
    },
  },
  "tampere-university": {
    name: "Tampere University",
    displayNames: {
      "fi": "Tampereen yliopisto",
    },
  },
  "taras-shevchenko-national-university-of-kyiv": {
    name: "Taras Shevchenko National University of Kyiv",
    displayNames: {
      "uk": "Київський національний університет імені Тараса Шевченка",
    },
  },
  "tarbiat-modares-university": {
    displayNames: {
      "fa": "دانشگاه تربیت مدرس",
    },
  },
  "technical-university-of-denmark": {
    name: "Technical University of Denmark",
    displayNames: {
      "da": "Danmarks Tekniske Universitet",
    },
  },
  "technical-university-of-munich": {
    name: "Technical University of Munich",
    displayNames: {
      "de": "Technische Universität München",
    },
  },
  "technion-israel-institute-of-technology": {
    name: "Technion - Israel Institute of Technology",
    displayNames: {
      "he": "הטכניון - מכון טכנולוגי לישראל",
    },
  },
  "technische-universitat-berlin": {
    name: "Technische Universität Berlin (TU Berlin)",
    displayNames: {
      "de": "Technische Universität Berlin",
    },
  },
  "technische-universitat-darmstadt": {
    displayNames: {
      "de": "Technische Universität Darmstadt",
    },
  },
  "technische-universitat-dresden": {
    name: "Technische Universität Dresden",
    displayNames: {
      "de": "Technische Universität Dresden",
    },
  },
  "technische-universitat-wien": {
    name: "Technische Universität Wien",
    displayNames: {
      "de": "Technische Universität Wien",
    },
  },
  "tecnologico-de-monterrey": {
    displayNames: {
      "es": "Instituto Tecnológico y de Estudios Superiores de Monterrey",
    },
  },
  "tel-aviv-university": {
    name: "Tel Aviv University",
    displayNames: {
      "he": "אוניברסיטת תל אביב",
    },
  },
  "thammasat-university": {
    displayNames: {
      "th": "มหาวิทยาลัยธรรมศาสตร์",
    },
  },
  "the-catholic-university-of-korea-cuk": {
    name: "The Catholic University of Korea (CUK)",
    displayNames: {
      "ko": "가톨릭대학교",
    },
  },
  "the-hong-kong-polytechnic-university": {
    name: "The Hong Kong Polytechnic University",
    displayNames: {
      "zh": "香港理工大學",
      "zh-Hant": "香港理工大學",
    },
    aliases: {
      "zh": ["香港理工大学","理大","PolyU"],
    },
  },
  "tianjin-university": {
    displayNames: {
      "zh": "天津大学",
    },
    aliases: {
      "zh": ["天大"],
    },
  },
  "tohoku-university": {
    name: "Tohoku University",
    displayNames: {
      "ja": "東北大学",
    },
  },
  "tokyo-institute-of-technology": {
    name: "Tokyo Institute of Technology (Tokyo Tech)",
    displayNames: {
      "ja": "東京工業大学",
    },
  },
  "tokyo-university-of-science": {
    name: "Tokyo University of Science",
    displayNames: {
      "ja": "東京理科大学",
    },
  },
  "tomsk-state-university": {
    name: "Tomsk State University",
    displayNames: {
      "ru": "Национальный исследовательский Томский государственный университет",
    },
  },
  "ton-duc-thang-university": {
    name: "Ton Duc Thang University",
    displayNames: {
      "vi": "Đại học Tôn Đức Thắng",
    },
  },
  "tongji-university": {
    displayNames: {
      "zh": "同济大学",
    },
    aliases: {
      "zh": ["同济"],
    },
  },
  "tsinghua-university": {
    displayNames: {
      "zh": "清华大学",
    },
    aliases: {
      "zh": ["清华"],
    },
  },
  "tu-dortmund-university": {
    name: "TU Dortmund University",
    displayNames: {
      "de": "TU Dortmund",
    },
  },
  "u-tokyo": {
    name: "The University of Tokyo",
    displayNames: {
      "ja": "東京大学",
    },
  },
  "uit-the-arctic-university-of-norway": {
    displayNames: {
      "nb": "UiT Norges arktiske universitet",
    },
  },
  "ulsan-national-institute-of-science-and-technology-unist": {
    name: "Ulsan National Institute of Science and Technology (UNIST)",
    displayNames: {
      "ko": "울산과학기술원",
    },
  },
  "umea-university": {
    name: "Umea University",
    displayNames: {
      "sv": "Umeå universitet",
    },
  },
  "umm-al-qura-university": {
    name: "Umm Al-Qura University",
    displayNames: {
      "ar": "جامعة أم القرى",
    },
  },
  "unesp": {
    name: "UNESP",
    displayNames: {
      "pt": "Universidade Estadual Paulista",
    },
  },
  "united-arab-emirates-university": {
    name: "United Arab Emirates University",
    displayNames: {
      "ar": "جامعة الإمارات العربية المتحدة",
    },
  },
  "universidad-autonoma-metropolitana-uam": {
    displayNames: {
      "es": "Universidad Autónoma Metropolitana",
    },
  },
  "universidad-carlos-iii-de-madrid-uc3m": {
    name: "Universidad Carlos III de Madrid (UC3M)",
    displayNames: {
      "es": "Universidad Carlos III de Madrid",
    },
  },
  "universidad-de-alcala": {
    displayNames: {
      "es": "Universidad de Alcalá",
    },
  },
  "universidad-de-antioquia": {
    name: "Universidad de Antioquia",
    displayNames: {
      "es": "Universidad de Antioquia",
    },
  },
  "universidad-de-buenos-aires": {
    name: "Universidad de Buenos Aires (UBA)",
    displayNames: {
      "es": "Universidad de Buenos Aires",
    },
  },
  "universidad-de-chile": {
    name: "Universidad de Chile",
    displayNames: {
      "es": "Universidad de Chile",
    },
  },
  "universidad-de-concepcion": {
    name: "Universidad de Concepción",
    displayNames: {
      "es": "Universidad de Concepción",
    },
  },
  "universidad-de-granada": {
    displayNames: {
      "es": "Universidad de Granada",
    },
  },
  "universidad-de-la-republica": {
    displayNames: {
      "es": "Universidad de la República",
    },
  },
  "universidad-de-los-andes-colombia": {
    displayNames: {
      "es": "Universidad de los Andes",
    },
  },
  "universidad-de-murcia": {
    displayNames: {
      "es": "Universidad de Murcia",
    },
  },
  "universidad-de-navarra": {
    displayNames: {
      "es": "Universidad de Navarra",
    },
  },
  "universidad-de-salamanca": {
    displayNames: {
      "es": "Universidad de Salamanca",
    },
  },
  "universidad-de-santiago-de-chile-usach": {
    name: "Universidad de Santiago de Chile (USACH)",
    displayNames: {
      "es": "Universidad de Santiago de Chile",
    },
  },
  "universidad-de-sevilla": {
    name: "Universidad de Sevilla",
    displayNames: {
      "es": "Universidad de Sevilla",
    },
  },
  "universidad-de-zaragoza": {
    name: "Universidad de Zaragoza",
    displayNames: {
      "es": "Universidad de Zaragoza",
    },
  },
  "universidad-del-pais-vasco-euskal-herriko-unibertsitatea": {
    displayNames: {
      "es": "Universidad del País Vasco / Euskal Herriko Unibertsitatea",
    },
  },
  "universidad-nacional-autonoma-de-mexico": {
    name: "Universidad Nacional Autónoma de México (UNAM)",
    displayNames: {
      "es": "Universidad Nacional Autónoma de México",
    },
  },
  "universidad-nacional-de-colombia": {
    name: "Universidad Nacional de Colombia",
    displayNames: {
      "es": "Universidad Nacional de Colombia",
    },
  },
  "universidad-nacional-mayor-de-san-marcos": {
    displayNames: {
      "es": "Universidad Nacional Mayor de San Marcos",
    },
  },
  "universidad-politecnica-de-madrid": {
    displayNames: {
      "es": "Universidad Politécnica de Madrid",
    },
  },
  "universidad-politecnica-de-madrid-upm": {
    name: "Universidad Politécnica de Madrid (UPM)",
    displayNames: {
      "es": "Universidad Politécnica de Madrid",
    },
  },
  "universidade-de-aveiro": {
    displayNames: {
      "pt": "Universidade de Aveiro",
    },
  },
  "universidade-de-brasilia": {
    name: "Universidade de Brasília",
    displayNames: {
      "pt": "Universidade de Brasília",
    },
  },
  "universidade-de-coimbra": {
    displayNames: {
      "pt": "Universidade de Coimbra",
    },
  },
  "universidade-de-lisboa": {
    displayNames: {
      "pt": "Universidade de Lisboa",
    },
  },
  "universidade-de-santiago-de-compostela": {
    name: "Universidade de Santiago de Compostela",
    displayNames: {
      "es": "Universidade de Santiago de Compostela",
    },
  },
  "universidade-de-sao-paulo": {
    name: "Universidade de São Paulo",
    displayNames: {
      "pt": "Universidade de São Paulo",
    },
  },
  "universidade-do-minho": {
    displayNames: {
      "pt": "Universidade do Minho",
    },
  },
  "universidade-do-porto": {
    displayNames: {
      "pt": "Universidade do Porto",
    },
  },
  "universidade-estadual-de-campinas-unicamp": {
    displayNames: {
      "pt": "Universidade Estadual de Campinas",
    },
  },
  "universidade-estadual-paulista-unesp": {
    displayNames: {
      "pt": "Universidade Estadual Paulista",
    },
  },
  "universidade-federal-de-minas-gerais": {
    displayNames: {
      "pt": "Universidade Federal de Minas Gerais",
    },
  },
  "universidade-federal-de-santa-catarina": {
    name: "Universidade Federal de Santa Catarina",
    displayNames: {
      "pt": "Universidade Federal de Santa Catarina",
    },
  },
  "universidade-federal-de-sao-paulo": {
    name: "Universidade Federal de São Paulo",
    displayNames: {
      "pt": "Universidade Federal de São Paulo",
    },
  },
  "universidade-federal-do-parana-ufpr": {
    displayNames: {
      "pt": "Universidade Federal do Paraná",
    },
  },
  "universidade-federal-do-rio-de-janeiro": {
    name: "Universidade Federal do Rio de Janeiro",
    displayNames: {
      "pt": "Universidade Federal do Rio de Janeiro",
    },
  },
  "universidade-federal-do-rio-grande-do-sul": {
    displayNames: {
      "pt": "Universidade Federal do Rio Grande do Sul",
    },
  },
  "universidade-nova-de-lisboa": {
    displayNames: {
      "pt": "Universidade Nova de Lisboa",
    },
  },
  "universita-cattolica-del-sacro-cuore": {
    name: "Università Cattolica del Sacro Cuore",
    displayNames: {
      "it": "Università Cattolica del Sacro Cuore",
    },
  },
  "universita-degli-studi-di-pavia": {
    name: "Università degli Studi di Pavia",
    displayNames: {
      "it": "Università degli Studi di Pavia",
    },
  },
  "universitas-indonesia": {
    name: "Universitas Indonesia",
    displayNames: {
      "id": "Universitas Indonesia",
    },
  },
  "universitas-padjadjaran": {
    displayNames: {
      "id": "Universitas Padjadjaran",
    },
  },
  "universitat-autonoma-de-barcelona": {
    name: "Universitat Autònoma de Barcelona",
    displayNames: {
      "es": "Universidad Autónoma de Barcelona",
    },
  },
  "universitat-basel": {
    displayNames: {
      "de": "Universität Basel",
    },
  },
  "universitat-bayreuth": {
    displayNames: {
      "de": "Universität Bayreuth",
    },
  },
  "universitat-bern": {
    displayNames: {
      "de": "Universität Bern",
    },
  },
  "universitat-bonn": {
    displayNames: {
      "de": "Universität Bonn",
    },
  },
  "universitat-bremen": {
    displayNames: {
      "de": "Universität Bremen",
    },
  },
  "universitat-de-val-ncia": {
    displayNames: {
      "es": "Universitat de València",
    },
  },
  "universitat-graz": {
    displayNames: {
      "de": "Universität Graz",
    },
  },
  "universitat-hamburg": {
    name: "Universität Hamburg",
    displayNames: {
      "de": "Universität Hamburg",
    },
  },
  "universitat-heidelberg": {
    name: "Universität Heidelberg",
    displayNames: {
      "de": "Universität Heidelberg",
    },
  },
  "universitat-innsbruck": {
    name: "Universität Innsbruck",
    displayNames: {
      "de": "Universität Innsbruck",
    },
  },
  "universitat-konstanz": {
    name: "Universität Konstanz",
    displayNames: {
      "de": "Universität Konstanz",
    },
  },
  "universitat-leipzig": {
    displayNames: {
      "de": "Universität Leipzig",
    },
  },
  "universitat-mannheim": {
    name: "Universität Mannheim",
    displayNames: {
      "de": "Universität Mannheim",
    },
  },
  "universitat-munster": {
    displayNames: {
      "de": "Universität Münster",
    },
  },
  "universitat-polit-cnica-de-val-ncia": {
    displayNames: {
      "es": "Universitat Politècnica de València",
    },
  },
  "universitat-politecnica-de-catalunya-barcelonatech-upc": {
    name: "Universitat Politècnica de Catalunya · BarcelonaTech (UPC)",
    displayNames: {
      "es": "Universitat Politècnica de Catalunya",
    },
  },
  "universitat-pompeu-fabra": {
    name: "Universitat Pompeu Fabra (Barcelona)",
    displayNames: {
      "es": "Universitat Pompeu Fabra",
    },
  },
  "universitat-pompeu-fabra-barcelona": {
    displayNames: {
      "es": "Universitat Pompeu Fabra",
    },
  },
  "universitat-potsdam": {
    name: "Universität Potsdam",
    displayNames: {
      "de": "Universität Potsdam",
    },
  },
  "universitat-stuttgart": {
    name: "Universität Stuttgart",
    displayNames: {
      "de": "Universität Stuttgart",
    },
  },
  "universitat-ulm": {
    displayNames: {
      "de": "Universität Ulm",
    },
  },
  "universitat-wien": {
    displayNames: {
      "de": "Universität Wien",
    },
  },
  "universitat-zu-koln": {
    displayNames: {
      "de": "Universität zu Köln",
    },
  },
  "universite-catholique-de-louvain": {
    name: "Université catholique de Louvain (UCLouvain)",
    displayNames: {
      "fr": "Université catholique de Louvain",
    },
    aliases: {
      "fr": ["UCLouvain","Louvain"],
    },
  },
  "universite-claude-bernard-lyon-1": {
    name: "Université Claude Bernard Lyon 1",
    displayNames: {
      "fr": "Université Claude Bernard Lyon 1",
    },
    aliases: {
      "fr": ["Lyon 1","UCBL"],
    },
  },
  "universite-de-bordeaux": {
    displayNames: {
      "fr": "Université de Bordeaux",
    },
  },
  "universite-de-fribourg": {
    name: "Université de Fribourg",
    displayNames: {
      "fr": "Université de Fribourg",
    },
  },
  "universite-de-geneve": {
    displayNames: {
      "fr": "Université de Genève",
    },
  },
  "universite-de-lausanne": {
    displayNames: {
      "fr": "Université de Lausanne",
    },
  },
  "universite-de-liege": {
    name: "Université de Liège",
    displayNames: {
      "fr": "Université de Liège",
    },
    aliases: {
      "fr": ["ULiège","Universite de Liege"],
    },
  },
  "universite-de-lille": {
    name: "Université de Lille",
    displayNames: {
      "fr": "Université de Lille",
    },
  },
  "universite-de-lorraine": {
    name: "Université de Lorraine",
    displayNames: {
      "fr": "Université de Lorraine",
    },
  },
  "universite-de-montpellier": {
    name: "Université de Montpellier",
    displayNames: {
      "fr": "Université de Montpellier",
    },
  },
  "universite-de-montreal": {
    name: "Université de Montréal",
    displayNames: {
      "fr": "Université de Montréal",
    },
    aliases: {
      "fr": ["Universite de Montreal","UdeM","Université Montréal"],
    },
  },
  "universite-de-rennes": {
    name: "Université de Rennes",
    displayNames: {
      "fr": "Université de Rennes",
    },
  },
  "universite-de-sherbrooke": {
    displayNames: {
      "fr": "Université de Sherbrooke",
    },
  },
  "universite-de-strasbourg": {
    name: "Université de Strasbourg",
    displayNames: {
      "fr": "Université de Strasbourg",
    },
  },
  "universite-de-tunis-el-manar": {
    name: "Université de Tunis El Manar",
    displayNames: {
      "ar": "جامعة تونس المنار",
      "fr": "Université de Tunis El Manar",
    },
    aliases: {
      "fr": ["Tunis El Manar"],
    },
  },
  "universite-du-quebec": {
    name: "Université du Québec",
    displayNames: {
      "fr": "Université du Québec",
    },
    aliases: {
      "fr": ["UQ"],
    },
  },
  "universite-grenoble-alpes": {
    name: "Université Grenoble Alpes",
    displayNames: {
      "fr": "Université Grenoble Alpes",
    },
    aliases: {
      "fr": ["UGA"],
    },
  },
  "universite-laval": {
    name: "Université Laval",
    displayNames: {
      "fr": "Université Laval",
    },
  },
  "universite-libre-de-bruxelles": {
    name: "Universite libre de Bruxelles",
    displayNames: {
      "fr": "Université libre de Bruxelles",
    },
  },
  "universite-lumiere-lyon-2": {
    name: "Université Lumière Lyon 2",
    displayNames: {
      "fr": "Université Lumière Lyon 2",
    },
    aliases: {
      "fr": ["Lyon 2"],
    },
  },
  "universite-paris-1-pantheon-sorbonne": {
    name: "Université Paris 1 Panthéon-Sorbonne",
    displayNames: {
      "fr": "Université Paris 1 Panthéon-Sorbonne",
    },
    aliases: {
      "fr": ["Paris 1","Panthéon-Sorbonne"],
    },
  },
  "universite-paris-13-nord": {
    name: "Université Paris 13 Nord",
    displayNames: {
      "fr": "Université Paris 13 Nord",
    },
  },
  "universite-paris-cite": {
    name: "Université Paris Cité",
    displayNames: {
      "fr": "Université Paris Cité",
    },
  },
  "universite-paris-pantheon-assas": {
    name: "Universite Paris-Pantheon-Assas",
    displayNames: {
      "fr": "Université Paris-Panthéon-Assas",
    },
    aliases: {
      "fr": ["Assas","Paris 2"],
    },
  },
  "universite-paris-saclay": {
    name: "Université Paris-Saclay",
    displayNames: {
      "fr": "Université Paris-Saclay",
    },
    aliases: {
      "fr": ["Paris-Saclay"],
    },
  },
  "universite-paul-sabatier-toulouse-iii": {
    name: "Université Paul Sabatier Toulouse III",
    displayNames: {
      "fr": "Université Paul Sabatier Toulouse III",
    },
    aliases: {
      "fr": ["Toulouse III","Paul Sabatier"],
    },
  },
  "universite-psl": {
    name: "Université PSL",
    displayNames: {
      "fr": "Université PSL",
    },
    aliases: {
      "fr": ["PSL","Paris Sciences et Lettres"],
    },
  },
  "universiti-brunei-darussalam-ubd": {
    name: "Universiti Brunei Darussalam (UBD)",
    displayNames: {
      "ms": "Universiti Brunei Darussalam",
    },
  },
  "universiti-kebangsaan-malaysia-ukm": {
    displayNames: {
      "ms": "Universiti Kebangsaan Malaysia",
    },
  },
  "universiti-malaya": {
    name: "Universiti Malaya (UM)",
    displayNames: {
      "ms": "Universiti Malaya",
    },
  },
  "universiti-malaysia-sabah-ums": {
    name: "Universiti Malaysia Sabah (UMS)",
    displayNames: {
      "ms": "Universiti Malaysia Sabah",
    },
  },
  "universiti-malaysia-sarawak-unimas": {
    name: "Universiti Malaysia Sarawak (UNIMAS)",
    displayNames: {
      "ms": "Universiti Malaysia Sarawak",
    },
  },
  "universiti-putra-malaysia-upm": {
    displayNames: {
      "ms": "Universiti Putra Malaysia",
    },
  },
  "universiti-sains-malaysia": {
    name: "Universiti Sains Malaysia (USM)",
    displayNames: {
      "ms": "Universiti Sains Malaysia",
    },
  },
  "universiti-teknologi-malaysia": {
    name: "Universiti Teknologi Malaysia",
    displayNames: {
      "ms": "Universiti Teknologi Malaysia",
    },
  },
  "universiti-teknologi-mara-uitm": {
    displayNames: {
      "ms": "Universiti Teknologi MARA",
    },
  },
  "universiti-teknologi-petronas-utp": {
    displayNames: {
      "ms": "Universiti Teknologi PETRONAS",
    },
  },
  "universiti-tun-hussein-onn-malaysia-uthm": {
    name: "Universiti Tun Hussein Onn Malaysia (UTHM)",
    displayNames: {
      "ms": "Universiti Tun Hussein Onn Malaysia",
    },
  },
  "universiti-utara-malaysia-uum": {
    name: "Universiti Utara Malaysia (UUM)",
    displayNames: {
      "ms": "Universiti Utara Malaysia",
    },
  },
  "university-of-agriculture-faisalabad": {
    name: "University of Agriculture, Faisalabad",
    displayNames: {
      "ur": "زرعی یونیورسٹی فیصل آباد",
    },
  },
  "university-of-algarve": {
    name: "University of Algarve",
    displayNames: {
      "pt": "Universidade do Algarve",
    },
  },
  "university-of-amsterdam": {
    name: "University of Amsterdam",
    displayNames: {
      "nl": "Universiteit van Amsterdam",
    },
  },
  "university-of-antwerp": {
    name: "University of Antwerp",
    displayNames: {
      "nl": "Universiteit Antwerpen",
    },
  },
  "university-of-barcelona": {
    displayNames: {
      "es": "Universidad de Barcelona",
    },
  },
  "university-of-bari-aldo-moro": {
    displayNames: {
      "it": "Università degli Studi di Bari Aldo Moro",
    },
  },
  "university-of-bergen": {
    name: "University of Bergen",
    displayNames: {
      "nb": "Universitetet i Bergen",
    },
  },
  "university-of-bologna": {
    displayNames: {
      "it": "Alma Mater Studiorum - Università di Bologna",
    },
  },
  "university-of-bordeaux": {
    name: "University of Bordeaux",
    displayNames: {
      "fr": "Université de Bordeaux",
    },
  },
  "university-of-brescia": {
    name: "University of Brescia",
    displayNames: {
      "it": "Università degli Studi di Brescia",
    },
  },
  "university-of-calabria": {
    displayNames: {
      "it": "Università della Calabria",
    },
  },
  "university-of-calcutta": {
    name: "University of Calcutta",
    displayNames: {
      "hi": "कलकत्ता विश्वविद्यालय",
    },
  },
  "university-of-catania": {
    displayNames: {
      "it": "Università degli Studi di Catania",
    },
  },
  "university-of-chemistry-and-technology-prague": {
    name: "University of Chemistry and Technology, Prague",
    displayNames: {
      "cs": "Vysoká škola chemicko-technologická v Praze",
    },
  },
  "university-of-chinese-academy-of-sciences-ucas": {
    displayNames: {
      "zh": "中国科学院大学",
    },
    aliases: {
      "zh": ["国科大","中国科学院大学"],
    },
  },
  "university-of-cologne": {
    name: "University of Cologne",
    displayNames: {
      "de": "Universität zu Köln",
    },
  },
  "university-of-copenhagen": {
    name: "University of Copenhagen",
    displayNames: {
      "da": "Københavns Universitet",
    },
  },
  "university-of-crete": {
    name: "University of Crete",
    displayNames: {
      "el": "Πανεπιστήμιο Κρήτης",
    },
  },
  "university-of-cyprus-ucy": {
    name: "University of Cyprus (UCY)",
    displayNames: {
      "el": "Πανεπιστήμιο Κύπρου",
    },
  },
  "university-of-delhi": {
    name: "University of Delhi",
    displayNames: {
      "hi": "दिल्ली विश्वविद्यालय",
    },
  },
  "university-of-dhaka": {
    name: "University of Dhaka",
    displayNames: {
      "bn": "ঢাকা বিশ্ববিদ্যালয়",
    },
  },
  "university-of-eastern-finland": {
    name: "University of Eastern Finland",
    displayNames: {
      "fi": "Itä-Suomen yliopisto",
    },
  },
  "university-of-engineering-and-technology-uet-lahore": {
    name: "University of Engineering & Technology (UET) Lahore",
    displayNames: {
      "ur": "یونیورسٹی آف انجینئرنگ اینڈ ٹیکنالوجی، لاہور",
    },
  },
  "university-of-ferrara": {
    displayNames: {
      "it": "Università degli Studi di Ferrara",
    },
  },
  "university-of-florence": {
    name: "University of Florence",
    displayNames: {
      "it": "Università degli Studi di Firenze",
    },
  },
  "university-of-genoa": {
    displayNames: {
      "it": "Università degli Studi di Genova",
    },
  },
  "university-of-gothenburg": {
    name: "University of Gothenburg",
    displayNames: {
      "sv": "Göteborgs universitet",
    },
  },
  "university-of-groningen": {
    name: "University of Groningen",
    displayNames: {
      "nl": "Rijksuniversiteit Groningen",
    },
  },
  "university-of-helsinki": {
    name: "University of Helsinki",
    displayNames: {
      "fi": "Helsingin yliopisto",
    },
  },
  "university-of-hong-kong": {
    name: "The University of Hong Kong",
    displayNames: {
      "zh": "香港大學",
      "zh-Hant": "香港大學",
    },
    aliases: {
      "zh": ["香港大学","港大","HKU"],
    },
  },
  "university-of-hradec-kralove": {
    name: "University of Hradec Kralove",
    displayNames: {
      "cs": "Univerzita Hradec Králové",
    },
  },
  "university-of-ioannina": {
    name: "University of Ioannina",
    displayNames: {
      "el": "Πανεπιστήμιο Ιωαννίνων",
    },
  },
  "university-of-isfahan": {
    name: "University of Isfahan",
    displayNames: {
      "fa": "دانشگاه اصفهان",
    },
  },
  "university-of-jordan": {
    name: "University of Jordan",
    displayNames: {
      "ar": "الجامعة الأردنية",
    },
  },
  "university-of-jyvaskyla": {
    name: "University of Jyväskylä",
    displayNames: {
      "fi": "Jyväskylän yliopisto",
    },
  },
  "university-of-karachi": {
    name: "University of Karachi",
    displayNames: {
      "ur": "جامعہ کراچی",
    },
  },
  "university-of-l-aquila": {
    displayNames: {
      "it": "Università degli Studi dell'Aquila",
    },
  },
  "university-of-lodz": {
    displayNames: {
      "pl": "Uniwersytet Łódzki",
    },
  },
  "university-of-macau": {
    name: "University of Macau",
    displayNames: {
      "zh": "澳門大學",
      "zh-Hant": "澳門大學",
    },
    aliases: {
      "zh": ["澳门大学","澳大"],
    },
  },
  "university-of-messina": {
    displayNames: {
      "it": "Università degli Studi di Messina",
    },
  },
  "university-of-milan": {
    name: "University of Milan",
    displayNames: {
      "it": "Università degli Studi di Milano",
    },
  },
  "university-of-modena-and-reggio-emilia": {
    name: "University of Modena and Reggio Emilia",
    displayNames: {
      "it": "Università degli Studi di Modena e Reggio Emilia",
    },
  },
  "university-of-mumbai": {
    name: "University of Mumbai",
    displayNames: {
      "hi": "मुंबई विश्वविद्यालय",
    },
  },
  "university-of-naples-federico-ii": {
    name: "University of Naples - Federico II",
    displayNames: {
      "it": "Università degli Studi di Napoli Federico II",
    },
  },
  "university-of-oslo": {
    name: "University of Oslo",
    displayNames: {
      "nb": "Universitetet i Oslo",
    },
  },
  "university-of-ottawa": {
    displayNames: {
      "fr": "Université d'Ottawa",
    },
    aliases: {
      "fr": ["uOttawa","Ottawa"],
    },
  },
  "university-of-oulu": {
    name: "University of Oulu",
    displayNames: {
      "fi": "Oulun yliopisto",
    },
  },
  "university-of-padua": {
    displayNames: {
      "it": "Università degli Studi di Padova",
    },
  },
  "university-of-palermo": {
    name: "University of Palermo",
    displayNames: {
      "it": "Università degli Studi di Palermo",
    },
  },
  "university-of-parma": {
    name: "University of Parma",
    displayNames: {
      "it": "Università di Parma",
    },
  },
  "university-of-patras": {
    displayNames: {
      "el": "Πανεπιστήμιο Πατρών",
    },
  },
  "university-of-pecs": {
    name: "University of Pecs",
    displayNames: {
      "hu": "Pécsi Tudományegyetem",
    },
  },
  "university-of-perugia": {
    displayNames: {
      "it": "Università degli Studi di Perugia",
    },
  },
  "university-of-pisa": {
    name: "University of Pisa",
    displayNames: {
      "it": "Università di Pisa",
    },
  },
  "university-of-rome-tor-vergata": {
    name: "University of Rome \"Tor Vergata\"",
    displayNames: {
      "it": "Università degli Studi di Roma Tor Vergata",
    },
  },
  "university-of-salento": {
    name: "University of Salento",
    displayNames: {
      "it": "Università del Salento",
    },
  },
  "university-of-salerno": {
    name: "University of Salerno",
    displayNames: {
      "it": "Università degli Studi di Salerno",
    },
  },
  "university-of-science-and-technology-beijing": {
    displayNames: {
      "zh": "北京科技大学",
    },
    aliases: {
      "zh": ["北科大"],
    },
  },
  "university-of-science-and-technology-of-china": {
    displayNames: {
      "zh": "中国科学技术大学",
    },
    aliases: {
      "zh": ["中科大","中国科大"],
    },
  },
  "university-of-sfax": {
    name: "University of Sfax",
    displayNames: {
      "ar": "جامعة صفاقس",
    },
  },
  "university-of-sharjah": {
    name: "University of Sharjah",
    displayNames: {
      "ar": "جامعة الشارقة",
    },
  },
  "university-of-siena": {
    name: "University of Siena",
    displayNames: {
      "it": "Università degli Studi di Siena",
    },
  },
  "university-of-south-bohemia-in-ceske-budejovice": {
    name: "University of South Bohemia in České Budějovice",
    displayNames: {
      "cs": "Jihočeská univerzita v Českých Budějovicích",
    },
  },
  "university-of-southern-denmark-sdu": {
    name: "University of Southern Denmark (SDU)",
    displayNames: {
      "da": "Syddansk Universitet",
    },
  },
  "university-of-szeged": {
    name: "University of Szeged",
    displayNames: {
      "hu": "Szegedi Tudományegyetem",
    },
  },
  "university-of-tehran": {
    name: "University of Tehran",
    displayNames: {
      "fa": "دانشگاه تهران",
    },
  },
  "university-of-trento": {
    name: "University of Trento",
    displayNames: {
      "it": "Università di Trento",
    },
  },
  "university-of-trieste": {
    name: "University of Trieste",
    displayNames: {
      "it": "Università degli Studi di Trieste",
    },
  },
  "university-of-tsukuba": {
    name: "University of Tsukuba",
    displayNames: {
      "ja": "筑波大学",
    },
  },
  "university-of-turin": {
    name: "University of Turin",
    displayNames: {
      "it": "Università degli Studi di Torino",
    },
  },
  "university-of-turku": {
    name: "University of Turku",
    displayNames: {
      "fi": "Turun yliopisto",
    },
  },
  "university-of-twente": {
    name: "University of Twente",
    displayNames: {
      "nl": "Universiteit Twente",
    },
  },
  "university-of-ulsan": {
    name: "University of Ulsan",
    displayNames: {
      "ko": "울산대학교",
    },
  },
  "university-of-verona": {
    displayNames: {
      "it": "Università degli Studi di Verona",
    },
  },
  "university-of-vienna": {
    name: "University of Vienna",
    displayNames: {
      "de": "Universität Wien",
    },
  },
  "university-of-warmia-and-mazury-in-olsztyn": {
    name: "University of Warmia and Mazury in Olsztyn",
    displayNames: {
      "pl": "Uniwersytet Warmińsko-Mazurski w Olsztynie",
    },
    aliases: {
      "pl": ["UWM","Uniwersytet Warminsko-Mazurski"],
    },
  },
  "university-of-warsaw": {
    name: "University of Warsaw",
    displayNames: {
      "pl": "Uniwersytet Warszawski",
    },
    aliases: {
      "pl": ["UW","Uniwersytet Warszawski"],
    },
  },
  "university-of-west-bohemia": {
    name: "University of West Bohemia",
    displayNames: {
      "cs": "Západočeská univerzita v Plzni",
    },
  },
  "university-of-wroclaw": {
    name: "University of Wroclaw",
    displayNames: {
      "pl": "Uniwersytet Wrocławski",
    },
    aliases: {
      "pl": ["UWr","Uniwersytet Wroclawski"],
    },
  },
  "university-of-zurich": {
    name: "University of Zurich",
    displayNames: {
      "de": "Universität Zürich",
    },
  },
  "uppsala-university": {
    name: "Uppsala University",
    displayNames: {
      "sv": "Uppsala universitet",
    },
  },
  "ural-federal-university": {
    displayNames: {
      "ru": "Уральский федеральный университет",
    },
  },
  "utrecht-university": {
    name: "Utrecht University",
    displayNames: {
      "nl": "Universiteit Utrecht",
    },
  },
  "v-n-karazin-kharkiv-national-university": {
    name: "V. N. Karazin Kharkiv National University",
    displayNames: {
      "uk": "Харківський національний університет імені В. Н. Каразіна",
    },
  },
  "van-lang-university": {
    name: "Van Lang University",
    displayNames: {
      "vi": "Trường Đại học Văn Lang",
    },
  },
  "viet-nam-national-university-ho-chi-minh-city-vnu-hcm": {
    name: "Viet Nam National University Ho Chi Minh City (VNU-HCM)",
    displayNames: {
      "vi": "Đại học Quốc gia Thành phố Hồ Chí Minh",
    },
  },
  "vietnam-national-university-hanoi": {
    name: "Vietnam National University, Hanoi",
    displayNames: {
      "vi": "Đại học Quốc gia Hà Nội",
    },
  },
  "vilnius-tech-vilnius-gediminas-technical-university": {
    name: "VILNIUS TECH (Vilnius Gediminas Technical University)",
    displayNames: {
      "lt": "Vilniaus Gedimino technikos universitetas",
    },
  },
  "vilnius-university": {
    name: "Vilnius University",
    displayNames: {
      "lt": "Vilniaus universitetas",
    },
  },
  "vita-salute-san-raffaele-university": {
    displayNames: {
      "it": "Università Vita-Salute San Raffaele",
    },
  },
  "vrije-universiteit-amsterdam": {
    name: "Vrije Universiteit Amsterdam",
    displayNames: {
      "nl": "Vrije Universiteit Amsterdam",
    },
  },
  "vrije-universiteit-brussel-vub": {
    name: "Vrije Universiteit Brussel (VUB)",
    displayNames: {
      "nl": "Vrije Universiteit Brussel",
    },
  },
  "vsb-technical-university-of-ostrava": {
    name: "VSB - Technical University of Ostrava",
    displayNames: {
      "cs": "VŠB - Technická univerzita Ostrava",
    },
  },
  "vytautas-magnus-university": {
    name: "Vytautas Magnus University",
    displayNames: {
      "lt": "Vytauto Didžiojo universitetas",
    },
  },
  "wageningen-university-and-research": {
    name: "Wageningen University & Research",
    displayNames: {
      "nl": "Wageningen University & Research",
    },
  },
  "walailak-university": {
    name: "Walailak University",
    displayNames: {
      "th": "มหาวิทยาลัยวลัยลักษณ์",
    },
  },
  "warsaw-university-of-technology": {
    name: "Warsaw University of Technology",
    displayNames: {
      "pl": "Politechnika Warszawska",
    },
    aliases: {
      "pl": ["PW","Politechnika Warszawska"],
    },
  },
  "waseda-university": {
    name: "Waseda University",
    displayNames: {
      "ja": "早稲田大学",
    },
  },
  "weizmann-institute-of-science": {
    displayNames: {
      "he": "מכון ויצמן למדע",
    },
  },
  "wroclaw-university-of-science-and-technology-wroc-aw-tech": {
    name: "Wroclaw University of Science and Technology (Wrocław Tech)",
    displayNames: {
      "pl": "Politechnika Wrocławska",
    },
    aliases: {
      "pl": ["PWr","Politechnika Wroclawska"],
    },
  },
  "wuhan-university": {
    displayNames: {
      "zh": "武汉大学",
    },
    aliases: {
      "zh": ["武大"],
    },
  },
  "xiamen-university": {
    displayNames: {
      "zh": "厦门大学",
    },
    aliases: {
      "zh": ["厦大"],
    },
  },
  "xian-jiaotong-university": {
    displayNames: {
      "zh": "西安交通大学",
    },
    aliases: {
      "zh": ["西交大"],
    },
  },
  "yarmouk-university": {
    name: "Yarmouk University",
    displayNames: {
      "ar": "جامعة اليرموك",
    },
  },
  "yildiz-technical-university": {
    name: "Yildiz Technical University",
    displayNames: {
      "tr": "Yıldız Teknik Üniversitesi",
    },
  },
  "yokohama-city-university": {
    name: "Yokohama City University",
    displayNames: {
      "ja": "横浜市立大学",
    },
  },
  "yokohama-national-university": {
    name: "Yokohama National University",
    displayNames: {
      "ja": "横浜国立大学",
    },
  },
  "yonsei-university": {
    name: "Yonsei University",
    displayNames: {
      "ko": "연세대학교",
    },
  },
  "yuan-ze-university": {
    name: "Yuan Ze University",
    displayNames: {
      "zh-Hant": "元智大學",
    },
  },
  "zhejiang-university": {
    displayNames: {
      "zh": "浙江大学",
    },
    aliases: {
      "zh": ["浙大"],
    },
  },
  "zhengzhou-university": {
    displayNames: {
      "zh": "郑州大学",
    },
  },
};

const slugByName = new Map<string, string>();
for (const [slug, record] of Object.entries(records)) {
  slugByName.set(slug, slug);
  if (record.name) {
    const raw = record.name.trim();
    const withoutParen = raw.replace(/\s*\([^)]*\)/g, "").trim();
    const variations = [raw, withoutParen];
    for (const v of variations) {
      slugByName.set(v, slug);
      slugByName.set(v.toLowerCase(), slug);
      if (v.startsWith("The ")) {
        const stripped = v.slice(4).trim();
        slugByName.set(stripped, slug);
        slugByName.set(stripped.toLowerCase(), slug);
      }
    }
  }
}

export function getInstitutionNativeName(
  slugOrName: string,
  locale: ReadingLocale | SupportedLocale | string
): string | undefined {
  if (!slugOrName || locale === "en") return undefined;

  const loc = locale as InstitutionLocale;

  // 1. Direct slug match
  if (records[slugOrName]?.displayNames?.[loc]) {
    return records[slugOrName].displayNames[loc];
  }

  // 2. Canonical slug match via alias
  const canonical = canonicalUniversitySlug(slugOrName);
  if (records[canonical]?.displayNames?.[loc]) {
    return records[canonical].displayNames[loc];
  }

  // 3. Name lookup
  const trimmed = slugOrName.trim();
  const slugFromName = slugByName.get(trimmed) ?? slugByName.get(trimmed.toLowerCase());
  if (slugFromName) {
    if (records[slugFromName]?.displayNames?.[loc]) {
      return records[slugFromName].displayNames[loc];
    }
    const resolvedCanonical = canonicalUniversitySlug(slugFromName);
    if (records[resolvedCanonical]?.displayNames?.[loc]) {
      return records[resolvedCanonical].displayNames[loc];
    }
  }

  return undefined;
}

export function getLocalizedInstitutionName(
  _slug: string,
  fallbackName: string,
  _locale: import("./language-catalog").ReadingLocale
): string {
  // Public display names stay canonical across locales. Localized names remain
  // available below as search aliases, but never replace the source entity name.
  return fallbackName;
}

export function getInstitutionLocalizedAliases(slug: string): string[] {
  const canonical = canonicalUniversitySlug(slug);
  const record = records[canonical] ?? records[slug];
  if (!record) return [];

  return Array.from(
    new Set([
      ...Object.values(record.displayNames ?? {}),
      ...Object.values(record.aliases ?? {}).flat()
    ])
  ).filter(Boolean);
}

export function getInstitutionLocalizedAliasesByLocale(
  slug: string,
  locale: SupportedLocale | ReadingLocale | string
): string[] {
  if (locale === "en") return [];

  const canonical = canonicalUniversitySlug(slug);
  const record = records[canonical] ?? records[slug];
  if (!record) return [];

  const loc = locale as InstitutionLocale;
  return Array.from(
    new Set([
      record.displayNames?.[loc],
      ...(record.aliases?.[loc] ?? [])
    ])
  ).filter((value): value is string => Boolean(value));
}
