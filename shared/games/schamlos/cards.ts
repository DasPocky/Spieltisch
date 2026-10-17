/**
 * Karten für Schamlos – alle Texte selbst geschrieben. Schwarze Karten haben Lücken („___“), weiße Karten füllen sie.
 * Eine Karte wird über ihre ID angesprochen: Stufe, Farbe und Nummer, z. B. „a-w-12“ (Für alle, weiß, Nr. 12).
 * Neue Karten einfach hinten anhängen – so bleiben die IDs laufender Partien gültig.
 */
export type Tier = "alle" | "ab18" | "plus";

const BLANK = "___";

/** Stufe „Für alle“: frech, aber für jede Runde */
const ALLE_BLACK = [
  "Was ich nie wieder im Familienchat schreiben werde: ___.",
  "Meine geheime Superkraft: ___.",
  "Oma hat beim Kaffeeklatsch plötzlich ___ erwähnt.",
  "Der neue Trend aus dem Internet: ___.",
  "Warum bin ich zu spät? ___.",
  "Das Geheimnis einer glücklichen Ehe: ___.",
  "Im Urlaub habe ich gelernt: ___ ist keine gute Idee.",
  "Was riecht hier so? ___.",
  "Mein Lebenslauf, Lücke von 2019 bis 2021: ___.",
  "Der Elternabend eskalierte wegen ___.",
  "Das Motto der nächsten Betriebsfeier: ___.",
  "Ich wollte nur kurz einkaufen und kam mit ___ zurück.",
  "Was der Hund wirklich denkt: ___.",
  "Die neue Folge Kochshow: Heute gibt es ___.",
  "Mein Therapeut sagt, ich soll weniger über ___ reden.",
  "Das schönste Weihnachtsgeschenk aller Zeiten: ___.",
  "Hinter dem Sofa lag die ganze Zeit ___.",
  "Ich gründe ein Start-up für ___.",
  "Der wahre Grund, warum die Dinosaurier ausgestorben sind: ___.",
  "Auf meinem Grabstein soll stehen: ___.",
  "Das Navi sagte: „Nach 300 Metern ___.“",
  "Was man beim ersten Date auf keinen Fall erwähnen sollte: ___.",
  "Der Nachbar hat sich schon wieder über ___ beschwert.",
  "Mein Plan für die Rente: ___.",
  "Die Bahn entschuldigt sich für ___.",
  "Statt Hausaufgaben habe ich ___ gemacht.",
  "Das neue Brettspiel heißt: „___ – Das Spiel“.",
  "Was im Kühlschrank leuchtet: ___.",
  "Die Wissenschaft bestätigt: ___ macht glücklich.",
  "Was ist mein Lieblingsgeräusch? ___.",
  "Auf dem Klassenfoto sieht man im Hintergrund ___.",
  "Ich habe meinen WLAN-Namen in „___“ geändert.",
  "Erst ___, dann ___. So läuft das bei uns.",
  "Mein Wochenende in zwei Worten: ___ und ___.",
  "Das Rezept meiner Oma: ___ mit einer Prise ___.",
  "Wer ___ sagt, muss auch ___ sagen.",
  "Neu im Supermarkt: ___ im Sonderangebot.",
  "Mein Horoskop warnt mich vor ___.",
  "Die Hochzeitsrede ging schief wegen ___.",
  "Was ich mit einer Million machen würde: ___.",
  "Ich habe im Schlaf über ___ geredet.",
  "Der Zoo hat ein neues Gehege für ___.",
  "Beim Umzug ist uns ___ aus dem Fenster gefallen.",
  "Mein Lieblingsfach in der Schule war ___.",
  "Das Geräusch aus dem Keller war in Wahrheit ___.",
];

