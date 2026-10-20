import type { FragenKategorie } from "./typen";

export const GESCHICHTE: FragenKategorie = {
  id: "geschichte",
  name: "Geschichte",
  emoji: "🏛️",
  stufe: "familie",
  fragen: [
    ["Wer erfand um 1450 den Buchdruck mit beweglichen Lettern in Europa?", "Johannes Gutenberg", "Albrecht Dürer", "Martin Luther", "Jakob Fugger"], // Quelle: https://de.wikipedia.org/wiki/Johannes_Gutenberg
    ["Welcher Frankenherrscher wurde in Rom zum Kaiser gekrönt?", "Karl der Große", "Chlodwig I.", "Pippin der Jüngere", "Karl Martell"], // Quelle: https://de.wikipedia.org/wiki/Karl_der_Große
    ["In welchem Jahr begann die Französische Revolution?", "1789", "1776", "1799", "1815"], // Quelle: https://de.wikipedia.org/wiki/Französische_Revolution
    ["Welches Gebäude wurde am 14. Juli 1789 in Paris gestürmt?", "Die Bastille", "Der Louvre", "Schloss Versailles", "Notre-Dame"], // Quelle: https://de.wikipedia.org/wiki/Sturm_auf_die_Bastille
    ["In welcher Schlacht wurde Napoleon 1815 endgültig besiegt?", "Waterloo", "Leipzig", "Austerlitz", "Jena"], // Quelle: https://de.wikipedia.org/wiki/Schlacht_bei_Waterloo
    ["Auf welcher Insel starb Napoleon?", "St. Helena", "Elba", "Korsika", "Malta"], // Quelle: https://de.wikipedia.org/wiki/Napoleon_Bonaparte
    ["Auf welcher Insel wurde Napoleon geboren?", "Korsika", "Sardinien", "Elba", "Sizilien"], // Quelle: https://de.wikipedia.org/wiki/Napoleon_Bonaparte
    ["Wer war der erste Präsident der USA?", "George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], // Quelle: https://de.wikipedia.org/wiki/George_Washington
    ["In welchem Jahr wurde die Unabhängigkeitserklärung der USA verabschiedet?", "1776", "1789", "1765", "1801"], // Quelle: https://de.wikipedia.org/wiki/Unabhängigkeitserklärung_der_Vereinigten_Staaten
    ["Welcher US-Präsident führte die Nordstaaten im Bürgerkrieg?", "Abraham Lincoln", "Ulysses S. Grant", "Andrew Jackson", "George Washington"], // Quelle: https://de.wikipedia.org/wiki/Abraham_Lincoln
    ["Wer war der erste Mensch im Weltall?", "Juri Gagarin", "Neil Armstrong", "Alexei Leonow", "Walentina Tereschkowa"], // Quelle: https://de.wikipedia.org/wiki/Juri_Alexejewitsch_Gagarin
    ["Wie hieß der erste künstliche Erdsatellit von 1957?", "Sputnik 1", "Wostok 1", "Explorer 1", "Apollo 1"], // Quelle: https://de.wikipedia.org/wiki/Sputnik_1
    ["Welches berühmte Passagierschiff sank nach einer Kollision mit einem Eisberg?", "Titanic", "Lusitania", "Britannic", "Wilhelm Gustloff"], // Quelle: https://de.wikipedia.org/wiki/Titanic_(Schiff)
    ["In welchem Jahr wurde Julius Caesar ermordet?", "44 v. Chr.", "14 n. Chr.", "79 n. Chr.", "100 v. Chr."], // Quelle: https://de.wikipedia.org/wiki/Gaius_Iulius_Caesar
    ["Welche Stadt wurde 79 n. Chr. vom Vesuv verschüttet?", "Pompeji", "Ostia", "Neapel", "Syrakus"], // Quelle: https://de.wikipedia.org/wiki/Pompeji
    ["Wer führte die Germanen 9 n. Chr. in der Varusschlacht gegen Rom?", "Arminius", "Vercingetorix", "Hannibal", "Spartacus"], // Quelle: https://de.wikipedia.org/wiki/Varusschlacht
    ["Welcher Feldherr überquerte mit Elefanten die Alpen?", "Hannibal", "Alexander der Große", "Julius Caesar", "Attila"], // Quelle: https://de.wikipedia.org/wiki/Hannibal
    ["Wer war der Lehrer Alexanders des Großen?", "Aristoteles", "Platon", "Sokrates", "Pythagoras"], // Quelle: https://de.wikipedia.org/wiki/Alexander_der_Große
    ["Welche Stadt gründete Alexander der Große in Ägypten?", "Alexandria", "Kairo", "Memphis", "Theben"], // Quelle: https://de.wikipedia.org/wiki/Alexandria
    ["Für welchen Pharao wurde die Große Pyramide von Gizeh gebaut?", "Cheops", "Tutanchamun", "Ramses II.", "Echnaton"], // Quelle: https://de.wikipedia.org/wiki/Cheops-Pyramide
    ["Wer entdeckte 1922 das Grab des Tutanchamun?", "Howard Carter", "Heinrich Schliemann", "Jean-François Champollion", "Arthur Evans"], // Quelle: https://de.wikipedia.org/wiki/Howard_Carter
    ["Wer entzifferte die ägyptischen Hieroglyphen?", "Jean-François Champollion", "Howard Carter", "Heinrich Schliemann", "Napoleon Bonaparte"], // Quelle: https://de.wikipedia.org/wiki/Jean-François_Champollion
    ["Wer grub das antike Troja aus?", "Heinrich Schliemann", "Howard Carter", "Arthur Evans", "Carl Humann"], // Quelle: https://de.wikipedia.org/wiki/Heinrich_Schliemann
    ["Wie hieß die letzte Herrscherin des Ptolemäerreichs in Ägypten?", "Kleopatra", "Nofretete", "Hatschepsut", "Nefertari"], // Quelle: https://de.wikipedia.org/wiki/Kleopatra_VII.
    ["In welchem Jahr eroberten die Osmanen Konstantinopel?", "1453", "1492", "1389", "1517"], // Quelle: https://de.wikipedia.org/wiki/Eroberung_von_Konstantinopel_(1453)
    ["Welche Stadt hieß früher Konstantinopel?", "Istanbul", "Ankara", "Athen", "Izmir"], // Quelle: https://de.wikipedia.org/wiki/Istanbul
    ["Wer wurde 1871 erster Kaiser des Deutschen Kaiserreichs?", "Wilhelm I.", "Wilhelm II.", "Friedrich III.", "Franz Joseph I."], // Quelle: https://de.wikipedia.org/wiki/Wilhelm_I._(Deutsches_Reich)
    ["Wo wurde 1871 das Deutsche Kaiserreich ausgerufen?", "Spiegelsaal von Versailles", "Berliner Schloss", "Frankfurter Paulskirche", "Schloss Sanssouci"], // Quelle: https://de.wikipedia.org/wiki/Deutsche_Reichsgründung
    ["Wer war der erste Reichskanzler des Deutschen Kaiserreichs?", "Otto von Bismarck", "Leo von Caprivi", "Bernhard von Bülow", "Gustav Stresemann"], // Quelle: https://de.wikipedia.org/wiki/Otto_von_Bismarck
    ["In welcher Stadt tagte 1848 die erste deutsche Nationalversammlung?", "Frankfurt am Main", "Berlin", "Weimar", "Bonn"], // Quelle: https://de.wikipedia.org/wiki/Frankfurter_Nationalversammlung
    ["Nach welcher Stadt ist die erste deutsche Republik benannt?", "Weimar", "Berlin", "Bonn", "Frankfurt"], // Quelle: https://de.wikipedia.org/wiki/Weimarer_Republik
    ["Wer war der erste Reichspräsident der Weimarer Republik?", "Friedrich Ebert", "Paul von Hindenburg", "Gustav Stresemann", "Philipp Scheidemann"], // Quelle: https://de.wikipedia.org/wiki/Friedrich_Ebert
    ["In welchem Jahr wurde das Grundgesetz verkündet?", "1949", "1945", "1951", "1955"], // Quelle: https://de.wikipedia.org/wiki/Grundgesetz_für_die_Bundesrepublik_Deutschland
    ["Welche Stadt war vor der Einheit Hauptstadt der Bundesrepublik?", "Bonn", "Frankfurt", "Köln", "München"], // Quelle: https://de.wikipedia.org/wiki/Bonn
    ["Welcher Bundeskanzler kniete 1970 in Warschau nieder?", "Willy Brandt", "Helmut Schmidt", "Helmut Kohl", "Konrad Adenauer"], // Quelle: https://de.wikipedia.org/wiki/Kniefall_von_Warschau
    ["Wer war Bundeskanzler bei der Wiedervereinigung?", "Helmut Kohl", "Helmut Schmidt", "Gerhard Schröder", "Willy Brandt"], // Quelle: https://de.wikipedia.org/wiki/Helmut_Kohl
    ["Womit endete 1648 der Dreißigjährige Krieg?", "Westfälischer Friede", "Wiener Kongress", "Versailler Vertrag", "Augsburger Religionsfriede"], // Quelle: https://de.wikipedia.org/wiki/Westfälischer_Friede
    ["Welche Seuche wütete ab 1347 in Europa?", "Die Pest", "Die Cholera", "Die Pocken", "Die Grippe"], // Quelle: https://de.wikipedia.org/wiki/Schwarzer_Tod
    ["Wer war Königin von England, als 1588 die Armada besiegt wurde?", "Elisabeth I.", "Maria Stuart", "Victoria", "Anne Boleyn"], // Quelle: https://de.wikipedia.org/wiki/Elisabeth_I.
    ["Welcher englische König hatte sechs Ehefrauen?", "Heinrich VIII.", "Richard III.", "Eduard VI.", "Jakob I."], // Quelle: https://de.wikipedia.org/wiki/Heinrich_VIII._(England)
    ["Wessen Expedition umrundete 1519–1522 als erste die Erde?", "Ferdinand Magellan", "James Cook", "Francis Drake", "Vasco da Gama"], // Quelle: https://de.wikipedia.org/wiki/Ferdinand_Magellan
    ["Wer fand 1498 den Seeweg nach Indien?", "Vasco da Gama", "Christoph Kolumbus", "Ferdinand Magellan", "Bartolomeu Dias"], // Quelle: https://de.wikipedia.org/wiki/Vasco_da_Gama
    ["Wer erreichte 1911 als Erster den Südpol?", "Roald Amundsen", "Robert Scott", "Ernest Shackleton", "Fridtjof Nansen"], // Quelle: https://de.wikipedia.org/wiki/Roald_Amundsen
    ["Wer bestieg 1953 mit Tenzing Norgay als Erster den Mount Everest?", "Edmund Hillary", "Reinhold Messner", "George Mallory", "Heinrich Harrer"], // Quelle: https://de.wikipedia.org/wiki/Edmund_Hillary
    ["Welche Brüder flogen 1903 bei Kitty Hawk mit einem Motorflugzeug?", "Die Brüder Wright", "Die Brüder Lilienthal", "Die Brüder Grimm", "Die Brüder Montgolfier"], // Quelle: https://de.wikipedia.org/wiki/Motorflugzeug https://de.wikipedia.org/wiki/Chronologie_der_Luftfahrt
    ["Welche Brüder ließen 1783 einen Heißluftballon aufsteigen?", "Die Brüder Montgolfier", "Die Brüder Wright", "Die Brüder Lumière", "Die Brüder Grimm"], // Quelle: https://de.wikipedia.org/wiki/Brüder_Montgolfier
    ["Wer verbesserte ab 1769 die Dampfmaschine entscheidend?", "James Watt", "George Stephenson", "Michael Faraday", "Isaac Newton"], // Quelle: https://de.wikipedia.org/wiki/James_Watt
    ["Zwischen welchen Städten fuhr die erste deutsche Eisenbahn?", "Nürnberg und Fürth", "Berlin und Potsdam", "Leipzig und Dresden", "Köln und Bonn"], // Quelle: https://de.wikipedia.org/wiki/Bayerische_Ludwigsbahn
    ["Wer entdeckte 1895 die nach ihm benannten Strahlen?", "Wilhelm Conrad Röntgen", "Max Planck", "Albert Einstein", "Robert Koch"], // Quelle: https://de.wikipedia.org/wiki/Wilhelm_Conrad_Röntgen
    ["Wer entdeckte 1928 das Penicillin?", "Alexander Fleming", "Robert Koch", "Louis Pasteur", "Paul Ehrlich"], // Quelle: https://de.wikipedia.org/wiki/Penicillin
    ["Wer entdeckte 1882 den Erreger der Tuberkulose?", "Robert Koch", "Louis Pasteur", "Alexander Fleming", "Rudolf Virchow"], // Quelle: https://de.wikipedia.org/wiki/Robert_Koch
    ["Wer erhielt als erste Frau einen Nobelpreis?", "Marie Curie", "Bertha von Suttner", "Lise Meitner", "Mutter Teresa"], // Quelle: https://de.wikipedia.org/wiki/Marie_Curie
    ["In welchem Jahr wurden die ersten Nobelpreise verliehen?", "1901", "1895", "1910", "1888"], // Quelle: https://de.wikipedia.org/wiki/Nobelpreis
    ["Wer veröffentlichte 1905 die spezielle Relativitätstheorie?", "Albert Einstein", "Max Planck", "Niels Bohr", "Werner Heisenberg"], // Quelle: https://de.wikipedia.org/wiki/Spezielle_Relativitätstheorie
    ["Wer stellte 1543 die Sonne in den Mittelpunkt des Weltbilds?", "Nikolaus Kopernikus", "Galileo Galilei", "Johannes Kepler", "Claudius Ptolemäus"], // Quelle: https://de.wikipedia.org/wiki/Nikolaus_Kopernikus
    ["Wer malte die Mona Lisa?", "Leonardo da Vinci", "Michelangelo", "Raffael", "Sandro Botticelli"], // Quelle: https://de.wikipedia.org/wiki/Mona_Lisa
    ["Wer malte die Decke der Sixtinischen Kapelle?", "Michelangelo", "Leonardo da Vinci", "Raffael", "Tizian"], // Quelle: https://de.wikipedia.org/wiki/Sixtinische_Kapelle
    ["Welcher Komponist wurde 1770 in Bonn geboren?", "Ludwig van Beethoven", "Wolfgang Amadeus Mozart", "Johann Sebastian Bach", "Joseph Haydn"], // Quelle: https://de.wikipedia.org/wiki/Ludwig_van_Beethoven
    ["Wie hieß der letzte Zar Russlands?", "Nikolaus II.", "Alexander III.", "Peter der Große", "Iwan der Schreckliche"], // Quelle: https://de.wikipedia.org/wiki/Nikolaus_II._(Russland)
    ["In welchem Jahr fand die Oktoberrevolution in Russland statt?", "1917", "1905", "1922", "1914"], // Quelle: https://de.wikipedia.org/wiki/Oktoberrevolution
    ["Wer war 1917 der Anführer der Bolschewiki?", "Lenin", "Stalin", "Chruschtschow", "Gorbatschow"], // Quelle: https://de.wikipedia.org/wiki/Oktoberrevolution
    ["Welcher Staat löste sich Ende 1991 auf?", "Die Sowjetunion", "Österreich-Ungarn", "Das Osmanische Reich", "Preußen"], // Quelle: https://de.wikipedia.org/wiki/Zerfall_der_Sowjetunion
    ["Wer war der letzte Staatschef der Sowjetunion?", "Michail Gorbatschow", "Boris Jelzin", "Leonid Breschnew", "Nikita Chruschtschow"], // Quelle: https://de.wikipedia.org/wiki/Michail_Sergejewitsch_Gorbatschow
    ["Wer führte Indiens Unabhängigkeitsbewegung mit gewaltlosem Widerstand an?", "Mahatma Gandhi", "Nelson Mandela", "Martin Luther King", "Dalai Lama"], // Quelle: https://de.wikipedia.org/wiki/Mahatma_Gandhi
    ["In welchem Jahr wurde Indien unabhängig?", "1947", "1950", "1945", "1957"], // Quelle: https://de.wikipedia.org/wiki/Indien
    ["Wer wurde 1994 erster schwarzer Präsident Südafrikas?", "Nelson Mandela", "Desmond Tutu", "Kofi Annan", "Thabo Mbeki"], // Quelle: https://de.wikipedia.org/wiki/Nelson_Mandela
    ["Wer hielt 1963 die berühmte Rede „Ich habe einen Traum“?", "Martin Luther King", "Malcolm X", "John F. Kennedy", "Rosa Parks"], // Quelle: https://de.wikipedia.org/wiki/I_Have_a_Dream
    ["Welcher US-Präsident wurde 1963 in Dallas ermordet?", "John F. Kennedy", "Abraham Lincoln", "Richard Nixon", "Lyndon B. Johnson"], // Quelle: https://de.wikipedia.org/wiki/Attentat_auf_John_F._Kennedy
    ["Welcher US-Präsident trat 1974 zurück?", "Richard Nixon", "Gerald Ford", "Jimmy Carter", "Lyndon B. Johnson"], // Quelle: https://de.wikipedia.org/wiki/Richard_Nixon
    ["In welcher Stadt wurde 1945 die Charta der Vereinten Nationen unterzeichnet?", "San Francisco", "New York", "Genf", "London"], // Quelle: https://de.wikipedia.org/wiki/Charta_der_Vereinten_Nationen
    ["Welche Stadt wurde am 6. August 1945 von einer Atombombe getroffen?", "Hiroshima", "Nagasaki", "Tokio", "Osaka"], // Quelle: https://de.wikipedia.org/wiki/Atombombenabwürfe_auf_Hiroshima_und_Nagasaki
    ["Welchen Hafen griff Japan im Dezember 1941 an?", "Pearl Harbor", "San Diego", "Seattle", "Boston"], // Quelle: https://de.wikipedia.org/wiki/Angriff_auf_Pearl_Harbor
    ["An welchem Tag landeten die Alliierten in der Normandie?", "6. Juni 1944", "8. Mai 1945", "1. September 1939", "20. Juli 1944"], // Quelle: https://de.wikipedia.org/wiki/Operation_Overlord
    ["Mit dem Überfall auf welches Land begann 1939 der Zweite Weltkrieg?", "Polen", "Frankreich", "Sowjetunion", "Belgien"], // Quelle: https://de.wikipedia.org/wiki/Überfall_auf_Polen
    ["Welcher Plan half ab 1948 beim Wiederaufbau Westeuropas?", "Marshallplan", "Morgenthau-Plan", "Schuman-Plan", "Dawes-Plan"], // Quelle: https://de.wikipedia.org/wiki/Marshallplan
    ["Wie hießen die Flugzeuge der Berliner Luftbrücke im Volksmund?", "Rosinenbomber", "Zuckerflieger", "Brotbomber", "Schokojets"], // Quelle: https://de.wikipedia.org/wiki/Berliner_Luftbrücke
    ["Welche Verträge gründeten 1957 die Europäische Wirtschaftsgemeinschaft?", "Römische Verträge", "Vertrag von Maastricht", "Vertrag von Lissabon", "Élysée-Vertrag"], // Quelle: https://de.wikipedia.org/wiki/Römische_Verträge
    ["In welchem Jahr wurde der Euro als Bargeld eingeführt?", "2002", "1999", "2000", "2001"], // Quelle: https://de.wikipedia.org/wiki/Euro
    ["Auf welcher Burg übersetzte Luther das Neue Testament?", "Wartburg", "Burg Hohenzollern", "Neuschwanstein", "Burg Eltz"], // Quelle: https://de.wikipedia.org/wiki/Wartburg
    ["Welcher König ließ Schloss Neuschwanstein bauen?", "Ludwig II.", "Ludwig I.", "Maximilian II.", "Friedrich der Große"], // Quelle: https://de.wikipedia.org/wiki/Schloss_Neuschwanstein
    ["Welcher preußische König wurde „der Alte Fritz“ genannt?", "Friedrich II.", "Friedrich Wilhelm I.", "Wilhelm I.", "Friedrich I."], // Quelle: https://de.wikipedia.org/wiki/Friedrich_II._(Preußen)
    ["Welches Schloss ließ Friedrich der Große in Potsdam bauen?", "Sanssouci", "Charlottenburg", "Bellevue", "Nymphenburg"], // Quelle: https://de.wikipedia.org/wiki/Schloss_Sanssouci
    ["Welche Herrscherin regierte Österreich von 1740 bis 1780?", "Maria Theresia", "Kaiserin Elisabeth", "Katharina die Große", "Marie Antoinette"], // Quelle: https://de.wikipedia.org/wiki/Maria_Theresia
    ["Wie hieß die österreichische Kaiserin mit dem Spitznamen „Sisi“?", "Elisabeth", "Maria Theresia", "Zita", "Sophie"], // Quelle: https://de.wikipedia.org/wiki/Elisabeth_von_Österreich-Ungarn
    ["Wessen Ermordung in Sarajevo löste 1914 den Ersten Weltkrieg aus?", "Erzherzog Franz Ferdinand", "Kaiser Franz Joseph", "Kaiser Wilhelm II.", "Kronprinz Rudolf"], // Quelle: https://de.wikipedia.org/wiki/Attentat_von_Sarajevo
    ["Welcher Vertrag beendete 1919 den Ersten Weltkrieg für Deutschland?", "Versailler Vertrag", "Westfälischer Friede", "Vertrag von Locarno", "Vertrag von Rapallo"], // Quelle: https://de.wikipedia.org/wiki/Friedensvertrag_von_Versailles
    ["Welches Volk segelte um das Jahr 1000 nach Nordamerika?", "Die Wikinger", "Die Römer", "Die Phönizier", "Die Kelten"], // Quelle: https://de.wikipedia.org/wiki/Vinland
    ["Welche Hochkultur erbaute Machu Picchu?", "Die Inka", "Die Azteken", "Die Maya", "Die Olmeken"], // Quelle: https://de.wikipedia.org/wiki/Machu_Picchu
    ["Wer eroberte ab 1519 das Aztekenreich?", "Hernán Cortés", "Francisco Pizarro", "Christoph Kolumbus", "Ferdinand Magellan"], // Quelle: https://de.wikipedia.org/wiki/Hernán_Cortés
    ["Wer eroberte das Inkareich?", "Francisco Pizarro", "Hernán Cortés", "Vasco da Gama", "Amerigo Vespucci"], // Quelle: https://de.wikipedia.org/wiki/Francisco_Pizarro
    ["Wie hieß die Hauptstadt der Azteken?", "Tenochtitlan", "Cusco", "Chichén Itzá", "Machu Picchu"], // Quelle: https://de.wikipedia.org/wiki/Tenochtitlan
    ["Auf welcher Insel stand der Koloss, eines der sieben Weltwunder?", "Rhodos", "Kreta", "Zypern", "Sizilien"], // Quelle: https://de.wikipedia.org/wiki/Koloss_von_Rhodos
    ["Welches der sieben antiken Weltwunder steht heute noch?", "Pyramiden von Gizeh", "Leuchtturm von Alexandria", "Hängende Gärten", "Koloss von Rhodos"], // Quelle: https://de.wikipedia.org/wiki/Sieben_Weltwunder
    ["Welcher erste Kaiser Chinas ließ die Terrakotta-Armee anlegen?", "Qin Shihuangdi", "Kublai Khan", "Dschingis Khan", "Konfuzius"], // Quelle: https://de.wikipedia.org/wiki/Qin_Shihuangdi
    ["Wer gründete im 13. Jahrhundert das Mongolische Reich?", "Dschingis Khan", "Kublai Khan", "Attila", "Tamerlan"], // Quelle: https://de.wikipedia.org/wiki/Dschingis_Khan
    ["Welcher Venezianer reiste im 13. Jahrhundert nach China?", "Marco Polo", "Christoph Kolumbus", "Vasco da Gama", "Amerigo Vespucci"], // Quelle: https://de.wikipedia.org/wiki/Marco_Polo
    ["Nach wem ist der Kontinent Amerika benannt?", "Amerigo Vespucci", "Christoph Kolumbus", "Ferdinand Magellan", "John Cabot"], // Quelle: https://de.wikipedia.org/wiki/Amerigo_Vespucci

    ["In welchem Jahr segelte die Mayflower nach Amerika?", 1620, ""], // Quelle: https://de.wikipedia.org/wiki/Mayflower
    ["In welchem Jahr wurde Martin Luther geboren?", 1483, ""], // Quelle: https://de.wikipedia.org/wiki/Martin_Luther
    ["In welchem Jahr starb Martin Luther?", 1546, ""], // Quelle: https://de.wikipedia.org/wiki/Martin_Luther
    ["In welchem Jahr krönte sich Napoleon zum Kaiser der Franzosen?", 1804, ""], // Quelle: https://de.wikipedia.org/wiki/Napoleon_Bonaparte
    ["In welchem Jahr fand die Völkerschlacht bei Leipzig statt?", 1813, ""], // Quelle: https://de.wikipedia.org/wiki/Völkerschlacht_bei_Leipzig
    ["In welchem Jahr begann der Wiener Kongress?", 1814, ""], // Quelle: https://de.wikipedia.org/wiki/Wiener_Kongress
    ["In welchem Jahr wurde der Eiffelturm eröffnet?", 1889, ""], // Quelle: https://de.wikipedia.org/wiki/Eiffelturm
    ["Wie hoch war die Cheops-Pyramide ursprünglich?", 147, "m"], // Quelle: https://de.wikipedia.org/wiki/Cheops-Pyramide
    ["Wie viele Jahre regierte Queen Victoria?", 63, "Jahre"], // Quelle: https://de.wikipedia.org/wiki/Victoria_(Vereinigtes_Königreich)
    ["In welchem Jahr wurde die Magna Carta in England besiegelt?", 1215, ""], // Quelle: https://de.wikipedia.org/wiki/Magna_Carta
    ["In welchem Jahr wurde die Universität Heidelberg gegründet?", 1386, ""], // Quelle: https://de.wikipedia.org/wiki/Ruprecht-Karls-Universität_Heidelberg
    ["In welchem Jahr begann der Bau des gotischen Kölner Doms?", 1248, ""], // Quelle: https://de.wikipedia.org/wiki/Kölner_Dom
    ["In welchem Jahr wurde die Freiheitsstatue in New York eingeweiht?", 1886, ""], // Quelle: https://de.wikipedia.org/wiki/Freiheitsstatue
    ["In welchem Jahr wurde der Suezkanal eröffnet?", 1869, ""], // Quelle: https://de.wikipedia.org/wiki/Sueskanal
    ["Wie lang war die Berliner Mauer rund um West-Berlin?", 155, "km"], // Quelle: https://de.wikipedia.org/wiki/Berliner_Mauer https://www.bundesregierung.de/breg-de/themen/deutsche-einheit/eine-traurige-bilanz-393916
    ["In welchem Jahr wurde die DDR gegründet?", 1949, ""], // Quelle: https://de.wikipedia.org/wiki/Deutsche_Demokratische_Republik
    ["Wie viele Thesen veröffentlichte Martin Luther 1517?", 95, ""], // Quelle: https://de.wikipedia.org/wiki/95_Thesen
    ["In welchem Jahr wurde Karl der Große zum Kaiser gekrönt?", 800, ""], // Quelle: https://de.wikipedia.org/wiki/Karl_der_Große
    ["In welchem Jahr wurde Otto von Bismarck geboren?", 1815, ""], // Quelle: https://de.wikipedia.org/wiki/Otto_von_Bismarck
    ["In welchem Jahr wurde Abraham Lincoln ermordet?", 1865, ""], // Quelle: https://de.wikipedia.org/wiki/Abraham_Lincoln
    ["In welchem Jahr wurde Albert Einstein geboren?", 1879, ""], // Quelle: https://de.wikipedia.org/wiki/Albert_Einstein
    ["In welchem Jahr flog Juri Gagarin ins Weltall?", 1961, ""], // Quelle: https://de.wikipedia.org/wiki/Wostok_1
    ["In welchem Jahr wurde der Bundesbrief der Eidgenossen geschlossen?", 1291, ""], // Quelle: https://de.wikipedia.org/wiki/Bundesbrief_von_1291
    ["In welchem Jahr endete das Heilige Römische Reich?", 1806, ""], // Quelle: https://de.wikipedia.org/wiki/Heiliges_Römisches_Reich
    ["In welchem Jahr erhielten Frauen in Deutschland das Wahlrecht?", 1918, ""], // Quelle: https://de.wikipedia.org/wiki/Frauenwahlrecht
    ["Wie alt wurde Alexander der Große?", 32, "Jahre"], // Quelle: https://de.wikipedia.org/wiki/Alexander_der_Große
    ["In welchem Jahr wurde William Shakespeare geboren?", 1564, ""], // Quelle: https://de.wikipedia.org/wiki/William_Shakespeare
    ["In welchem Jahr wurde der letzte weströmische Kaiser abgesetzt?", 476, ""], // Quelle: https://de.wikipedia.org/wiki/Romulus_Augustulus
    ["In welchem Jahr fand die Schlacht bei Hastings statt?", 1066, ""], // Quelle: https://de.wikipedia.org/wiki/Schlacht_bei_Hastings

    ["Vom ältesten zum jüngsten Ereignis:", ["Bau der Cheops-Pyramide", "Ermordung Caesars", "Kaiserkrönung Karls", "Fall der Berliner Mauer"]], // Quelle: https://de.wikipedia.org/wiki/Cheops-Pyramide https://de.wikipedia.org/wiki/Gaius_Iulius_Caesar https://de.wikipedia.org/wiki/Karl_der_Große https://de.wikipedia.org/wiki/Berliner_Mauer
    ["Vom ältesten zum jüngsten Ereignis:", ["Gutenbergs Buchdruck", "Kolumbus erreicht Amerika", "Luthers 95 Thesen", "Dreißigjähriger Krieg"]], // Quelle: https://de.wikipedia.org/wiki/Johannes_Gutenberg https://de.wikipedia.org/wiki/Christoph_Kolumbus https://de.wikipedia.org/wiki/95_Thesen https://de.wikipedia.org/wiki/Dreißigjähriger_Krieg
    ["Vom ältesten zum jüngsten Ereignis:", ["Französische Revolution", "Reichsgründung", "Erster Weltkrieg", "Erste Mondlandung"]], // Quelle: https://de.wikipedia.org/wiki/Französische_Revolution https://de.wikipedia.org/wiki/Deutsche_Reichsgründung https://de.wikipedia.org/wiki/Erster_Weltkrieg https://de.wikipedia.org/wiki/Apollo_11
    ["Bundeskanzler in der Reihenfolge ihrer Amtszeit:", ["Konrad Adenauer", "Ludwig Erhard", "Kurt Georg Kiesinger", "Willy Brandt"]], // Quelle: https://de.wikipedia.org/wiki/Bundeskanzler_(Deutschland)
    ["Bundeskanzler in der Reihenfolge ihrer Amtszeit:", ["Helmut Schmidt", "Helmut Kohl", "Gerhard Schröder", "Angela Merkel"]], // Quelle: https://de.wikipedia.org/wiki/Bundeskanzler_(Deutschland)
    ["Antike, vom ältesten zum jüngsten Ereignis:", ["Bau der Cheops-Pyramide", "Tod Alexanders des Großen", "Ermordung Caesars", "Untergang Pompejis"]], // Quelle: https://de.wikipedia.org/wiki/Cheops-Pyramide https://de.wikipedia.org/wiki/Alexander_der_Große https://de.wikipedia.org/wiki/Gaius_Iulius_Caesar https://de.wikipedia.org/wiki/Pompeji
    ["Entdecker, vom frühesten zum spätesten:", ["Marco Polo in China", "Kolumbus in Amerika", "Vasco da Gama in Indien", "Amundsen am Südpol"]], // Quelle: https://de.wikipedia.org/wiki/Marco_Polo https://de.wikipedia.org/wiki/Christoph_Kolumbus https://de.wikipedia.org/wiki/Vasco_da_Gama https://de.wikipedia.org/wiki/Roald_Amundsen
    ["Deutsche Geschichte, vom ältesten zum jüngsten:", ["Paulskirchen-Parlament", "Reichsgründung", "Weimarer Verfassung", "Grundgesetz"]], // Quelle: https://de.wikipedia.org/wiki/Frankfurter_Nationalversammlung https://de.wikipedia.org/wiki/Deutsche_Reichsgründung https://de.wikipedia.org/wiki/Weimarer_Verfassung https://de.wikipedia.org/wiki/Grundgesetz_für_die_Bundesrepublik_Deutschland
    ["Nachkriegszeit, vom ältesten zum jüngsten:", ["Berliner Luftbrücke", "Bau der Mauer", "Erste Mondlandung", "Fall der Mauer"]], // Quelle: https://de.wikipedia.org/wiki/Berliner_Luftbrücke https://de.wikipedia.org/wiki/Berliner_Mauer https://de.wikipedia.org/wiki/Apollo_11
    ["Russische Herrscher, vom frühesten zum spätesten:", ["Iwan der Schreckliche", "Peter der Große", "Katharina die Große", "Nikolaus II."]], // Quelle: https://de.wikipedia.org/wiki/Iwan_IV._(Russland) https://de.wikipedia.org/wiki/Peter_I._(Russland) https://de.wikipedia.org/wiki/Katharina_II._(Russland) https://de.wikipedia.org/wiki/Nikolaus_II._(Russland)
    ["Nach Geburtsjahr, vom ältesten zum jüngsten:", ["Leonardo da Vinci", "Martin Luther", "Johann Sebastian Bach", "Albert Einstein"]], // Quelle: https://de.wikipedia.org/wiki/Leonardo_da_Vinci https://de.wikipedia.org/wiki/Martin_Luther https://de.wikipedia.org/wiki/Johann_Sebastian_Bach https://de.wikipedia.org/wiki/Albert_Einstein
    ["Komponisten nach Geburtsjahr, vom ältesten zum jüngsten:", ["Johann Sebastian Bach", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Richard Wagner"]], // Quelle: https://de.wikipedia.org/wiki/Johann_Sebastian_Bach https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart https://de.wikipedia.org/wiki/Ludwig_van_Beethoven https://de.wikipedia.org/wiki/Richard_Wagner
    ["Bundespräsidenten in der Reihenfolge ihrer Amtszeit:", ["Theodor Heuss", "Heinrich Lübke", "Gustav Heinemann", "Walter Scheel"]], // Quelle: https://de.wikipedia.org/wiki/Bundespräsident_(Deutschland)
    ["US-Präsidenten in der Reihenfolge ihrer Amtszeit:", ["George Washington", "Abraham Lincoln", "Franklin D. Roosevelt", "John F. Kennedy"]], // Quelle: https://de.wikipedia.org/wiki/Liste_der_Präsidenten_der_Vereinigten_Staaten
    ["Forscher nach Geburtsjahr, vom ältesten zum jüngsten:", ["Nikolaus Kopernikus", "Galileo Galilei", "Isaac Newton", "Albert Einstein"]], // Quelle: https://de.wikipedia.org/wiki/Nikolaus_Kopernikus https://de.wikipedia.org/wiki/Galileo_Galilei https://de.wikipedia.org/wiki/Isaac_Newton https://de.wikipedia.org/wiki/Albert_Einstein
  ],
};
