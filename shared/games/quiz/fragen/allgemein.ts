import type { FragenKategorie } from "./typen";

export const ALLGEMEIN: FragenKategorie = {
  id: "allgemein",
  name: "Allgemeinwissen",
  emoji: "💡",
  stufe: "familie",
  fragen: [
    ["Wie viele Beine hat eine Spinne?", "Acht", "Sechs", "Zehn", "Zwölf"], // Quelle: https://de.wikipedia.org/wiki/Spinnen
    ["Welches Gas nehmen Pflanzen bei der Fotosynthese auf?", "Kohlendioxid", "Sauerstoff", "Stickstoff", "Helium"], // Quelle: https://de.wikipedia.org/wiki/Fotosynthese
    ["Wer malte die „Mona Lisa“?", "Leonardo da Vinci", "Michelangelo", "Raffael", "Rembrandt"], // Quelle: https://de.wikipedia.org/wiki/Mona_Lisa
    ["Welches chemische Symbol hat Gold?", "Au", "Ag", "Go", "Gd"], // Quelle: https://de.wikipedia.org/wiki/Gold
    ["Welches ist das größte Organ des Menschen?", "Die Haut", "Die Leber", "Die Lunge", "Das Gehirn"], // Quelle: https://de.wikipedia.org/wiki/Haut
    ["Welcher Planet ist der Sonne am nächsten?", "Merkur", "Venus", "Mars", "Erde"], // Quelle: https://de.wikipedia.org/wiki/Merkur_(Planet)
    ["Welcher Planet ist der größte im Sonnensystem?", "Jupiter", "Saturn", "Neptun", "Uranus"], // Quelle: https://de.wikipedia.org/wiki/Jupiter_(Planet)
    ["Wie viele Spieler hat eine Fußballmannschaft auf dem Feld?", "Elf", "Zehn", "Zwölf", "Neun"], // Quelle: https://de.wikipedia.org/wiki/Fußball
    ["Wer schrieb „Faust“?", "Johann Wolfgang von Goethe", "Friedrich Schiller", "Heinrich Heine", "Thomas Mann"], // Quelle: https://de.wikipedia.org/wiki/Faust._Eine_Tragödie.
    ["Wer schrieb das Drama „Die Räuber“?", "Friedrich Schiller", "Johann Wolfgang von Goethe", "Gotthold Ephraim Lessing", "Heinrich von Kleist"], // Quelle: https://de.wikipedia.org/wiki/Die_Räuber
    ["In welchem Jahr fiel die Berliner Mauer?", "1989", "1990", "1987", "1991"], // Quelle: https://de.wikipedia.org/wiki/Berliner_Mauer
    ["Welches ist das größte Tier der Erde?", "Blauwal", "Afrikanischer Elefant", "Pottwal", "Walhai"], // Quelle: https://de.wikipedia.org/wiki/Blauwal
    ["Wie viele Farben hat ein Regenbogen nach der üblichen Zählung?", "Sieben", "Sechs", "Fünf", "Acht"], // Quelle: https://de.wikipedia.org/wiki/Regenbogen
    ["Welcher Vogel kann rückwärts fliegen?", "Kolibri", "Spatz", "Schwalbe", "Specht"], // Quelle: https://de.wikipedia.org/wiki/Kolibris
    ["Welches Metall ist bei Raumtemperatur flüssig?", "Quecksilber", "Blei", "Zinn", "Aluminium"], // Quelle: https://de.wikipedia.org/wiki/Quecksilber
    ["Wer entwickelte die Relativitätstheorie?", "Albert Einstein", "Isaac Newton", "Max Planck", "Niels Bohr"], // Quelle: https://de.wikipedia.org/wiki/Relativitätstheorie
    ["Was misst ein Barometer?", "Luftdruck", "Temperatur", "Luftfeuchtigkeit", "Windgeschwindigkeit"], // Quelle: https://de.wikipedia.org/wiki/Barometer
    ["Wie viele Tage hat ein Schaltjahr?", "366", "365", "364", "367"], // Quelle: https://de.wikipedia.org/wiki/Schaltjahr
    ["Welcher Monat ist der kürzeste im Jahr?", "Februar", "April", "Juni", "November"], // Quelle: https://de.wikipedia.org/wiki/Februar
    ["Wofür steht die Formel H₂O?", "Wasser", "Wasserstoffperoxid", "Kochsalz", "Ozon"], // Quelle: https://de.wikipedia.org/wiki/Wasser
    ["Welches Element hat das chemische Symbol „O“?", "Sauerstoff", "Gold", "Osmium", "Ozon"], // Quelle: https://de.wikipedia.org/wiki/Sauerstoff
    ["Welche Farbe entsteht, wenn man Blau und Gelb mischt?", "Grün", "Lila", "Orange", "Braun"], // Quelle: https://de.wikipedia.org/wiki/Subtraktive_Farbmischung
    ["Welche Farbe entsteht, wenn man Rot und Gelb mischt?", "Orange", "Grün", "Lila", "Rosa"], // Quelle: https://de.wikipedia.org/wiki/Subtraktive_Farbmischung
    ["Wer erreichte 1492 im Auftrag Spaniens Amerika?", "Christoph Kolumbus", "Vasco da Gama", "Ferdinand Magellan", "Amerigo Vespucci"], // Quelle: https://de.wikipedia.org/wiki/Christoph_Kolumbus
    ["Wer betrat als erster Mensch den Mond?", "Neil Armstrong", "Buzz Aldrin", "Juri Gagarin", "Michael Collins"], // Quelle: https://de.wikipedia.org/wiki/Neil_Armstrong
    ["Wer flog als erster Mensch ins Weltall?", "Juri Gagarin", "Neil Armstrong", "Alexei Leonow", "John Glenn"], // Quelle: https://de.wikipedia.org/wiki/Juri_Alexejewitsch_Gagarin
    ["Wie heißt der längste Knochen des Menschen?", "Oberschenkelknochen", "Schienbein", "Oberarmknochen", "Wadenbein"], // Quelle: https://de.wikipedia.org/wiki/Oberschenkelknochen
    ["Welche Blutgefäße führen das Blut vom Herzen weg?", "Arterien", "Venen", "Lymphgefäße", "Bronchien"], // Quelle: https://de.wikipedia.org/wiki/Arterie
    ["Welches Organ bildet das Hormon Insulin?", "Bauchspeicheldrüse", "Leber", "Niere", "Milz"], // Quelle: https://de.wikipedia.org/wiki/Insulin
    ["Wie viele Saiten hat eine klassische Gitarre?", "Sechs", "Vier", "Fünf", "Sieben"], // Quelle: https://de.wikipedia.org/wiki/Konzertgitarre
    ["Zu welcher Instrumentengruppe gehört die Trompete?", "Blechblasinstrumente", "Holzblasinstrumente", "Streichinstrumente", "Schlaginstrumente"], // Quelle: https://de.wikipedia.org/wiki/Trompete
    ["Zu welcher Instrumentengruppe gehört das Cello?", "Streichinstrumente", "Blasinstrumente", "Tasteninstrumente", "Schlaginstrumente"], // Quelle: https://de.wikipedia.org/wiki/Violoncello
    ["Wer komponierte die Oper „Die Zauberflöte“?", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Joseph Haydn", "Richard Wagner"], // Quelle: https://de.wikipedia.org/wiki/Die_Zauberflöte
    ["Wer sammelte das Märchen „Hänsel und Gretel“?", "Die Brüder Grimm", "Hans Christian Andersen", "Wilhelm Hauff", "Charles Perrault"], // Quelle: https://de.wikipedia.org/wiki/Hänsel_und_Gretel
    ["Wer schrieb „Die kleine Meerjungfrau“?", "Hans Christian Andersen", "Die Brüder Grimm", "Wilhelm Hauff", "Charles Perrault"], // Quelle: https://de.wikipedia.org/wiki/Die_kleine_Meerjungfrau
    ["Wer schrieb „Romeo und Julia“?", "William Shakespeare", "Johann Wolfgang von Goethe", "Molière", "Dante Alighieri"], // Quelle: https://de.wikipedia.org/wiki/Romeo_und_Julia
    ["Was ist die Hauptzutat von Guacamole?", "Avocado", "Tomate", "Gurke", "Paprika"], // Quelle: https://de.wikipedia.org/wiki/Guacamole
    ["Aus welcher Pflanze wird in Mitteleuropa meist Zucker gewonnen?", "Zuckerrübe", "Zuckerrohr", "Mais", "Kartoffel"], // Quelle: https://de.wikipedia.org/wiki/Zuckerrübe
    ["Aus welchen Bohnen wird Schokolade hergestellt?", "Kakaobohnen", "Kaffeebohnen", "Sojabohnen", "Ackerbohnen"], // Quelle: https://de.wikipedia.org/wiki/Schokolade
    ["Woraus wird Tofu hergestellt?", "Sojabohnen", "Reis", "Weizen", "Kichererbsen"], // Quelle: https://de.wikipedia.org/wiki/Tofu
    ["Was ist ein Hexagon?", "Ein Sechseck", "Ein Fünfeck", "Ein Achteck", "Ein Siebeneck"], // Quelle: https://de.wikipedia.org/wiki/Sechseck
    ["Wie viel Grad hat ein rechter Winkel?", "90", "45", "180", "100"], // Quelle: https://de.wikipedia.org/wiki/Rechter_Winkel
    ["Wie viel Grad ergeben die Innenwinkel eines Dreiecks zusammen?", "180", "360", "90", "270"], // Quelle: https://de.wikipedia.org/wiki/Dreieck
    ["Was ist die Quadratwurzel aus 144?", "12", "14", "11", "16"], // Quelle: https://de.wikipedia.org/wiki/Quadratwurzel
    ["Wie viel ist 7 mal 8?", "56", "54", "48", "63"], // Quelle: https://de.wikipedia.org/wiki/Einmaleins
    ["Welches römische Zahlzeichen steht für 50?", "L", "C", "D", "X"], // Quelle: https://de.wikipedia.org/wiki/Römische_Zahlschrift
    ["Welches römische Zahlzeichen steht für 1000?", "M", "D", "C", "K"], // Quelle: https://de.wikipedia.org/wiki/Römische_Zahlschrift
    ["Welche dieser Zahlen ist eine Primzahl?", "17", "21", "27", "15"], // Quelle: https://de.wikipedia.org/wiki/Primzahl
    ["Wie heißt die Wissenschaft von den Himmelskörpern?", "Astronomie", "Geologie", "Meteorologie", "Ozeanografie"], // Quelle: https://de.wikipedia.org/wiki/Astronomie
    ["Womit beschäftigt sich ein Ornithologe?", "Vögel", "Insekten", "Fische", "Pilze"], // Quelle: https://de.wikipedia.org/wiki/Ornithologie
    ["Womit beschäftigt sich ein Entomologe?", "Insekten", "Vögel", "Gesteine", "Fossilien"], // Quelle: https://de.wikipedia.org/wiki/Entomologie
    ["Wie nennt man die Angst vor Spinnen?", "Arachnophobie", "Klaustrophobie", "Akrophobie", "Agoraphobie"], // Quelle: https://de.wikipedia.org/wiki/Arachnophobie
    ["Welches dieser Tiere ist ein Säugetier?", "Delfin", "Hai", "Thunfisch", "Rochen"], // Quelle: https://de.wikipedia.org/wiki/Delfine
    ["Welches Säugetier legt Eier?", "Schnabeltier", "Känguru", "Koala", "Wombat"], // Quelle: https://de.wikipedia.org/wiki/Schnabeltier
    ["Wie heißt ein junges Pferd?", "Fohlen", "Kalb", "Lamm", "Ferkel"], // Quelle: https://de.wikipedia.org/wiki/Fohlen
    ["Wie heißt das männliche Huhn?", "Hahn", "Erpel", "Ganter", "Bock"], // Quelle: https://de.wikipedia.org/wiki/Haushuhn
    ["Wie viele Beine hat ein Insekt?", "Sechs", "Acht", "Vier", "Zehn"], // Quelle: https://de.wikipedia.org/wiki/Insekten
    ["Welches ist das schnellste Landtier?", "Gepard", "Löwe", "Pferd", "Windhund"], // Quelle: https://de.wikipedia.org/wiki/Gepard
    ["Wovon ernährt sich der Große Panda hauptsächlich?", "Bambus", "Fisch", "Beeren", "Eukalyptus"], // Quelle: https://de.wikipedia.org/wiki/Großer_Panda
    ["Wovon ernährt sich der Koala hauptsächlich?", "Eukalyptusblätter", "Bambus", "Gras", "Insekten"], // Quelle: https://de.wikipedia.org/wiki/Koala
    ["In welchem Gebäude tagt der Deutsche Bundestag?", "Reichstagsgebäude", "Bundeskanzleramt", "Schloss Bellevue", "Rotes Rathaus"], // Quelle: https://de.wikipedia.org/wiki/Reichstagsgebäude
    ["Wer war der erste Bundeskanzler der Bundesrepublik?", "Konrad Adenauer", "Ludwig Erhard", "Willy Brandt", "Theodor Heuss"], // Quelle: https://de.wikipedia.org/wiki/Konrad_Adenauer
    ["Wer war der erste Bundespräsident der Bundesrepublik?", "Theodor Heuss", "Heinrich Lübke", "Konrad Adenauer", "Gustav Heinemann"], // Quelle: https://de.wikipedia.org/wiki/Theodor_Heuss
    ["In welchem Jahr wurde Deutschland wiedervereinigt?", "1990", "1989", "1991", "1992"], // Quelle: https://de.wikipedia.org/wiki/Deutsche_Wiedervereinigung
    ["In welchem Jahr endete der Zweite Weltkrieg in Europa?", "1945", "1944", "1946", "1943"], // Quelle: https://de.wikipedia.org/wiki/Zweiter_Weltkrieg
    ["In welchem Jahr begann der Erste Weltkrieg?", "1914", "1918", "1912", "1916"], // Quelle: https://de.wikipedia.org/wiki/Erster_Weltkrieg
    ["Wer erfand in Europa den Buchdruck mit beweglichen Lettern?", "Johannes Gutenberg", "Martin Luther", "Albrecht Dürer", "Leonardo da Vinci"], // Quelle: https://de.wikipedia.org/wiki/Johannes_Gutenberg
    ["Wer veröffentlichte 1517 die 95 Thesen?", "Martin Luther", "Johannes Calvin", "Huldrych Zwingli", "Thomas Müntzer"], // Quelle: https://de.wikipedia.org/wiki/95_Thesen
    ["Welche Stadt wurde im Jahr 79 vom Vesuv verschüttet?", "Pompeji", "Rom", "Neapel", "Athen"], // Quelle: https://de.wikipedia.org/wiki/Pompeji
    ["Wer war der erste römische Kaiser?", "Augustus", "Nero", "Caligula", "Trajan"], // Quelle: https://de.wikipedia.org/wiki/Augustus
    ["Wie viele Sterne zeigt die Flagge der Europäischen Union?", "Zwölf", "Zehn", "Fünfzehn", "Achtzehn"], // Quelle: https://de.wikipedia.org/wiki/Europaflagge
    ["Wie viele Ringe hat das Symbol der Olympischen Spiele?", "Fünf", "Vier", "Sechs", "Sieben"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Ringe
    ["Wo fanden 1896 die ersten Olympischen Spiele der Neuzeit statt?", "Athen", "Paris", "London", "Rom"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Sommerspiele_1896
    ["Welche Schachfigur zieht nur diagonal?", "Läufer", "Turm", "Springer", "König"], // Quelle: https://de.wikipedia.org/wiki/Läufer_(Schach)
    ["Welche Schachfigur darf über andere Figuren springen?", "Springer", "Läufer", "Dame", "Turm"], // Quelle: https://de.wikipedia.org/wiki/Springer_(Schach)
    ["Wie viele Spieler je Team stehen beim Volleyball auf dem Feld?", "Sechs", "Fünf", "Sieben", "Vier"], // Quelle: https://de.wikipedia.org/wiki/Volleyball
    ["Wie viele Spieler je Team stehen beim Basketball auf dem Feld?", "Fünf", "Sechs", "Sieben", "Vier"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Bei wie viel Grad Celsius gefriert Wasser?", "0 °C", "4 °C", "−10 °C", "10 °C"], // Quelle: https://de.wikipedia.org/wiki/Grad_Celsius
    ["Bei wie viel Grad Celsius kocht Wasser auf Meereshöhe?", "100 °C", "90 °C", "120 °C", "80 °C"], // Quelle: https://de.wikipedia.org/wiki/Grad_Celsius
    ["In welcher Einheit misst man elektrische Spannung?", "Volt", "Ampere", "Watt", "Ohm"], // Quelle: https://de.wikipedia.org/wiki/Volt
    ["In welcher Einheit misst man elektrischen Widerstand?", "Ohm", "Volt", "Hertz", "Joule"], // Quelle: https://de.wikipedia.org/wiki/Ohm
    ["In welcher Einheit misst man Frequenz?", "Hertz", "Watt", "Newton", "Pascal"], // Quelle: https://de.wikipedia.org/wiki/Hertz_(Einheit)
    ["Welcher Planet wird „der Rote Planet“ genannt?", "Mars", "Venus", "Jupiter", "Merkur"], // Quelle: https://de.wikipedia.org/wiki/Mars_(Planet)
    ["Welcher Planet hat die auffälligsten Ringe?", "Saturn", "Jupiter", "Mars", "Venus"], // Quelle: https://de.wikipedia.org/wiki/Saturn_(Planet)
    ["Wie heißt unsere Galaxie?", "Milchstraße", "Andromeda", "Sombrero-Galaxie", "Große Magellansche Wolke"], // Quelle: https://de.wikipedia.org/wiki/Milchstraße
    ["Wer malte „Die Sternennacht“?", "Vincent van Gogh", "Claude Monet", "Paul Cézanne", "Edvard Munch"], // Quelle: https://de.wikipedia.org/wiki/Die_Sternennacht
    ["Wer malte „Der Schrei“?", "Edvard Munch", "Vincent van Gogh", "Gustav Klimt", "Egon Schiele"], // Quelle: https://de.wikipedia.org/wiki/Der_Schrei
    ["Wer bemalte die Decke der Sixtinischen Kapelle?", "Michelangelo", "Raffael", "Leonardo da Vinci", "Tizian"], // Quelle: https://de.wikipedia.org/wiki/Sixtinische_Kapelle
    ["Wer schrieb den Roman „Der Zauberberg“?", "Thomas Mann", "Hermann Hesse", "Franz Kafka", "Günter Grass"], // Quelle: https://de.wikipedia.org/wiki/Der_Zauberberg
    ["Wer schrieb die Erzählung „Die Verwandlung“?", "Franz Kafka", "Thomas Mann", "Heinrich von Kleist", "Rainer Maria Rilke"], // Quelle: https://de.wikipedia.org/wiki/Die_Verwandlung
    ["Was bedeutet das lateinische „carpe diem“?", "Nutze den Tag", "Ich kam, sah und siegte", "Im Wein liegt Wahrheit", "Der Würfel ist gefallen"], // Quelle: https://de.wikipedia.org/wiki/Carpe_diem
    ["Wem wird der Ausspruch „Veni, vidi, vici“ zugeschrieben?", "Julius Caesar", "Augustus", "Nero", "Hannibal"], // Quelle: https://de.wikipedia.org/wiki/Veni,_vidi,_vici
    ["Wer schrieb den Roman „Don Quijote“?", "Miguel de Cervantes", "Lope de Vega", "Federico García Lorca", "Gabriel García Márquez"], // Quelle: https://de.wikipedia.org/wiki/Don_Quijote
    ["Welcher Teil des Auges gibt ihm seine Farbe?", "Iris", "Pupille", "Netzhaut", "Linse"], // Quelle: https://de.wikipedia.org/wiki/Iris_(Auge)
    ["Welches Vitamin bildet der Körper mithilfe von Sonnenlicht?", "Vitamin D", "Vitamin C", "Vitamin A", "Vitamin B12"], // Quelle: https://de.wikipedia.org/wiki/Vitamin_D
    ["Wie heißt der rote Blutfarbstoff?", "Hämoglobin", "Chlorophyll", "Melanin", "Keratin"], // Quelle: https://de.wikipedia.org/wiki/Hämoglobin
    ["Wie heißt der grüne Farbstoff der Pflanzen?", "Chlorophyll", "Hämoglobin", "Karotin", "Melanin"], // Quelle: https://de.wikipedia.org/wiki/Chlorophyll
    ["Welches dieser Tiere ist eine Amphibie?", "Frosch", "Eidechse", "Schildkröte", "Krokodil"], // Quelle: https://de.wikipedia.org/wiki/Amphibien
    ["Welches dieser Tiere ist ein Reptil?", "Eidechse", "Frosch", "Salamander", "Molch"], // Quelle: https://de.wikipedia.org/wiki/Reptilien
    ["Wer komponierte die „Mondscheinsonate“?", "Ludwig van Beethoven", "Wolfgang Amadeus Mozart", "Johann Sebastian Bach", "Frédéric Chopin"], // Quelle: https://de.wikipedia.org/wiki/Klaviersonate_Nr._14_(Beethoven)

    ["Wie viele Tasten hat ein übliches Klavier?", 88, ""], // Quelle: https://de.wikipedia.org/wiki/Klaviatur
    ["Wie viele Felder hat ein Schachbrett?", 64, ""], // Quelle: https://de.wikipedia.org/wiki/Schachbrett
    ["Wie viele Knochen hat ein erwachsener Mensch etwa?", 206, ""], // Quelle: https://de.wikipedia.org/wiki/Skelett_des_Menschen
    ["Wie viele Zähne hat ein vollständiges Erwachsenengebiss?", 32, ""], // Quelle: https://de.wikipedia.org/wiki/Gebiss
    ["Wie viele Buchstaben hat das Alphabet ohne Ä, Ö, Ü und ß?", 26, ""], // Quelle: https://de.wikipedia.org/wiki/Lateinisches_Alphabet
    ["Wie lang ist ein Marathonlauf?", 42.195, "km"], // Quelle: https://de.wikipedia.org/wiki/Marathonlauf
    ["In welchem Jahr landeten erstmals Menschen auf dem Mond?", 1969, ""], // Quelle: https://de.wikipedia.org/wiki/Apollo_11
    ["In welchem Jahr wurde die Bundesrepublik Deutschland gegründet?", 1949, ""], // Quelle: https://de.wikipedia.org/wiki/Grundgesetz_für_die_Bundesrepublik_Deutschland
    ["In welchem Jahr wurde Wolfgang Amadeus Mozart geboren?", 1756, ""], // Quelle: https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart
    ["In welchem Jahr sank die Titanic?", 1912, ""], // Quelle: https://de.wikipedia.org/wiki/Titanic_(Schiff)
    ["Wie hoch ist die normale Körpertemperatur des Menschen etwa?", 37, "°C"], // Quelle: https://de.wikipedia.org/wiki/Körpertemperatur
    ["Wie schnell ist Licht im Vakuum?", 299792, "km/s"], // Quelle: https://de.wikipedia.org/wiki/Lichtgeschwindigkeit
    ["Wie viele Tage dauert es von Vollmond zu Vollmond etwa?", 29.5, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Lunation
    ["Wie viele Planeten hat unser Sonnensystem?", 8, ""], // Quelle: https://de.wikipedia.org/wiki/Sonnensystem
    ["Wie viele Karten hat ein französisches Blatt ohne Joker?", 52, ""], // Quelle: https://de.wikipedia.org/wiki/Französisches_Blatt
    ["Wie viele Augen hat ein normaler Spielwürfel insgesamt?", 21, ""], // Quelle: https://de.wikipedia.org/wiki/Spielwürfel
    ["Wie viele Saiten hat eine Geige?", 4, ""], // Quelle: https://de.wikipedia.org/wiki/Violine
    ["Wie viele Herzen hat ein Oktopus?", 3, ""], // Quelle: https://de.wikipedia.org/wiki/Kraken
    ["Wie viele Minuten hat ein Tag?", 1440, ""], // Quelle: https://de.wikipedia.org/wiki/Tag
    ["Wie viele Sekunden hat ein Tag?", 86400, ""], // Quelle: https://de.wikipedia.org/wiki/Tag
    ["In welchem Jahr endete der Dreißigjährige Krieg?", 1648, ""], // Quelle: https://de.wikipedia.org/wiki/Dreißigjähriger_Krieg
    ["In welchem Jahr wurde Johann Wolfgang von Goethe geboren?", 1749, ""], // Quelle: https://de.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe
    ["In welchem Jahr starb Ludwig van Beethoven?", 1827, ""], // Quelle: https://de.wikipedia.org/wiki/Ludwig_van_Beethoven
    ["Wie viele Gramm hat ein Pfund in Deutschland?", 500, "g"], // Quelle: https://de.wikipedia.org/wiki/Pfund
    ["Wie viele Zentimeter misst ein Zoll?", 2.54, "cm"], // Quelle: https://de.wikipedia.org/wiki/Zoll_(Einheit)
    ["Wie viele Meter misst eine Seemeile?", 1852, "m"], // Quelle: https://de.wikipedia.org/wiki/Seemeile
    ["Wie viele Stunden hat eine Woche?", 168, ""], // Quelle: https://de.wikipedia.org/wiki/Woche
    ["Bei wie viel Grad Fahrenheit gefriert Wasser?", 32, "°F"], // Quelle: https://de.wikipedia.org/wiki/Grad_Fahrenheit
    ["Welche Ordnungszahl hat Kohlenstoff im Periodensystem?", 6, ""], // Quelle: https://de.wikipedia.org/wiki/Kohlenstoff
    ["Wie viele Sinfonien hat Ludwig van Beethoven vollendet?", 9, ""], // Quelle: https://de.wikipedia.org/wiki/Ludwig_van_Beethoven
    ["Wie viele Streifen hat die Flagge der USA?", 13, ""], // Quelle: https://de.wikipedia.org/wiki/Flagge_der_Vereinigten_Staaten
    ["In welchem Jahr wurde die Berliner Mauer gebaut?", 1961, ""], // Quelle: https://de.wikipedia.org/wiki/Berliner_Mauer
    ["Wie alt wurde Wolfgang Amadeus Mozart?", 35, "Jahre"], // Quelle: https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart
    ["Wie viele Kanten hat ein Würfel?", 12, ""], // Quelle: https://de.wikipedia.org/wiki/Würfel_(Geometrie)
    ["Wie viele Halswirbel hat eine Giraffe?", 7, ""], // Quelle: https://de.wikipedia.org/wiki/Giraffen

    ["Vom kleinsten zum größten Planeten:", ["Merkur", "Mars", "Venus", "Erde"]], // Quelle: https://de.wikipedia.org/wiki/Planet
    ["Von der Sonne aus, von nah nach fern:", ["Venus", "Mars", "Jupiter", "Saturn"]], // Quelle: https://de.wikipedia.org/wiki/Sonnensystem
    ["Vom frühesten zum spätesten Ereignis:", ["Buchdruck in Europa", "Französische Revolution", "Erster Weltkrieg", "Erste Mondlandung"]], // Quelle: https://de.wikipedia.org/wiki/Johannes_Gutenberg https://de.wikipedia.org/wiki/Französische_Revolution https://de.wikipedia.org/wiki/Erster_Weltkrieg https://de.wikipedia.org/wiki/Apollo_11
    ["Komponisten nach Geburtsjahr, der früheste zuerst:", ["Johann Sebastian Bach", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Richard Wagner"]], // Quelle: https://de.wikipedia.org/wiki/Johann_Sebastian_Bach https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart https://de.wikipedia.org/wiki/Ludwig_van_Beethoven https://de.wikipedia.org/wiki/Richard_Wagner
    ["Dichter nach Geburtsjahr, der früheste zuerst:", ["William Shakespeare", "Johann Wolfgang von Goethe", "Friedrich Schiller", "Thomas Mann"]], // Quelle: https://de.wikipedia.org/wiki/William_Shakespeare https://de.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe https://de.wikipedia.org/wiki/Friedrich_Schiller https://de.wikipedia.org/wiki/Thomas_Mann
    ["Vom kleinsten zum größten Tier:", ["Ameise", "Maus", "Katze", "Pferd"]], // Quelle: https://de.wikipedia.org/wiki/Ameisen https://de.wikipedia.org/wiki/Hausmaus https://de.wikipedia.org/wiki/Hauskatze https://de.wikipedia.org/wiki/Hauspferd
    ["Von der kleinsten zur größten Längeneinheit:", ["Millimeter", "Zentimeter", "Dezimeter", "Meter"]], // Quelle: https://de.wikipedia.org/wiki/Meter
    ["Von der kleinsten zur größten Datenmenge:", ["Kilobyte", "Megabyte", "Gigabyte", "Terabyte"]], // Quelle: https://de.wikipedia.org/wiki/Byte
    ["Römische Zahlzeichen vom kleinsten zum größten Wert:", ["V", "X", "L", "C"]], // Quelle: https://de.wikipedia.org/wiki/Römische_Zahlschrift
    ["Zeitalter vom frühesten zum spätesten:", ["Steinzeit", "Bronzezeit", "Eisenzeit", "Mittelalter"]], // Quelle: https://de.wikipedia.org/wiki/Dreiperiodensystem https://de.wikipedia.org/wiki/Mittelalter
    ["Kunstepochen von der frühesten zur spätesten:", ["Romanik", "Gotik", "Renaissance", "Barock"]], // Quelle: https://de.wikipedia.org/wiki/Europäische_Kunstgeschichte
    ["Elemente nach Ordnungszahl, die kleinste zuerst:", ["Wasserstoff", "Helium", "Kohlenstoff", "Sauerstoff"]], // Quelle: https://de.wikipedia.org/wiki/Periodensystem
    ["Regenbogenfarben von außen nach innen:", ["Rot", "Orange", "Gelb", "Grün"]], // Quelle: https://de.wikipedia.org/wiki/Regenbogen
    ["Bundeskanzler in zeitlicher Reihenfolge:", ["Konrad Adenauer", "Willy Brandt", "Helmut Kohl", "Gerhard Schröder"]], // Quelle: https://de.wikipedia.org/wiki/Bundeskanzler_(Deutschland)
    ["Vom langsamsten zum schnellsten Läufer:", ["Schnecke", "Mensch", "Pferd", "Gepard"]], // Quelle: https://de.wikipedia.org/wiki/Liste_von_Größenordnungen_der_Geschwindigkeit https://de.wikipedia.org/wiki/Weinbergschnecke https://de.wikipedia.org/wiki/Hauspferd https://de.wikipedia.org/wiki/Gepard
  ],
};
