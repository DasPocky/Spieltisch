/**
 * Kategorien von Stadt-Land-Fluss und kleine Wortlisten je Kategorie – für die Testspieler (Bots).
 * Wörter durch Leerzeichen getrennt, `_` steht für ein Leerzeichen im Wort.
 */
export interface Kategorie { id: string; name: string; on?: true; kinder?: true; woerter: string }

export const KATEGORIEN: Kategorie[] = [
  { id: "stadt", name: "Stadt", on: true, woerter: "Aachen Augsburg Berlin Bremen Bonn Chemnitz Cottbus Dresden Dortmund Erfurt Essen Frankfurt Freiburg Gera Göttingen Hamburg Hannover Ingolstadt Jena Kiel Köln Leipzig Lübeck München Mainz Nürnberg Oldenburg Osnabrück Paris Potsdam Quedlinburg Rostock Regensburg Stuttgart Saarbrücken Trier Tübingen Ulm Unna Venedig Weimar Wien Xanten Ypern Zürich Zwickau" },
  { id: "land", name: "Land", on: true, woerter: "Argentinien Ägypten Belgien Brasilien China Chile Dänemark Deutschland Estland England Finnland Frankreich Griechenland Ghana Holland Indien Irland Italien Japan Jemen Kanada Kenia Lettland Luxemburg Mexiko Marokko Norwegen Nepal Österreich Oman Polen Peru Katar Russland Rumänien Schweden Spanien Thailand Türkei Ungarn Uganda Vietnam Wales Zypern" },
  { id: "fluss", name: "Fluss", on: true, woerter: "Aller Amazonas Bode Donau Elbe Ems Fulda Ganges Havel Inn Isar Jangtse Kongo Lahn Lech Main Mosel Neckar Nil Oder Oker Po Rhein Ruhr Saale Spree Themse Ufa Unstrut Weser Werra Wolga Yukon Zambezi" },
  { id: "name", name: "Name", on: true, kinder: true, woerter: "Anna Ben Clara David Emma Felix Greta Hannah Ida Jonas Klara Lena Mia Noah Olga Paul Quentin Rosa Sophie Tim Ulla Valentin Wilma Xaver Yara Zoe" },
  { id: "beruf", name: "Beruf", on: true, woerter: "Arzt Bäcker Bauer Chemiker Dachdecker Elektriker Friseur Gärtner Hebamme Imker Juwelier Koch Lehrer Maurer Notar Optiker Pilot Richter Schreiner Tischler Uhrmacher Verkäufer Winzer Zahnarzt Zimmermann" },
  { id: "tier", name: "Tier", on: true, kinder: true, woerter: "Affe Adler Bär Biene Dachs Delfin Elefant Esel Fuchs Frosch Giraffe Gans Hund Hase Igel Jaguar Katze Kuh Löwe Maus Nashorn Otter Pferd Qualle Rabe Schaf Tiger Uhu Vogel Wal Wolf Yak Zebra Ziege" },
  { id: "pflanze", name: "Pflanze", woerter: "Ahorn Birke Buche Distel Eiche Efeu Farn Flieder Geranie Hortensie Iris Jasmin Kaktus Klee Lilie Moos Nelke Orchidee Palme Quecke Rose Sonnenblume Tulpe Ulme Veilchen Weide Zypresse" },
  { id: "obst", name: "Obst & Gemüse", kinder: true, woerter: "Apfel Aubergine Banane Birne Brokkoli Dattel Erbse Erdbeere Feige Gurke Himbeere Ingwer Johannisbeere Kirsche Kartoffel Lauch Mango Möhre Nektarine Olive Paprika Pflaume Quitte Radieschen Spinat Tomate Traube Zitrone Zucchini Zwiebel" },
  { id: "essen", name: "Essen", kinder: true, woerter: "Auflauf Brot Brezel Curry Eintopf Frikadelle Gulasch Hamburger Joghurt Kuchen Käse Lasagne Müsli Nudeln Omelett Pizza Pfannkuchen Quark Reis Suppe Spaghetti Toast Waffel Wurst Zwieback" },
  { id: "getraenk", name: "Getränk", woerter: "Apfelsaft Buttermilch Cola Eistee Espresso Fruchtsaft Grog Kaffee Kakao Limonade Milch Most Orangensaft Punsch Saft Sprudel Tee Tomatensaft Wasser Wein Zitronenlimo" },
  { id: "sport", name: "Sportart", woerter: "Angeln Badminton Basketball Boxen Curling Eishockey Fechten Fußball Golf Handball Hockey Judo Joggen Karate Klettern Laufen Minigolf Nordic_Walking Polo Reiten Rudern Schwimmen Tennis Turnen Volleyball Wandern Yoga Zehnkampf" },
  { id: "gegenstand", name: "Gegenstand", kinder: true, woerter: "Ball Becher Bleistift Decke Eimer Fahrrad Gabel Hammer Kissen Kerze Lampe Löffel Messer Nagel Ofen Pinsel Radiergummi Schere Stuhl Tasse Teller Uhr Vase Wecker Zange" },
  { id: "koerper", name: "Körperteil", kinder: true, woerter: "Arm Auge Bauch Bein Daumen Ellbogen Ferse Finger Fuß Hals Hand Kinn Knie Kopf Lippe Mund Nase Ohr Po Rücken Schulter Wade Zahn Zeh Zunge" },
  { id: "instrument", name: "Instrument", woerter: "Akkordeon Banjo Bratsche Cello Dudelsack Flöte Geige Gitarre Harfe Horn Klavier Kontrabass Mandoline Mundharmonika Orgel Pauke Posaune Saxofon Trommel Trompete Tuba Ukulele Xylofon Zither" },
  { id: "kleidung", name: "Kleidung", woerter: "Anzug Bluse Gürtel Handschuh Hemd Hose Hut Jacke Jeans Kleid Krawatte Mantel Mütze Pullover Rock Sandale Schal Schuh Socke Stiefel Tuch Unterhemd Weste Zipfelmütze" },
  { id: "spielzeug", name: "Spielzeug", kinder: true, woerter: "Ball Bauklotz Drachen Eisenbahn Flummi Kreisel Murmel Puppe Puzzle Rassel Roller Schaukel Teddy Trampolin Würfel Wippe Zauberwürfel" },
  { id: "hobby", name: "Hobby", woerter: "Angeln Backen Basteln Fotografieren Gärtnern Häkeln Kochen Lesen Malen Nähen Puzzeln Reisen Singen Stricken Tanzen Töpfern Wandern Zeichnen Zaubern" },
];

export const KAT_BY_ID = Object.fromEntries(KATEGORIEN.map((k) => [k.id, k])) as Record<string, Kategorie>;

/** Wortliste einer Kategorie (eingebaut; eigene Kategorien haben keine) */
export function woerterOf(name: string): string[] {
  const k = KATEGORIEN.find((x) => x.name === name);
  return k ? k.woerter.split(" ").map((w) => w.replace(/_/g, " ")) : [];
}