const ALLE_WHITE = [
  "Socken in Sandalen", "ein Toaster mit Gefühlen", "Tante Gerdas Kartoffelsalat", "ein sehr selbstbewusster Pinguin", "die Steuererklärung",
  "Bauchtanz im Treppenhaus", "drei Waschbären im Mantel", "ein verlorener Handschuh", "das letzte Stück Pizza", "Rasenmähen um sieben Uhr morgens",
  "eine Sprachnachricht von zwölf Minuten", "Opas Witze", "ein Einhorn mit Rückenschmerzen", "Glitzer. Überall Glitzer.", "ein Hamster im Laufrad der Macht",
  "der Kassenzettel vom Baumarkt", "eine sehr enge Jeans", "Pfannkuchen zum Abendessen", "ein Gartenzwerg mit Geheimnissen", "der Wäscheberg",
  "lautes Schmatzen", "Karaoke ohne Talent", "ein Schrank voller Plastiktüten", "die Fernbedienung, die nie da ist", "eine Ziege im Wohnzimmer",
  "Mamas Lieblingskind", "ein Tag ohne Handy", "Kekskrümel im Bett", "eine Hupe aus Gummi", "der Elternabend",
  "zu viel Knoblauch", "eine Hängematte aus Spaghetti", "das Faultier im Büro", "eine Polonaise durchs Wartezimmer", "ein Kuchen, der wie ein Schuh aussieht",
  "Rückwärts einparken", "der Mann mit dem Laubbläser", "ein Lama mit Sonnenbrille", "Mittagsschlaf um elf", "die Nachbarskatze",
  "ein Kaktus, der Liebe braucht", "Fischbrötchen im Zug", "eine heimliche Leidenschaft für Schlager", "die Gurkenmaske", "ein Ventilator voller Konfetti",
  "Hüpfburg für Erwachsene", "Kindergeburtstag mit Clown", "der Duft von frischem Asphalt", "ein Pferd namens Klaus", "Wollmäuse unter dem Sofa",
  "Dosenravioli kalt aus der Dose", "ein Vortrag über Briefmarken", "Tanzen wie niemand zuschaut, obwohl alle zuschauen", "ein Krokodil in der Badewanne", "Mett mit Zwiebeln",
  "der Bus, der gerade wegfährt", "ein Selfie mit dem Bürgermeister", "Opa auf dem E-Scooter", "zu viele Kissen", "eine Bauchlandung im Freibad",
  "Spinat zwischen den Zähnen", "ein Saunaaufguss mit Eukalyptus", "Wanderschuhe im Restaurant", "die Schwiegermutter", "ein Igel im Gartenschlauch",
  "Matheunterricht am Freitagnachmittag", "ein Geburtstagsständchen in vier Tonarten", "Schuhe, die quietschen", "ein Raumschiff aus Pappe", "Brokkoli",
  "ein geheimer Tanz in der Küche", "Kaffee aus der Thermoskanne", "ein Regenschirm, der nach außen klappt", "der Kollege, der immer \"Mahlzeit\" sagt", "ein Stau auf der A7",
  "der Duft von Großmutters Keller", "Lockenwickler beim Bäcker", "eine Möwe mit Pommes", "ein ausgestopftes Wildschwein", "Schlafanzug den ganzen Sonntag",
  "eine sehr laute Kaffeemaschine", "Schnecken nach dem Regen", "zwei linke Hände", "der Bausatzschrank mit einer Schraube zu viel", "ein Feuerwerk an Ostern",
  "die Nachbarin mit dem Fernglas", "Strickpulli mit Rentier", "Fußball im Wohnzimmer", "ein schlecht gelaunter Schwan", "Kartoffelchips im Bett",
  "ein Postbote auf Rollschuhen", "ein Gartenteich voller Goldfische", "die Weihnachtsdeko im Juli", "eine Handvoll Gummibärchen", "Barfuß auf Bauklötzen",
  "der lauteste Nieser der Welt", "ein Toupet im Wind", "Sonnenbrand in Form einer Badehose", "Mittelalter-Markt", "eine Seifenblasenmaschine",
  "Schluckauf beim Vorstellungsgespräch", "ein Kühlschrank voller Senf", "ein Dackel in Gummistiefeln", "eine Bratwurst im Brötchen", "ein Gruppenfoto, auf dem einer blinzelt",
  "die Fernsehzeitschrift von 1998", "Hausschuhe mit Hasenohren", "ein Gewinnspiel-Anruf", "eine Pyramide aus Klopapier", "Popcorn im Kino-Sitz",
  "ein Wackelpudding mit Persönlichkeit", "eine Bärenumarmung", "ein Fahrrad ohne Sattel", "der Wecker, den keiner hört", "Lametta",
  "ein Wal im Gartenpool", "Aerobic-Video aus den Achtzigern", "zu viel Parfüm im Aufzug", "eine Kuh auf der Autobahn", "die Lieblingstasse vom Chef",
  "ein Fallschirmsprung im Pyjama", "Spaghetti mit Ketchup", "ein Roboterstaubsauger mit Ehrgeiz", "eine Ritterrüstung", "Händchenhalten im Wartezimmer",
  "die Oma mit dem Motorrad", "ein Papagei, der alles nachplappert", "Blockflötenkonzert", "der Schlüssel, der immer in der anderen Jacke ist", "eine Ente im Kofferraum",
  "Nacktschnecken im Salat", "Hüttenzauber", "ein Bauch voller Schmetterlinge", "die Klassenfahrt nach Hamburg", "ein Pinguin im Smoking",
];

