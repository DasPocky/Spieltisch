import type { FragenKategorie } from "./typen";

export const SPRACHE: FragenKategorie = {
  id: "sprache",
  name: "Sprache & Wörter",
  emoji: "🔤",
  stufe: "familie",
  fragen: [
    ["Aus welcher Sprache hat das Englische das Wort „Kindergarten“ übernommen?", "Deutsch", "Niederländisch", "Dänisch", "Schwedisch"], // Quelle: https://de.wikipedia.org/wiki/Kindergarten
    ["Aus welcher Sprache stammt das Wort „Schokolade“ ursprünglich?", "Nahuatl", "Arabisch", "Latein", "Persisch"], // Quelle: https://de.wikipedia.org/wiki/Schokolade
    ["Aus welcher Sprache stammt das Wort „Algebra“?", "Arabisch", "Griechisch", "Latein", "Hebräisch"], // Quelle: https://de.wikipedia.org/wiki/Algebra
    ["Aus welcher Sprache stammt das Wort „Tee“ letztlich?", "Chinesisch", "Hindi", "Arabisch", "Japanisch"], // Quelle: https://de.wikipedia.org/wiki/Tee
    ["Aus welcher Sprache stammt das Wort „Tsunami“?", "Japanisch", "Indonesisch", "Hawaiisch", "Chinesisch"], // Quelle: https://de.wikipedia.org/wiki/Tsunami
    ["Aus welcher Sprache stammt das Wort „Karaoke“?", "Japanisch", "Koreanisch", "Chinesisch", "Thai"], // Quelle: https://de.wikipedia.org/wiki/Karaoke
    ["Aus welcher Sprache stammt das Wort „Iglu“?", "Inuktitut", "Finnisch", "Russisch", "Samisch"], // Quelle: https://de.wikipedia.org/wiki/Iglu
    ["Aus welcher Sprache stammt das Wort „Kaffee“ letztlich?", "Arabisch", "Italienisch", "Spanisch", "Griechisch"], // Quelle: https://de.wikipedia.org/wiki/Kaffee
    ["Aus welcher Sprache stammt das Wort „Safari“?", "Swahili", "Afrikaans", "Hindi", "Zulu"], // Quelle: https://de.wikipedia.org/wiki/Safari
    ["Aus welcher Sprache stammt das Wort „Ski“?", "Norwegisch", "Finnisch", "Russisch", "Französisch"], // Quelle: https://de.wikipedia.org/wiki/Ski
    ["Aus welcher Sprache stammt das Wort „Roboter“?", "Tschechisch", "Russisch", "Englisch", "Japanisch"], // Quelle: https://de.wikipedia.org/wiki/Roboter
    ["Aus welcher Sprache stammt das Wort „Joghurt“?", "Türkisch", "Griechisch", "Bulgarisch", "Persisch"], // Quelle: https://de.wikipedia.org/wiki/Joghurt
    ["Aus welcher Sprache stammt das Wort „Siesta“?", "Spanisch", "Italienisch", "Portugiesisch", "Französisch"], // Quelle: https://de.wikipedia.org/wiki/Siesta
    ["Aus welcher Sprache stammt das Wort „Kosmos“?", "Griechisch", "Latein", "Arabisch", "Hebräisch"], // Quelle: https://de.wikipedia.org/wiki/Kosmos
    ["Was bedeutet „Demokratie“ wörtlich?", "Volksherrschaft", "Königsherrschaft", "Gottesherrschaft", "Geldherrschaft"], // Quelle: https://de.wikipedia.org/wiki/Demokratie
    ["Was bedeutet „Philosophie“ wörtlich?", "Liebe zur Weisheit", "Lehre vom Sein", "Kunst des Denkens", "Wissen der Alten"], // Quelle: https://de.wikipedia.org/wiki/Philosophie
    ["Was bedeutet „Biologie“ wörtlich?", "Lehre vom Leben", "Lehre von den Tieren", "Lehre vom Körper", "Lehre vom Wachsen"], // Quelle: https://de.wikipedia.org/wiki/Biologie
    ["Was bedeutet „Geographie“ wörtlich?", "Erdbeschreibung", "Steinkunde", "Kartenkunst", "Himmelskunde"], // Quelle: https://de.wikipedia.org/wiki/Geographie
    ["Was bedeutet „Telefon“ wörtlich?", "Fern-Stimme", "Draht-Ton", "Schnell-Wort", "Weit-Ohr"], // Quelle: https://de.wikipedia.org/wiki/Telefon
    ["Was bedeutet „Veni, vidi, vici“?", "Ich kam, ich sah, ich siegte", "Ich lebte, ich liebte, ich lachte", "Ich kam, ich ging, ich blieb", "Ich sah, ich staunte, ich ging"], // Quelle: https://de.wikipedia.org/wiki/Veni,_vidi,_vici
    ["Was bedeutet „ad acta“?", "Zu den Akten", "Zur Tat", "Nach dem Gesetz", "Für immer"], // Quelle: https://de.wikipedia.org/wiki/Ad_acta
    ["Was bedeutet „in vino veritas“?", "Im Wein liegt die Wahrheit", "Wein macht froh", "Trinke mit Maß", "Wahrheit ist bitter"], // Quelle: https://de.wikipedia.org/wiki/In_vino_veritas
    ["Was bedeutet „per pedes“?", "Zu Fuß", "Mit dem Pferd", "Auf dem Schiff", "Im Wagen"], // Quelle: https://de.wikipedia.org/wiki/Liste_lateinischer_Phrasen/P
    ["Welches deutsche Wort für Furcht ist auch im Englischen gebräuchlich?", "Angst", "Furcht", "Bange", "Schreck"], // Quelle: https://de.wikipedia.org/wiki/Angst
    ["Ergänze: Jemandem einen … aufbinden (ihn anlügen).", "Bären", "Hund", "Esel", "Floh"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Die … im Sack kaufen (ungeprüft kaufen).", "Katze", "Maus", "Gans", "Ziege"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: … auf den Augen haben (etwas nicht bemerken).", "Tomaten", "Gurken", "Bohnen", "Erbsen"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Den … vor lauter Bäumen nicht sehen.", "Wald", "Weg", "Berg", "Himmel"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Etwas auf die lange … schieben (aufschieben).", "Bank", "Leiter", "Straße", "Seite"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Jemandem reinen … einschenken (die Wahrheit sagen).", "Wein", "Wasser", "Tee", "Saft"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Mit jemandem ein … zu rupfen haben.", "Hühnchen", "Gänschen", "Täubchen", "Entchen"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Haare auf den … haben (resolut sein).", "Zähnen", "Ohren", "Händen", "Füßen"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Sich ins … legen (sich anstrengen).", "Zeug", "Bett", "Feld", "Gras"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Die … ins Korn werfen (aufgeben).", "Flinte", "Mütze", "Sense", "Hacke"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Wie auf glühenden … sitzen (ungeduldig sein).", "Kohlen", "Nadeln", "Steinen", "Platten"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Ein Brett vor dem … haben (begriffsstutzig sein).", "Kopf", "Bauch", "Fenster", "Herzen"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Unter einer … stecken (gemeinsame Sache machen).", "Decke", "Mütze", "Brücke", "Plane"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Seinen … dazugeben (ungefragt mitreden).", "Senf", "Pfeffer", "Zucker", "Quark"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Ins … beißen (sterben).", "Gras", "Holz", "Brot", "Kissen"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Den … zum Gärtner machen.", "Bock", "Hund", "Fuchs", "Hasen"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Da liegt der … begraben (das ist der Kern der Sache).", "Hund", "Hase", "Bär", "Esel"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Perlen vor die … werfen.", "Säue", "Hunde", "Gänse", "Hühner"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Eulen nach … tragen (Überflüssiges tun).", "Athen", "Rom", "Sparta", "Troja"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Ergänze: Die … aus dem Sack lassen (ein Geheimnis verraten).", "Katze", "Maus", "Ratte", "Taube"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Was bedeutet „Schwein haben“?", "Glück haben", "Pech haben", "Hunger haben", "Schmutzig sein"], // Quelle: https://de.wikipedia.org/wiki/Liste_deutscher_Redewendungen
    ["Wie viele grammatische Fälle hat das Deutsche?", "Vier", "Drei", "Fünf", "Sechs"], // Quelle: https://de.wikipedia.org/wiki/Kasus
    ["Wie heißt der zweite Fall im Deutschen?", "Genitiv", "Dativ", "Akkusativ", "Nominativ"], // Quelle: https://de.wikipedia.org/wiki/Genitiv
    ["Nach welchem Fall fragt man mit „Wem?“", "Dativ", "Genitiv", "Akkusativ", "Nominativ"], // Quelle: https://de.wikipedia.org/wiki/Dativ
    ["Nach welchem Fall fragt man mit „Wen oder was?“", "Akkusativ", "Dativ", "Genitiv", "Nominativ"], // Quelle: https://de.wikipedia.org/wiki/Akkusativ
    ["Wie heißt der erste Fall im Deutschen?", "Nominativ", "Genitiv", "Dativ", "Akkusativ"], // Quelle: https://de.wikipedia.org/wiki/Nominativ
    ["Wie heißt ein „Tunwort“ in der Grammatik?", "Verb", "Substantiv", "Adjektiv", "Adverb"], // Quelle: https://de.wikipedia.org/wiki/Verb
    ["Wie heißt ein „Wiewort“ in der Grammatik?", "Adjektiv", "Verb", "Pronomen", "Artikel"], // Quelle: https://de.wikipedia.org/wiki/Adjektiv
    ["Wie heißt ein „Namenwort“ in der Grammatik?", "Substantiv", "Verb", "Pronomen", "Präposition"], // Quelle: https://de.wikipedia.org/wiki/Substantiv
    ["Zu welcher Wortart gehören „ich“, „du“ und „er“?", "Pronomen", "Artikel", "Präposition", "Konjunktion"], // Quelle: https://de.wikipedia.org/wiki/Personalpronomen
    ["Zu welcher Wortart gehören „und“, „oder“ und „aber“?", "Konjunktion", "Präposition", "Artikel", "Adverb"], // Quelle: https://de.wikipedia.org/wiki/Konjunktion_(Wortart)
    ["Zu welcher Wortart gehören „auf“, „unter“ und „neben“?", "Präposition", "Konjunktion", "Pronomen", "Artikel"], // Quelle: https://de.wikipedia.org/wiki/Pr%C3%A4position
    ["Welche Zeitform ist „ich war gegangen“?", "Plusquamperfekt", "Perfekt", "Präteritum", "Futur II"], // Quelle: https://de.wikipedia.org/wiki/Plusquamperfekt
    ["Welche Zeitform ist „ich werde gegangen sein“?", "Futur II", "Futur I", "Perfekt", "Plusquamperfekt"], // Quelle: https://de.wikipedia.org/wiki/Futur_II
    ["Welche Zeitform ist „ich ging“?", "Präteritum", "Perfekt", "Präsens", "Plusquamperfekt"], // Quelle: https://de.wikipedia.org/wiki/Pr%C3%A4teritum
    ["Wie heißt die Möglichkeitsform des Verbs?", "Konjunktiv", "Imperativ", "Indikativ", "Infinitiv"], // Quelle: https://de.wikipedia.org/wiki/Konjunktiv
    ["Wie heißt die Befehlsform des Verbs?", "Imperativ", "Konjunktiv", "Indikativ", "Partizip"], // Quelle: https://de.wikipedia.org/wiki/Imperativ_(Modus)
    ["Wie heißt die Grundform eines Verbs wie „laufen“?", "Infinitiv", "Imperativ", "Partizip", "Konjunktiv"], // Quelle: https://de.wikipedia.org/wiki/Infinitiv
    ["Ergänze die Steigerung: gut, besser, …", "am besten", "am gütesten", "am bessersten", "am guttesten"], // Quelle: https://de.wikipedia.org/wiki/Komparation
    ["Wie heißt die höchste Steigerungsstufe, etwa „am schnellsten“?", "Superlativ", "Komparativ", "Positiv", "Diminutiv"], // Quelle: https://de.wikipedia.org/wiki/Komparation
    ["Wie lautet eine richtige Mehrzahl von „Visum“?", "Visa", "Visums", "Visümer", "Visas"], // Quelle: https://de.wikipedia.org/wiki/Visum
    ["Wie lautet eine richtige Mehrzahl von „Kaktus“?", "Kakteen", "Kaktä", "Kaktusen", "Kaktüsser"], // Quelle: https://de.wikipedia.org/wiki/Kakteengew%C3%A4chse
    ["Wie lautet die Mehrzahl von „Museum“?", "Museen", "Museums", "Musea", "Museumer"], // Quelle: https://de.wikipedia.org/wiki/Museum
    ["Wie heißt der Satzteil, der angibt, wer oder was handelt?", "Subjekt", "Prädikat", "Objekt", "Attribut"], // Quelle: https://de.wikipedia.org/wiki/Subjekt_(Grammatik)
    ["Wie viele grammatische Geschlechter kennt das Deutsche?", "Drei", "Zwei", "Vier", "Eins"], // Quelle: https://de.wikipedia.org/wiki/Genus
    ["Welches grammatische Geschlecht hat „das Mädchen“?", "Neutrum", "Femininum", "Maskulinum", "Utrum"], // Quelle: https://de.wikipedia.org/wiki/Genus
    ["Was bedeutet „obsolet“?", "Veraltet", "Neuartig", "Unklar", "Wichtig"], // Quelle: https://de.wiktionary.org/wiki/obsolet
    ["Was bedeutet „ambivalent“?", "Zwiespältig", "Eindeutig", "Gleichgültig", "Feindselig"], // Quelle: https://de.wiktionary.org/wiki/ambivalent
    ["Was bedeutet „redundant“?", "Überflüssig", "Notwendig", "Selten", "Fehlerhaft"], // Quelle: https://de.wiktionary.org/wiki/redundant
    ["Was bedeutet „ubiquitär“?", "Überall verbreitet", "Sehr selten", "Uralt", "Unsichtbar"], // Quelle: https://de.wiktionary.org/wiki/ubiquit%C3%A4r
    ["Was bedeutet „Prokrastination“?", "Aufschieben", "Vorausplanen", "Übertreiben", "Nachahmen"], // Quelle: https://de.wikipedia.org/wiki/Prokrastination
    ["Was bedeutet „Empathie“?", "Einfühlungsvermögen", "Begeisterung", "Gleichgültigkeit", "Abneigung"], // Quelle: https://de.wikipedia.org/wiki/Empathie
    ["Was ist ein „Euphemismus“?", "Beschönigendes Wort", "Schimpfwort", "Fremdwort", "Kunstwort"], // Quelle: https://de.wikipedia.org/wiki/Euphemismus
    ["Was bedeutet „Nostalgie“?", "Sehnsucht nach Vergangenem", "Angst vor Neuem", "Freude am Reisen", "Heimweh nach dem Meer"], // Quelle: https://de.wikipedia.org/wiki/Nostalgie
    ["Was ist ein „Palindrom“?", "Vor- und rückwärts gleich", "Ein sehr langes Wort", "Ein Wort ohne Vokale", "Ein Reim am Zeilenende"], // Quelle: https://de.wikipedia.org/wiki/Palindrom
    ["Was ist ein „Synonym“?", "Wort gleicher Bedeutung", "Wort mit Gegenbedeutung", "Gleich klingendes Wort", "Abgekürztes Wort"], // Quelle: https://de.wikipedia.org/wiki/Synonym
    ["Was ist ein „Antonym“?", "Wort mit Gegenbedeutung", "Wort gleicher Bedeutung", "Gleich klingendes Wort", "Abgekürztes Wort"], // Quelle: https://de.wikipedia.org/wiki/Antonym
    ["Was ist ein „Akronym“?", "Kurzwort aus Anfangsbuchstaben", "Wort aus zwei Sprachen", "Erfundenes Wort", "Veraltetes Wort"], // Quelle: https://de.wikipedia.org/wiki/Akronym
    ["Was bedeutet „Déjà-vu“ wörtlich?", "Schon gesehen", "Noch nie gehört", "Gleich vergessen", "Bald erlebt"], // Quelle: https://de.wikipedia.org/wiki/D%C3%A9j%C3%A0-vu
    ["Was ist eine „Metapher“?", "Bildhafter Ausdruck", "Wörtliches Zitat", "Gereimter Vers", "Ausrufesatz"], // Quelle: https://de.wikipedia.org/wiki/Metapher
    ["Wie heißt Onomatopoesie auf Deutsch?", "Lautmalerei", "Wortspiel", "Stabreim", "Schüttelreim"], // Quelle: https://de.wikipedia.org/wiki/Lautmalerei
    ["Wie schreibt man das Wort für Takt und Gleichmaß richtig?", "Rhythmus", "Rythmus", "Rhytmus", "Rhythmuss"], // Quelle: https://de.wiktionary.org/wiki/Rhythmus
    ["Wie schreibt man das Wort für Maßstab und Norm richtig?", "Standard", "Standart", "Standarth", "Standad"], // Quelle: https://de.wiktionary.org/wiki/Standard
    ["Wie schreibt man das Wort für ein technisches Gerät richtig?", "Maschine", "Maschiene", "Mashine", "Maschinne"], // Quelle: https://de.wiktionary.org/wiki/Maschine
    ["Wie schreibt man das Wort für eine Instandsetzung richtig?", "Reparatur", "Reperatur", "Repparatur", "Reparartur"], // Quelle: https://de.wiktionary.org/wiki/Reparatur
    ["Wie schreibt man das Wort für eine Bezahlung richtig?", "Entgelt", "Entgeld", "Endgelt", "Endgeld"], // Quelle: https://de.wiktionary.org/wiki/Entgelt
    ["Wie schreibt man „nämlich“ richtig?", "nämlich", "nähmlich", "nämmlich", "nemlich"], // Quelle: https://de.wiktionary.org/wiki/n%C3%A4mlich
    ["Wie schreibt man das Wort für duldsam richtig?", "tolerant", "tollerant", "tolerrant", "tolerannt"], // Quelle: https://de.wiktionary.org/wiki/tolerant
    ["Wie schreibt man das Fahrgeschäft auf dem Jahrmarkt richtig?", "Karussell", "Karusell", "Karrussell", "Karussel"], // Quelle: https://de.wiktionary.org/wiki/Karussell
    ["Wie schreibt man den künstlichen Erdtrabanten richtig?", "Satellit", "Sattelit", "Satelit", "Sattellit"], // Quelle: https://de.wiktionary.org/wiki/Satellit
    ["Wie schreibt man das Geliermittel richtig?", "Gelatine", "Gelantine", "Gellatine", "Gelatiene"], // Quelle: https://de.wiktionary.org/wiki/Gelatine
    ["Wie schreibt man das Wort für die Wirbelsäule richtig?", "Rückgrat", "Rückgrad", "Rückrat", "Rückgradt"], // Quelle: https://de.wiktionary.org/wiki/R%C3%BCckgrat
    ["Wie schreibt man das Wort für einen Decknamen richtig?", "Pseudonym", "Pseudonüm", "Pseodonym", "Psoidonym"], // Quelle: https://de.wiktionary.org/wiki/Pseudonym
    ["Wie schreibt man das Wort für abschließend richtig?", "endgültig", "entgültig", "endgültich", "entgültich"], // Quelle: https://de.wiktionary.org/wiki/endg%C3%BCltig
    ["Wie schreibt man das Wort für einen Laien richtig?", "Dilettant", "Dilletant", "Dillettant", "Diletant"], // Quelle: https://de.wiktionary.org/wiki/Dilettant
    ["Wie schreibt man das Wort für eine Erlaubnis richtig?", "Lizenz", "Lizens", "Lisenz", "Litzenz"], // Quelle: https://de.wiktionary.org/wiki/Lizenz
    ["Wie schreibt man den Sitzplatz vor dem Haus richtig?", "Terrasse", "Terasse", "Terrase", "Teraße"], // Quelle: https://de.wiktionary.org/wiki/Terrasse
    ["Wie schreibt man die Büchersammlung richtig?", "Bibliothek", "Biblothek", "Bibliotek", "Bibliotheck"], // Quelle: https://de.wiktionary.org/wiki/Bibliothek
    ["Welche Sprache hat weltweit die meisten Muttersprachler?", "Mandarin", "Englisch", "Spanisch", "Hindi"], // Quelle: https://de.wikipedia.org/wiki/Liste_der_meistgesprochenen_Sprachen
    ["In welcher Schrift schreibt man Russisch?", "Kyrillisch", "Lateinisch", "Griechisch", "Arabisch"], // Quelle: https://de.wikipedia.org/wiki/Russische_Sprache
    ["In welche Richtung schreibt man Arabisch?", "Von rechts nach links", "Von links nach rechts", "Von oben nach unten", "Abwechselnd"], // Quelle: https://de.wikipedia.org/wiki/Arabische_Schrift
    ["Welche Sprache spricht man in Argentinien?", "Spanisch", "Portugiesisch", "Italienisch", "Englisch"], // Quelle: https://de.wikipedia.org/wiki/Argentinien
    ["Welche Sprache ist eine Landessprache der Schweiz?", "Rätoromanisch", "Niederländisch", "Dänisch", "Slowenisch"], // Quelle: https://de.wikipedia.org/wiki/R%C3%A4toromanische_Sprachen
    ["Welche Sprache Europas ist mit keiner anderen bekannten Sprache verwandt?", "Baskisch", "Ungarisch", "Finnisch", "Maltesisch"], // Quelle: https://de.wikipedia.org/wiki/Baskische_Sprache
    ["Mit welcher Sprache ist Finnisch eng verwandt?", "Estnisch", "Schwedisch", "Russisch", "Norwegisch"], // Quelle: https://de.wikipedia.org/wiki/Finnische_Sprache
    ["Zu welcher Sprachfamilie gehört Ungarisch?", "Uralisch", "Slawisch", "Germanisch", "Romanisch"], // Quelle: https://de.wikipedia.org/wiki/Ungarische_Sprache
    ["Welche dieser Sprachen stammt vom Latein ab?", "Italienisch", "Englisch", "Polnisch", "Griechisch"], // Quelle: https://de.wikipedia.org/wiki/Romanische_Sprachen
    ["Welche dieser Sprachen ist eine slawische Sprache?", "Polnisch", "Ungarisch", "Rumänisch", "Litauisch"], // Quelle: https://de.wikipedia.org/wiki/Slawische_Sprachen
    ["Welche dieser Sprachen ist eine germanische Sprache?", "Niederländisch", "Finnisch", "Ungarisch", "Rumänisch"], // Quelle: https://de.wikipedia.org/wiki/Germanische_Sprachen
    ["Welche Plansprache veröffentlichte Ludwik Zamenhof?", "Esperanto", "Volapük", "Interlingua", "Latino sine flexione"], // Quelle: https://de.wikipedia.org/wiki/Esperanto
    ["Welche Sprache spricht man vor allem in Angola?", "Portugiesisch", "Französisch", "Englisch", "Spanisch"], // Quelle: https://de.wikipedia.org/wiki/Angola
    ["Welche Sprache spricht die Mehrheit in der Provinz Québec?", "Französisch", "Englisch", "Spanisch", "Italienisch"], // Quelle: https://de.wikipedia.org/wiki/Qu%C3%A9bec_(Provinz)
    ["Welche Sprache ist Amtssprache im Iran?", "Persisch", "Arabisch", "Türkisch", "Kurdisch"], // Quelle: https://de.wikipedia.org/wiki/Iran
    ["Wie heißt eine der japanischen Silbenschriften?", "Hiragana", "Hangeul", "Devanagari", "Kyrillisch"], // Quelle: https://de.wikipedia.org/wiki/Hiragana
    ["In welcher Schrift schreibt man Hindi?", "Devanagari", "Hiragana", "Hangeul", "Kyrillisch"], // Quelle: https://de.wikipedia.org/wiki/Devanagari
    ["Welche Sprache ist Amtssprache in Israel?", "Hebräisch", "Griechisch", "Persisch", "Türkisch"], // Quelle: https://de.wikipedia.org/wiki/Israel
    ["Welche Sprache sprach man im antiken Rom?", "Latein", "Griechisch", "Etruskisch", "Italienisch"], // Quelle: https://de.wikipedia.org/wiki/Latein
    ["In welcher Region ist Swahili eine wichtige Verkehrssprache?", "Ostafrika", "Westafrika", "Südostasien", "Südamerika"], // Quelle: https://de.wikipedia.org/wiki/Swahili
    ["Welche Sprache ist neben Niederländisch und Deutsch Amtssprache in Belgien?", "Französisch", "Englisch", "Luxemburgisch", "Italienisch"], // Quelle: https://de.wikipedia.org/wiki/Belgien
    ["Welche Minderheitensprache spricht man in der Lausitz?", "Sorbisch", "Friesisch", "Dänisch", "Romanes"], // Quelle: https://de.wikipedia.org/wiki/Sorbische_Sprache
    ["Welche Regionalsprache spricht man in Norddeutschland?", "Plattdeutsch", "Bairisch", "Alemannisch", "Schwäbisch"], // Quelle: https://de.wikipedia.org/wiki/Niederdeutsche_Sprache
    ["Welche Schrift benutzten die alten Ägypter?", "Hieroglyphen", "Keilschrift", "Runen", "Kanji"], // Quelle: https://de.wikipedia.org/wiki/%C3%84gyptische_Hieroglyphen
    ["Welche Schrift entstand im alten Mesopotamien?", "Keilschrift", "Hieroglyphen", "Runen", "Ogham"], // Quelle: https://de.wikipedia.org/wiki/Keilschrift
    ["Wie heißen die alten Schriftzeichen der Germanen?", "Runen", "Glyphen", "Kanji", "Lettern"], // Quelle: https://de.wikipedia.org/wiki/Runen
    ["Wie viele Buchstaben hat das griechische Alphabet?", 24, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Griechisches_Alphabet
    ["Wie viele Buchstaben hat das russische Alphabet?", 33, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Russisches_Alphabet
    ["Wie viele Grundzeichen hat die Hiragana-Schrift?", 46, "Zeichen"], // Quelle: https://de.wikipedia.org/wiki/Hiragana
    ["In welchem Jahr erschien Luthers vollständige Bibelübersetzung?", 1534, ""], // Quelle: https://de.wikipedia.org/wiki/Lutherbibel
    ["Wie viele Buchstaben hat das hebräische Alphabet?", 22, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Hebr%C3%A4isches_Alphabet
    ["Wie viele Buchstaben hat das arabische Alphabet?", 28, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Arabisches_Alphabet
    ["Wie viele Landessprachen hat die Schweiz?", 4, ""], // Quelle: https://de.wikipedia.org/wiki/Schweiz
    ["In welchem Jahr begannen die Brüder Grimm ihr Deutsches Wörterbuch?", 1838, ""], // Quelle: https://de.wikipedia.org/wiki/Deutsches_W%C3%B6rterbuch
    ["In welchem Jahr wurde das Deutsche Wörterbuch der Brüder Grimm vollendet?", 1961, ""], // Quelle: https://de.wikipedia.org/wiki/Deutsches_W%C3%B6rterbuch
    ["Wie viele Buchstaben hatte das armenische Alphabet ursprünglich?", 36, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Armenisches_Alphabet
    ["Wie viele Buchstaben hat das heutige georgische Alphabet?", 33, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Georgisches_Alphabet
    ["In welchem Jahr veröffentlichte Zamenhof das erste Lehrbuch des Esperanto?", 1887, ""], // Quelle: https://de.wikipedia.org/wiki/Esperanto
    ["In welchem Jahr wurde die koreanische Schrift verkündet?", 1446, ""], // Quelle: https://de.wikipedia.org/wiki/Koreanisches_Alphabet
    ["Wie viele Vokalbuchstaben hat das Alphabet ohne Umlaute?", 5, ""], // Quelle: https://de.wikipedia.org/wiki/Vokal
    ["In welchem Jahr einigte sich eine Konferenz in Berlin auf eine einheitliche deutsche Rechtschreibung?", 1901, ""], // Quelle: https://de.wikipedia.org/wiki/II._Orthographische_Konferenz
    ["Wie viele Buchstaben hat das türkische Alphabet?", 29, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/T%C3%BCrkisches_Alphabet
    ["Wie viele Buchstaben hat das polnische Alphabet?", 32, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Polnisches_Alphabet
    ["In welchem Jahr führte die Türkei das lateinische Alphabet ein?", 1928, ""], // Quelle: https://de.wikipedia.org/wiki/T%C3%BCrkisches_Alphabet
    ["Die Fälle in der üblichen Reihenfolge:", ["Nominativ", "Genitiv", "Dativ", "Akkusativ"]], // Quelle: https://de.wikipedia.org/wiki/Kasus
    ["Zeitformen von der Vergangenheit zur Zukunft:", ["Plusquamperfekt", "Präteritum", "Präsens", "Futur I"]], // Quelle: https://de.wikipedia.org/wiki/Tempus
    ["Griechische Buchstaben in der Reihenfolge des Alphabets:", ["Beta", "Epsilon", "Lambda", "Omega"]], // Quelle: https://de.wikipedia.org/wiki/Griechisches_Alphabet
    ["Von der kleinsten zur größten Einheit:", ["Laut", "Silbe", "Wort", "Satz"]], // Quelle: https://de.wikipedia.org/wiki/Silbe https://de.wikipedia.org/wiki/Wort https://de.wikipedia.org/wiki/Satz_(Grammatik)
    ["Sprachstufen des Deutschen, die älteste zuerst:", ["Althochdeutsch", "Mittelhochdeutsch", "Frühneuhochdeutsch", "Neuhochdeutsch"]], // Quelle: https://de.wikipedia.org/wiki/Deutsche_Sprache
    ["Sprachstufen des Englischen, die älteste zuerst:", ["Altenglisch", "Mittelenglisch", "Frühneuenglisch", "Neuenglisch"]], // Quelle: https://de.wikipedia.org/wiki/Englische_Sprache
    ["Schriften nach ihrem Alter, die älteste zuerst:", ["Keilschrift", "Griechisches Alphabet", "Runen", "Hangeul"]], // Quelle: https://de.wikipedia.org/wiki/Keilschrift https://de.wikipedia.org/wiki/Griechisches_Alphabet https://de.wikipedia.org/wiki/Runen https://de.wikipedia.org/wiki/Koreanisches_Alphabet
    ["„sein“ in der Reihenfolge ich, du, er, wir:", ["bin", "bist", "ist", "sind"]], // Quelle: https://de.wiktionary.org/wiki/sein
    ["Personalpronomen in der üblichen Reihenfolge:", ["ich", "du", "er", "wir"]], // Quelle: https://de.wikipedia.org/wiki/Personalpronomen
    ["Diese Monate tragen lateinische Zahlen im Namen – kleinste Zahl zuerst:", ["September", "Oktober", "November", "Dezember"]], // Quelle: https://de.wikipedia.org/wiki/Monat
  ],
};
