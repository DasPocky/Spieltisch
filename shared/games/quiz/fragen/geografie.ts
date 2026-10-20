import type { FragenKategorie } from "./typen";

export const GEOGRAFIE: FragenKategorie = {
  id: "geografie",
  name: "Erde & Länder",
  emoji: "🌍",
  stufe: "familie",
  fragen: [
    ["Wie heißt die Hauptstadt von Australien?", "Canberra", "Sydney", "Melbourne", "Perth"], // Quelle: https://de.wikipedia.org/wiki/Canberra
    ["Wie heißt die Hauptstadt von Kanada?", "Ottawa", "Toronto", "Vancouver", "Montreal"], // Quelle: https://de.wikipedia.org/wiki/Ottawa
    ["Wie heißt die Hauptstadt von Brasilien?", "Brasília", "Rio de Janeiro", "São Paulo", "Salvador"], // Quelle: https://de.wikipedia.org/wiki/Brasília
    ["Wie heißt die Hauptstadt der Türkei?", "Ankara", "Istanbul", "Izmir", "Antalya"], // Quelle: https://de.wikipedia.org/wiki/Ankara
    ["In welcher Stadt sitzt die Regierung der Schweiz?", "Bern", "Zürich", "Genf", "Basel"], // Quelle: https://de.wikipedia.org/wiki/Bern
    ["Wie heißt die Hauptstadt von Neuseeland?", "Wellington", "Auckland", "Christchurch", "Queenstown"], // Quelle: https://de.wikipedia.org/wiki/Wellington
    ["Wie heißt die Hauptstadt von Marokko?", "Rabat", "Casablanca", "Marrakesch", "Fès"], // Quelle: https://de.wikipedia.org/wiki/Rabat
    ["Wie heißt die Hauptstadt der USA?", "Washington, D.C.", "New York", "Los Angeles", "Chicago"], // Quelle: https://de.wikipedia.org/wiki/Washington,_D.C.
    ["Wie heißt die Hauptstadt von Ägypten?", "Kairo", "Alexandria", "Luxor", "Assuan"], // Quelle: https://de.wikipedia.org/wiki/Kairo
    ["Wie heißt die Hauptstadt von Indien?", "Neu-Delhi", "Mumbai", "Kalkutta", "Bangalore"], // Quelle: https://de.wikipedia.org/wiki/Neu-Delhi
    ["Wie heißt die Hauptstadt von Griechenland?", "Athen", "Thessaloniki", "Patras", "Heraklion"], // Quelle: https://de.wikipedia.org/wiki/Athen
    ["Wie heißt die Hauptstadt von Russland?", "Moskau", "Sankt Petersburg", "Nowosibirsk", "Kasan"], // Quelle: https://de.wikipedia.org/wiki/Moskau
    ["Wie heißt die Hauptstadt von China?", "Peking", "Shanghai", "Hongkong", "Kanton"], // Quelle: https://de.wikipedia.org/wiki/Peking
    ["Welcher Fluss legt die längste Strecke in Deutschland zurück?", "Rhein", "Donau", "Elbe", "Main"], // Quelle: https://de.wikipedia.org/wiki/Liste_von_Flüssen_in_Deutschland https://www.wissen.de/lexikon/rhein
    ["An welchem Fluss liegt Köln?", "Rhein", "Main", "Mosel", "Ruhr"], // Quelle: https://de.wikipedia.org/wiki/Köln
    ["An welchem Fluss liegt Dresden?", "Elbe", "Oder", "Saale", "Spree"], // Quelle: https://de.wikipedia.org/wiki/Dresden
    ["An welchem Fluss liegt Wien?", "Donau", "Inn", "Elbe", "Moldau"], // Quelle: https://de.wikipedia.org/wiki/Wien
    ["An welchem Fluss liegt Paris?", "Seine", "Loire", "Rhône", "Garonne"], // Quelle: https://de.wikipedia.org/wiki/Paris
    ["An welchem Fluss liegt London?", "Themse", "Severn", "Tyne", "Mersey"], // Quelle: https://de.wikipedia.org/wiki/London
    ["An welchem Fluss liegt Prag?", "Moldau", "Donau", "Oder", "Weichsel"], // Quelle: https://de.wikipedia.org/wiki/Prag
    ["An welchem Fluss liegt Rom?", "Tiber", "Po", "Arno", "Etsch"], // Quelle: https://de.wikipedia.org/wiki/Rom
    ["An welchem Fluss liegt Florenz?", "Arno", "Tiber", "Po", "Etsch"], // Quelle: https://de.wikipedia.org/wiki/Florenz
    ["An welchem Fluss liegt Budapest?", "Donau", "Theiß", "Drau", "Save"], // Quelle: https://de.wikipedia.org/wiki/Budapest
    ["Welcher Fluss fließt durch Kairo?", "Nil", "Kongo", "Niger", "Sambesi"], // Quelle: https://de.wikipedia.org/wiki/Kairo
    ["In welches Meer mündet die Donau?", "Schwarzes Meer", "Mittelmeer", "Adria", "Ostsee"], // Quelle: https://de.wikipedia.org/wiki/Donau
    ["In welches Meer mündet der Rhein?", "Nordsee", "Ostsee", "Mittelmeer", "Schwarzes Meer"], // Quelle: https://de.wikipedia.org/wiki/Rhein
    ["In welches Meer mündet die Oder?", "Ostsee", "Nordsee", "Schwarzes Meer", "Mittelmeer"], // Quelle: https://de.wikipedia.org/wiki/Oder
    ["Wie heißt der höchste Berg Deutschlands?", "Zugspitze", "Watzmann", "Feldberg", "Brocken"], // Quelle: https://de.wikipedia.org/wiki/Zugspitze
    ["Wie heißt der höchste Berg der Alpen?", "Mont Blanc", "Matterhorn", "Großglockner", "Eiger"], // Quelle: https://de.wikipedia.org/wiki/Mont_Blanc
    ["Wie heißt der höchste Berg Afrikas?", "Kilimandscharo", "Mount Kenya", "Toubkal", "Mount Meru"], // Quelle: https://de.wikipedia.org/wiki/Kilimandscharo
    ["Wie heißt der höchste Berg der Erde?", "Mount Everest", "K2", "Kangchendzönga", "Lhotse"], // Quelle: https://de.wikipedia.org/wiki/Mount_Everest
    ["Wie heißt der höchste Berg Südamerikas?", "Aconcagua", "Chimborazo", "Huascarán", "Illimani"], // Quelle: https://de.wikipedia.org/wiki/Aconcagua
    ["Wie heißt der höchste Berg Österreichs?", "Großglockner", "Wildspitze", "Dachstein", "Zugspitze"], // Quelle: https://de.wikipedia.org/wiki/Großglockner
    ["In welchem Gebirge liegt der Mount Everest?", "Himalaya", "Karakorum", "Hindukusch", "Anden"], // Quelle: https://de.wikipedia.org/wiki/Mount_Everest
    ["Wie heißt die größte Wüste Afrikas?", "Sahara", "Kalahari", "Namib", "Danakil"], // Quelle: https://de.wikipedia.org/wiki/Sahara
    ["Welcher ist der größte Ozean der Erde?", "Pazifik", "Atlantik", "Indischer Ozean", "Arktischer Ozean"], // Quelle: https://de.wikipedia.org/wiki/Pazifischer_Ozean
    ["Welche ist die größte Insel der Erde?", "Grönland", "Neuguinea", "Borneo", "Madagaskar"], // Quelle: https://de.wikipedia.org/wiki/Liste_der_größten_Inseln_der_Erde
    ["Welche ist die größte Insel Deutschlands?", "Rügen", "Usedom", "Fehmarn", "Sylt"], // Quelle: https://de.wikipedia.org/wiki/Rügen
    ["Welcher See ist der größte, der ganz in Deutschland liegt?", "Müritz", "Chiemsee", "Starnberger See", "Ammersee"], // Quelle: https://de.wikipedia.org/wiki/Müritz
    ["Welches Land grenzt nicht an den Bodensee?", "Liechtenstein", "Deutschland", "Österreich", "Schweiz"], // Quelle: https://de.wikipedia.org/wiki/Bodensee
    ["Welches ist das flächengrößte deutsche Bundesland?", "Bayern", "Niedersachsen", "Baden-Württemberg", "Nordrhein-Westfalen"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Welches ist das flächenkleinste deutsche Bundesland?", "Bremen", "Hamburg", "Berlin", "Saarland"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Bayern?", "München", "Nürnberg", "Augsburg", "Regensburg"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Nordrhein-Westfalen?", "Düsseldorf", "Köln", "Dortmund", "Essen"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Niedersachsen?", "Hannover", "Braunschweig", "Oldenburg", "Osnabrück"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Schleswig-Holstein?", "Kiel", "Lübeck", "Flensburg", "Neumünster"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Sachsen?", "Dresden", "Leipzig", "Chemnitz", "Zwickau"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Thüringen?", "Erfurt", "Jena", "Weimar", "Gera"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Mecklenburg-Vorpommern?", "Schwerin", "Rostock", "Stralsund", "Greifswald"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Rheinland-Pfalz?", "Mainz", "Koblenz", "Trier", "Kaiserslautern"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Hessen?", "Wiesbaden", "Frankfurt am Main", "Kassel", "Darmstadt"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Sachsen-Anhalt?", "Magdeburg", "Halle (Saale)", "Dessau", "Wittenberg"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Baden-Württemberg?", "Stuttgart", "Karlsruhe", "Mannheim", "Freiburg"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie heißt die Landeshauptstadt von Brandenburg?", "Potsdam", "Cottbus", "Frankfurt (Oder)", "Brandenburg an der Havel"], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Welcher Kontinent ist der größte?", "Asien", "Afrika", "Nordamerika", "Europa"], // Quelle: https://de.wikipedia.org/wiki/Kontinent
    ["Welcher Kontinent hat keine dauerhaften Einwohner?", "Antarktika", "Australien", "Europa", "Südamerika"], // Quelle: https://de.wikipedia.org/wiki/Antarktika
    ["Welches ist das flächengrößte Land der Erde?", "Russland", "Kanada", "China", "USA"], // Quelle: https://de.wikipedia.org/wiki/Russland
    ["Welches ist der kleinste Staat der Erde?", "Vatikanstadt", "Monaco", "San Marino", "Liechtenstein"], // Quelle: https://de.wikipedia.org/wiki/Vatikanstadt
    ["Welches Land hat die Form eines Stiefels?", "Italien", "Griechenland", "Spanien", "Kroatien"], // Quelle: https://de.wikipedia.org/wiki/Apenninhalbinsel
    ["Welche Meerenge trennt Europa und Afrika?", "Straße von Gibraltar", "Bosporus", "Ärmelkanal", "Straße von Messina"], // Quelle: https://de.wikipedia.org/wiki/Straße_von_Gibraltar
    ["Welche Meerenge teilt Istanbul in zwei Teile?", "Bosporus", "Dardanellen", "Straße von Gibraltar", "Öresund"], // Quelle: https://de.wikipedia.org/wiki/Bosporus
    ["Welcher Kanal verbindet Mittelmeer und Rotes Meer?", "Sueskanal", "Panamakanal", "Nord-Ostsee-Kanal", "Kanal von Korinth"], // Quelle: https://de.wikipedia.org/wiki/Sueskanal
    ["Welcher Kanal verbindet Atlantik und Pazifik?", "Panamakanal", "Sueskanal", "Nord-Ostsee-Kanal", "Mittellandkanal"], // Quelle: https://de.wikipedia.org/wiki/Panamakanal
    ["Auf welcher Halbinsel liegen Spanien und Portugal?", "Iberische Halbinsel", "Apenninhalbinsel", "Balkanhalbinsel", "Skandinavische Halbinsel"], // Quelle: https://de.wikipedia.org/wiki/Iberische_Halbinsel
    ["Welches dieser Länder ist ein Nachbarland Deutschlands?", "Tschechien", "Ungarn", "Slowenien", "Italien"], // Quelle: https://de.wikipedia.org/wiki/Deutschland
    ["Wie heißt der längste Fluss Europas?", "Wolga", "Donau", "Rhein", "Dnepr"], // Quelle: https://de.wikipedia.org/wiki/Wolga
    ["Wie heißt der längste Fluss Afrikas?", "Nil", "Kongo", "Niger", "Sambesi"], // Quelle: https://de.wikipedia.org/wiki/Nil
    ["Welcher Fluss führt das meiste Wasser der Erde?", "Amazonas", "Nil", "Jangtse", "Mississippi"], // Quelle: https://de.wikipedia.org/wiki/Amazonas
    ["Welcher ist der tiefste See der Erde?", "Baikalsee", "Tanganjikasee", "Kaspisches Meer", "Victoriasee"], // Quelle: https://de.wikipedia.org/wiki/Baikalsee
    ["Welcher ist der größte See Afrikas?", "Victoriasee", "Tanganjikasee", "Malawisee", "Tschadsee"], // Quelle: https://de.wikipedia.org/wiki/Victoriasee
    ["In welchem Gewässer ist das Wasser so salzig, dass man darin treibt?", "Totes Meer", "Rotes Meer", "Schwarzes Meer", "Bodensee"], // Quelle: https://de.wikipedia.org/wiki/Totes_Meer
    ["Vor welchem Land liegt das Große Barriereriff?", "Australien", "Indonesien", "Philippinen", "Neuseeland"], // Quelle: https://de.wikipedia.org/wiki/Great_Barrier_Reef
    ["In welchem Land liegt die Ruinenstadt Machu Picchu?", "Peru", "Bolivien", "Ecuador", "Chile"], // Quelle: https://de.wikipedia.org/wiki/Machu_Picchu
    ["In welchem Land steht die Tempelanlage Angkor Wat?", "Kambodscha", "Thailand", "Laos", "Vietnam"], // Quelle: https://de.wikipedia.org/wiki/Angkor_Wat
    ["In welchem Land liegt die Felsenstadt Petra?", "Jordanien", "Israel", "Syrien", "Ägypten"], // Quelle: https://de.wikipedia.org/wiki/Petra_(Jordanien)
    ["In welcher Stadt steht das Kolosseum?", "Rom", "Athen", "Neapel", "Mailand"], // Quelle: https://de.wikipedia.org/wiki/Kolosseum
    ["In welcher Stadt steht die Akropolis?", "Athen", "Rom", "Sparta", "Delphi"], // Quelle: https://de.wikipedia.org/wiki/Akropolis_(Athen)
    ["In welcher Stadt steht die Freiheitsstatue?", "New York", "Washington, D.C.", "Boston", "Philadelphia"], // Quelle: https://de.wikipedia.org/wiki/Freiheitsstatue
    ["In welcher Stadt steht der berühmte Schiefe Turm?", "Pisa", "Florenz", "Siena", "Venedig"], // Quelle: https://de.wikipedia.org/wiki/Schiefer_Turm_von_Pisa
    ["In welcher Stadt steht die Hagia Sophia?", "Istanbul", "Athen", "Ankara", "Rom"], // Quelle: https://de.wikipedia.org/wiki/Hagia_Sophia
    ["In welchem Land liegt der Kilimandscharo?", "Tansania", "Kenia", "Uganda", "Äthiopien"], // Quelle: https://de.wikipedia.org/wiki/Kilimandscharo
    ["Welche Stadt wird auch „Elbflorenz“ genannt?", "Dresden", "Hamburg", "Magdeburg", "Meißen"], // Quelle: https://de.wikipedia.org/wiki/Elbflorenz
    ["Welche Stadt ist auf über 100 Inseln in einer Lagune gebaut?", "Venedig", "Amsterdam", "Stockholm", "Brügge"], // Quelle: https://de.wikipedia.org/wiki/Venedig
    ["Zu welchem Land gehört die Insel Mallorca?", "Spanien", "Italien", "Frankreich", "Griechenland"], // Quelle: https://de.wikipedia.org/wiki/Mallorca
    ["Zu welchem Land gehört die Insel Korsika?", "Frankreich", "Italien", "Spanien", "Griechenland"], // Quelle: https://de.wikipedia.org/wiki/Korsika
    ["Zu welchem Land gehört die Insel Kreta?", "Griechenland", "Zypern", "Türkei", "Italien"], // Quelle: https://de.wikipedia.org/wiki/Kreta
    ["Welches Land hat ein Ahornblatt auf der Flagge?", "Kanada", "Japan", "Schweiz", "Österreich"], // Quelle: https://de.wikipedia.org/wiki/Flagge_Kanadas
    ["Welche Farben hat die deutsche Flagge von oben nach unten?", "Schwarz, Rot, Gold", "Rot, Schwarz, Gold", "Schwarz, Gold, Rot", "Gold, Rot, Schwarz"], // Quelle: https://de.wikipedia.org/wiki/Flagge_Deutschlands
    ["Welche Währung hat Japan?", "Yen", "Won", "Yuan", "Rupie"], // Quelle: https://de.wikipedia.org/wiki/Yen
    ["Welche Sprache spricht man in Brasilien hauptsächlich?", "Portugiesisch", "Spanisch", "Englisch", "Französisch"], // Quelle: https://de.wikipedia.org/wiki/Brasilien
    ["In welchem Land ist Niederländisch eine Amtssprache?", "Belgien", "Dänemark", "Luxemburg", "Schweden"], // Quelle: https://de.wikipedia.org/wiki/Niederländische_Sprache
    ["Durch welchen Londoner Stadtteil verläuft der Nullmeridian?", "Greenwich", "Westminster", "Camden", "Chelsea"], // Quelle: https://de.wikipedia.org/wiki/Nullmeridian
    ["Wie heißt die Linie, die die Erde in Nord- und Südhalbkugel teilt?", "Äquator", "Nullmeridian", "Wendekreis", "Polarkreis"], // Quelle: https://de.wikipedia.org/wiki/Äquator
    ["Welche Wüste liegt in China und der Mongolei?", "Gobi", "Sahara", "Atacama", "Kalahari"], // Quelle: https://de.wikipedia.org/wiki/Gobi
    ["Welches Gebirge liegt zwischen Frankreich und Spanien?", "Pyrenäen", "Alpen", "Vogesen", "Apenninen"], // Quelle: https://de.wikipedia.org/wiki/Pyrenäen
    ["Welches Gebirge verläuft entlang der Westküste Südamerikas?", "Anden", "Rocky Mountains", "Appalachen", "Ural"], // Quelle: https://de.wikipedia.org/wiki/Anden
    ["Auf welcher Insel liegt der Vulkan Ätna?", "Sizilien", "Sardinien", "Korsika", "Kreta"], // Quelle: https://de.wikipedia.org/wiki/Ätna
    ["Wie heißt der höchste Berg Japans?", "Fuji", "Aso", "Ontake", "Hotaka"], // Quelle: https://de.wikipedia.org/wiki/Fuji_(Vulkan)
    ["Welche Großstadt liegt auf zwei Kontinenten?", "Istanbul", "Kairo", "Athen", "Wien"], // Quelle: https://de.wikipedia.org/wiki/Istanbul

    ["Wie hoch ist die Zugspitze?", 2962, "m"], // Quelle: https://de.wikipedia.org/wiki/Zugspitze
    ["Wie hoch ist der Mount Everest?", 8849, "m"], // Quelle: https://de.wikipedia.org/wiki/Mount_Everest
    ["Wie hoch ist der Kilimandscharo?", 5895, "m"], // Quelle: https://de.wikipedia.org/wiki/Kilimandscharo
    ["Wie viele Bundesländer hat Deutschland?", 16, ""], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Wie viele Kantone hat die Schweiz?", 26, ""], // Quelle: https://de.wikipedia.org/wiki/Kanton_(Schweiz)
    ["Wie viele Bundesländer hat Österreich?", 9, ""], // Quelle: https://de.wikipedia.org/wiki/Land_(Österreich)
    ["Aus wie vielen Bundesstaaten bestehen die USA?", 50, ""], // Quelle: https://de.wikipedia.org/wiki/Bundesstaat_der_Vereinigten_Staaten
    ["Wie lang ist der Erdumfang am Äquator?", 40075, "km"], // Quelle: https://de.wikipedia.org/wiki/Erde
    ["Wie tief ist der Marianengraben an der tiefsten Stelle etwa?", 11000, "m"], // Quelle: https://de.wikipedia.org/wiki/Marianengraben
    ["Wie weit ist der Mond im Mittel von der Erde entfernt?", 384400, "km"], // Quelle: https://de.wikipedia.org/wiki/Mond
    ["Wie weit ist die Sonne im Mittel von der Erde entfernt?", 150, "Mio. km"], // Quelle: https://de.wikipedia.org/wiki/Astronomische_Einheit
    ["Wie hoch ist der Brocken im Harz?", 1141, "m"], // Quelle: https://de.wikipedia.org/wiki/Brocken
    ["Wie hoch ist der Großglockner?", 3798, "m"], // Quelle: https://de.wikipedia.org/wiki/Großglockner
    ["Wie hoch ist das Matterhorn?", 4478, "m"], // Quelle: https://de.wikipedia.org/wiki/Matterhorn
    ["Wie hoch ist der Aconcagua?", 6961, "m"], // Quelle: https://de.wikipedia.org/wiki/Aconcagua
    ["Wie tief ist der Baikalsee an der tiefsten Stelle?", 1642, "m"], // Quelle: https://de.wikipedia.org/wiki/Baikalsee
    ["Wie lang ist der Nord-Ostsee-Kanal etwa?", 98, "km"], // Quelle: https://de.wikipedia.org/wiki/Nord-Ostsee-Kanal
    ["Wie lang ist der Panamakanal etwa?", 82, "km"], // Quelle: https://de.wikipedia.org/wiki/Panamakanal
    ["Wie lang ist der Sueskanal etwa?", 193, "km"], // Quelle: https://de.wikipedia.org/wiki/Sueskanal
    ["An wie viele Staaten grenzt Deutschland?", 9, ""], // Quelle: https://de.wikipedia.org/wiki/Deutschland
    ["In welchem Jahr wurde der Panamakanal eröffnet?", 1914, ""], // Quelle: https://de.wikipedia.org/wiki/Panamakanal
    ["In welchem Jahr wurde der Sueskanal eröffnet?", 1869, ""], // Quelle: https://de.wikipedia.org/wiki/Sueskanal
    ["Wie hoch ist der Watzmann?", 2713, "m"], // Quelle: https://de.wikipedia.org/wiki/Watzmann
    ["Wie hoch ist der Fuji?", 3776, "m"], // Quelle: https://de.wikipedia.org/wiki/Fuji_(Vulkan)
    ["Wie hoch ist der Denali, der höchste Berg Nordamerikas?", 6190, "m"], // Quelle: https://de.wikipedia.org/wiki/Denali
    ["Wie hoch ist der Elbrus im Kaukasus?", 5642, "m"], // Quelle: https://de.wikipedia.org/wiki/Elbrus
    ["Wie hoch ist der K2?", 8611, "m"], // Quelle: https://de.wikipedia.org/wiki/K2
    ["Wie viele Provinzen hat Kanada?", 10, ""], // Quelle: https://de.wikipedia.org/wiki/Provinzen_und_Territorien_Kanadas
    ["Wie groß ist die Fläche des Bodensees etwa?", 536, "km²"], // Quelle: https://de.wikipedia.org/wiki/Bodensee
    ["Wie groß ist die Fläche Deutschlands etwa?", 357000, "km²"], // Quelle: https://de.wikipedia.org/wiki/Deutschland
    ["Auf welcher Höhe über dem Meer liegt der Titicacasee etwa?", 3812, "m"], // Quelle: https://de.wikipedia.org/wiki/Titicacasee https://www.lernhelfer.de/schuelerlexikon/geografie/artikel/titicacasee-hoechstgelegener-see-der-welt

    ["Vom größten zum kleinsten Land:", ["Russland", "Kanada", "Brasilien", "Australien"]], // Quelle: https://de.wikipedia.org/wiki/Liste_der_Staaten_der_Erde
    ["Vom höchsten zum niedrigsten Berg:", ["Mount Everest", "K2", "Aconcagua", "Kilimandscharo"]], // Quelle: https://de.wikipedia.org/wiki/Seven_Summits https://de.wikipedia.org/wiki/K2
    ["Von Norden nach Süden:", ["Hamburg", "Hannover", "Frankfurt am Main", "München"]], // Quelle: https://de.wikipedia.org/wiki/Hamburg https://de.wikipedia.org/wiki/Hannover https://de.wikipedia.org/wiki/Frankfurt_am_Main https://de.wikipedia.org/wiki/München
    ["Von Westen nach Osten:", ["Lissabon", "Madrid", "Berlin", "Warschau"]], // Quelle: https://de.wikipedia.org/wiki/Lissabon https://de.wikipedia.org/wiki/Madrid https://de.wikipedia.org/wiki/Berlin https://de.wikipedia.org/wiki/Warschau
    ["Vom größten zum kleinsten Kontinent:", ["Asien", "Afrika", "Nordamerika", "Südamerika"]], // Quelle: https://de.wikipedia.org/wiki/Kontinent
    ["Vom größten zum kleinsten Ozean:", ["Pazifik", "Atlantik", "Indischer Ozean", "Arktischer Ozean"]], // Quelle: https://de.wikipedia.org/wiki/Ozean
    ["Vom längsten zum kürzesten Fluss:", ["Wolga", "Donau", "Rhein", "Elbe"]], // Quelle: https://de.wikipedia.org/wiki/Wolga https://de.wikipedia.org/wiki/Donau https://de.wikipedia.org/wiki/Rhein https://de.wikipedia.org/wiki/Elbe
    ["Bundesländer von der größten zur kleinsten Fläche:", ["Bayern", "Niedersachsen", "Baden-Württemberg", "Nordrhein-Westfalen"]], // Quelle: https://de.wikipedia.org/wiki/Land_(Deutschland)
    ["Länder von Norden nach Süden:", ["Norwegen", "Dänemark", "Deutschland", "Italien"]], // Quelle: https://de.wikipedia.org/wiki/Norwegen https://de.wikipedia.org/wiki/Dänemark https://de.wikipedia.org/wiki/Deutschland https://de.wikipedia.org/wiki/Italien
    ["Vom höchsten zum niedrigsten deutschen Berg:", ["Zugspitze", "Watzmann", "Feldberg", "Brocken"]], // Quelle: https://de.wikipedia.org/wiki/Zugspitze https://de.wikipedia.org/wiki/Watzmann https://de.wikipedia.org/wiki/Feldberg_(Schwarzwald) https://de.wikipedia.org/wiki/Brocken
    ["US-Städte von Westen nach Osten:", ["San Francisco", "Denver", "Chicago", "New York"]], // Quelle: https://de.wikipedia.org/wiki/San_Francisco https://de.wikipedia.org/wiki/Denver https://de.wikipedia.org/wiki/Chicago https://de.wikipedia.org/wiki/New_York_City
    ["Afrikanische Städte von Norden nach Süden:", ["Kairo", "Khartum", "Nairobi", "Kapstadt"]], // Quelle: https://de.wikipedia.org/wiki/Kairo https://de.wikipedia.org/wiki/Khartum https://de.wikipedia.org/wiki/Nairobi https://de.wikipedia.org/wiki/Kapstadt
    ["Von der größten zur kleinsten Insel:", ["Grönland", "Neuguinea", "Borneo", "Madagaskar"]], // Quelle: https://de.wikipedia.org/wiki/Liste_der_größten_Inseln_der_Erde
    ["Deutsche Städte von Westen nach Osten:", ["Aachen", "Köln", "Kassel", "Dresden"]], // Quelle: https://de.wikipedia.org/wiki/Aachen https://de.wikipedia.org/wiki/Köln https://de.wikipedia.org/wiki/Kassel https://de.wikipedia.org/wiki/Dresden
  ],
};
