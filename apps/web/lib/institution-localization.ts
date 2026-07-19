import type { SupportedLocale } from "./i18n";

type InstitutionLocale = Exclude<SupportedLocale, "en">;

interface InstitutionLocalizationRecord {
  aliases?: Partial<Record<InstitutionLocale, string[]>>;
  displayNames?: Partial<Record<InstitutionLocale, string>>;
}

const records: Record<string, InstitutionLocalizationRecord> = {
  "adam-mickiewicz-university-poznan": {
    displayNames: { pl: "Uniwersytet im. Adama Mickiewicza w Poznaniu" },
    aliases: { pl: ["UAM", "Uniwersytet Adama Mickiewicza", "UAM Poznań"] }
  },
  "agh-university-of-krakow": {
    displayNames: { pl: "Akademia Górniczo-Hutnicza w Krakowie" },
    aliases: { pl: ["AGH", "AGH Kraków"] }
  },
  "aix-marseille-university": {
    displayNames: { fr: "Aix-Marseille Université" },
    aliases: { fr: ["AMU", "Université d'Aix-Marseille"] }
  },
  "beihang-university-former-buaa": {
    displayNames: { zh: "北京航空航天大学" },
    aliases: { zh: ["北航", "北京航空航天"] }
  },
  "beijing-institute-of-technology": {
    displayNames: { zh: "北京理工大学" },
    aliases: { zh: ["北理工"] }
  },
  "beijing-jiaotong-university": {
    displayNames: { zh: "北京交通大学" },
    aliases: { zh: ["北交大"] }
  },
  "beijing-normal-university": {
    displayNames: { zh: "北京师范大学" },
    aliases: { zh: ["北师大"] }
  },
  "beijing-university-of-technology": {
    displayNames: { zh: "北京工业大学" },
    aliases: { zh: ["北工大"] }
  },
  "central-south-university": {
    displayNames: { zh: "中南大学" },
    aliases: { zh: ["中南"] }
  },
  "chang-gung-university": {
    displayNames: { zh: "長庚大學" },
    aliases: { zh: ["长庚大学", "長庚", "长庚"] }
  },
  "china-agricultural-university": {
    displayNames: { zh: "中国农业大学" },
    aliases: { zh: ["中国农大"] }
  },
  "china-medical-university": {
    displayNames: { zh: "中國醫藥大學" },
    aliases: { zh: ["中国医药大学", "中醫大", "中医大"] }
  },
  "china-university-of-geosciences": {
    displayNames: { zh: "中国地质大学" },
    aliases: { zh: ["地大"] }
  },
  "china-university-of-mining-and-technology": {
    displayNames: { zh: "中国矿业大学" },
    aliases: { zh: ["矿大"] }
  },
  "china-university-of-petroleum-beijing": {
    displayNames: { zh: "中国石油大学（北京）" },
    aliases: { zh: ["中国石油大学北京", "中石大"] }
  },
  "chongqing-university": {
    displayNames: { zh: "重庆大学" },
    aliases: { zh: ["重大"] }
  },
  "city-university-of-hong-kong": {
    displayNames: { zh: "香港城市大學" },
    aliases: { zh: ["香港城市大学", "城大", "CityUHK"] }
  },
  "concordia-university": {
    displayNames: { fr: "Université Concordia" },
    aliases: { fr: ["Concordia Montréal"] }
  },
  "dalian-university-of-technology": {
    displayNames: { zh: "大连理工大学" },
    aliases: { zh: ["大工"] }
  },
  "donghua-university": {
    displayNames: { zh: "东华大学" }
  },
  "east-china-normal-university": {
    displayNames: { zh: "华东师范大学" },
    aliases: { zh: ["华东师大"] }
  },
  "east-china-university-of-science-and-technology": {
    displayNames: { zh: "华东理工大学" },
    aliases: { zh: ["华理"] }
  },
  "ecole-normale-superieure-de-lyon": {
    displayNames: { fr: "École normale supérieure de Lyon" },
    aliases: { fr: ["ENS de Lyon", "ENS Lyon"] }
  },
  "fudan-university": {
    displayNames: { zh: "复旦大学" },
    aliases: { zh: ["复旦"] }
  },
  "gdansk-university-of-technology": {
    displayNames: { pl: "Politechnika Gdańska" },
    aliases: { pl: ["PG", "Politechnika Gdanska"] }
  },
  "epfl": {
    displayNames: { fr: "École polytechnique fédérale de Lausanne" },
    aliases: { fr: ["EPFL", "Polytechnique Lausanne"] }
  },
  "harbin-institute-of-technology": {
    displayNames: { zh: "哈尔滨工业大学" },
    aliases: { zh: ["哈工大"] }
  },
  "hong-kong-baptist-university": {
    displayNames: { zh: "香港浸會大學" },
    aliases: { zh: ["香港浸会大学", "浸大", "HKBU"] }
  },
  "hong-kong-metropolitan-university": {
    displayNames: { zh: "香港都會大學" },
    aliases: { zh: ["香港都会大学", "都大", "HKMU"] }
  },
  "huazhong-agricultural-university": {
    displayNames: { zh: "华中农业大学" },
    aliases: { zh: ["华中农大"] }
  },
  "huazhong-university-of-science-and-technology": {
    displayNames: { zh: "华中科技大学" },
    aliases: { zh: ["华科", "华中大"] }
  },
  "hunan-university": {
    displayNames: { zh: "湖南大学" }
  },
  "institut-national-des-sciences-appliquees-de-lyon-insa": {
    displayNames: { fr: "Institut national des sciences appliquées de Lyon" },
    aliases: { fr: ["INSA Lyon"] }
  },
  "institut-polytechnique-de-paris": {
    displayNames: { fr: "Institut Polytechnique de Paris" },
    aliases: { fr: ["IP Paris"] }
  },
  "jagiellonian-university": {
    displayNames: { pl: "Uniwersytet Jagielloński" },
    aliases: { pl: ["UJ", "Uniwersytet Jagiellonski"] }
  },
  "jilin-university": {
    displayNames: { zh: "吉林大学" },
    aliases: { zh: ["吉大"] }
  },
  "kaohsiung-medical-university": {
    displayNames: { zh: "高雄醫學大學" },
    aliases: { zh: ["高雄医学大学", "高醫", "高医"] }
  },
  "lanzhou-university": {
    displayNames: { zh: "兰州大学" },
    aliases: { zh: ["兰大"] }
  },
  "mcgill-university": {
    displayNames: { fr: "Université McGill" },
    aliases: { fr: ["McGill Montréal", "McGill Montreal"] }
  },
  "nanjing-university": {
    displayNames: { zh: "南京大学" },
    aliases: { zh: ["南大"] }
  },
  "nanjing-university-of-aeronautics-and-astronautics": {
    displayNames: { zh: "南京航空航天大学" },
    aliases: { zh: ["南航"] }
  },
  "nanyang-technological-university": {
    displayNames: { zh: "南洋理工大学" },
    aliases: { zh: ["南大", "NTU Singapore"] }
  },
  "nankai-university": {
    displayNames: { zh: "南开大学" },
    aliases: { zh: ["南开"] }
  },
  "national-central-university": {
    displayNames: { zh: "國立中央大學" },
    aliases: { zh: ["国立中央大学", "中央大學", "中央大学"] }
  },
  "national-cheng-kung-university": {
    displayNames: { zh: "國立成功大學" },
    aliases: { zh: ["国立成功大学", "成大", "NCKU"] }
  },
  "national-chengchi-university": {
    displayNames: { zh: "國立政治大學" },
    aliases: { zh: ["国立政治大学", "政大"] }
  },
  "national-chung-hsing-university": {
    displayNames: { zh: "國立中興大學" },
    aliases: { zh: ["国立中兴大学", "中興大學", "中兴大学"] }
  },
  "national-sun-yat-sen-university": {
    displayNames: { zh: "國立中山大學" },
    aliases: { zh: ["国立中山大学", "中山大學", "中山大学"] }
  },
  "national-taipei-university-of-technology": {
    displayNames: { zh: "國立臺北科技大學" },
    aliases: { zh: ["国立台北科技大学", "臺北科技大學", "台北科技大学", "北科大"] }
  },
  "national-taiwan-normal-university-ntnu": {
    displayNames: { zh: "國立臺灣師範大學" },
    aliases: { zh: ["国立台湾师范大学", "臺師大", "台师大", "NTNU"] }
  },
  "national-taiwan-university": {
    displayNames: { zh: "國立臺灣大學" },
    aliases: { zh: ["国立台湾大学", "臺大", "台大", "NTU"] }
  },
  "national-taiwan-university-of-science-and-technology-taiwan-tech": {
    displayNames: { zh: "國立臺灣科技大學" },
    aliases: { zh: ["国立台湾科技大学", "臺科大", "台科大", "Taiwan Tech"] }
  },
  "national-tsing-hua-university": {
    displayNames: { zh: "國立清華大學" },
    aliases: { zh: ["国立清华大学", "清大", "NTHU"] }
  },
  "national-university-of-singapore": {
    displayNames: { zh: "新加坡国立大学" },
    aliases: { zh: ["新国大", "国大", "NUS"] }
  },
  "national-yang-ming-chiao-tung-university": {
    displayNames: { zh: "國立陽明交通大學" },
    aliases: { zh: ["国立阳明交通大学", "陽明交大", "阳明交大", "NYCU"] }
  },
  "northwest-agriculture-and-forestry-university": {
    displayNames: { zh: "西北农林科技大学" },
    aliases: { zh: ["西农", "西北农林"] }
  },
  "northwestern-polytechnical-university": {
    displayNames: { zh: "西北工业大学" },
    aliases: { zh: ["西工大"] }
  },
  "ocean-university-of-china": {
    displayNames: { zh: "中国海洋大学" },
    aliases: { zh: ["中国海大"] }
  },
  "peking-university": {
    displayNames: { zh: "北京大学" },
    aliases: { zh: ["北大", "北京大学"] }
  },
  "sciences-po": {
    displayNames: { fr: "Sciences Po" },
    aliases: { fr: ["Institut d'études politiques de Paris"] }
  },
  "shandong-university": {
    displayNames: { zh: "山东大学" },
    aliases: { zh: ["山大"] }
  },
  "shanghai-jiao-tong-university": {
    displayNames: { zh: "上海交通大学" },
    aliases: { zh: ["上海交大", "上交", "上交大"] }
  },
  "shanghai-university": {
    displayNames: { zh: "上海大学" },
    aliases: { zh: ["上大"] }
  },
  "shenzhen-university": {
    displayNames: { zh: "深圳大学" },
    aliases: { zh: ["深大"] }
  },
  "sichuan-university": {
    displayNames: { zh: "四川大学" },
    aliases: { zh: ["川大"] }
  },
  "soochow-university": {
    displayNames: { zh: "苏州大学" },
    aliases: { zh: ["苏大"] }
  },
  "sorbonne-university": {
    displayNames: { fr: "Sorbonne Université" },
    aliases: { fr: ["La Sorbonne"] }
  },
  "south-china-university-of-technology": {
    displayNames: { zh: "华南理工大学" },
    aliases: { zh: ["华南理工"] }
  },
  "southeast-university": {
    displayNames: { zh: "东南大学" },
    aliases: { zh: ["东大"] }
  },
  "southern-university-of-science-and-technology-sustech": {
    displayNames: { zh: "南方科技大学" },
    aliases: { zh: ["南科大"] }
  },
  "sun-yat-sen-university": {
    displayNames: { zh: "中山大学" },
    aliases: { zh: ["中大"] }
  },
  "tianjin-university": {
    displayNames: { zh: "天津大学" },
    aliases: { zh: ["天大"] }
  },
  "tongji-university": {
    displayNames: { zh: "同济大学" },
    aliases: { zh: ["同济"] }
  },
  "tsinghua-university": {
    displayNames: { zh: "清华大学" },
    aliases: { zh: ["清华"] }
  },
  "taipei-medical-university-tmu": {
    displayNames: { zh: "臺北醫學大學" },
    aliases: { zh: ["台北医学大学", "北醫", "北医", "TMU"] }
  },
  "cuhk": {
    displayNames: { zh: "香港中文大學" },
    aliases: { zh: ["香港中文大学", "港中大", "CUHK"] }
  },
  "the-hong-kong-polytechnic-university": {
    displayNames: { zh: "香港理工大學" },
    aliases: { zh: ["香港理工大学", "理大", "PolyU"] }
  },
  "hkust": {
    displayNames: { zh: "香港科技大學" },
    aliases: { zh: ["香港科技大学", "港科大", "HKUST"] }
  },
  "university-of-hong-kong": {
    displayNames: { zh: "香港大學" },
    aliases: { zh: ["香港大学", "港大", "HKU"] }
  },
  "university-of-macau": {
    displayNames: { zh: "澳門大學" },
    aliases: { zh: ["澳门大学", "澳大"] }
  },
  "universite-catholique-de-louvain": {
    displayNames: { fr: "Université catholique de Louvain" },
    aliases: { fr: ["UCLouvain", "Louvain"] }
  },
  "universite-claude-bernard-lyon-1": {
    displayNames: { fr: "Université Claude Bernard Lyon 1" },
    aliases: { fr: ["Lyon 1", "UCBL"] }
  },
  "universite-de-fribourg": {
    displayNames: { fr: "Université de Fribourg" }
  },
  "universite-de-liege": {
    displayNames: { fr: "Université de Liège" },
    aliases: { fr: ["ULiège", "Universite de Liege"] }
  },
  "universite-de-lille": {
    displayNames: { fr: "Université de Lille" }
  },
  "universite-de-lorraine": {
    displayNames: { fr: "Université de Lorraine" }
  },
  "universite-de-montpellier": {
    displayNames: { fr: "Université de Montpellier" }
  },
  "universite-de-montreal": {
    displayNames: { fr: "Université de Montréal" },
    aliases: { fr: ["Universite de Montreal", "UdeM", "Université Montréal"] }
  },
  "universite-de-rennes": {
    displayNames: { fr: "Université de Rennes" }
  },
  "universite-de-strasbourg": {
    displayNames: { fr: "Université de Strasbourg" }
  },
  "universite-de-tunis-el-manar": {
    displayNames: { fr: "Université de Tunis El Manar" },
    aliases: { fr: ["Tunis El Manar"] }
  },
  "universite-du-quebec": {
    displayNames: { fr: "Université du Québec" },
    aliases: { fr: ["UQ"] }
  },
  "universite-grenoble-alpes": {
    displayNames: { fr: "Université Grenoble Alpes" },
    aliases: { fr: ["UGA"] }
  },
  "universite-laval": {
    displayNames: { fr: "Université Laval" }
  },
  "universite-lumiere-lyon-2": {
    displayNames: { fr: "Université Lumière Lyon 2" },
    aliases: { fr: ["Lyon 2"] }
  },
  "universite-paris-1-pantheon-sorbonne": {
    displayNames: { fr: "Université Paris 1 Panthéon-Sorbonne" },
    aliases: { fr: ["Paris 1", "Panthéon-Sorbonne"] }
  },
  "universite-paris-13-nord": {
    displayNames: { fr: "Université Paris 13 Nord" }
  },
  "universite-paris-cite": {
    displayNames: { fr: "Université Paris Cité" }
  },
  "universite-paris-pantheon-assas": {
    displayNames: { fr: "Université Paris-Panthéon-Assas" },
    aliases: { fr: ["Assas", "Paris 2"] }
  },
  "universite-paris-saclay": {
    displayNames: { fr: "Université Paris-Saclay" },
    aliases: { fr: ["Paris-Saclay"] }
  },
  "universite-paul-sabatier-toulouse-iii": {
    displayNames: { fr: "Université Paul Sabatier Toulouse III" },
    aliases: { fr: ["Toulouse III", "Paul Sabatier"] }
  },
  "universite-psl": {
    displayNames: { fr: "Université PSL" },
    aliases: { fr: ["PSL", "Paris Sciences et Lettres"] }
  },
  "university-of-bordeaux": {
    displayNames: { fr: "Université de Bordeaux" }
  },
  "university-of-chinese-academy-of-sciences-ucas": {
    displayNames: { zh: "中国科学院大学" },
    aliases: { zh: ["国科大", "中国科学院大学"] }
  },
  "university-of-ottawa": {
    displayNames: { fr: "Université d'Ottawa" },
    aliases: { fr: ["uOttawa", "Ottawa"] }
  },
  "university-of-science-and-technology-beijing": {
    displayNames: { zh: "北京科技大学" },
    aliases: { zh: ["北科大"] }
  },
  "university-of-science-and-technology-of-china": {
    displayNames: { zh: "中国科学技术大学" },
    aliases: { zh: ["中科大", "中国科大"] }
  },
  "university-of-warmia-and-mazury-in-olsztyn": {
    displayNames: { pl: "Uniwersytet Warmińsko-Mazurski w Olsztynie" },
    aliases: { pl: ["UWM", "Uniwersytet Warminsko-Mazurski"] }
  },
  "university-of-warsaw": {
    displayNames: { pl: "Uniwersytet Warszawski" },
    aliases: { pl: ["UW", "Uniwersytet Warszawski"] }
  },
  "university-of-wroclaw": {
    displayNames: { pl: "Uniwersytet Wrocławski" },
    aliases: { pl: ["UWr", "Uniwersytet Wroclawski"] }
  },
  "warsaw-university-of-technology": {
    displayNames: { pl: "Politechnika Warszawska" },
    aliases: { pl: ["PW", "Politechnika Warszawska"] }
  },
  "wroclaw-university-of-science-and-technology-wroc-aw-tech": {
    displayNames: { pl: "Politechnika Wrocławska" },
    aliases: { pl: ["PWr", "Politechnika Wroclawska"] }
  },
  "wuhan-university": {
    displayNames: { zh: "武汉大学" },
    aliases: { zh: ["武大"] }
  },
  "xiamen-university": {
    displayNames: { zh: "厦门大学" },
    aliases: { zh: ["厦大"] }
  },
  "xian-jiaotong-university": {
    displayNames: { zh: "西安交通大学" },
    aliases: { zh: ["西交大"] }
  },
  "zhejiang-university": {
    displayNames: { zh: "浙江大学" },
    aliases: { zh: ["浙大"] }
  },
  "zhengzhou-university": {
    displayNames: { zh: "郑州大学" }
  }
};

export function getLocalizedInstitutionName(
  _slug: string,
  fallbackName: string,
  _locale: SupportedLocale
): string {
  // Public display names stay canonical across locales. Localized names remain
  // available below as search aliases, but never replace the source entity name.
  return fallbackName;
}

export function getInstitutionLocalizedAliases(slug: string): string[] {
  const record = records[slug];
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
  locale: SupportedLocale
): string[] {
  if (locale === "en") return [];

  const record = records[slug];
  if (!record) return [];

  return Array.from(
    new Set([
      record.displayNames?.[locale],
      ...(record.aliases?.[locale] ?? [])
    ])
  ).filter((value): value is string => Boolean(value));
}