/** Stufe „Ab 18“ – für Freunde: Alkohol, schwarzer Humor, deftige Sprache */
const AB18_BLACK = [
  "Was ich nach dem dritten Glas Wein für eine gute Idee hielt: ___.",
  "Die Polizei fand in meinem Kofferraum ___.",
  "Meine Ex hat mich verlassen wegen ___.",
  "Was auf der Junggesellenabschiedsfahrt passiert, bleibt bei ___.",
  "Kater-Frühstück de luxe: ___.",
  "Im Testament steht: Alles erbt ___.",
  "Das Geheimnis hinter Onkel Heinz' guter Laune: ___.",
  "Der Arzt sagt, es ist nicht schlimm, aber ___.",
  "Meine Mitbewohner haben einen Gruppenchat über ___.",
  "Das stand in der Bewertung der Ferienwohnung: ___.",
  "Ich kann nicht schlafen, weil ___.",
  "Auf der Firmenfeier hat der Chef ___ gemacht.",
  "Der wahre Grund für meine Scheidung: ___.",
  "Mein Browserverlauf besteht zu 80 % aus ___.",
  "Ich schwöre, das war nur ___!",
  "Neues Trinkspiel: Bei ___ wird getrunken.",
  "Was ich um vier Uhr nachts bestellt habe: ___.",
  "Die Hausratversicherung zahlt nicht für ___.",
  "Im Darkroom des Lebens wartet ___.",
  "Mein Dating-Profil verschweigt ___.",
  "Das Schlimmste an Familienfesten: ___.",
  "Erst ___, dann ___, dann Kopfschmerzen.",
  "Mein Lebensmotto: Lieber ___ als ___.",
  "Die Bahnhofstoilette hat mir ___ beigebracht.",
  "Was ich im Rausch tätowieren ließ: ___.",
  "Der Notarzt fragte nur: „Wie kam ___ da hinein?“",
  "Meine Mutter darf niemals von ___ erfahren.",
  "Das neue Kinderbuch heißt: „___ für Anfänger“.",
  "Was mir beim Klassentreffen den Abend rettete: ___.",
  "Der Geruch nach der Party: ___.",
  "Ich bin nicht betrunken, ich bin nur ___.",
  "Vorsatz fürs neue Jahr: weniger ___.",
];

const AB18_WHITE = [
  "ein Schnaps zu viel", "der Kater des Jahrhunderts", "Karaoke mit dem Ex", "ein Döner um drei Uhr nachts", "die Steuerfahndung",
  "Fremdschämen auf Weltklasse-Niveau", "ein Tattoo mit Rechtschreibfehler", "Opas geheime Schnapsvorräte", "die Nachricht, die ich nie hätte schicken sollen", "Pfefferspray",
  "Bierbauch mit Stolz", "das Schweigen nach einem schlechten Witz", "ein Schwiegersohn mit Vorstrafen", "die Midlife-Crisis im Cabrio", "Lügen auf dem Lebenslauf",
  "Bierpong im Altersheim", "ein Haftbefehl", "der Mülleimer als Toilette", "Schadenfreude", "der Ausschnitt der Nachbarin",
  "Nasenhaare", "Hosen, die nach hinten offen sind", "ein Saunabesuch mit Kollegen", "Rülpsen auf Kommando", "Kotzen in die Handtasche",
  "Schuldgefühle am Sonntagmorgen", "der Typ, der beim Grillen alles besser weiß", "eine Polonaise in Unterhose", "Wodka aus dem Tetrapak", "Vatertag",
  "ein Fußpilz-Spray", "die Hämorrhoidensalbe", "Fäkalhumor", "ein Baustellenklo im Hochsommer", "Mamas Telefonnummer im Notfall",
  "betrunkene Liebesbriefe", "Selbstmitleid mit Eiscreme", "ein Shot mit dem Pfarrer", "Kater-Pommes", "Sauftour auf Mallorca",
  "ein Junggesellinnenabschied mit Penis-Strohhalm", "der Kumpel, der immer kotzt", "Unterwäsche vom Discounter", "Schweißflecken", "Zahlungserinnerung Nummer drei",
  "das Ordnungsamt", "Ausnüchterungszelle", "die Hochzeit, bei der keiner nüchtern war", "Klopapier-Hamsterkäufe", "ein Hexenschuss beim Tanzen",
  "Furzen im Aufzug", "der Chef im Tigerstring", "Botox beim Discounter", "eine Abmahnung", "ein Hundehaufen im Profil der Schuhsohle",
  "Ich-hab-ja-nichts-gegen-aber-Leute", "Wein aus der Gießkanne", "Pinkeln im Pool", "das Blind Date, das seine Mutter mitbringt", "Kreditkartenschulden",
  "Kotelett am Spieß", "ein Gentest mit Überraschungen", "Erbschleicher", "eine Prügelei im Supermarkt", "Kurzurlaub in der Ausnüchterungszelle",
  "Partyfotos von 2009", "Fernbeziehung mit dem Kühlschrank", "der Vermieter mit Zweitschlüssel", "Darmspiegelung", "Wetten, dass ich das trinke?",
  "Schwarzfahren", "ein Kondom im Portemonnaie seit 2012", "die Nachbarn beim Streiten belauschen", "Saufen wie ein Matrose", "eine Beerdigung mit Open Bar",
  "Brusthaar-Toupet", "Duschen zu dritt, aus Wassersparen", "der Bierdeckel mit meiner Telefonnummer", "ein Strafzettel vom Ordnungsamt", "Bierdusche",
  "Schlafen auf dem Badezimmerboden", "der Morgen danach", "ein Ehevertrag", "Lästern über die Schwägerin", "Stripclub-Gutscheine",
  "Spucke auf dem Taschentuch", "eine Zahnlücke vom letzten Junggesellenabschied", "Glühwein mit Schuss", "Peinliche Tanzvideos", "die Rechnung für alle",
  "das letzte Bier im Kühlschrank", "Sitzpinkler", "ein Mettigel", "Schweigeminute für die Leber", "Saunanacktheit",
  "Spontanurlaub ohne Pass", "ein Mann namens Kevin", "die Nacht, an die sich keiner erinnert", "zu ehrliche Freunde", "Sekt zum Frühstück",
];

