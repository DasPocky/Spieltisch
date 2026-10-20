import type { FragenKategorie } from "./typen";

export const KINDER: FragenKategorie = {
  id: "kinder",
  name: "Kinderquiz",
  emoji: "🧸",
  stufe: "kinder",
  fragen: [
    ["Welches Tier macht „Muh“?", "Kuh", "Schaf", "Ziege", "Pferd"], // Quelle: https://de.wikipedia.org/wiki/Hausrind
    ["Welches Tier macht „Mäh“?", "Schaf", "Kuh", "Hund", "Katze"], // Quelle: https://de.wikipedia.org/wiki/Hausschaf
    ["Welches Tier bellt?", "Hund", "Katze", "Maus", "Huhn"], // Quelle: https://de.wikipedia.org/wiki/Haushund
    ["Welches Tier miaut?", "Katze", "Hund", "Kuh", "Ente"], // Quelle: https://de.wikipedia.org/wiki/Hauskatze
    ["Welches Tier legt Eier?", "Huhn", "Kuh", "Hund", "Pferd"], // Quelle: https://de.wikipedia.org/wiki/Haushuhn
    ["Wo lebt ein Fisch?", "Im Wasser", "Im Nest", "Im Stall", "Auf dem Baum"], // Quelle: https://de.wikipedia.org/wiki/Fische
    ["Welches Tier hat einen langen Rüssel?", "Elefant", "Giraffe", "Löwe", "Nashorn"], // Quelle: https://de.wikipedia.org/wiki/Elefanten
    ["Welches Tier hat den längsten Hals?", "Giraffe", "Elefant", "Zebra", "Kamel"], // Quelle: https://de.wikipedia.org/wiki/Giraffen
    ["Welches Tier hat schwarze und weiße Streifen?", "Zebra", "Giraffe", "Löwe", "Leopard"], // Quelle: https://de.wikipedia.org/wiki/Zebras
    ["Welches Tier nennt man den „König der Tiere“?", "Löwe", "Tiger", "Bär", "Elefant"], // Quelle: https://de.wikipedia.org/wiki/Löwe
    ["Welches Tier hüpft und trägt sein Baby in einem Beutel?", "Känguru", "Hase", "Frosch", "Eichhörnchen"], // Quelle: https://de.wikipedia.org/wiki/Kängurus
    ["Welches Tier hat Stacheln und rollt sich zu einer Kugel?", "Igel", "Maus", "Hamster", "Maulwurf"], // Quelle: https://de.wikipedia.org/wiki/Braunbrustigel
    ["Welches Tier spinnt ein Netz?", "Spinne", "Ameise", "Biene", "Käfer"], // Quelle: https://de.wikipedia.org/wiki/Webspinnen
    ["Welches Tier macht Honig?", "Biene", "Mücke", "Fliege", "Ameise"], // Quelle: https://de.wikipedia.org/wiki/Honigbienen
    ["Aus einer Raupe wird ein …", "Schmetterling", "Käfer", "Biene", "Spinne"], // Quelle: https://de.wikipedia.org/wiki/Raupe
    ["Aus einer Kaulquappe wird ein …", "Frosch", "Fisch", "Schnecke", "Eidechse"], // Quelle: https://de.wikipedia.org/wiki/Kaulquappe
    ["Welches Tier trägt sein Haus auf dem Rücken?", "Schnecke", "Igel", "Käfer", "Wurm"], // Quelle: https://de.wikipedia.org/wiki/Schnecken
    ["Welches dieser Tiere kann fliegen?", "Fledermaus", "Pinguin", "Strauß", "Maulwurf"], // Quelle: https://de.wikipedia.org/wiki/Fledertiere
    ["Welcher Vogel kann nicht fliegen?", "Pinguin", "Adler", "Spatz", "Taube"], // Quelle: https://de.wikipedia.org/wiki/Pinguine
    ["Wie heißt das Kind vom Pferd?", "Fohlen", "Kalb", "Lamm", "Ferkel"], // Quelle: https://de.wikipedia.org/wiki/Fohlen
    ["Wie heißt das Kind von der Kuh?", "Kalb", "Fohlen", "Welpe", "Küken"], // Quelle: https://de.wikipedia.org/wiki/Kalb
    ["Wie heißt das Kind vom Schaf?", "Lamm", "Ferkel", "Fohlen", "Kalb"], // Quelle: https://de.wikipedia.org/wiki/Lamm
    ["Wie heißt das Kind vom Schwein?", "Ferkel", "Lamm", "Kalb", "Welpe"], // Quelle: https://de.wikipedia.org/wiki/Ferkel
    ["Wie heißt das Kind vom Hund?", "Welpe", "Küken", "Ferkel", "Fohlen"], // Quelle: https://de.wikipedia.org/wiki/Welpe
    ["Wie heißt das Kind vom Huhn?", "Küken", "Welpe", "Lamm", "Kalb"], // Quelle: https://de.wikipedia.org/wiki/Küken
    ["Welches Tier hält einen Winterschlaf?", "Igel", "Fuchs", "Reh", "Wildschwein"], // Quelle: https://de.wikipedia.org/wiki/Winterschlaf
    ["Welches ist das größte Tier der Welt?", "Blauwal", "Elefant", "Giraffe", "Hai"], // Quelle: https://de.wikipedia.org/wiki/Blauwal
    ["Welches Tier hat Höcker auf dem Rücken?", "Kamel", "Pferd", "Esel", "Lama"], // Quelle: https://de.wikipedia.org/wiki/Kamele
    ["Welches ist das schnellste Tier an Land?", "Gepard", "Löwe", "Pferd", "Hase"], // Quelle: https://de.wikipedia.org/wiki/Gepard
    ["Was frisst ein Panda am liebsten?", "Bambus", "Fisch", "Honig", "Bananen"], // Quelle: https://de.wikipedia.org/wiki/Großer_Panda
    ["Welches Tier hat einen harten Panzer?", "Schildkröte", "Frosch", "Schlange", "Eidechse"], // Quelle: https://de.wikipedia.org/wiki/Schildkröten
    ["Welches Tier gibt uns Wolle?", "Schaf", "Kuh", "Schwein", "Huhn"], // Quelle: https://de.wikipedia.org/wiki/Wolle
    ["Welches Tier gibt Milch, die wir oft trinken?", "Kuh", "Huhn", "Ente", "Gans"], // Quelle: https://de.wikipedia.org/wiki/Kuhmilch
    ["Welches Tier grunzt im Stall?", "Schwein", "Pferd", "Schaf", "Huhn"], // Quelle: https://de.wikipedia.org/wiki/Hausschwein
    ["Welches Tier kräht am Morgen?", "Hahn", "Henne", "Ente", "Gans"], // Quelle: https://de.wikipedia.org/wiki/Haushuhn
    ["Welches Tier wiehert?", "Pferd", "Kuh", "Schaf", "Hund"], // Quelle: https://de.wikipedia.org/wiki/Hauspferd
    ["Welches Tier gräbt Gänge unter der Erde?", "Maulwurf", "Eichhörnchen", "Igel", "Hase"], // Quelle: https://de.wikipedia.org/wiki/Europäischer_Maulwurf
    ["Welches Tier sammelt Nüsse und klettert auf Bäume?", "Eichhörnchen", "Igel", "Maulwurf", "Frosch"], // Quelle: https://de.wikipedia.org/wiki/Eurasisches_Eichhörnchen
    ["Welches Tier lebt in der Antarktis?", "Pinguin", "Eisbär", "Kamel", "Löwe"], // Quelle: https://de.wikipedia.org/wiki/Pinguine https://de.wikipedia.org/wiki/Eisbär
    ["Welche Farbe hat eine reife Banane?", "Gelb", "Blau", "Lila", "Rosa"], // Quelle: https://de.wikipedia.org/wiki/Bananen
    ["Welche Farbe hat Gras?", "Grün", "Rot", "Blau", "Gelb"], // Quelle: https://de.wikipedia.org/wiki/Süßgräser
    ["Welche Farbe hat der Himmel an einem sonnigen Tag?", "Blau", "Grün", "Braun", "Rot"], // Quelle: https://de.wikipedia.org/wiki/Rayleigh-Streuung
    ["Welche Farbe hat Schnee?", "Weiß", "Grün", "Rot", "Gelb"], // Quelle: https://de.wikipedia.org/wiki/Schnee
    ["Welche Farbe entsteht aus Blau und Gelb?", "Grün", "Lila", "Orange", "Braun"], // Quelle: https://de.wikipedia.org/wiki/Subtraktive_Farbmischung
    ["Welche Farbe entsteht aus Rot und Gelb?", "Orange", "Grün", "Lila", "Blau"], // Quelle: https://de.wikipedia.org/wiki/Subtraktive_Farbmischung
    ["Welche Farbe entsteht aus Rot und Blau?", "Lila", "Grün", "Orange", "Gelb"], // Quelle: https://de.wikipedia.org/wiki/Subtraktive_Farbmischung
    ["Welche Farbe entsteht aus Schwarz und Weiß?", "Grau", "Braun", "Rosa", "Gelb"], // Quelle: https://de.wikipedia.org/wiki/Grau
    ["Welche Farbe entsteht aus Rot und Weiß?", "Rosa", "Lila", "Orange", "Grau"], // Quelle: https://de.wikipedia.org/wiki/Rosa
    ["Wie sieht ein Marienkäfer meistens aus?", "Rot mit schwarzen Punkten", "Blau mit gelben Punkten", "Grün mit weißen Streifen", "Lila mit roten Streifen"], // Quelle: https://de.wikipedia.org/wiki/Siebenpunkt-Marienkäfer
    ["Welches Licht leuchtet bei der Ampel ganz oben?", "Rot", "Grün", "Gelb", "Blau"], // Quelle: https://de.wikipedia.org/wiki/Lichtsignalanlage
    ["Bei welcher Farbe darf man an der Fußgängerampel gehen?", "Grün", "Rot", "Gelb", "Blau"], // Quelle: https://de.wikipedia.org/wiki/Lichtsignalanlage
    ["Welche Zahl kommt nach 9?", "10", "8", "11", "19"], // Quelle: https://de.wikipedia.org/wiki/Natürliche_Zahl
    ["Wie viel ist 2 + 3?", "5", "4", "6", "7"], // Quelle: https://de.wikipedia.org/wiki/Addition
    ["Wie viel ist 10 − 4?", "6", "5", "7", "4"], // Quelle: https://de.wikipedia.org/wiki/Subtraktion
    ["Was ist das Doppelte von 4?", "8", "6", "10", "16"], // Quelle: https://de.wikipedia.org/wiki/Multiplikation
    ["Welche Zahl ist die größte?", "12", "9", "7", "10"], // Quelle: https://de.wikipedia.org/wiki/Natürliche_Zahl
    ["Was ist die Hälfte von 10?", "5", "2", "4", "6"], // Quelle: https://de.wikipedia.org/wiki/Division_(Mathematik)
    ["Wie viel ist 3 + 3 + 3?", "9", "6", "8", "12"], // Quelle: https://de.wikipedia.org/wiki/Addition
    ["Welche Zahl ist gerade?", "8", "3", "5", "7"], // Quelle: https://de.wikipedia.org/wiki/Gerade_und_ungerade_Zahlen
    ["Welche Form hat keine Ecken?", "Kreis", "Dreieck", "Quadrat", "Rechteck"], // Quelle: https://de.wikipedia.org/wiki/Kreis
    ["Welche Jahreszeit kommt nach dem Winter?", "Frühling", "Sommer", "Herbst", "Winter"], // Quelle: https://de.wikipedia.org/wiki/Jahreszeit
    ["Welche Jahreszeit kommt nach dem Sommer?", "Herbst", "Frühling", "Winter", "Sommer"], // Quelle: https://de.wikipedia.org/wiki/Jahreszeit
    ["In welcher Jahreszeit fallen die Blätter von den Bäumen?", "Herbst", "Frühling", "Sommer", "Winter"], // Quelle: https://de.wikipedia.org/wiki/Laub_(Botanik)
    ["In welcher Jahreszeit ist es bei uns am wärmsten?", "Sommer", "Winter", "Herbst", "Frühling"], // Quelle: https://de.wikipedia.org/wiki/Sommer
    ["In welchem Monat ist Weihnachten?", "Dezember", "November", "Januar", "Oktober"], // Quelle: https://de.wikipedia.org/wiki/Weihnachten
    ["Welcher Tag kommt nach Montag?", "Dienstag", "Mittwoch", "Sonntag", "Freitag"], // Quelle: https://de.wikipedia.org/wiki/Wochentag
    ["Welcher Wochentag kommt vor dem Sonntag?", "Samstag", "Freitag", "Montag", "Donnerstag"], // Quelle: https://de.wikipedia.org/wiki/Wochentag
    ["Welcher Monat ist der erste im Jahr?", "Januar", "Februar", "Dezember", "März"], // Quelle: https://de.wikipedia.org/wiki/Januar
    ["Womit sehen wir?", "Mit den Augen", "Mit den Ohren", "Mit der Nase", "Mit dem Mund"], // Quelle: https://de.wikipedia.org/wiki/Auge
    ["Womit hören wir?", "Mit den Ohren", "Mit den Augen", "Mit der Nase", "Mit den Händen"], // Quelle: https://de.wikipedia.org/wiki/Ohr
    ["Womit riechen wir?", "Mit der Nase", "Mit den Ohren", "Mit den Augen", "Mit den Füßen"], // Quelle: https://de.wikipedia.org/wiki/Nase
    ["Womit schmecken wir?", "Mit der Zunge", "Mit den Ohren", "Mit den Augen", "Mit den Haaren"], // Quelle: https://de.wikipedia.org/wiki/Zunge
    ["Welches Organ pumpt das Blut durch den Körper?", "Herz", "Lunge", "Magen", "Leber"], // Quelle: https://de.wikipedia.org/wiki/Herz
    ["Mit welchem Organ atmen wir?", "Lunge", "Herz", "Magen", "Niere"], // Quelle: https://de.wikipedia.org/wiki/Lunge
    ["Wo ist das Knie?", "Am Bein", "Am Arm", "Am Kopf", "Am Bauch"], // Quelle: https://de.wikipedia.org/wiki/Knie
    ["Was putzt man morgens und abends mit einer Bürste und Paste?", "Zähne", "Ohren", "Haare", "Füße"], // Quelle: https://de.wikipedia.org/wiki/Zahnbürste
    ["Wen will Rotkäppchen besuchen?", "Die Großmutter", "Die Tante", "Die Königin", "Die Hexe"], // Quelle: https://de.wikipedia.org/wiki/Rotkäppchen
    ["Wer frisst im Märchen die Großmutter von Rotkäppchen?", "Der Wolf", "Der Bär", "Der Fuchs", "Der Löwe"], // Quelle: https://de.wikipedia.org/wiki/Rotkäppchen
    ["Was verliert Aschenputtel auf der Treppe?", "Einen Schuh", "Eine Krone", "Einen Ring", "Eine Kette"], // Quelle: https://de.wikipedia.org/wiki/Aschenputtel
    ["Wer beißt in einen giftigen Apfel?", "Schneewittchen", "Rapunzel", "Dornröschen", "Rotkäppchen"], // Quelle: https://de.wikipedia.org/wiki/Schneewittchen
    ["Wer lässt ihr langes Haar aus dem Turm herunter?", "Rapunzel", "Schneewittchen", "Aschenputtel", "Gretel"], // Quelle: https://de.wikipedia.org/wiki/Rapunzel
    ["In welchem Märchen ist das Hexenhaus aus Brot und Kuchen?", "Hänsel und Gretel", "Rotkäppchen", "Frau Holle", "Rapunzel"], // Quelle: https://de.wikipedia.org/wiki/Hänsel_und_Gretel
    ["Welche Tiere sind die Bremer Stadtmusikanten?", "Esel, Hund, Katze, Hahn", "Pferd, Hund, Katze, Huhn", "Esel, Schaf, Katze, Hahn", "Esel, Hund, Maus, Gans"], // Quelle: https://de.wikipedia.org/wiki/Die_Bremer_Stadtmusikanten
    ["Wer wohnt bei Schneewittchen hinter den Bergen?", "Die sieben Zwerge", "Die drei Bären", "Die sieben Geißlein", "Die drei Riesen"], // Quelle: https://de.wikipedia.org/wiki/Schneewittchen
    ["Was spinnt die Müllerstochter mit Rumpelstilzchens Hilfe aus Stroh?", "Gold", "Silber", "Seide", "Wolle"], // Quelle: https://de.wikipedia.org/wiki/Rumpelstilzchen
    ["In welchem Märchen schüttelt jemand die Betten, damit es schneit?", "Frau Holle", "Dornröschen", "Rapunzel", "Schneewittchen"], // Quelle: https://de.wikipedia.org/wiki/Frau_Holle
    ["Woran sticht sich Dornröschen?", "An einer Spindel", "An einem Rosendorn", "An einer Schere", "An einem Messer"], // Quelle: https://de.wikipedia.org/wiki/Dornröschen
    ["Welches Tier trägt im Märchen Stiefel?", "Kater", "Hund", "Fuchs", "Hase"], // Quelle: https://de.wikipedia.org/wiki/Der_gestiefelte_Kater
    ["Welches Fahrzeug fährt auf Schienen?", "Zug", "Bus", "Lastwagen", "Fahrrad"], // Quelle: https://de.wikipedia.org/wiki/Eisenbahn
    ["Welches Fahrzeug fliegt durch die Luft?", "Flugzeug", "Schiff", "Zug", "Bus"], // Quelle: https://de.wikipedia.org/wiki/Flugzeug
    ["Welches Fahrzeug fährt auf dem Wasser?", "Schiff", "Auto", "Zug", "Traktor"], // Quelle: https://de.wikipedia.org/wiki/Schiff
    ["Welches Auto hat eine lange Leiter und löscht Feuer?", "Feuerwehrauto", "Krankenwagen", "Polizeiauto", "Müllauto"], // Quelle: https://de.wikipedia.org/wiki/Drehleiter
    ["Welches Fahrzeug bringt Kranke schnell ins Krankenhaus?", "Krankenwagen", "Feuerwehrauto", "Müllauto", "Traktor"], // Quelle: https://de.wikipedia.org/wiki/Krankenwagen
    ["Welches Fahrzeug zieht auf dem Bauernhof den Pflug?", "Traktor", "Zug", "Boot", "Rakete"], // Quelle: https://de.wikipedia.org/wiki/Traktor
    ["Mit welchem Fahrzeug fliegen Menschen ins Weltall?", "Rakete", "Hubschrauber", "Heißluftballon", "Segelflugzeug"], // Quelle: https://de.wikipedia.org/wiki/Rakete
    ["Welches Fahrzeug hat große Rotorblätter auf dem Dach?", "Hubschrauber", "Flugzeug", "Rakete", "Zug"], // Quelle: https://de.wikipedia.org/wiki/Hubschrauber
    ["Welches Fahrzeug fährt unter Wasser?", "U-Boot", "Segelboot", "Floß", "Fähre"], // Quelle: https://de.wikipedia.org/wiki/U-Boot
    ["Woraus wächst ein Baum?", "Aus einem Samen", "Aus einem Stein", "Aus einer Wolke", "Aus einer Muschel"], // Quelle: https://de.wikipedia.org/wiki/Samen
    ["Was brauchen Pflanzen zum Wachsen?", "Wasser und Licht", "Milch und Zucker", "Saft und Dunkelheit", "Salz und Öl"], // Quelle: https://de.wikipedia.org/wiki/Photosynthese
    ["An welchem Baum wachsen Eicheln?", "Eiche", "Tanne", "Birke", "Linde"], // Quelle: https://de.wikipedia.org/wiki/Eichel
    ["Welche Pflanze hat Dornen?", "Kaktus", "Tulpe", "Gänseblümchen", "Löwenzahn"], // Quelle: https://de.wikipedia.org/wiki/Kakteengewächse
    ["Was scheint am Tag am Himmel und wärmt uns?", "Die Sonne", "Der Mond", "Die Sterne", "Die Wolken"], // Quelle: https://de.wikipedia.org/wiki/Sonne
    ["Was sieht man oft, wenn Sonne und Regen zusammenkommen?", "Einen Regenbogen", "Einen Schneemann", "Einen Mondschein", "Nebel"], // Quelle: https://de.wikipedia.org/wiki/Regenbogen
    ["Was hört man nach einem Blitz?", "Donner", "Vogelgezwitscher", "Glockenläuten", "Hundebellen"], // Quelle: https://de.wikipedia.org/wiki/Donner
    ["Wie nennt man gefrorenes Wasser?", "Eis", "Dampf", "Nebel", "Tau"], // Quelle: https://de.wikipedia.org/wiki/Eis
    ["Auf welchem Planeten leben wir?", "Erde", "Mars", "Mond", "Sonne"], // Quelle: https://de.wikipedia.org/wiki/Erde

    ["Wie viele Beine hat eine Spinne?", 8, "Beine"], // Quelle: https://de.wikipedia.org/wiki/Webspinnen
    ["Wie viele Beine hat ein Käfer?", 6, "Beine"], // Quelle: https://de.wikipedia.org/wiki/Käfer
    ["Wie viele Tage hat eine Woche?", 7, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Woche
    ["Wie viele Monate hat ein Jahr?", 12, "Monate"], // Quelle: https://de.wikipedia.org/wiki/Monat
    ["Wie viele Jahreszeiten gibt es?", 4, "Jahreszeiten"], // Quelle: https://de.wikipedia.org/wiki/Jahreszeit
    ["Wie viele Finger hast du an einer Hand?", 5, "Finger"], // Quelle: https://de.wikipedia.org/wiki/Finger
    ["Wie viele Zehen hast du an beiden Füßen zusammen?", 10, "Zehen"], // Quelle: https://de.wikipedia.org/wiki/Zeh
    ["Wie viele Beine hat ein Hund?", 4, "Beine"], // Quelle: https://de.wikipedia.org/wiki/Haushund
    ["Wie viele Beine hat ein Vogel?", 2, "Beine"], // Quelle: https://de.wikipedia.org/wiki/Vögel
    ["Wie viele Zwerge wohnen bei Schneewittchen?", 7, "Zwerge"], // Quelle: https://de.wikipedia.org/wiki/Schneewittchen
    ["Wie viele Geißlein hat die alte Geiß im Märchen vom Wolf?", 7, "Geißlein"], // Quelle: https://de.wikipedia.org/wiki/Der_Wolf_und_die_sieben_jungen_Geißlein
    ["Wie viele Räder hat ein Fahrrad?", 2, "Räder"], // Quelle: https://de.wikipedia.org/wiki/Fahrrad
    ["Wie viele Räder hat ein Dreirad?", 3, "Räder"], // Quelle: https://de.wikipedia.org/wiki/Dreirad
    ["Wie viele Ecken hat ein Dreieck?", 3, "Ecken"], // Quelle: https://de.wikipedia.org/wiki/Dreieck
    ["Wie viele Ecken hat ein Quadrat?", 4, "Ecken"], // Quelle: https://de.wikipedia.org/wiki/Quadrat
    ["Wie viele Stunden hat ein Tag?", 24, "Stunden"], // Quelle: https://de.wikipedia.org/wiki/Tag
    ["Wie viele Minuten hat eine Stunde?", 60, "Minuten"], // Quelle: https://de.wikipedia.org/wiki/Stunde
    ["Wie viele Tage hat ein Jahr, das kein Schaltjahr ist?", 365, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Gemeinjahr
    ["Wie viele Punkte hat ein Spielwürfel auf allen Seiten zusammen?", 21, "Punkte"], // Quelle: https://de.wikipedia.org/wiki/Spielwürfel
    ["Wie viele Punkte hat die höchste Seite eines Spielwürfels?", 6, "Punkte"], // Quelle: https://de.wikipedia.org/wiki/Spielwürfel
    ["Wie viele Arme hat ein Krake?", 8, "Arme"], // Quelle: https://de.wikipedia.org/wiki/Kraken
    ["Wie viele Milchzähne hat ein Kind?", 20, "Zähne"], // Quelle: https://de.wikipedia.org/wiki/Milchgebiss
    ["Wie viele Buchstaben hat das Alphabet ohne Ä, Ö, Ü und ß?", 26, "Buchstaben"], // Quelle: https://de.wikipedia.org/wiki/Deutsches_Alphabet
    ["Wie viele Tage hat der Februar, wenn kein Schaltjahr ist?", 28, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Februar
    ["Wie viele Arme hat ein Seestern meistens?", 5, "Arme"], // Quelle: https://de.wikipedia.org/wiki/Seesterne
    ["Wie viele Flügel hat ein Schmetterling?", 4, "Flügel"], // Quelle: https://de.wikipedia.org/wiki/Schmetterlinge
    ["Wie viele Höcker hat ein Dromedar?", 1, "Höcker"], // Quelle: https://de.wikipedia.org/wiki/Dromedar
    ["Wie viele Tage hat das Wochenende?", 2, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Wochenende
    ["Wie viel ist 3 mal 4?", 12, ""], // Quelle: https://de.wikipedia.org/wiki/Multiplikation
    ["Wie viele Beine haben zwei Hühner zusammen?", 4, "Beine"], // Quelle: https://de.wikipedia.org/wiki/Haushuhn
    ["Bei wie viel Grad gefriert Wasser?", 0, "°C"], // Quelle: https://de.wikipedia.org/wiki/Grad_Celsius
    ["Bei wie viel Grad kocht Wasser?", 100, "°C"], // Quelle: https://de.wikipedia.org/wiki/Grad_Celsius
    ["Wie viele Minuten hat eine halbe Stunde?", 30, "Minuten"], // Quelle: https://de.wikipedia.org/wiki/Stunde
    ["Wie viele Ecken hat ein Würfel?", 8, "Ecken"], // Quelle: https://de.wikipedia.org/wiki/Würfel_(Geometrie)
    ["Wie viele Augen hat ein Mensch?", 2, "Augen"], // Quelle: https://de.wikipedia.org/wiki/Auge

    ["Vom kleinsten zum größten Tier:", ["Ameise", "Maus", "Katze", "Pferd"]], // Quelle: https://de.wikipedia.org/wiki/Ameisen https://de.wikipedia.org/wiki/Hausmaus https://de.wikipedia.org/wiki/Hauskatze https://de.wikipedia.org/wiki/Hauspferd
    ["Vom größten zum kleinsten Tier:", ["Elefant", "Kuh", "Schaf", "Hase"]], // Quelle: https://de.wikipedia.org/wiki/Afrikanischer_Elefant https://de.wikipedia.org/wiki/Hausrind https://de.wikipedia.org/wiki/Hausschaf https://de.wikipedia.org/wiki/Feldhase
    ["Die Jahreszeiten, beginnend mit dem Frühling:", ["Frühling", "Sommer", "Herbst", "Winter"]], // Quelle: https://de.wikipedia.org/wiki/Jahreszeit
    ["Die Wochentage, beginnend mit Montag:", ["Montag", "Dienstag", "Mittwoch", "Donnerstag"]], // Quelle: https://de.wikipedia.org/wiki/Wochentag
    ["Von der kleinsten zur größten Zahl:", ["3", "8", "12", "20"]], // Quelle: https://de.wikipedia.org/wiki/Natürliche_Zahl
    ["Vom Ei zum Schmetterling:", ["Ei", "Raupe", "Puppe", "Schmetterling"]], // Quelle: https://de.wikipedia.org/wiki/Schmetterlinge
    ["Vom Samen zur Blume:", ["Samen", "Keimling", "Knospe", "Blüte"]], // Quelle: https://de.wikipedia.org/wiki/Keimling https://de.wikipedia.org/wiki/Blüte
    ["Der Tag von früh bis spät:", ["Morgen", "Mittag", "Abend", "Nacht"]], // Quelle: https://de.wikipedia.org/wiki/Tageszeit
    ["Von wenigen zu vielen Rädern:", ["Einrad", "Fahrrad", "Dreirad", "Auto"]], // Quelle: https://de.wikipedia.org/wiki/Einrad https://de.wikipedia.org/wiki/Dreirad
    ["Die Monate, beginnend mit Januar:", ["Januar", "Februar", "März", "April"]], // Quelle: https://de.wikipedia.org/wiki/Monat
    ["Vom jüngsten zum ältesten Menschen:", ["Baby", "Kind", "Jugendlicher", "Erwachsener"]], // Quelle: https://de.wikipedia.org/wiki/Lebensalter
    ["Von der kürzesten zur längsten Zeit:", ["Minute", "Stunde", "Tag", "Woche"]], // Quelle: https://de.wikipedia.org/wiki/Zeiteinheit
    ["Planeten, von der Sonne aus gesehen:", ["Merkur", "Venus", "Erde", "Mars"]], // Quelle: https://de.wikipedia.org/wiki/Sonnensystem
    ["Von wenigen zu vielen Beinen:", ["Schlange", "Huhn", "Katze", "Spinne"]], // Quelle: https://de.wikipedia.org/wiki/Schlangen https://de.wikipedia.org/wiki/Webspinnen
    ["Vom Laich zum Frosch:", ["Froschlaich", "Kaulquappe", "Jungfrosch", "Frosch"]], // Quelle: https://de.wikipedia.org/wiki/Froschlurche
  ],
};
