import type { FragenKategorie } from "./typen";

export const NATUR: FragenKategorie = {
  id: "natur",
  name: "Natur & Tiere",
  emoji: "🦊",
  stufe: "familie",
  fragen: [
    ["Welches ist das größte heute lebende Tier?", "Blauwal", "Pottwal", "Afrikanischer Elefant", "Walhai"], // Quelle: https://de.wikipedia.org/wiki/Blauwal
    ["Zu welcher Tiergruppe gehört der Wal?", "Säugetiere", "Fische", "Reptilien", "Amphibien"], // Quelle: https://de.wikipedia.org/wiki/Wale
    ["Zu welcher Tiergruppe gehört der Frosch?", "Amphibien", "Reptilien", "Fische", "Säugetiere"], // Quelle: https://de.wikipedia.org/wiki/Froschlurche
    ["Wie nennt man ein junges Pferd?", "Fohlen", "Kalb", "Lamm", "Ferkel"], // Quelle: https://de.wikipedia.org/wiki/Fohlen
    ["Wie nennt man das Junge einer Ziege?", "Zicklein", "Fohlen", "Welpe", "Küken"], // Quelle: https://de.wikipedia.org/wiki/Liste_von_Bezeichnungen_f%C3%BCr_Haus-_und_Wildtiere
    ["Wo lebt der Eisbär in freier Natur?", "In der Arktis", "In der Antarktis", "In den Alpen", "In Patagonien"], // Quelle: https://de.wikipedia.org/wiki/Eisb%C3%A4r
    ["Auf welchem Kontinent brüten Kaiserpinguine?", "Antarktika", "Afrika", "Australien", "Südamerika"], // Quelle: https://de.wikipedia.org/wiki/Kaiserpinguin
    ["Was frisst ein Großer Panda hauptsächlich?", "Bambus", "Fisch", "Eukalyptus", "Gras"], // Quelle: https://de.wikipedia.org/wiki/Gro%C3%9Fer_Panda
    ["Was frisst ein Koala fast ausschließlich?", "Eukalyptusblätter", "Bambus", "Insekten", "Früchte"], // Quelle: https://de.wikipedia.org/wiki/Koala
    ["Womit atmen Fische?", "Mit Kiemen", "Mit Lungen", "Mit Tracheen", "Mit dem Magen"], // Quelle: https://de.wikipedia.org/wiki/Kieme
    ["Wie heißt die Verwandlung von der Raupe zum Schmetterling?", "Metamorphose", "Photosynthese", "Mitose", "Osmose"], // Quelle: https://de.wikipedia.org/wiki/Metamorphose_(Zoologie)
    ["Wie heißt das Ruhestadium zwischen Raupe und Schmetterling?", "Puppe", "Larve", "Ei", "Nymphe"], // Quelle: https://de.wikipedia.org/wiki/Schmetterlinge
    ["Welches Tier hat den längsten Hals?", "Giraffe", "Kamel", "Strauß", "Lama"], // Quelle: https://de.wikipedia.org/wiki/Giraffe
    ["Wie nennt man eine männliche Ente?", "Erpel", "Ganter", "Hengst", "Bulle"], // Quelle: https://de.wikipedia.org/wiki/Liste_von_Fachbegriffen_der_Rassegefl%C3%BCgelzucht
    ["Welches Gas geben Pflanzen bei der Photosynthese ab?", "Sauerstoff", "Stickstoff", "Kohlendioxid", "Methan"], // Quelle: https://de.wikipedia.org/wiki/Photosynthese
    ["Welcher Farbstoff macht Blätter grün?", "Chlorophyll", "Karotin", "Hämoglobin", "Melanin"], // Quelle: https://de.wikipedia.org/wiki/Chlorophylle
    ["Welches Gas nehmen Pflanzen für die Photosynthese auf?", "Kohlendioxid", "Sauerstoff", "Stickstoff", "Helium"], // Quelle: https://de.wikipedia.org/wiki/Photosynthese
    ["Wie viele Herzen hat ein Krake?", "Drei", "Eins", "Zwei", "Vier"], // Quelle: https://de.wikipedia.org/wiki/Gew%C3%B6hnlicher_Krake
    ["Wie viele Arme hat ein Krake?", "Acht", "Zehn", "Sechs", "Zwölf"], // Quelle: https://de.wikipedia.org/wiki/Kraken
    ["Welches dieser Tiere ist kein Säugetier?", "Pinguin", "Delfin", "Fledermaus", "Wal"], // Quelle: https://de.wikipedia.org/wiki/Pinguine
    ["Welches Säugetier kann aktiv fliegen?", "Fledermaus", "Maulwurf", "Igel", "Biber"], // Quelle: https://de.wikipedia.org/wiki/Fledertiere
    ["Welcher Baum trägt Eicheln?", "Eiche", "Buche", "Linde", "Kastanie"], // Quelle: https://de.wikipedia.org/wiki/Eichen
    ["Welcher Baum trägt Bucheckern?", "Buche", "Eiche", "Ahorn", "Birke"], // Quelle: https://de.wikipedia.org/wiki/Rotbuche
    ["Welcher Nadelbaum verliert im Winter seine Nadeln?", "Lärche", "Fichte", "Tanne", "Kiefer"], // Quelle: https://de.wikipedia.org/wiki/L%C3%A4rchen
    ["Welcher Baum hat eine weiße Rinde mit dunklen Flecken?", "Birke", "Eiche", "Fichte", "Buche"], // Quelle: https://de.wikipedia.org/wiki/H%C3%A4nge-Birke
    ["Wie nennt man Tiere, die Pflanzen und Fleisch fressen?", "Allesfresser", "Pflanzenfresser", "Fleischfresser", "Aasfresser"], // Quelle: https://de.wikipedia.org/wiki/Allesfresser
    ["Welches dieser Tiere hält Winterschlaf?", "Igel", "Fuchs", "Reh", "Wildschwein"], // Quelle: https://de.wikipedia.org/wiki/Braunbrustigel
    ["Welches dieser Tiere hält keinen Winterschlaf?", "Eichhörnchen", "Igel", "Siebenschläfer", "Murmeltier"], // Quelle: https://de.wikipedia.org/wiki/Eurasisches_Eichh%C3%B6rnchen https://de.wikipedia.org/wiki/Siebenschl%C3%A4fer https://de.wikipedia.org/wiki/Winterschlaf
    ["Welcher Vogel legt seine Eier in fremde Nester?", "Kuckuck", "Amsel", "Storch", "Specht"], // Quelle: https://de.wikipedia.org/wiki/Kuckuck
    ["Welcher Vogel hämmert Löcher in Baumstämme?", "Specht", "Eule", "Rabe", "Meise"], // Quelle: https://de.wikipedia.org/wiki/Spechte
    ["Welcher Vogel kann seinen Kopf um etwa 270 Grad drehen?", "Eule", "Storch", "Ente", "Huhn"], // Quelle: https://de.wikipedia.org/wiki/Eulen
    ["Wie heißt die Wohnung eines Fuchses?", "Bau", "Horst", "Kobel", "Stall"], // Quelle: https://de.wikipedia.org/wiki/Rotfuchs
    ["Wie heißt das Nest eines Eichhörnchens?", "Kobel", "Horst", "Bau", "Burg"], // Quelle: https://de.wikipedia.org/wiki/Eurasisches_Eichh%C3%B6rnchen
    ["Wie heißt das Nest eines Greifvogels?", "Horst", "Kobel", "Bau", "Wabe"], // Quelle: https://de.wikipedia.org/wiki/Horst_(Nest)
    ["Worin lagern Honigbienen ihren Honig?", "In Waben", "Im Kobel", "In Blüten", "Im Horst"], // Quelle: https://de.wikipedia.org/wiki/Bienenwabe
    ["Wie heißen die männlichen Honigbienen?", "Drohnen", "Arbeiterinnen", "Königinnen", "Ammen"], // Quelle: https://de.wikipedia.org/wiki/Drohne_(Hautfl%C3%BCgler)
    ["Was sind die Stoßzähne eines Elefanten?", "Schneidezähne", "Eckzähne", "Hörner", "Backenzähne"], // Quelle: https://de.wikipedia.org/wiki/Afrikanischer_Elefant
    ["Woraus besteht das Horn eines Nashorns?", "Keratin", "Knochen", "Elfenbein", "Kalk"], // Quelle: https://de.wikipedia.org/wiki/Nash%C3%B6rner
    ["Welche Farbe hat die Haut eines erwachsenen Eisbären?", "Schwarz", "Weiß", "Rosa", "Gelb"], // Quelle: https://de.wikipedia.org/wiki/B%C3%A4renfell
    ["Wie viele Höcker hat ein Dromedar?", "Einen", "Zwei", "Drei", "Keinen"], // Quelle: https://de.wikipedia.org/wiki/Dromedar
    ["Was speichert ein Kamel in seinen Höckern?", "Fett", "Wasser", "Blut", "Luft"], // Quelle: https://de.wikipedia.org/wiki/Kamele
    ["Welche dieser Tiere sind Beuteltiere?", "Kängurus", "Biber", "Lemuren", "Gürteltiere"], // Quelle: https://de.wikipedia.org/wiki/K%C3%A4ngurus
    ["Welches dieser Tiere ist ein Fisch?", "Seepferdchen", "Seestern", "Qualle", "Seeigel"], // Quelle: https://de.wikipedia.org/wiki/Seepferdchen
    ["Welches Tier gehört zu den Spinnentieren?", "Zecke", "Ameise", "Käfer", "Libelle"], // Quelle: https://de.wikipedia.org/wiki/Zecken
    ["Wie viele Flügel hat eine Libelle?", "Vier", "Zwei", "Sechs", "Acht"], // Quelle: https://de.wikipedia.org/wiki/Libellen
    ["Wie nennt man ein junges Reh?", "Kitz", "Fohlen", "Ferkel", "Lamm"], // Quelle: https://de.wikipedia.org/wiki/Reh
    ["Wie heißt ein junges Wildschwein?", "Frischling", "Kitz", "Fohlen", "Lamm"], // Quelle: https://de.wikipedia.org/wiki/Wildschwein
    ["Wie heißt das weibliche Reh?", "Ricke", "Bache", "Fähe", "Stute"], // Quelle: https://de.wikipedia.org/wiki/Reh
    ["Wie heißt das weibliche Wildschwein?", "Bache", "Ricke", "Fähe", "Stute"], // Quelle: https://de.wikipedia.org/wiki/Wildschwein
    ["Wie nennt man einen weiblichen Fuchs?", "Fähe", "Bache", "Ricke", "Henne"], // Quelle: https://de.wikipedia.org/wiki/Rotfuchs
    ["Was ist ein Hai?", "Ein Fisch", "Ein Säugetier", "Ein Reptil", "Eine Amphibie"], // Quelle: https://de.wikipedia.org/wiki/Knorpelfische
    ["Woraus besteht das Skelett eines Hais?", "Knorpel", "Knochen", "Chitin", "Kalk"], // Quelle: https://de.wikipedia.org/wiki/Haie
    ["Woraus besteht der Panzer von Insekten hauptsächlich?", "Chitin", "Keratin", "Kalk", "Zellulose"], // Quelle: https://de.wikipedia.org/wiki/Insekten
    ["Welcher dieser Vögel ist ein Zugvogel?", "Mauersegler", "Haussperling", "Elster", "Buntspecht"], // Quelle: https://de.wikipedia.org/wiki/Standvogel https://de.wikipedia.org/wiki/Segler_(V%C3%B6gel)
    ["Welches dieser Tiere ist ein Nagetier?", "Biber", "Igel", "Maulwurf", "Fledermaus"], // Quelle: https://de.wikipedia.org/wiki/Biber
    ["Welche Tiergruppe ist wechselwarm?", "Reptilien", "Vögel", "Säugetiere", "Beuteltiere"], // Quelle: https://de.wikipedia.org/wiki/Wechselwarmes_Tier
    ["Welches Tier ist für seinen Farbwechsel bekannt?", "Chamäleon", "Leguan", "Schildkröte", "Krokodil"], // Quelle: https://de.wikipedia.org/wiki/Cham%C3%A4leons
    ["Welches Tier kann bei Gefahr seinen Schwanz abwerfen?", "Eidechse", "Schlange", "Schildkröte", "Krokodil"], // Quelle: https://de.wikipedia.org/wiki/Autotomie
    ["Wozu züngelt eine Schlange?", "Um Gerüche aufzunehmen", "Um zu trinken", "Um zu hören", "Um sich abzukühlen"], // Quelle: https://de.wikipedia.org/wiki/Schlangen
    ["Welche Pflanze speichert in der Wüste Wasser?", "Kaktus", "Farn", "Moos", "Seerose"], // Quelle: https://de.wikipedia.org/wiki/Kakteengew%C3%A4chse
    ["Wie vermehren sich Farne?", "Durch Sporen", "Durch Samen", "Durch Zwiebeln", "Durch Früchte"], // Quelle: https://de.wikipedia.org/wiki/Farne
    ["Welcher Pflanzenteil nimmt Wasser aus dem Boden auf?", "Wurzel", "Blatt", "Blüte", "Frucht"], // Quelle: https://de.wikipedia.org/wiki/Wurzel_(Pflanze)
    ["Was ist eine Tomate botanisch gesehen?", "Eine Beere", "Eine Nuss", "Eine Steinfrucht", "Ein Zapfen"], // Quelle: https://de.wikipedia.org/wiki/Tomate
    ["Was ist eine Kirsche botanisch gesehen?", "Eine Steinfrucht", "Eine Beere", "Eine Nuss", "Eine Kapsel"], // Quelle: https://de.wikipedia.org/wiki/Steinfrucht
    ["Welche Pflanze fängt Insekten?", "Venusfliegenfalle", "Löwenzahn", "Klee", "Brennnessel"], // Quelle: https://de.wikipedia.org/wiki/Venusfliegenfalle
    ["Womit verursacht die Brennnessel das Brennen?", "Mit Brennhaaren", "Mit Dornen", "Mit Pollen", "Mit Wurzeln"], // Quelle: https://de.wikipedia.org/wiki/Gro%C3%9Fe_Brennnessel
    ["Wie nennt man den Fruchtstand des Löwenzahns?", "Pusteblume", "Kätzchen", "Zapfen", "Dolde"], // Quelle: https://de.wikipedia.org/wiki/Gew%C3%B6hnlicher_L%C3%B6wenzahn
    ["Welcher dieser Bäume bildet Zapfen?", "Fichte", "Eiche", "Linde", "Buche"], // Quelle: https://de.wikipedia.org/wiki/Fichten
    ["Wie viele Jahresringe bildet ein Baum bei uns pro Jahr?", "Einen", "Zwei", "Vier", "Zwölf"], // Quelle: https://de.wikipedia.org/wiki/Jahresring
    ["Welcher Menschenaffe lebt auf Borneo und Sumatra?", "Orang-Utan", "Gorilla", "Schimpanse", "Bonobo"], // Quelle: https://de.wikipedia.org/wiki/Orang-Utans
    ["Welche Großkatze lebt in Rudeln?", "Löwe", "Tiger", "Leopard", "Jaguar"], // Quelle: https://de.wikipedia.org/wiki/L%C3%B6we
    ["Welche Großkatze hat Streifen?", "Tiger", "Löwe", "Leopard", "Gepard"], // Quelle: https://de.wikipedia.org/wiki/Tiger
    ["Auf welchem Kontinent leben Tiger in freier Natur?", "Asien", "Afrika", "Südamerika", "Australien"], // Quelle: https://de.wikipedia.org/wiki/Tiger
    ["Auf welchem Doppelkontinent lebt der Jaguar?", "Amerika", "Afrika", "Asien", "Australien"], // Quelle: https://de.wikipedia.org/wiki/Jaguar
    ["Welcher Vogel ist der größte der Erde?", "Strauß", "Emu", "Kasuar", "Albatros"], // Quelle: https://de.wikipedia.org/wiki/Afrikanischer_Strau%C3%9F
    ["Welcher dieser Vögel kann nicht fliegen?", "Kiwi", "Kranich", "Möwe", "Falke"], // Quelle: https://de.wikipedia.org/wiki/Kiwis
    ["Wie schlafen Fledermäuse meistens?", "Kopfüber hängend", "Im Wasser", "Auf dem Rücken", "Im Flug"], // Quelle: https://de.wikipedia.org/wiki/Fledertiere
    ["Womit orientieren sich Fledermäuse im Dunkeln?", "Mit Echoortung", "Mit Wärmebildern", "Mit Leuchtorganen", "Mit den Barthaaren"], // Quelle: https://de.wikipedia.org/wiki/Flederm%C3%A4use
    ["Womit atmen Delfine?", "Mit Lungen", "Mit Kiemen", "Über die Haut", "Mit der Schwimmblase"], // Quelle: https://de.wikipedia.org/wiki/Delfine
    ["Welches Tier baut Dämme in Bächen und Flüssen?", "Biber", "Fischotter", "Igel", "Dachs"], // Quelle: https://de.wikipedia.org/wiki/Biber
    ["Wie heißt das Larvenstadium des Frosches?", "Kaulquappe", "Raupe", "Made", "Nymphe"], // Quelle: https://de.wikipedia.org/wiki/Kaulquappe
    ["Wie heißt die Larve einer Fliege?", "Made", "Raupe", "Kaulquappe", "Engerling"], // Quelle: https://de.wikipedia.org/wiki/Made
    ["Wie heißt die Larve des Maikäfers?", "Engerling", "Made", "Raupe", "Kaulquappe"], // Quelle: https://de.wikipedia.org/wiki/Engerling
    ["Welches Tier liefert die Seide für Stoffe?", "Seidenraupe", "Kreuzspinne", "Biene", "Ameise"], // Quelle: https://de.wikipedia.org/wiki/Seidenspinner
    ["Welches dieser Tiere ist ein Weichtier?", "Schnecke", "Krebs", "Spinne", "Regenwurm"], // Quelle: https://de.wikipedia.org/wiki/Schnecken
    ["Wie viele Augen hat eine Honigbiene?", "Fünf", "Zwei", "Drei", "Acht"], // Quelle: https://de.wikipedia.org/wiki/Westliche_Honigbiene
    ["Welches Tier lebt in einem Staat mit einer Königin?", "Ameise", "Spinne", "Marienkäfer", "Libelle"], // Quelle: https://de.wikipedia.org/wiki/Ameisen
    ["Welche Farbe hat das Blut eines Kraken?", "Blau", "Rot", "Grün", "Gelb"], // Quelle: https://de.wikipedia.org/wiki/H%C3%A4mocyanin
    ["Welche dieser Pflanzen ist ein Getreide?", "Weizen", "Raps", "Kartoffel", "Sonnenblume"], // Quelle: https://de.wikipedia.org/wiki/Weizen
    ["Aus welcher Pflanze wird in Europa meist Zucker gewonnen?", "Zuckerrübe", "Zuckerrohr", "Mais", "Kartoffel"], // Quelle: https://de.wikipedia.org/wiki/Zuckerr%C3%BCbe
    ["Welches Gewürz stammt aus der Rinde eines Baumes?", "Zimt", "Pfeffer", "Muskat", "Nelke"], // Quelle: https://de.wikipedia.org/wiki/Zimt
    ["Was ist die Kartoffel botanisch gesehen?", "Eine Sprossknolle", "Eine Wurzel", "Eine Frucht", "Ein Samen"], // Quelle: https://de.wikipedia.org/wiki/Kartoffel
    ["Aus welchem Teil der Krokusblüte wird Safran gewonnen?", "Aus den Narben", "Aus den Wurzeln", "Aus den Samen", "Aus den Blättern"], // Quelle: https://de.wikipedia.org/wiki/Safran
    ["Woraus ist Bernstein entstanden?", "Aus Baumharz", "Aus Honig", "Aus Sand", "Aus Fischschuppen"], // Quelle: https://de.wikipedia.org/wiki/Bernstein
    ["Wie heißt das Fadengeflecht der Pilze im Boden?", "Myzel", "Moos", "Spore", "Wurzelstock"], // Quelle: https://de.wikipedia.org/wiki/Myzel
    ["Welches dieser Tiere ist ein Paarhufer?", "Rind", "Pferd", "Esel", "Zebra"], // Quelle: https://de.wikipedia.org/wiki/Paarhufer
    ["Welches dieser Tiere ist ein Unpaarhufer?", "Pferd", "Rind", "Schaf", "Ziege"], // Quelle: https://de.wikipedia.org/wiki/Unpaarhufer
    ["Wie viele Magenabschnitte hat eine Kuh?", "Vier", "Zwei", "Einen", "Sechs"], // Quelle: https://de.wikipedia.org/wiki/Hausrind
    ["Wie heißen die Ohren des Hasen in der Jägersprache?", "Löffel", "Lichter", "Blume", "Lunte"], // Quelle: https://de.wikipedia.org/wiki/J%C3%A4gersprache https://de.wikipedia.org/wiki/Liste_von_Bezeichnungen_f%C3%BCr_Haus-_und_Wildtiere
    ["Was ist ein Axolotl?", "Ein Schwanzlurch", "Ein Fisch", "Eine Echse", "Ein Krebs"], // Quelle: https://de.wikipedia.org/wiki/Axolotl
    ["Was sind Korallen?", "Tiere", "Pflanzen", "Steine", "Pilze"], // Quelle: https://de.wikipedia.org/wiki/Korallen
    ["Zu welcher Tiergruppe gehört der Seestern?", "Stachelhäuter", "Fische", "Quallen", "Krebse"], // Quelle: https://de.wikipedia.org/wiki/Seesterne
    ["Wie viele Arme hat ein typischer Seestern?", "Fünf", "Vier", "Sechs", "Acht"], // Quelle: https://de.wikipedia.org/wiki/Seesterne
    ["Welcher Wal hat einen langen, gedrehten Stoßzahn?", "Narwal", "Belugawal", "Orca", "Pottwal"], // Quelle: https://de.wikipedia.org/wiki/Narwal
    ["Welches Tier wird auch Schwertwal genannt?", "Orca", "Narwal", "Pottwal", "Grönlandwal"], // Quelle: https://de.wikipedia.org/wiki/Schwertwal
    ["Was fressen Bartenwale hauptsächlich?", "Krill", "Robben", "Seetang", "Haie"], // Quelle: https://de.wikipedia.org/wiki/Bartenwale
    ["Von welchem Wildtier stammt der Haushund ab?", "Wolf", "Fuchs", "Schakal", "Hyäne"], // Quelle: https://de.wikipedia.org/wiki/Haushund
    ["Von welchem Wildtier stammt das Hausrind ab?", "Auerochse", "Wisent", "Bison", "Wasserbüffel"], // Quelle: https://de.wikipedia.org/wiki/Hausrind
    ["Wie heißt die Wissenschaft von den Pflanzen?", "Botanik", "Zoologie", "Geologie", "Astronomie"], // Quelle: https://de.wikipedia.org/wiki/Botanik
    ["Wie heißt die Wissenschaft von den Vögeln?", "Ornithologie", "Entomologie", "Ichthyologie", "Mykologie"], // Quelle: https://de.wikipedia.org/wiki/Ornithologie
    ["Womit befasst sich die Entomologie?", "Mit Insekten", "Mit Fischen", "Mit Vögeln", "Mit Pilzen"], // Quelle: https://de.wikipedia.org/wiki/Entomologie
    ["Wie nennt man die Eier von Fröschen?", "Laich", "Kaviar", "Pollen", "Sporen"], // Quelle: https://de.wikipedia.org/wiki/Laich
    ["Welche dieser Schlangen ist in Deutschland giftig?", "Kreuzotter", "Ringelnatter", "Schlingnatter", "Äskulapnatter"], // Quelle: https://de.wikipedia.org/wiki/Kreuzotter
    ["Welcher Käfer hat oft rote Flügel mit schwarzen Punkten?", "Marienkäfer", "Maikäfer", "Hirschkäfer", "Mistkäfer"], // Quelle: https://de.wikipedia.org/wiki/Siebenpunkt-Marienk%C3%A4fer
    ["Welcher Käfer hat geweihartige Oberkiefer?", "Hirschkäfer", "Marienkäfer", "Maikäfer", "Laufkäfer"], // Quelle: https://de.wikipedia.org/wiki/Hirschk%C3%A4fer
    ["Was sind Flechten?", "Pilz und Alge zusammen", "Junge Moose", "Kleine Farne", "Bakterienkolonien"], // Quelle: https://de.wikipedia.org/wiki/Flechte
    ["Was bedeutet Symbiose?", "Zusammenleben mit Nutzen", "Kampf um Nahrung", "Fressen und Gefressenwerden", "Leben als Einzelgänger"], // Quelle: https://de.wikipedia.org/wiki/Symbiose
    ["Welche Echse läuft dank feiner Härchen an Glas hoch?", "Gecko", "Leguan", "Waran", "Chamäleon"], // Quelle: https://de.wikipedia.org/wiki/Geckos
    ["Was ist ein Siebenschläfer?", "Ein Nagetier", "Ein Vogel", "Ein Insekt", "Eine Fledermaus"], // Quelle: https://de.wikipedia.org/wiki/Siebenschl%C3%A4fer
    ["Welcher heimische Vogel hat eine orangerote Brust?", "Rotkehlchen", "Blaumeise", "Amsel", "Haussperling"], // Quelle: https://de.wikipedia.org/wiki/Rotkehlchen
    ["Welcher Vogel klappert laut mit dem Schnabel?", "Weißstorch", "Kranich", "Graureiher", "Schwan"], // Quelle: https://de.wikipedia.org/wiki/Wei%C3%9Fstorch
    ["Woher haben Flamingos ihre rosa Farbe?", "Aus ihrer Nahrung", "Vom Sonnenlicht", "Vom Salzwasser", "Von der Kälte"], // Quelle: https://de.wikipedia.org/wiki/Zwergflamingo
    ["Wie viele Zehen hat ein Pferd an jedem Bein?", 1, "Zehen"], // Quelle: https://de.wikipedia.org/wiki/Pferde
    ["Wie viele Zähne hat ein erwachsener Hund?", 42, "Zähne"], // Quelle: https://de.wikipedia.org/wiki/Haushund
    ["Wie viele Zähne hat eine erwachsene Katze?", 30, "Zähne"], // Quelle: https://de.wikipedia.org/wiki/Hauskatze
    ["Wie viele Monate dauert die Tragzeit beim Afrikanischen Elefanten etwa?", 22, "Monate"], // Quelle: https://de.wikipedia.org/wiki/Afrikanischer_Elefant
    ["Wie viele Tage brütet ein Huhn seine Eier aus?", 21, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Haushuhn
    ["Wie viele Monate ist eine Kuh etwa trächtig?", 9, "Monate"], // Quelle: https://de.wikipedia.org/wiki/Tr%C3%A4chtigkeit
    ["Wie viele Tage ist eine Hündin etwa trächtig?", 63, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Haushund
    ["Wie viele Augen hat eine typische Spinne?", 8, "Augen"], // Quelle: https://de.wikipedia.org/wiki/Webspinnen
    ["Wie lang kann ein Blauwal höchstens etwa werden?", 33, "m"], // Quelle: https://de.wikipedia.org/wiki/Blauwal
    ["Wie viel wiegt ein Afrikanischer Elefantenbulle etwa?", 6000, "kg"], // Quelle: https://de.wikipedia.org/wiki/Afrikanischer_Elefant
    ["Wie viele Monate ist eine Stute etwa trächtig?", 11, "Monate"], // Quelle: https://de.wikipedia.org/wiki/Hauspferd
    ["Wie viele Zehen hat ein Strauß an jedem Fuß?", 2, "Zehen"], // Quelle: https://de.wikipedia.org/wiki/Afrikanischer_Strau%C3%9F
    ["Aus wie vielen Körperabschnitten besteht ein Insekt?", 3, "Abschnitte"], // Quelle: https://de.wikipedia.org/wiki/Insekten
    ["Aus wie vielen Körperabschnitten besteht eine Spinne?", 2, "Abschnitte"], // Quelle: https://de.wikipedia.org/wiki/Webspinnen
    ["Wie viele Ecken hat eine Zelle der Bienenwabe?", 6, "Ecken"], // Quelle: https://de.wikipedia.org/wiki/Bienenwabe
    ["Wie viele Blättchen hat ein gewöhnliches Kleeblatt?", 3, "Blättchen"], // Quelle: https://de.wikipedia.org/wiki/Klee
    ["Wie viele Kiemenspalten haben die meisten Haie je Körperseite?", 5, "Spalten"], // Quelle: https://de.wikipedia.org/wiki/Haie
    ["Wie viele Tage brütet eine Stockente ihre Eier etwa aus?", 27, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Stockente
    ["Wie viele Flügel hat ein Schmetterling?", 4, "Flügel"], // Quelle: https://de.wikipedia.org/wiki/Schmetterlinge
    ["Zu wie viel Prozent besteht eine Qualle etwa aus Wasser?", 98, "%"], // Quelle: https://de.wikipedia.org/wiki/Quallen
    ["Wie viele Tage ist ein Kaninchen etwa trächtig?", 31, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Hauskaninchen
    ["Wie viele Tage ist eine Sau etwa trächtig?", 114, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Hausschwein
    ["Wie viele Hörner hat ein Panzernashorn?", 1, "Horn"], // Quelle: https://de.wikipedia.org/wiki/Panzernashorn
    ["Wie viele Hörner hat ein Breitmaulnashorn?", 2, "Hörner"], // Quelle: https://de.wikipedia.org/wiki/Breitmaulnashorn
    ["Wie viel wiegt ein Hühnerei etwa?", 60, "g"], // Quelle: https://de.wikipedia.org/wiki/H%C3%BChnerei
    ["Wie viele Tage dauert es vom Ei bis zur fertigen Arbeitsbiene?", 21, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Westliche_Honigbiene
    ["Wie viele Zehen hat eine Hauskatze an einer Hinterpfote?", 4, "Zehen"], // Quelle: https://de.wikipedia.org/wiki/Hauskatze
    ["Vom leichtesten zum schwersten Tier:", ["Maus", "Katze", "Pferd", "Elefant"]], // Quelle: https://de.wikipedia.org/wiki/Hausmaus https://de.wikipedia.org/wiki/Hauskatze https://de.wikipedia.org/wiki/Hauspferd https://de.wikipedia.org/wiki/Elefanten
    ["Vom kleinsten zum größten Vogel:", ["Kolibri", "Spatz", "Taube", "Strauß"]], // Quelle: https://de.wikipedia.org/wiki/Kolibris https://de.wikipedia.org/wiki/Haussperling https://de.wikipedia.org/wiki/Stra%C3%9Fentaube https://de.wikipedia.org/wiki/Afrikanischer_Strau%C3%9F
    ["Von der kürzesten zur längsten Tragzeit:", ["Maus", "Hund", "Kuh", "Elefant"]], // Quelle: https://de.wikipedia.org/wiki/Tr%C3%A4chtigkeit
    ["Entwicklung des Frosches, vom Anfang an:", ["Laich", "Kaulquappe", "Jungfrosch", "Frosch"]], // Quelle: https://de.wikipedia.org/wiki/Froschlurche https://de.wikipedia.org/wiki/Kaulquappe
    ["Entwicklung des Schmetterlings, vom Anfang an:", ["Ei", "Raupe", "Puppe", "Falter"]], // Quelle: https://de.wikipedia.org/wiki/Schmetterlinge
    ["Von der kleinsten zur größten Katze:", ["Hauskatze", "Luchs", "Leopard", "Tiger"]], // Quelle: https://de.wikipedia.org/wiki/Hauskatze https://de.wikipedia.org/wiki/Eurasischer_Luchs https://de.wikipedia.org/wiki/Leopard https://de.wikipedia.org/wiki/Tiger
    ["Von den wenigsten zu den meisten Beinen:", ["Huhn", "Hund", "Käfer", "Spinne"]], // Quelle: https://de.wikipedia.org/wiki/Haushuhn https://de.wikipedia.org/wiki/Haushund https://de.wikipedia.org/wiki/K%C3%A4fer https://de.wikipedia.org/wiki/Webspinnen
    ["Vom kleinsten zum größten Meerestier:", ["Krill", "Hering", "Delfin", "Blauwal"]], // Quelle: https://de.wikipedia.org/wiki/Krill https://de.wikipedia.org/wiki/Atlantischer_Hering https://de.wikipedia.org/wiki/Delfine https://de.wikipedia.org/wiki/Blauwal
    ["Vom kleinsten zum größten Hirsch:", ["Reh", "Damhirsch", "Rothirsch", "Elch"]], // Quelle: https://de.wikipedia.org/wiki/Reh https://de.wikipedia.org/wiki/Damhirsch https://de.wikipedia.org/wiki/Rothirsch https://de.wikipedia.org/wiki/Elch
    ["Vom kleinsten zum größten Pinguin:", ["Zwergpinguin", "Brillenpinguin", "Königspinguin", "Kaiserpinguin"]], // Quelle: https://de.wikipedia.org/wiki/Zwergpinguin https://de.wikipedia.org/wiki/Brillenpinguin https://de.wikipedia.org/wiki/K%C3%B6nigspinguin https://de.wikipedia.org/wiki/Kaiserpinguin
    ["Vom kleinsten zum größten Wal:", ["Schweinswal", "Orca", "Pottwal", "Blauwal"]], // Quelle: https://de.wikipedia.org/wiki/Schweinswal https://de.wikipedia.org/wiki/Schwertwal https://de.wikipedia.org/wiki/Pottwal https://de.wikipedia.org/wiki/Blauwal
    ["Vom kleinsten zum größten Nagetier:", ["Maus", "Ratte", "Biber", "Wasserschwein"]], // Quelle: https://de.wikipedia.org/wiki/Hausmaus https://de.wikipedia.org/wiki/Wanderratte https://de.wikipedia.org/wiki/Biber https://de.wikipedia.org/wiki/Capybara
  ],
};