/** Stufe „Feuchtfröhlich“ – für Freundschaft plus und mehr: frivol und zweideutig, aber nie gemein */
const PLUS_BLACK = [
  "Was ich im Schlafzimmer niemals laut sagen würde: ___.",
  "Mein geheimes Ritual vor dem ersten Date: ___.",
  "Das stand auf dem Zettel am Morgen danach: ___.",
  "Die Nachbarn haben sich beschwert. Wegen ___.",
  "Neu im Erotikshop: ___.",
  "Mein Safeword ist ___.",
  "Was in die Nachttischschublade gehört: ___.",
  "Das romantischste Wochenende: ___ und viel ___.",
  "Freundschaft plus, Regel Nummer eins: ___.",
  "Im Whirlpool ist es passiert: ___.",
  "Statt Blumen schenke ich lieber ___.",
  "Das sexy Rollenspiel heute Abend: ___.",
  "Er wollte Kuscheln. Sie wollte ___.",
  "Was ich mir für die Hochzeitsnacht vorgenommen habe: ___.",
  "Was im Flirtkurs als Erstes gelehrt wird: ___.",
  "So weckt man mich am liebsten: ___.",
  "Meine Fantasie, über die ich nur betrunken spreche: ___.",
  "Die Dating-App hat mich mit ___ gematcht.",
  "Die Stimmung war perfekt, bis ___.",
  "Erst ___, dann ___, dann eine Zigarette.",
  "Was beim Strip-Poker als Erstes fällt: ___.",
  "Auf der Packung stand: „Vorsicht, ___!“",
  "Der beste Anmachspruch aller Zeiten: „Du bist wie ___.“",
  "Der Grund für den Muskelkater: ___.",
  "Mein Liebesleben in drei Worten: ___.",
];

