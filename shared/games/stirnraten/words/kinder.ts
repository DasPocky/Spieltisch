import type { Category } from "../cards";

/** Stufe Kinder: leicht, ab etwa 6 Jahren */
export const KINDER: Category[] = [
  {
    id: "k-tiere", name: "Tiere", level: "kinder", emoji: "🐶",
    words: ["Hund", "Katze", "Maus", "Elefant", "Giraffe", "Löwe", "Tiger", "Affe", "Bär", "Pinguin", "Krokodil", "Schlange", "Frosch", "Schildkröte", "Hase", "Igel", "Eichhörnchen", "Fuchs", "Wolf", "Eule", "Papagei", "Zebra", "Nilpferd", "Känguru", "Koala", "Panda", "Kamel", "Hamster", "Meerschweinchen", "Schmetterling", "Biene", "Marienkäfer", "Schnecke", "Spinne", "Ameise", "Raupe", "Storch", "Flamingo", "Delfin", "Wal", "Hai", "Robbe", "Eisbär", "Nashorn", "Gorilla", "Faultier", "Waschbär", "Maulwurf", "Fledermaus", "Reh", "Hirsch", "Dachs", "Specht", "Rabe", "Gans", "Ente", "Taube", "Wellensittich", "Goldfisch", "Leopard"],
  },
  {
    id: "k-bauernhof", name: "Auf dem Bauernhof", level: "kinder", emoji: "🚜",
    words: ["Kuh", "Schwein", "Pferd", "Schaf", "Ziege", "Huhn", "Hahn", "Küken", "Esel", "Pony", "Kalb", "Ferkel", "Lamm", "Traktor", "Scheune", "Heu", "Stroh", "Mistgabel", "Stall", "Melken", "Milchkanne", "Bauer", "Bäuerin", "Hofhund", "Hofkatze", "Zaun", "Weide", "Futtertrog", "Eier", "Hühnerstall", "Mähdrescher", "Feld", "Kornfeld", "Vogelscheuche", "Gummistiefel", "Schubkarre", "Misthaufen", "Anhänger", "Pflug", "Kartoffeln", "Apfelbaum", "Brunnen", "Pute", "Truthahn", "Kaninchenstall", "Trecker fahren", "Heuballen", "Sonnenblume", "Maisfeld", "Ernte"],
  },
  {
    id: "k-meer", name: "Im Meer", level: "kinder", emoji: "🐠",
    words: ["Fisch", "Qualle", "Seestern", "Krabbe", "Hummer", "Muschel", "Seepferdchen", "Tintenfisch", "Krake", "Rochen", "Seehund", "Walross", "Orca", "Schwertfisch", "Clownfisch", "Kugelfisch", "Koralle", "Seetang", "Algen", "Welle", "Strand", "Sandburg", "Leuchtturm", "Schiff", "Segelboot", "U-Boot", "Taucher", "Schnorchel", "Taucherbrille", "Flossen", "Schatzkiste", "Pirat", "Meerjungfrau", "Insel", "Möwe", "Pelikan", "Anker", "Rettungsring", "Ebbe", "Flut", "Wattwurm", "Sandwurm", "Sandkasten", "Eimer und Schaufel", "Luftmatratze", "Badehose", "Sonnencreme", "Liegestuhl", "Boje", "Delfinshow"],
  },
  {
    id: "k-spielzeug", name: "Spielzeug & Spiele", level: "kinder", emoji: "🧸",
    words: ["Ball", "Puppe", "Teddybär", "Bauklötze", "Kreisel", "Drachen steigen", "Seifenblasen", "Springseil", "Murmeln", "Puzzle", "Malbuch", "Wachsmalstifte", "Knete", "Rutsche", "Schaukel", "Wippe", "Sandkasten", "Roller", "Fahrrad", "Laufrad", "Rollschuhe", "Skateboard", "Trampolin", "Verstecken", "Fangen", "Blinde Kuh", "Stille Post", "Topfschlagen", "Würfel", "Spielkarten", "Plüschtier", "Spielzeugauto", "Eisenbahn", "Ritterburg", "Puppenhaus", "Kaufladen", "Schwimmflügel", "Wasserpistole", "Zauberwürfel", "Jo-Jo", "Hüpfball", "Steckenpferd", "Bilderbuch", "Hula-Reifen", "Gummitwist", "Himmel und Hölle", "Kuscheltier", "Spielplatz", "Kletterturm", "Schneemann bauen", "Schlitten", "Rutschauto", "Seilbahn", "Sackhüpfen", "Eierlaufen"],
  },
  {
    id: "k-essen", name: "Essen & Naschen", level: "kinder", emoji: "🍕",
    words: ["Pizza", "Nudeln", "Pommes", "Spaghetti", "Pfannkuchen", "Eis", "Schokolade", "Gummibärchen", "Lolli", "Zuckerwatte", "Popcorn", "Keks", "Kuchen", "Torte", "Brezel", "Brötchen", "Toast", "Müsli", "Joghurt", "Milch", "Kakao", "Saft", "Wasser", "Käse", "Wurst", "Würstchen", "Hamburger", "Fischstäbchen", "Ketchup", "Senf", "Suppe", "Reis", "Kartoffelbrei", "Spiegelei", "Rührei", "Butterbrot", "Marmelade", "Honig", "Waffel", "Muffin", "Donut", "Croissant", "Apfelkuchen", "Sandkuchen", "Schokokuss", "Kaugummi", "Bonbon", "Lebkuchen", "Plätzchen", "Pudding", "Götterspeise", "Milchreis", "Grießbrei", "Salzstangen", "Chips"],
  },
  {
    id: "k-obst", name: "Obst & Gemüse", level: "kinder", emoji: "🍎",
    words: ["Apfel", "Banane", "Birne", "Erdbeere", "Kirsche", "Traube", "Orange", "Zitrone", "Mandarine", "Ananas", "Melone", "Wassermelone", "Kiwi", "Pfirsich", "Pflaume", "Himbeere", "Blaubeere", "Mango", "Kokosnuss", "Granatapfel", "Karotte", "Gurke", "Tomate", "Kartoffel", "Zwiebel", "Knoblauch", "Paprika", "Brokkoli", "Blumenkohl", "Salat", "Mais", "Erbsen", "Bohnen", "Kürbis", "Zucchini", "Aubergine", "Radieschen", "Spinat", "Pilz", "Spargel", "Rosenkohl", "Rotkohl", "Lauch", "Sellerie", "Avocado", "Feige", "Dattel", "Johannisbeere", "Stachelbeere", "Rhabarber"],
  },
  {
    id: "k-fahrzeuge", name: "Fahrzeuge", level: "kinder", emoji: "🚒",
    words: ["Auto", "Bus", "Zug", "Flugzeug", "Hubschrauber", "Feuerwehrauto", "Krankenwagen", "Polizeiauto", "Müllauto", "Bagger", "Kran", "Lastwagen", "Traktor", "Motorrad", "Fahrrad", "Roller", "Schiff", "Boot", "Kanu", "Ruderboot", "Rakete", "Ufo", "Straßenbahn", "U-Bahn", "Taxi", "Wohnmobil", "Heißluftballon", "Segelflugzeug", "Dampflok", "Seilbahn", "Sessellift", "Kinderwagen", "Rollstuhl", "Tretboot", "Kutsche", "Schlitten", "Pistenraupe", "Abschleppwagen", "Betonmischer", "Gabelstapler", "Rennwagen", "Cabrio", "Doppeldeckerbus", "Fähre", "Gondel", "Luftschiff", "Monstertruck", "Postauto", "Eiswagen", "Mondfahrzeug"],
  },
  {
    id: "k-maerchen", name: "Märchen & Fantasie", level: "kinder", emoji: "🧚",
    words: ["Rotkäppchen", "Schneewittchen", "Aschenputtel", "Dornröschen", "Rapunzel", "Hänsel und Gretel", "Rumpelstilzchen", "Frau Holle", "Der Froschkönig", "Die sieben Zwerge", "Der gestiefelte Kater", "Die Bremer Stadtmusikanten", "Der Wolf und die sieben Geißlein", "Die kleine Meerjungfrau", "Das hässliche Entlein", "Pinocchio", "Prinzessin", "Prinz", "König", "Königin", "Hexe", "Zauberer", "Fee", "Drache", "Einhorn", "Riese", "Zwerg", "Kobold", "Gespenst", "Vampir", "Ritter", "Burg", "Schloss", "Zauberstab", "Krone", "Schatz", "Zauberspruch", "Lebkuchenhaus", "Spiegel an der Wand", "Gläserner Schuh", "Goldene Gans", "Der Mann im Mond", "Weihnachtsmann", "Osterhase", "Zahnfee", "Sandmann", "Fliegender Teppich", "Wunderlampe", "Flaschengeist", "Zauberbohne", "Elfe", "Troll", "Meerjungfrau", "Pegasus", "Phönix"],
  },
  {
    id: "k-berufe", name: "Was ich mal werde", level: "kinder", emoji: "👩‍🚒",
    words: ["Feuerwehrfrau", "Polizist", "Ärztin", "Zahnarzt", "Tierarzt", "Lehrerin", "Bäcker", "Koch", "Friseur", "Bauarbeiter", "Pilot", "Astronaut", "Kapitän", "Busfahrer", "Lokführer", "Briefträger", "Müllmann", "Gärtner", "Bauer", "Verkäuferin", "Kassierer", "Krankenschwester", "Clown", "Zauberer", "Sänger", "Tänzerin", "Maler", "Schreiner", "Klempner", "Elektriker", "Mechaniker", "Fischer", "Förster", "Zoowärter", "Detektiv", "Rennfahrer", "Fußballspieler", "Schornsteinfeger", "Bibliothekarin", "Fotograf", "Musiker", "Erzieherin", "Hausmeister", "Kellner", "Metzger", "Imker", "Ritter", "Pirat", "Prinzessin", "Forscher"],
  },
  {
    id: "k-zuhause", name: "Zuhause", level: "kinder", emoji: "🏠",
    words: ["Bett", "Kissen", "Decke", "Sofa", "Tisch", "Stuhl", "Lampe", "Fenster", "Tür", "Treppe", "Badewanne", "Dusche", "Toilette", "Zahnbürste", "Zahnpasta", "Handtuch", "Seife", "Kühlschrank", "Herd", "Backofen", "Mikrowelle", "Toaster", "Waschmaschine", "Staubsauger", "Besen", "Fernseher", "Telefon", "Wecker", "Uhr", "Schrank", "Regal", "Teppich", "Vorhang", "Spiegel", "Kamm", "Haarbürste", "Klingel", "Schlüssel", "Briefkasten", "Garten", "Balkon", "Keller", "Dachboden", "Garage", "Gießkanne", "Blumentopf", "Kinderzimmer", "Hochbett", "Nachtlicht", "Schlafanzug"],
  },
  {
    id: "k-koerper", name: "Körper & Kleidung", level: "kinder", emoji: "👕",
    words: ["Nase", "Ohr", "Auge", "Mund", "Zahn", "Zunge", "Haare", "Hand", "Finger", "Daumen", "Fuß", "Zeh", "Knie", "Ellenbogen", "Bauch", "Bauchnabel", "Rücken", "Popo", "Schulter", "Kopf", "Hals", "Wimpern", "Augenbraue", "Sommersprossen", "Pflaster", "Mütze", "Schal", "Handschuhe", "Jacke", "Pullover", "T-Shirt", "Hose", "Rock", "Kleid", "Socken", "Schuhe", "Gummistiefel", "Sandalen", "Hausschuhe", "Badeanzug", "Regenjacke", "Sonnenbrille", "Brille", "Gürtel", "Krawatte", "Hut", "Rucksack", "Schlafmütze", "Strumpfhose", "Latzhose"],
  },
  {
    id: "k-natur", name: "Natur & Wetter", level: "kinder", emoji: "🌈",
    words: ["Sonne", "Mond", "Stern", "Wolke", "Regen", "Schnee", "Gewitter", "Blitz", "Donner", "Regenbogen", "Wind", "Sturm", "Nebel", "Hagel", "Eiszapfen", "Pfütze", "Baum", "Blume", "Gras", "Blatt", "Wald", "Wiese", "Berg", "Fluss", "See", "Meer", "Wasserfall", "Höhle", "Vulkan", "Wüste", "Insel", "Stein", "Sand", "Muschel", "Kastanie", "Eichel", "Tannenzapfen", "Pilz", "Gänseblümchen", "Löwenzahn", "Pusteblume", "Sonnenblume", "Kaktus", "Herbstlaub", "Schneeflocke", "Schneemann", "Sonnenaufgang", "Sternschnuppe", "Vollmond", "Erdbeben"],
  },
  {
    id: "k-dinos", name: "Dinos & Abenteuer", level: "kinder", emoji: "🦖",
    words: ["Dinosaurier", "Tyrannosaurus", "Flugsaurier", "Langhals", "Dino-Ei", "Vulkanausbruch", "Fossil", "Skelett", "Mammut", "Säbelzahntiger", "Höhlenmensch", "Steinzeit", "Ausgrabung", "Schatzsuche", "Schatzkarte", "Kompass", "Fernglas", "Lagerfeuer", "Zelt", "Taschenlampe", "Dschungel", "Lianen", "Wasserfall", "Hängebrücke", "Floß", "Pyramide", "Mumie", "Ritterrüstung", "Schwert", "Schild", "Pirateninsel", "Flaschenpost", "Kapitänsmütze", "Augenklappe", "Holzbein", "Papageienpirat", "Raumschiff", "Astronautenhelm", "Mondlandung", "Außerirdischer", "Roboter", "Zeitmaschine", "Superheld", "Umhang", "Geheimversteck", "Baumhaus", "Detektivlupe", "Fußspuren", "Geheimschrift", "Abenteuerspielplatz"],
  },
  {
    id: "k-tun", name: "Was tust du? (Pantomime)", level: "kinder", emoji: "🤸", style: "pantomime",
    words: ["Zähne putzen", "Haare kämmen", "Schuhe binden", "Eis essen", "Fahrrad fahren", "Schwimmen", "Hüpfen", "Schlafen", "Gähnen", "Niesen", "Weinen", "Lachen", "Tanzen", "Klatschen", "Winken", "Ball werfen", "Fußball spielen", "Seil springen", "Malen", "Lesen", "Kochen", "Backen", "Staubsaugen", "Gießen", "Duschen", "Anziehen", "Telefonieren", "Fotografieren", "Gitarre spielen", "Trommeln", "Klavier spielen", "Angeln", "Reiten", "Skifahren", "Schlittschuh laufen", "Klettern", "Schaukeln", "Rutschen", "Geschenk auspacken", "Kerzen auspusten", "Schneeball werfen", "Regenschirm aufspannen", "Hund ausführen", "Katze streicheln", "Zaubern", "Boxen", "Gewichte heben", "Treppe steigen", "Tür aufschließen", "Spaghetti essen"],
  },
  {
    id: "k-lieder", name: "Kinderlieder (summen)", level: "kinder", emoji: "🎶", style: "summen",
    words: ["Alle meine Entchen", "Hänschen klein", "Kuckuck, Kuckuck, ruft's aus dem Wald", "Fuchs, du hast die Gans gestohlen", "Ein Männlein steht im Walde", "Bruder Jakob", "Alle Vögel sind schon da", "Kommt ein Vogel geflogen", "Summ, summ, summ", "Der Mond ist aufgegangen", "Weißt du, wie viel Sternlein stehen", "Guten Abend, gut' Nacht", "Schlaf, Kindlein, schlaf", "Laterne, Laterne", "Ich geh mit meiner Laterne", "Sankt Martin", "O Tannenbaum", "Stille Nacht", "Kling, Glöckchen, klingelingeling", "Morgen kommt der Weihnachtsmann", "Leise rieselt der Schnee", "Jingle Bells", "Zum Geburtstag viel Glück", "Wie schön, dass du geboren bist", "Hoch soll er leben", "Auf der Mauer, auf der Lauer", "Ein Hut, der hat drei Ecken", "Hejo, spann den Wagen an", "Old MacDonald hat 'nen Bauernhof", "Morgen, Kinder, wird's was geben", "Backe, backe Kuchen", "Häschen in der Grube", "Hoppe, hoppe Reiter", "Ringel, Ringel, Reihe", "Grün, grün, grün sind alle meine Kleider", "Es tönen die Lieder", "Taler, Taler, du musst wandern", "Wer will fleißige Handwerker sehn", "Das Wandern ist des Müllers Lust", "Morgen früh, wenn Gott will", "Funkel, funkel, kleiner Stern", "Ein Vogel wollte Hochzeit machen", "Schneeflöckchen, Weißröckchen", "Hänsel und Gretel verirrten sich im Wald", "Dornröschen war ein schönes Kind", "Drei Chinesen mit dem Kontrabass", "Ich bin ein kleiner Hampelmann", "Häschen hüpf", "Es klappert die Mühle am rauschenden Bach", "Bi-Ba-Butzemann"],
  },
  {
    id: "k-tierlaute", name: "Tierlaute (Geräusche)", level: "kinder", emoji: "🐮", style: "geraeusche",
    words: ["Hund", "Katze", "Kuh", "Schwein", "Pferd", "Schaf", "Ziege", "Hahn", "Huhn", "Ente", "Gans", "Esel", "Frosch", "Eule", "Kuckuck", "Taube", "Löwe", "Tiger", "Affe", "Elefant", "Wolf", "Schlange", "Biene", "Mücke", "Maus", "Seehund", "Delfin", "Pinguin", "Krähe", "Truthahn", "Papagei", "Grille", "Specht", "Bär", "Pferd im Galopp", "Kamel", "Hyäne", "Möwe", "Kanarienvogel", "Fliege", "Gorilla", "Uhu", "Lama", "Hamster beim Fressen", "Walgesang", "Dinosaurier", "Drache", "Hummel", "Kätzchen", "Welpe"],
  },
];
