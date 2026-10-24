import type { FragenKategorie } from "./typen";

export const WISSENSCHAFT: FragenKategorie = {
  id: "wissenschaft",
  name: "Wissenschaft & Technik",
  emoji: "🔬",
  stufe: "familie",
  fragen: [
    ["In welcher Einheit misst man die elektrische Stromstärke?", "Ampere", "Volt", "Watt", "Ohm"], // Quelle: https://de.wikipedia.org/wiki/Elektrische_Stromst%C3%A4rke
    ["In welcher Einheit misst man die physikalische Leistung?", "Watt", "Joule", "Newton", "Pascal"], // Quelle: https://de.wikipedia.org/wiki/Leistung_(Physik)
    ["In welcher Einheit misst man eine Kraft?", "Newton", "Watt", "Kelvin", "Hertz"], // Quelle: https://de.wikipedia.org/wiki/Kraft
    ["In welcher Einheit misst man den Druck?", "Pascal", "Newton", "Joule", "Coulomb"], // Quelle: https://de.wikipedia.org/wiki/Druck_(Physik)
    ["In welcher Einheit misst man die Energie?", "Joule", "Watt", "Pascal", "Ampere"], // Quelle: https://de.wikipedia.org/wiki/Energie
    ["In welcher Einheit gibt man den Schallpegel an?", "Dezibel", "Hertz", "Lux", "Candela"], // Quelle: https://de.wikipedia.org/wiki/Dezibel
    ["Welche Temperaturskala beginnt am absoluten Nullpunkt?", "Kelvin", "Celsius", "Fahrenheit", "Réaumur"], // Quelle: https://de.wikipedia.org/wiki/Kelvin
    ["Nach wem ist das klassische Gravitationsgesetz benannt?", "Isaac Newton", "Galileo Galilei", "Johannes Kepler", "Albert Einstein"], // Quelle: https://de.wikipedia.org/wiki/Newtonsches_Gravitationsgesetz
    ["Wie heißt das Lichtteilchen in der Physik?", "Photon", "Elektron", "Neutron", "Proton"], // Quelle: https://de.wikipedia.org/wiki/Photon
    ["Welches Teilchen im Atomkern ist elektrisch neutral?", "Neutron", "Proton", "Elektron", "Positron"], // Quelle: https://de.wikipedia.org/wiki/Neutron
    ["Welche elektrische Ladung hat ein Elektron?", "Negativ", "Positiv", "Keine", "Wechselnd"], // Quelle: https://de.wikipedia.org/wiki/Elektron
    ["Wie heißt die Zerlegung von weißem Licht in Farben, etwa im Prisma?", "Dispersion", "Reflexion", "Absorption", "Interferenz"], // Quelle: https://de.wikipedia.org/wiki/Dispersion_(Physik)
    ["Welche Farbe des sichtbaren Lichts hat die längste Wellenlänge?", "Rot", "Violett", "Grün", "Blau"], // Quelle: https://de.wikipedia.org/wiki/Licht
    ["Wie heißt der direkte Übergang von fest zu gasförmig?", "Sublimation", "Kondensation", "Verdampfung", "Erstarrung"], // Quelle: https://de.wikipedia.org/wiki/Sublimation_(Phasen%C3%BCbergang)
    ["Wie heißt der Übergang von gasförmig zu flüssig?", "Kondensation", "Verdunstung", "Sublimation", "Schmelzen"], // Quelle: https://de.wikipedia.org/wiki/Kondensation
    ["Welche Kraft lässt einen Apfel zu Boden fallen?", "Schwerkraft", "Magnetismus", "Fliehkraft", "Reibung"], // Quelle: https://de.wikipedia.org/wiki/Gravitation
    ["Welchen Zusammenhang beschreibt die Formel E = mc²?", "Masse-Energie-Äquivalenz", "Ohmsches Gesetz", "Hebelgesetz", "Impulserhaltung"], // Quelle: https://de.wikipedia.org/wiki/%C3%84quivalenz_von_Masse_und_Energie
    ["Wofür steht das c in der Formel E = mc²?", "Lichtgeschwindigkeit", "Schallgeschwindigkeit", "Wärmemenge", "Ladung"], // Quelle: https://de.wikipedia.org/wiki/%C3%84quivalenz_von_Masse_und_Energie
    ["Wie heißt das Gesetz U = R · I?", "Ohmsches Gesetz", "Hookesches Gesetz", "Coulombsches Gesetz", "Hebelgesetz"], // Quelle: https://de.wikipedia.org/wiki/Ohmsches_Gesetz
    ["Wie heißt Schall oberhalb des menschlichen Hörbereichs?", "Ultraschall", "Infraschall", "Überschall", "Hyperschall"], // Quelle: https://de.wikipedia.org/wiki/Ultraschall
    ["Wie heißt Schall unterhalb des menschlichen Hörbereichs?", "Infraschall", "Ultraschall", "Unterschall", "Tiefschall"], // Quelle: https://de.wikipedia.org/wiki/Infraschall
    ["Wer entdeckte 1938 zusammen mit Fritz Straßmann die Kernspaltung?", "Otto Hahn", "Max Planck", "Werner Heisenberg", "Albert Einstein"], // Quelle: https://de.wikipedia.org/wiki/Kernspaltung
    ["Nach welchem Physiker ist das Wirkungsquantum h benannt?", "Max Planck", "Niels Bohr", "Erwin Schrödinger", "Max Born"], // Quelle: https://de.wikipedia.org/wiki/Plancksches_Wirkungsquantum
    ["Wie heißt der Punkt, in dem eine Sammellinse das Licht bündelt?", "Brennpunkt", "Drehpunkt", "Fluchtpunkt", "Scheitelpunkt"], // Quelle: https://de.wikipedia.org/wiki/Linse_(Optik)
    ["Welche Kraft lässt ein Schiff schwimmen?", "Auftrieb", "Reibung", "Trägheit", "Fliehkraft"], // Quelle: https://de.wikipedia.org/wiki/Statischer_Auftrieb
    ["Welcher Physiker wies 1886 elektromagnetische Wellen nach?", "Heinrich Hertz", "Michael Faraday", "Alessandro Volta", "André-Marie Ampère"], // Quelle: https://de.wikipedia.org/wiki/Heinrich_Hertz
    ["Für welches Element steht das Symbol Fe?", "Eisen", "Fluor", "Fermium", "Blei"], // Quelle: https://de.wikipedia.org/wiki/Eisen
    ["Für welches Element steht das Symbol Na?", "Natrium", "Neon", "Nickel", "Stickstoff"], // Quelle: https://de.wikipedia.org/wiki/Natrium
    ["Für welches Element steht das Symbol K?", "Kalium", "Calcium", "Kohlenstoff", "Krypton"], // Quelle: https://de.wikipedia.org/wiki/Kalium
    ["Für welches Element steht das Symbol Pb?", "Blei", "Platin", "Phosphor", "Palladium"], // Quelle: https://de.wikipedia.org/wiki/Blei
    ["Für welches Element steht das Symbol Ag?", "Silber", "Gold", "Argon", "Aluminium"], // Quelle: https://de.wikipedia.org/wiki/Silber
    ["Für welches Element steht das Symbol Hg?", "Quecksilber", "Wasserstoff", "Helium", "Hafnium"], // Quelle: https://de.wikipedia.org/wiki/Quecksilber
    ["Welches Element hat die Ordnungszahl 1?", "Wasserstoff", "Helium", "Lithium", "Sauerstoff"], // Quelle: https://de.wikipedia.org/wiki/Wasserstoff
    ["Welches Element ist das häufigste im Universum?", "Wasserstoff", "Helium", "Sauerstoff", "Eisen"], // Quelle: https://de.wikipedia.org/wiki/Wasserstoff
    ["Mit welchem Edelgas gefüllte Ballons steigen in die Luft?", "Helium", "Argon", "Krypton", "Xenon"], // Quelle: https://de.wikipedia.org/wiki/Helium
    ["Welches Gas macht den größten Teil der Luft aus?", "Stickstoff", "Sauerstoff", "Kohlendioxid", "Argon"], // Quelle: https://de.wikipedia.org/wiki/Luft
    ["Wie nennt man eine Lösung mit einem pH-Wert unter 7?", "Sauer", "Basisch", "Neutral", "Gesättigt"], // Quelle: https://de.wikipedia.org/wiki/PH-Wert
    ["Welchen pH-Wert hat reines Wasser bei 25 °C?", "7", "1", "10", "14"], // Quelle: https://de.wikipedia.org/wiki/PH-Wert
    ["Welche chemische Formel hat Kochsalz?", "NaCl", "KCl", "NaOH", "CaCO₃"], // Quelle: https://de.wikipedia.org/wiki/Natriumchlorid
    ["Welcher Stoff hat die Formel CO₂?", "Kohlendioxid", "Kohlenmonoxid", "Kalk", "Chlor"], // Quelle: https://de.wikipedia.org/wiki/Kohlenstoffdioxid
    ["Was bildet sich, wenn Eisen mit Sauerstoff und Wasser reagiert?", "Rost", "Kalk", "Ruß", "Zunder"], // Quelle: https://de.wikipedia.org/wiki/Rost
    ["Wie heißt der grüne Belag auf altem Kupfer?", "Patina", "Rost", "Zunder", "Kalk"], // Quelle: https://de.wikipedia.org/wiki/Patina
    ["Wer stellte 1869 ein Periodensystem der Elemente vor?", "Dmitri Mendelejew", "Marie Curie", "Robert Bunsen", "Antoine Lavoisier"], // Quelle: https://de.wikipedia.org/wiki/Periodensystem
    ["Welches Element benannte Marie Curie nach ihrem Heimatland?", "Polonium", "Germanium", "Francium", "Gallium"], // Quelle: https://de.wikipedia.org/wiki/Polonium
    ["Wie heißt der kleinste Baustein eines chemischen Elements?", "Atom", "Molekül", "Zelle", "Kristall"], // Quelle: https://de.wikipedia.org/wiki/Atom
    ["Welcher natürliche Stoff ist der härteste?", "Diamant", "Quarz", "Granit", "Korund"], // Quelle: https://de.wikipedia.org/wiki/Diamant
    ["Aus welchem Element besteht ein Diamant?", "Kohlenstoff", "Silicium", "Stickstoff", "Bor"], // Quelle: https://de.wikipedia.org/wiki/Diamant
    ["Welches Metall steckt meist in Stromkabeln?", "Kupfer", "Blei", "Zinn", "Titan"], // Quelle: https://de.wikipedia.org/wiki/Kupfer
    ["Wie heißt ein Stoff, der eine Reaktion beschleunigt, ohne verbraucht zu werden?", "Katalysator", "Inhibitor", "Lösungsmittel", "Indikator"], // Quelle: https://de.wikipedia.org/wiki/Katalysator
    ["Zu welcher Gruppe gehören Neon und Argon?", "Edelgase", "Halogene", "Alkalimetalle", "Erdmetalle"], // Quelle: https://de.wikipedia.org/wiki/Edelgase
    ["Zu welcher Gruppe gehören Fluor und Chlor?", "Halogene", "Edelgase", "Alkalimetalle", "Erdalkalimetalle"], // Quelle: https://de.wikipedia.org/wiki/Halogene
    ["Welches Gas riecht nach faulen Eiern?", "Schwefelwasserstoff", "Methan", "Ammoniak", "Ozon"], // Quelle: https://de.wikipedia.org/wiki/Schwefelwasserstoff
    ["Welches Gas bildet die schützende Schicht hoch in der Atmosphäre?", "Ozon", "Helium", "Methan", "Wasserstoff"], // Quelle: https://de.wikipedia.org/wiki/Ozonschicht
    ["Was ist der Hauptbestandteil von Erdgas?", "Methan", "Propan", "Butan", "Ethan"], // Quelle: https://de.wikipedia.org/wiki/Erdgas
    ["Welches Zellorgan gilt als Kraftwerk der Zelle?", "Mitochondrium", "Zellkern", "Ribosom", "Vakuole"], // Quelle: https://de.wikipedia.org/wiki/Mitochondrium
    ["Wo liegt in Tier- und Pflanzenzellen der größte Teil der Erbinformation?", "Im Zellkern", "In der Zellwand", "Im Ribosom", "In der Vakuole"], // Quelle: https://de.wikipedia.org/wiki/Zellkern
    ["Wie heißt die DNA ausgeschrieben auf Deutsch?", "Desoxyribonukleinsäure", "Ribonukleinsäure", "Aminosäure", "Zitronensäure"], // Quelle: https://de.wikipedia.org/wiki/Desoxyribonukleins%C3%A4ure
    ["Welches Hormon senkt den Blutzucker?", "Insulin", "Adrenalin", "Melatonin", "Östrogen"], // Quelle: https://de.wikipedia.org/wiki/Insulin
    ["Welche Blutzellen transportieren den Sauerstoff?", "Rote Blutkörperchen", "Weiße Blutkörperchen", "Blutplättchen", "Lymphozyten"], // Quelle: https://de.wikipedia.org/wiki/Erythrozyt
    ["Wer veröffentlichte 1859 „Über die Entstehung der Arten“?", "Charles Darwin", "Gregor Mendel", "Carl von Linné", "Louis Pasteur"], // Quelle: https://de.wikipedia.org/wiki/%C3%9Cber_die_Entstehung_der_Arten
    ["Wer fand mit Erbsen die Grundregeln der Vererbung?", "Gregor Mendel", "Charles Darwin", "Robert Koch", "Ernst Haeckel"], // Quelle: https://de.wikipedia.org/wiki/Mendelsche_Regeln
    ["Wie heißt der kleinste Knochen des Menschen?", "Steigbügel", "Hammer", "Amboss", "Kniescheibe"], // Quelle: https://de.wikipedia.org/wiki/Geh%C3%B6rkn%C3%B6chelchen
    ["Welches Organ bildet die Galle?", "Leber", "Niere", "Milz", "Magen"], // Quelle: https://de.wikipedia.org/wiki/Galle
    ["Welche Organe filtern das Blut und bilden Harn?", "Nieren", "Lungen", "Leber", "Milz"], // Quelle: https://de.wikipedia.org/wiki/Niere
    ["Wie heißt die Wissenschaft von den Pilzen?", "Mykologie", "Botanik", "Virologie", "Pathologie"], // Quelle: https://de.wikipedia.org/wiki/Mykologie
    ["Wie heißt die Wissenschaft von den Insekten?", "Entomologie", "Ornithologie", "Mykologie", "Zoologie"], // Quelle: https://de.wikipedia.org/wiki/Entomologie
    ["Wie heißt die Teilung des Zellkerns bei Körperzellen?", "Mitose", "Meiose", "Osmose", "Diffusion"], // Quelle: https://de.wikipedia.org/wiki/Mitose
    ["In welchen Zellbestandteilen läuft bei Pflanzen die Photosynthese ab?", "Chloroplasten", "Mitochondrien", "Ribosomen", "Zellkernen"], // Quelle: https://de.wikipedia.org/wiki/Chloroplast
    ["Aus welchen Bausteinen bestehen Eiweiße?", "Aminosäuren", "Fettsäuren", "Zuckern", "Salzen"], // Quelle: https://de.wikipedia.org/wiki/Aminos%C3%A4uren
    ["Welches Vitamin heißt auch Ascorbinsäure?", "Vitamin C", "Vitamin A", "Vitamin D", "Vitamin K"], // Quelle: https://de.wikipedia.org/wiki/Ascorbins%C3%A4ure
    ["Wie nennt man Lebewesen aus nur einer Zelle?", "Einzeller", "Vielzeller", "Wirbeltiere", "Gliederfüßer"], // Quelle: https://de.wikipedia.org/wiki/Einzeller
    ["Welcher Planet hat die heißeste Oberfläche im Sonnensystem?", "Venus", "Merkur", "Mars", "Jupiter"], // Quelle: https://de.wikipedia.org/wiki/Venus_(Planet)
    ["Welcher Planet ist am weitesten von der Sonne entfernt?", "Neptun", "Uranus", "Saturn", "Jupiter"], // Quelle: https://de.wikipedia.org/wiki/Neptun_(Planet)
    ["Wie heißt der größte Mond des Saturn?", "Titan", "Europa", "Ganymed", "Io"], // Quelle: https://de.wikipedia.org/wiki/Titan_(Mond)
    ["Welcher Mond ist der größte im Sonnensystem?", "Ganymed", "Titan", "Kallisto", "Triton"], // Quelle: https://de.wikipedia.org/wiki/Ganymed_(Mond)
    ["Welcher Planet rollt mit stark gekippter Achse um die Sonne?", "Uranus", "Venus", "Mars", "Merkur"], // Quelle: https://de.wikipedia.org/wiki/Uranus_(Planet)
    ["Welcher Himmelskörper galt bis 2006 als neunter Planet?", "Pluto", "Ceres", "Eris", "Sedna"], // Quelle: https://de.wikipedia.org/wiki/Pluto
    ["Welcher Stern ist der Sonne am nächsten?", "Proxima Centauri", "Sirius", "Polarstern", "Beteigeuze"], // Quelle: https://de.wikipedia.org/wiki/Proxima_Centauri
    ["Welcher Stern ist der hellste am Nachthimmel?", "Sirius", "Polarstern", "Wega", "Beteigeuze"], // Quelle: https://de.wikipedia.org/wiki/Sirius
    ["Welche große Spiralgalaxie ist unsere Nachbarin?", "Andromedagalaxie", "Sombrerogalaxie", "Whirlpool-Galaxie", "Feuerradgalaxie"], // Quelle: https://de.wikipedia.org/wiki/Andromedagalaxie
    ["Was gibt ein Lichtjahr an?", "Eine Entfernung", "Eine Zeitspanne", "Eine Helligkeit", "Eine Geschwindigkeit"], // Quelle: https://de.wikipedia.org/wiki/Lichtjahr
    ["Wie heißt es, wenn der Mond die Sonne verdeckt?", "Sonnenfinsternis", "Mondfinsternis", "Sonnenwende", "Tagundnachtgleiche"], // Quelle: https://de.wikipedia.org/wiki/Sonnenfinsternis
    ["Was steht bei einer Mondfinsternis zwischen Sonne und Mond?", "Die Erde", "Die Venus", "Der Mars", "Der Merkur"], // Quelle: https://de.wikipedia.org/wiki/Mondfinsternis
    ["Wer betrat als zweiter Mensch den Mond?", "Buzz Aldrin", "Michael Collins", "Juri Gagarin", "John Glenn"], // Quelle: https://de.wikipedia.org/wiki/Apollo_11
    ["Welche Form haben die Planetenbahnen nach Kepler?", "Ellipsen", "Quadrate", "Spiralen", "Geraden"], // Quelle: https://de.wikipedia.org/wiki/Keplersche_Gesetze
    ["In welchem Sternbild steht der Polarstern?", "Kleiner Bär", "Großer Bär", "Orion", "Kassiopeia"], // Quelle: https://de.wikipedia.org/wiki/Polarstern
    ["Wie heißt die Zone zwischen Mars und Jupiter mit vielen Kleinkörpern?", "Asteroidengürtel", "Kuipergürtel", "Oortsche Wolke", "Van-Allen-Gürtel"], // Quelle: https://de.wikipedia.org/wiki/Asteroideng%C3%BCrtel
    ["Wie heißt eine Zahl, die nur durch 1 und sich selbst teilbar ist?", "Primzahl", "Quadratzahl", "Bruchzahl", "Kubikzahl"], // Quelle: https://de.wikipedia.org/wiki/Primzahl
    ["Wie heißt die längste Seite im rechtwinkligen Dreieck?", "Hypotenuse", "Kathete", "Diagonale", "Sehne"], // Quelle: https://de.wikipedia.org/wiki/Hypotenuse
    ["Für welche Dreiecke gilt der Satz des Pythagoras?", "Rechtwinklige", "Gleichseitige", "Stumpfwinklige", "Alle"], // Quelle: https://de.wikipedia.org/wiki/Satz_des_Pythagoras
    ["Wie heißt das Verhältnis von Kreisumfang zu Durchmesser?", "Pi", "Phi", "Tau", "Omega"], // Quelle: https://de.wikipedia.org/wiki/Kreiszahl
    ["Was ergibt jede Zahl außer null hoch 0?", "1", "0", "Die Zahl selbst", "Unendlich"], // Quelle: https://de.wikipedia.org/wiki/Potenz_(Mathematik)
    ["Wie heißt das Ergebnis einer Multiplikation?", "Produkt", "Summe", "Differenz", "Quotient"], // Quelle: https://de.wikipedia.org/wiki/Multiplikation
    ["Wie heißt das Ergebnis einer Division?", "Quotient", "Produkt", "Summe", "Faktor"], // Quelle: https://de.wikipedia.org/wiki/Division_(Mathematik)
    ["Welches Zahlensystem kommt mit den Ziffern 0 und 1 aus?", "Dualsystem", "Dezimalsystem", "Hexadezimalsystem", "Oktalsystem"], // Quelle: https://de.wikipedia.org/wiki/Dualsystem
    ["Wie heißt die Zahl e ≈ 2,718?", "Eulersche Zahl", "Kreiszahl", "Goldener Schnitt", "Feigenbaum-Zahl"], // Quelle: https://de.wikipedia.org/wiki/Eulersche_Zahl
    ["Wie heißt ein Viereck mit vier gleich langen Seiten?", "Raute", "Trapez", "Drachen", "Parallelogramm"], // Quelle: https://de.wikipedia.org/wiki/Raute
    ["Wer baute den ersten funktionsfähigen programmgesteuerten Rechner Z3?", "Konrad Zuse", "Alan Turing", "Charles Babbage", "John von Neumann"], // Quelle: https://de.wikipedia.org/wiki/Zuse_Z3
    ["Wer meldete 1886 ein Patent für einen Motorwagen an?", "Carl Benz", "Gottlieb Daimler", "Rudolf Diesel", "Nikolaus Otto"], // Quelle: https://de.wikipedia.org/wiki/Benz_Patent-Motorwagen_Nummer_1
    ["Nach welchem Erfinder ist ein Selbstzünder-Motor benannt?", "Rudolf Diesel", "Carl Benz", "Wilhelm Maybach", "Felix Wankel"], // Quelle: https://de.wikipedia.org/wiki/Dieselmotor
    ["Nach wem ist die Einheit Watt benannt?", "James Watt", "Thomas Newcomen", "George Stephenson", "Robert Fulton"], // Quelle: https://de.wikipedia.org/wiki/Watt_(Einheit)
    ["Wie heißt eine LED auf Deutsch?", "Leuchtdiode", "Lichtleiter", "Glühlampe", "Leuchtröhre"], // Quelle: https://de.wikipedia.org/wiki/Leuchtdiode
    ["Welches Gerät setzt Wechselspannung herauf oder herab?", "Transformator", "Generator", "Kondensator", "Akkumulator"], // Quelle: https://de.wikipedia.org/wiki/Transformator
    ["Welches Bauteil speichert elektrische Ladung?", "Kondensator", "Widerstand", "Transistor", "Spule"], // Quelle: https://de.wikipedia.org/wiki/Kondensator_(Elektrotechnik)
    ["Welche Brüder gelangen 1903 die ersten Motorflüge?", "Brüder Wright", "Brüder Lumière", "Brüder Grimm", "Brüder Montgolfier"], // Quelle: https://de.wikipedia.org/wiki/Br%C3%BCder_Wright
    ["Welches Fluggerät entwickelten die Brüder Montgolfier?", "Heißluftballon", "Luftschiff", "Segelflugzeug", "Hubschrauber"], // Quelle: https://de.wikipedia.org/wiki/Montgolfi%C3%A8re
    ["Wie viele Elemente zählt das Periodensystem bis Oganesson?", 118, ""], // Quelle: https://de.wikipedia.org/wiki/Periodensystem
    ["Wie viele Chromosomen hat eine menschliche Körperzelle normalerweise?", 46, ""], // Quelle: https://de.wikipedia.org/wiki/Chromosom
    ["Wie viele Tage braucht der Mars für eine Runde um die Sonne?", 687, "Tage"], // Quelle: https://de.wikipedia.org/wiki/Mars_(Planet)
    ["Wie viele Minuten braucht das Sonnenlicht etwa bis zur Erde?", 8, "Minuten"], // Quelle: https://de.wikipedia.org/wiki/Sonne
    ["Wie viele Sekunden hat eine Stunde?", 3600, "Sekunden"], // Quelle: https://de.wikipedia.org/wiki/Stunde
    ["Wie viele Flächen hat ein Ikosaeder?", 20, ""], // Quelle: https://de.wikipedia.org/wiki/Ikosaeder
    ["Aus wie vielen Sauerstoffatomen besteht ein Ozonmolekül?", 3, ""], // Quelle: https://de.wikipedia.org/wiki/Ozon
    ["Bei wie viel Grad Celsius schmilzt reines Eisen?", 1538, "°C"], // Quelle: https://de.wikipedia.org/wiki/Eisen
    ["In welchem Jahr startete Sputnik 1, der erste künstliche Satellit?", 1957, ""], // Quelle: https://de.wikipedia.org/wiki/Sputnik_1
    ["Wie viel Prozent der trockenen Luft sind etwa Sauerstoff?", 21, "Prozent"], // Quelle: https://de.wikipedia.org/wiki/Luft
    ["Wie viele Bit hat ein Byte?", 8, "Bit"], // Quelle: https://de.wikipedia.org/wiki/Byte
    ["Wie viele Jahre beträgt die Halbwertszeit von Kohlenstoff-14 etwa?", 5730, "Jahre"], // Quelle: https://de.wikipedia.org/wiki/Radiokarbonmethode
    ["Wie viele Monde hat der Mars?", 2, ""], // Quelle: https://de.wikipedia.org/wiki/Mars_(Planet)
    ["Wie viel Grad hat ein gestreckter Winkel?", 180, "Grad"], // Quelle: https://de.wikipedia.org/wiki/Winkel
    ["Wie viele Nullen hat eine Million?", 6, ""], // Quelle: https://de.wikipedia.org/wiki/Million
    ["Wie viele Kubikzentimeter hat ein Liter?", 1000, "cm³"], // Quelle: https://de.wikipedia.org/wiki/Liter
    ["Wie viele Meter hat eine Seemeile?", 1852, "m"], // Quelle: https://de.wikipedia.org/wiki/Seemeile
    ["Bei wie viel Grad Celsius siedet Ethanol etwa?", 78, "°C"], // Quelle: https://de.wikipedia.org/wiki/Ethanol
    ["Wie viele Rippenpaare hat der Mensch normalerweise?", 12, ""], // Quelle: https://de.wikipedia.org/wiki/Rippe
    ["Wie viel ergibt 2 hoch 10?", 1024, ""], // Quelle: https://de.wikipedia.org/wiki/Zweierpotenz
    ["Wie viel Grad hat ein Vollwinkel?", 360, "Grad"], // Quelle: https://de.wikipedia.org/wiki/Vollwinkel
    ["In welchem Jahr wurde der Rechner Z3 fertig?", 1941, ""], // Quelle: https://de.wikipedia.org/wiki/Zuse_Z3
    ["Von der kleinsten zur größten Datenmenge:", ["Bit", "Byte", "Kilobyte", "Megabyte"]], // Quelle: https://de.wikipedia.org/wiki/Byte
    ["Vom leichtesten zum schwersten Teilchen:", ["Elektron", "Proton", "Neutron", "Alphateilchen"]], // Quelle: https://de.wikipedia.org/wiki/Elektron https://de.wikipedia.org/wiki/Proton https://de.wikipedia.org/wiki/Neutron https://de.wikipedia.org/wiki/Alphastrahlung
    ["Von der niedrigsten zur höchsten Frequenz:", ["Radiowellen", "Mikrowellen", "Sichtbares Licht", "Röntgenstrahlung"]], // Quelle: https://de.wikipedia.org/wiki/Elektromagnetisches_Spektrum
    ["Vom kleinsten zum größten:", ["Atom", "Molekül", "Zelle", "Organ"]], // Quelle: https://de.wikipedia.org/wiki/Atom https://de.wikipedia.org/wiki/Molek%C3%BCl https://de.wikipedia.org/wiki/Zelle_(Biologie) https://de.wikipedia.org/wiki/Organ_(Biologie)
    ["Nach der Zahl der Ecken, wenigste zuerst:", ["Tetraeder", "Oktaeder", "Würfel", "Dodekaeder"]], // Quelle: https://de.wikipedia.org/wiki/Platonischer_K%C3%B6rper
    ["Vom niedrigsten zum höchsten Siedepunkt:", ["Stickstoff", "Ethanol", "Wasser", "Quecksilber"]], // Quelle: https://de.wikipedia.org/wiki/Stickstoff https://de.wikipedia.org/wiki/Ethanol https://de.wikipedia.org/wiki/Wasser https://de.wikipedia.org/wiki/Quecksilber
    ["Von der Sonne aus, nächstes zuerst:", ["Merkur", "Asteroidengürtel", "Jupiter", "Kuipergürtel"]], // Quelle: https://de.wikipedia.org/wiki/Sonnensystem
    ["Erfindungen, die älteste zuerst:", ["Buchdruck", "Dampfmaschine", "Telefon", "Computer"]], // Quelle: https://de.wikipedia.org/wiki/Buchdruck https://de.wikipedia.org/wiki/Dampfmaschine https://de.wikipedia.org/wiki/Telefon https://de.wikipedia.org/wiki/Computer
    ["Vorsätze für Maßeinheiten, kleinster zuerst:", ["Milli", "Kilo", "Mega", "Giga"]], // Quelle: https://de.wikipedia.org/wiki/Vors%C3%A4tze_f%C3%BCr_Ma%C3%9Feinheiten
    ["Erdzeitalter, das älteste zuerst:", ["Kambrium", "Jura", "Kreide", "Quartär"]], // Quelle: https://de.wikipedia.org/wiki/Geologische_Zeitskala
    ["Mondphasen ab Neumond:", ["Neumond", "Zunehmender Mond", "Vollmond", "Abnehmender Mond"]], // Quelle: https://de.wikipedia.org/wiki/Mondphase
    ["Von der kleinsten zur größten Zahl:", ["Million", "Milliarde", "Billion", "Billiarde"]], // Quelle: https://de.wikipedia.org/wiki/Zahlennamen
    ["Abschnitte der Mitose in ihrer Reihenfolge:", ["Prophase", "Metaphase", "Anaphase", "Telophase"]], // Quelle: https://de.wikipedia.org/wiki/Mitose
    ["Nach der Wellenlänge, kürzeste zuerst:", ["Violett", "Blau", "Grün", "Rot"]], // Quelle: https://de.wikipedia.org/wiki/Spektralfarbe
    ["Römische Zahlzeichen, kleinstes zuerst:", ["V", "X", "L", "C"]], // Quelle: https://de.wikipedia.org/wiki/R%C3%B6mische_Zahlschrift
  ],
};