const PLUS_WHITE = [
  "Handschellen mit Plüsch", "ein sehr langer Kuss", "Massageöl mit Erdbeerduft", "die Löffelchenstellung", "Schlagsahne auf Abwegen",
  "der Blick über den Rand der Brille", "Rotwein und Kerzen", "ein Spiegel an der Decke", "Knutschflecken am Montag", "ein Striptease mit Krampf im Bein",
  "Dirty Talk mit Rechtschreibfehlern", "das Bettgestell, das quietscht", "eine Augenbinde", "der Duft nach Sonntagmorgen", "Nacktbaden um Mitternacht",
  "Kuscheln mit Hintergedanken", "ein Seidenschal", "der Spitzen-BH der Nachbarin", "eine zu enge Lederhose", "Federn an den falschen Stellen",
  "das Wasserbett", "Liebesgeflüster ins falsche Ohr", "Morgengymnastik zu zweit", "Fesselspiele mit Krawatten", "ein Quickie in der Mittagspause",
  "der letzte Knopf", "Gänsehaut", "ein Kamasutra-Buch mit Eselsohren", "eine Dusche zu zweit", "Rollenspiele als Postbote",
  "die Hand auf dem Knie", "ein heißer Atem im Nacken", "Fußmassage, die eskaliert", "Champagner aus dem Bauchnabel", "Erdbeeren mit Hintergedanken",
  "das Wort „Hoppla“ im falschen Moment", "Liebesbriefe mit Duft", "der Reißverschluss, der klemmt", "Unterwäsche mit Leopardenmuster", "ein Hotelzimmer mit dünnen Wänden",
  "der Kuss, der zu lange dauert", "ein zufälliger Blick unter den Tisch", "Nacktputzen", "ein Body-Painting-Set", "zu viel Gleitgel",
  "die Ex im Chat", "die Nacht im Zelt", "Sexy Weihnachtsmann-Kostüm", "ein Lapdance mit Hexenschuss", "Kitzeln bis zum Ende",
  "das Kopfteil des Bettes, das gegen die Wand klopft", "die Nachbarn klopfen zurück", "Strapse", "Herzklopfen im Aufzug", "ein Zungenkuss mit Zahnspange",
  "Flirten mit dem Pizzaboten", "Massage mit Happy End", "ein neues Spielzeug mit Batterien", "Couchgeflüster", "Löffeln bis zum Mittag",
  "das Licht bleibt an", "ein Stöhnen aus Versehen", "Nacktschnecken-Tempo", "Sauna für zwei", "ein Zettel mit „Ruf mich an“",
  "eine Nacht ohne Schlaf", "Frühstück im Bett, mit Krümeln überall", "Handtuch statt Kleid", "die Ausrede „Ich hab Migräne“", "Stellungswechsel",
  "der zweite Versuch", "eine Wette mit Einsatz", "die Kissenschlacht in Unterwäsche", "Schmusen im Kino", "Kerzenwachs",
  "Liebe auf den ersten Wisch", "der Kuss auf den Hals", "Bettgeflüster", "gemeinsam Zähneputzen nach der ersten Nacht", "Schwitzen ohne Sport",
];

type Deck = { black: string[]; white: string[] };

const TEXTS: Record<string, string[]> = {
  "a-b": ALLE_BLACK, "a-w": ALLE_WHITE,
  "e-b": AB18_BLACK, "e-w": AB18_WHITE,
  "p-b": PLUS_BLACK, "p-w": PLUS_WHITE,
};

const ids = (prefix: string) => TEXTS[prefix].map((_, i) => `${prefix}-${i}`);
const TIER_PREFIX: Record<Tier, string[]> = { alle: ["a"], ab18: ["a", "e"], plus: ["a", "e", "p"] };

/** Alle Karten einer Stufe – höhere Stufen spielen die Karten der darunter mit */
export function deckFor(tier: Tier): Deck {
  const pre = TIER_PREFIX[tier] ?? TIER_PREFIX.alle;
  return { black: pre.flatMap((p) => ids(`${p}-b`)), white: pre.flatMap((p) => ids(`${p}-w`)) };
}

/** Text einer Karte */
export function cardText(id: string): string {
  const i = id.lastIndexOf("-");
  return TEXTS[id.slice(0, i)]?.[Number(id.slice(i + 1))] ?? "";
}

/** Wie viele Lücken eine schwarze Karte hat (mindestens eine – ohne Lücke kommt die Antwort ans Ende) */
export function blanksOf(id: string): number {
  return Math.max(1, cardText(id).split(BLANK).length - 1);
}

/** Satz mit eingesetzten Antworten, als Stücke (für Hervorhebung): `fill` markiert die eingesetzten Teile */
export function fillIn(prompt: string, answers: string[]): { text: string; fill: boolean }[] {
  const text = cardText(prompt);
  const parts = text.split(BLANK);
  const words = answers.map(cardText);
  if (parts.length === 1) return [{ text: `${text} `, fill: false }, { text: words.join(" "), fill: true }];
  const out: { text: string; fill: boolean }[] = [];
  parts.forEach((p, i) => {
    // Am Satzanfang groß schreiben
    if (p) out.push({ text: p, fill: false });
    if (i < parts.length - 1) {
      let w = words[i] ?? BLANK;
      if (i === 0 && !p) w = w.charAt(0).toUpperCase() + w.slice(1);
      out.push({ text: w, fill: true });
    }
  });
  return out;
}
