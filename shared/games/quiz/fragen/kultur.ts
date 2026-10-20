import type { FragenKategorie } from "./typen";

export const KULTUR: FragenKategorie = {
  id: "kultur",
  name: "Musik, Kunst & Bücher",
  emoji: "🎨",
  stufe: "familie",
  fragen: [
    ["Wer komponierte „Eine kleine Nachtmusik“?", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Johann Sebastian Bach", "Joseph Haydn"], // Quelle: https://de.wikipedia.org/wiki/Eine_kleine_Nachtmusik
    ["Wer komponierte die Sinfonie mit der „Ode an die Freude“?", "Ludwig van Beethoven", "Wolfgang Amadeus Mozart", "Johannes Brahms", "Franz Schubert"], // Quelle: https://de.wikipedia.org/wiki/9._Sinfonie_(Beethoven)
    ["Wer komponierte „Die vier Jahreszeiten“?", "Antonio Vivaldi", "Georg Friedrich Händel", "Johann Sebastian Bach", "Georg Philipp Telemann"], // Quelle: https://de.wikipedia.org/wiki/Die_vier_Jahreszeiten
    ["Wer sammelte Märchen wie „Hänsel und Gretel“?", "Die Brüder Grimm", "Hans Christian Andersen", "Wilhelm Hauff", "Charles Perrault"], // Quelle: https://de.wikipedia.org/wiki/Hänsel_und_Gretel
    ["Wer schrieb das Märchen „Die kleine Meerjungfrau“?", "Hans Christian Andersen", "Die Brüder Grimm", "Wilhelm Hauff", "Charles Perrault"], // Quelle: https://de.wikipedia.org/wiki/Die_kleine_Meerjungfrau
    ["Welches Instrument gehört zu den Blechblasinstrumenten?", "Trompete", "Klarinette", "Querflöte", "Oboe"], // Quelle: https://de.wikipedia.org/wiki/Blechblasinstrument
    ["Welches Instrument gehört zu den Holzblasinstrumenten?", "Fagott", "Posaune", "Tuba", "Waldhorn"], // Quelle: https://de.wikipedia.org/wiki/Holzblasinstrument
    ["Wer schrieb „Don Quijote“?", "Miguel de Cervantes", "Dante Alighieri", "Giovanni Boccaccio", "Francesco Petrarca"], // Quelle: https://de.wikipedia.org/wiki/Don_Quijote
    ["Wer schrieb die „Göttliche Komödie“?", "Dante Alighieri", "Francesco Petrarca", "Giovanni Boccaccio", "Niccolò Machiavelli"], // Quelle: https://de.wikipedia.org/wiki/Göttliche_Komödie
    ["Wer komponierte „Der Ring des Nibelungen“?", "Richard Wagner", "Richard Strauss", "Giuseppe Verdi", "Carl Maria von Weber"], // Quelle: https://de.wikipedia.org/wiki/Der_Ring_des_Nibelungen
    ["Wer komponierte die Oper „Aida“?", "Giuseppe Verdi", "Giacomo Puccini", "Gioachino Rossini", "Georges Bizet"], // Quelle: https://de.wikipedia.org/wiki/Aida
    ["Wer komponierte die Oper „Carmen“?", "Georges Bizet", "Giuseppe Verdi", "Jacques Offenbach", "Charles Gounod"], // Quelle: https://de.wikipedia.org/wiki/Carmen_(Oper)
    ["Wer komponierte das Ballett „Schwanensee“?", "Peter Tschaikowsky", "Igor Strawinsky", "Sergei Prokofjew", "Sergei Rachmaninow"], // Quelle: https://de.wikipedia.org/wiki/Schwanensee
    ["Wer komponierte den Walzer „An der schönen blauen Donau“?", "Johann Strauss (Sohn)", "Franz Lehár", "Joseph Haydn", "Anton Bruckner"], // Quelle: https://de.wikipedia.org/wiki/An_der_schönen_blauen_Donau
    ["Wer malte „Das Mädchen mit dem Perlenohrring“?", "Jan Vermeer", "Rembrandt", "Peter Paul Rubens", "Frans Hals"], // Quelle: https://de.wikipedia.org/wiki/Das_Mädchen_mit_dem_Perlenohrring
    ["Wer malte „Die Nachtwache“?", "Rembrandt", "Jan Vermeer", "Peter Paul Rubens", "Anthonis van Dyck"], // Quelle: https://de.wikipedia.org/wiki/Die_Nachtwache
    ["Wer malte die zerfließenden Uhren in „Die Beständigkeit der Erinnerung“?", "Salvador Dalí", "René Magritte", "Joan Miró", "Max Ernst"], // Quelle: https://de.wikipedia.org/wiki/Die_Beständigkeit_der_Erinnerung
    ["Wer malte „Die Geburt der Venus“?", "Sandro Botticelli", "Tizian", "Raffael", "Caravaggio"], // Quelle: https://de.wikipedia.org/wiki/Die_Geburt_der_Venus_(Botticelli)
    ["Wer malte das „Abendmahl“ in Mailand?", "Leonardo da Vinci", "Michelangelo", "Giotto", "Raffael"], // Quelle: https://de.wikipedia.org/wiki/Das_Abendmahl_(Leonardo_da_Vinci)
    ["Welcher Maler ist für seine Bilder von Sonnenblumen berühmt?", "Vincent van Gogh", "Edgar Degas", "Pierre-Auguste Renoir", "Camille Pissarro"], // Quelle: https://de.wikipedia.org/wiki/Sonnenblumen_(van_Gogh)
    ["Wer malte in seinem Garten in Giverny viele Seerosenbilder?", "Claude Monet", "Édouard Manet", "Pierre-Auguste Renoir", "Paul Cézanne"], // Quelle: https://de.wikipedia.org/wiki/Claude_Monet
    ["Wer malte „Der Wanderer über dem Nebelmeer“?", "Caspar David Friedrich", "Philipp Otto Runge", "Carl Spitzweg", "Adolph Menzel"], // Quelle: https://de.wikipedia.org/wiki/Der_Wanderer_über_dem_Nebelmeer
    ["Wer schrieb „Max und Moritz“?", "Wilhelm Busch", "Heinrich Hoffmann", "Joachim Ringelnatz", "Christian Morgenstern"], // Quelle: https://de.wikipedia.org/wiki/Max_und_Moritz
    ["Wer schrieb „Die Verwandlung“ über Gregor Samsa?", "Franz Kafka", "Thomas Mann", "Hermann Hesse", "Rainer Maria Rilke"], // Quelle: https://de.wikipedia.org/wiki/Die_Verwandlung
    ["Wer schrieb „Effi Briest“?", "Theodor Fontane", "Theodor Storm", "Gottfried Keller", "Wilhelm Raabe"], // Quelle: https://de.wikipedia.org/wiki/Effi_Briest
    ["Wer schrieb „Nathan der Weise“?", "Gotthold Ephraim Lessing", "Friedrich Schiller", "Johann Wolfgang von Goethe", "Johann Gottfried Herder"], // Quelle: https://de.wikipedia.org/wiki/Nathan_der_Weise
    ["Wer schrieb das Drama „Wilhelm Tell“?", "Friedrich Schiller", "Johann Wolfgang von Goethe", "Heinrich von Kleist", "Franz Grillparzer"], // Quelle: https://de.wikipedia.org/wiki/Wilhelm_Tell_(Schiller)
    ["Wer schrieb „Woyzeck“?", "Georg Büchner", "Heinrich von Kleist", "Gerhart Hauptmann", "Arthur Schnitzler"], // Quelle: https://de.wikipedia.org/wiki/Woyzeck
    ["Wer schrieb „Hamlet“?", "William Shakespeare", "Christopher Marlowe", "Molière", "Jean Racine"], // Quelle: https://de.wikipedia.org/wiki/Hamlet
    ["Wer schrieb „Krieg und Frieden“?", "Leo Tolstoi", "Fjodor Dostojewski", "Anton Tschechow", "Alexander Puschkin"], // Quelle: https://de.wikipedia.org/wiki/Krieg_und_Frieden
    ["Wer schrieb „Oliver Twist“?", "Charles Dickens", "Mark Twain", "Jane Austen", "Oscar Wilde"], // Quelle: https://de.wikipedia.org/wiki/Oliver_Twist
    ["Wer schrieb „Stolz und Vorurteil“?", "Jane Austen", "Charlotte Brontë", "Emily Brontë", "George Eliot"], // Quelle: https://de.wikipedia.org/wiki/Stolz_und_Vorurteil
    ["Wer schrieb „Die Abenteuer des Tom Sawyer“?", "Mark Twain", "Jack London", "Herman Melville", "Charles Dickens"], // Quelle: https://de.wikipedia.org/wiki/Die_Abenteuer_des_Tom_Sawyer
    ["Wer schrieb „Moby Dick“?", "Herman Melville", "Mark Twain", "Edgar Allan Poe", "Nathaniel Hawthorne"], // Quelle: https://de.wikipedia.org/wiki/Moby-Dick
    ["Wer schrieb „Robinson Crusoe“?", "Daniel Defoe", "Jonathan Swift", "Robert Louis Stevenson", "Walter Scott"], // Quelle: https://de.wikipedia.org/wiki/Robinson_Crusoe
    ["Wer schrieb „Die Schatzinsel“?", "Robert Louis Stevenson", "Daniel Defoe", "Jules Verne", "Charles Dickens"], // Quelle: https://de.wikipedia.org/wiki/Die_Schatzinsel
    ["Wer schrieb „In 80 Tagen um die Welt“?", "Jules Verne", "Alexandre Dumas", "Victor Hugo", "H. G. Wells"], // Quelle: https://de.wikipedia.org/wiki/Reise_um_die_Erde_in_80_Tagen
    ["Wer schrieb „Die drei Musketiere“?", "Alexandre Dumas", "Victor Hugo", "Jules Verne", "Honoré de Balzac"], // Quelle: https://de.wikipedia.org/wiki/Die_drei_Musketiere
    ["Wer schrieb „Der kleine Prinz“?", "Antoine de Saint-Exupéry", "Jules Verne", "Albert Camus", "Victor Hugo"], // Quelle: https://de.wikipedia.org/wiki/Der_kleine_Prinz
    ["Wer schrieb „Alice im Wunderland“?", "Lewis Carroll", "James M. Barrie", "Rudyard Kipling", "Robert Louis Stevenson"], // Quelle: https://de.wikipedia.org/wiki/Alice_im_Wunderland
    ["Wer schrieb „Das Dschungelbuch“?", "Rudyard Kipling", "Lewis Carroll", "Jack London", "James M. Barrie"], // Quelle: https://de.wikipedia.org/wiki/Das_Dschungelbuch
    ["Wer schrieb „Heidi“?", "Johanna Spyri", "Selma Lagerlöf", "Marie von Ebner-Eschenbach", "Jeremias Gotthelf"], // Quelle: https://de.wikipedia.org/wiki/Johanna_Spyri
    ["Wer komponierte „In der Halle des Bergkönigs“?", "Edvard Grieg", "Jean Sibelius", "Bedřich Smetana", "Antonín Dvořák"], // Quelle: https://de.wikipedia.org/wiki/In_der_Halle_des_Bergkönigs
    ["Wer komponierte „Die Moldau“?", "Bedřich Smetana", "Antonín Dvořák", "Leoš Janáček", "Franz Liszt"], // Quelle: https://de.wikipedia.org/wiki/Die_Moldau
    ["Wer komponierte „Der Karneval der Tiere“?", "Camille Saint-Saëns", "Maurice Ravel", "Georges Bizet", "Claude Debussy"], // Quelle: https://de.wikipedia.org/wiki/Der_Karneval_der_Tiere
    ["Wer komponierte „Peter und der Wolf“?", "Sergei Prokofjew", "Peter Tschaikowsky", "Igor Strawinsky", "Dmitri Schostakowitsch"], // Quelle: https://de.wikipedia.org/wiki/Peter_und_der_Wolf
    ["Wer komponierte das Ballett „Der Nussknacker“?", "Peter Tschaikowsky", "Nikolai Rimski-Korsakow", "Modest Mussorgski", "Alexander Borodin"], // Quelle: https://de.wikipedia.org/wiki/Der_Nussknacker
    ["Wer komponierte das Wiegenlied „Guten Abend, gut' Nacht“?", "Johannes Brahms", "Franz Schubert", "Wolfgang Amadeus Mozart", "Robert Schumann"], // Quelle: https://de.wikipedia.org/wiki/Guten_Abend,_gut’_Nacht
    ["Wer komponierte das Klavierstück „Für Elise“?", "Ludwig van Beethoven", "Wolfgang Amadeus Mozart", "Frédéric Chopin", "Franz Schubert"], // Quelle: https://de.wikipedia.org/wiki/Für_Elise
    ["In welcher Stadt wurde Mozart geboren?", "Salzburg", "Wien", "Linz", "Innsbruck"], // Quelle: https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart
    ["In welcher Stadt wurde Beethoven geboren?", "Bonn", "Wien", "Köln", "Leipzig"], // Quelle: https://de.wikipedia.org/wiki/Ludwig_van_Beethoven
    ["Was bedeutet „piano“ in der Musik?", "leise", "laut", "langsam", "schnell"], // Quelle: https://de.wikipedia.org/wiki/Dynamik_(Musik)
    ["Was bedeutet „forte“ in der Musik?", "laut", "leise", "langsam", "schnell"], // Quelle: https://de.wikipedia.org/wiki/Dynamik_(Musik)
    ["Welcher Notenschlüssel heißt auch G-Schlüssel?", "Violinschlüssel", "Bassschlüssel", "Altschlüssel", "Tenorschlüssel"], // Quelle: https://de.wikipedia.org/wiki/Notenschlüssel
    ["Wie nennt man ein Musikstück für vier Spieler?", "Quartett", "Trio", "Quintett", "Duett"], // Quelle: https://de.wikipedia.org/wiki/Quartett
    ["Wer steht vor dem Orchester und gibt mit dem Taktstock den Takt an?", "Dirigent", "Souffleur", "Intendant", "Solist"], // Quelle: https://de.wikipedia.org/wiki/Dirigent
    ["Welches Instrument hat Pfeifen und steht oft in Kirchen?", "Orgel", "Cembalo", "Harmonium", "Akkordeon"], // Quelle: https://de.wikipedia.org/wiki/Orgel
    ["Welches Streichinstrument klingt am tiefsten?", "Kontrabass", "Cello", "Bratsche", "Geige"], // Quelle: https://de.wikipedia.org/wiki/Kontrabass
    ["In welcher Stadt steht das Opernhaus „La Scala“?", "Mailand", "Rom", "Venedig", "Neapel"], // Quelle: https://de.wikipedia.org/wiki/Teatro_alla_Scala
    ["Welcher Baustil prägt den Kölner Dom?", "Gotik", "Romanik", "Barock", "Jugendstil"], // Quelle: https://de.wikipedia.org/wiki/Kölner_Dom
    ["In welcher Stadt steht die Kirche Sagrada Família?", "Barcelona", "Madrid", "Sevilla", "Valencia"], // Quelle: https://de.wikipedia.org/wiki/Sagrada_Família
    ["In welchem Land steht das Taj Mahal?", "Indien", "Pakistan", "Iran", "Bangladesch"], // Quelle: https://de.wikipedia.org/wiki/Taj_Mahal
    ["Wer gründete 1919 das Bauhaus?", "Walter Gropius", "Le Corbusier", "Karl Friedrich Schinkel", "Antoni Gaudí"], // Quelle: https://de.wikipedia.org/wiki/Bauhaus
    ["In welchem Museum hängt die „Mona Lisa“?", "Louvre", "Prado", "Uffizien", "Rijksmuseum"], // Quelle: https://de.wikipedia.org/wiki/Mona_Lisa
    ["Wie nennt man ein Gemälde von Obst, Blumen und Gegenständen?", "Stillleben", "Porträt", "Landschaftsbild", "Historienbild"], // Quelle: https://de.wikipedia.org/wiki/Stillleben
    ["Wer malte das Antikriegsbild „Guernica“?", "Pablo Picasso", "Salvador Dalí", "Joan Miró", "Henri Matisse"], // Quelle: https://de.wikipedia.org/wiki/Guernica_(Gemälde)
    ["Wer schrieb die Ballade „Der Erlkönig“?", "Johann Wolfgang von Goethe", "Friedrich Schiller", "Heinrich Heine", "Joseph von Eichendorff"], // Quelle: https://de.wikipedia.org/wiki/Erlkönig_(Ballade)
    ["Wer schrieb „Das Lied von der Glocke“?", "Friedrich Schiller", "Johann Wolfgang von Goethe", "Ludwig Uhland", "Friedrich Hölderlin"], // Quelle: https://de.wikipedia.org/wiki/Das_Lied_von_der_Glocke
    ["Wer schrieb das Loreley-Gedicht „Ich weiß nicht, was soll es bedeuten“?", "Heinrich Heine", "Johann Wolfgang von Goethe", "Joseph von Eichendorff", "Eduard Mörike"], // Quelle: https://de.wikipedia.org/wiki/Die_Lore-Ley
    ["Aus welcher Stadt stammt die Sage vom Rattenfänger?", "Hameln", "Bremen", "Goslar", "Hannover"], // Quelle: https://de.wikipedia.org/wiki/Rattenfänger_von_Hameln
    ["Welchem Dichter wird die „Odyssee“ zugeschrieben?", "Homer", "Vergil", "Sophokles", "Ovid"], // Quelle: https://de.wikipedia.org/wiki/Odyssee
    ["Wer ist der Held der „Odyssee“?", "Odysseus", "Achilles", "Herakles", "Perseus"], // Quelle: https://de.wikipedia.org/wiki/Odyssee
    ["Wer tötet im Nibelungenlied den Drachen?", "Siegfried", "Hagen", "Gunther", "Dietrich"], // Quelle: https://de.wikipedia.org/wiki/Nibelungenlied
    ["Wie heißt der König der Tafelrunde?", "Artus", "Lancelot", "Merlin", "Parzival"], // Quelle: https://de.wikipedia.org/wiki/Tafelrunde
    ["Wie nennt man ein lustiges Bühnenstück?", "Komödie", "Tragödie", "Elegie", "Ode"], // Quelle: https://de.wikipedia.org/wiki/Komödie
    ["Wie heißt ein Bühnenwerk, in dem fast alles gesungen wird?", "Oper", "Schauspiel", "Ballett", "Pantomime"], // Quelle: https://de.wikipedia.org/wiki/Oper
    ["Wie heißt Theater ohne Worte, nur mit Gesten und Mimik?", "Pantomime", "Oper", "Operette", "Kabarett"], // Quelle: https://de.wikipedia.org/wiki/Pantomime
    ["Wie heißt die höchste Frauenstimme?", "Sopran", "Alt", "Tenor", "Bariton"], // Quelle: https://de.wikipedia.org/wiki/Stimmlage
    ["Wie heißt die tiefste Männerstimme?", "Bass", "Tenor", "Bariton", "Alt"], // Quelle: https://de.wikipedia.org/wiki/Stimmlage
    ["Welcher Tanz steht im Dreivierteltakt?", "Walzer", "Polka", "Tango", "Marsch"], // Quelle: https://de.wikipedia.org/wiki/Walzer
    ["Wer komponierte die Melodie der deutschen Nationalhymne?", "Joseph Haydn", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Johannes Brahms"], // Quelle: https://de.wikipedia.org/wiki/Das_Lied_der_Deutschen
    ["Wer schrieb „Die Leiden des jungen Werthers“?", "Johann Wolfgang von Goethe", "Friedrich Schiller", "Novalis", "Friedrich Hölderlin"], // Quelle: https://de.wikipedia.org/wiki/Die_Leiden_des_jungen_Werthers
    ["Wer schrieb den Roman „Dracula“?", "Bram Stoker", "Mary Shelley", "Edgar Allan Poe", "Oscar Wilde"], // Quelle: https://de.wikipedia.org/wiki/Dracula
    ["Wer schrieb den Roman „Frankenstein“?", "Mary Shelley", "Bram Stoker", "Edgar Allan Poe", "Jane Austen"], // Quelle: https://de.wikipedia.org/wiki/Frankenstein_(Roman)
    ["Wer schrieb „Das Bildnis des Dorian Gray“?", "Oscar Wilde", "Charles Dickens", "George Bernard Shaw", "James Joyce"], // Quelle: https://de.wikipedia.org/wiki/Das_Bildnis_des_Dorian_Gray
    ["Wer schrieb die Geschichten über den Detektiv Sherlock Holmes?", "Arthur Conan Doyle", "Agatha Christie", "Edgar Allan Poe", "Wilkie Collins"], // Quelle: https://de.wikipedia.org/wiki/Sherlock_Holmes
    ["Wer schrieb „Die Zeitmaschine“?", "H. G. Wells", "Jules Verne", "Aldous Huxley", "George Orwell"], // Quelle: https://de.wikipedia.org/wiki/Die_Zeitmaschine

    ["Wie viele Tasten hat ein klassisches Klavier?", 88, "Tasten"], // Quelle: https://de.wikipedia.org/wiki/Klavier
    ["In welchem Jahr wurde Mozart geboren?", 1756, ""], // Quelle: https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart
    ["In welchem Jahr wurde Beethoven geboren?", 1770, ""], // Quelle: https://de.wikipedia.org/wiki/Ludwig_van_Beethoven
    ["In welchem Jahr starb Johann Sebastian Bach?", 1750, ""], // Quelle: https://de.wikipedia.org/wiki/Johann_Sebastian_Bach
    ["Wie viele Sinfonien hat Beethoven vollendet?", 9, "Sinfonien"], // Quelle: https://de.wikipedia.org/wiki/Ludwig_van_Beethoven
    ["In welchem Jahr wurde Goethe geboren?", 1749, ""], // Quelle: https://de.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe
    ["In welchem Jahr erschien der erste Band der Grimm'schen Märchen?", 1812, ""], // Quelle: https://de.wikipedia.org/wiki/Grimms_Märchen
    ["Wie hoch ist der Kölner Dom?", 157, "Meter"], // Quelle: https://de.wikipedia.org/wiki/Kölner_Dom
    ["In welchem Jahr wurde der Kölner Dom vollendet?", 1880, ""], // Quelle: https://de.wikipedia.org/wiki/Kölner_Dom
    ["Wie hoch war die Cheops-Pyramide ursprünglich ungefähr?", 146, "Meter"], // Quelle: https://de.wikipedia.org/wiki/Cheops-Pyramide
    ["Wie viele Saiten hat eine große Konzertharfe?", 47, "Saiten"], // Quelle: https://de.wikipedia.org/wiki/Harfe
    ["Aus wie vielen Halbtonschritten besteht eine Oktave?", 12, "Halbtöne"], // Quelle: https://de.wikipedia.org/wiki/Oktave
    ["In wie viele Gesänge ist Homers „Odyssee“ eingeteilt?", 24, "Gesänge"], // Quelle: https://de.wikipedia.org/wiki/Odyssee
    ["Wie viele Gesänge hat Dantes „Göttliche Komödie“?", 100, "Gesänge"], // Quelle: https://de.wikipedia.org/wiki/Göttliche_Komödie
    ["In welchem Jahr wurde „Die Zauberflöte“ uraufgeführt?", 1791, ""], // Quelle: https://de.wikipedia.org/wiki/Die_Zauberflöte
    ["Wie viele Meilen unter dem Meer nennt der Titel des Romans von Jules Verne?", 20000, "Meilen"], // Quelle: https://de.wikipedia.org/wiki/20.000_Meilen_unter_dem_Meer
    ["In welchem Jahr wurde Friedrich Schiller geboren?", 1759, ""], // Quelle: https://de.wikipedia.org/wiki/Friedrich_Schiller
    ["In welchem Jahr wurde Vincent van Gogh geboren?", 1853, ""], // Quelle: https://de.wikipedia.org/wiki/Vincent_van_Gogh
    ["Wie viele Zeilen hat ein klassisches Sonett?", 14, "Zeilen"], // Quelle: https://de.wikipedia.org/wiki/Sonett
    ["Wie viele Silben hat ein klassisches Haiku?", 17, "Silben"], // Quelle: https://de.wikipedia.org/wiki/Haiku
    ["In welchem Jahr begann der Bau von Schloss Neuschwanstein?", 1869, ""], // Quelle: https://de.wikipedia.org/wiki/Schloss_Neuschwanstein
    ["In welchem Jahr n. Chr. wurde das Kolosseum in Rom eingeweiht?", 80, ""], // Quelle: https://de.wikipedia.org/wiki/Kolosseum
    ["In welchem Jahr wurde Hans Christian Andersen geboren?", 1805, ""], // Quelle: https://de.wikipedia.org/wiki/Hans_Christian_Andersen
    ["Wie viele schwarze Tasten hat ein klassisches Klavier?", 36, "Tasten"], // Quelle: https://de.wikipedia.org/wiki/Klaviatur
    ["In welchem Jahr wurde Johann Sebastian Bach geboren?", 1685, ""], // Quelle: https://de.wikipedia.org/wiki/Johann_Sebastian_Bach
    ["In welchem Jahr wurde das Bauhaus gegründet?", 1919, ""], // Quelle: https://de.wikipedia.org/wiki/Bauhaus
    ["In welchem Jahr starb William Shakespeare?", 1616, ""], // Quelle: https://de.wikipedia.org/wiki/William_Shakespeare

    ["Vom kürzesten zum längsten Notenwert:", ["Achtelnote", "Viertelnote", "Halbe Note", "Ganze Note"]], // Quelle: https://de.wikipedia.org/wiki/Notenwert
    ["Vom höchsten zum tiefsten Streichinstrument:", ["Geige", "Bratsche", "Cello", "Kontrabass"]], // Quelle: https://de.wikipedia.org/wiki/Streichinstrument
    ["Gesangsstimmen von hoch nach tief:", ["Sopran", "Alt", "Tenor", "Bass"]], // Quelle: https://de.wikipedia.org/wiki/Stimmlage
    ["Nach Geburtsjahr, der Früheste zuerst:", ["Johann Sebastian Bach", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Richard Wagner"]], // Quelle: https://de.wikipedia.org/wiki/Johann_Sebastian_Bach https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart https://de.wikipedia.org/wiki/Ludwig_van_Beethoven https://de.wikipedia.org/wiki/Richard_Wagner
    ["Baustile vom ältesten zum jüngsten:", ["Romanik", "Gotik", "Renaissance", "Barock"]], // Quelle: https://de.wikipedia.org/wiki/Romanik https://de.wikipedia.org/wiki/Gotik https://de.wikipedia.org/wiki/Renaissance https://de.wikipedia.org/wiki/Barock
    ["Dichter nach Geburtsjahr, der Früheste zuerst:", ["Gotthold Ephraim Lessing", "Johann Wolfgang von Goethe", "Friedrich Schiller", "Heinrich Heine"]], // Quelle: https://de.wikipedia.org/wiki/Gotthold_Ephraim_Lessing https://de.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe https://de.wikipedia.org/wiki/Friedrich_Schiller https://de.wikipedia.org/wiki/Heinrich_Heine
    ["Maler nach Geburtsjahr, der Früheste zuerst:", ["Albrecht Dürer", "Rembrandt", "Francisco de Goya", "Vincent van Gogh"]], // Quelle: https://de.wikipedia.org/wiki/Albrecht_Dürer https://de.wikipedia.org/wiki/Rembrandt_van_Rijn https://de.wikipedia.org/wiki/Francisco_de_Goya https://de.wikipedia.org/wiki/Vincent_van_Gogh
    ["Lautstärke von leise nach laut:", ["pianissimo", "piano", "forte", "fortissimo"]], // Quelle: https://de.wikipedia.org/wiki/Dynamik_(Musik)
    ["Tempo von langsam nach schnell:", ["Largo", "Andante", "Allegro", "Presto"]], // Quelle: https://de.wikipedia.org/wiki/Tempo_(Musik)
    ["Bauwerke vom ältesten zum jüngsten:", ["Cheops-Pyramide", "Kolosseum", "Kölner Dom", "Eiffelturm"]], // Quelle: https://de.wikipedia.org/wiki/Cheops-Pyramide https://de.wikipedia.org/wiki/Kolosseum https://de.wikipedia.org/wiki/Kölner_Dom https://de.wikipedia.org/wiki/Eiffelturm
    ["Bauwerke vom niedrigsten zum höchsten:", ["Schiefer Turm von Pisa", "Cheops-Pyramide", "Kölner Dom", "Eiffelturm"]], // Quelle: https://de.wikipedia.org/wiki/Schiefer_Turm_von_Pisa https://de.wikipedia.org/wiki/Cheops-Pyramide https://de.wikipedia.org/wiki/Kölner_Dom https://de.wikipedia.org/wiki/Eiffelturm
    ["Musikgruppen von wenigen zu vielen Spielern:", ["Duo", "Trio", "Quartett", "Quintett"]], // Quelle: https://de.wikipedia.org/wiki/Kammermusik
    ["Schriftsteller nach Geburtsjahr, der Früheste zuerst:", ["Dante Alighieri", "Miguel de Cervantes", "William Shakespeare", "Johann Wolfgang von Goethe"]], // Quelle: https://de.wikipedia.org/wiki/Dante_Alighieri https://de.wikipedia.org/wiki/Miguel_de_Cervantes https://de.wikipedia.org/wiki/William_Shakespeare https://de.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe
    ["Opernkomponisten nach Geburtsjahr, der Früheste zuerst:", ["Claudio Monteverdi", "Georg Friedrich Händel", "Wolfgang Amadeus Mozart", "Giacomo Puccini"]], // Quelle: https://de.wikipedia.org/wiki/Claudio_Monteverdi https://de.wikipedia.org/wiki/Georg_Friedrich_Händel https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart https://de.wikipedia.org/wiki/Giacomo_Puccini
  ],
};
