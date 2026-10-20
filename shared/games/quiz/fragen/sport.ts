import type { FragenKategorie } from "./typen";

export const SPORT: FragenKategorie = {
  id: "sport",
  name: "Sport & Spiel",
  emoji: "⚽",
  stufe: "familie",
  fragen: [
    ["Wie viele Spieler stehen beim Volleyball je Team auf dem Feld?", "6", "5", "7", "4"], // Quelle: https://de.wikipedia.org/wiki/Volleyball
    ["Wie viele Spieler stehen beim Basketball je Team auf dem Feld?", "5", "6", "4", "7"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Wie viele Spieler hat ein Handballteam auf dem Feld, mit Torwart?", "7", "6", "8", "11"], // Quelle: https://de.wikipedia.org/wiki/Handballregeln
    ["Wie viele Spieler hat ein Eishockeyteam auf dem Eis, mit Torwart?", "6", "5", "7", "11"], // Quelle: https://de.wikipedia.org/wiki/Eishockey
    ["Wie viele Spieler hat ein Team im Rugby Union auf dem Feld?", "15", "13", "11", "12"], // Quelle: https://de.wikipedia.org/wiki/Rugby-Union-Regeln
    ["Wie viele Spieler hat ein Wasserballteam im Wasser, mit Torwart?", "7", "6", "5", "8"], // Quelle: https://de.wikipedia.org/wiki/Wasserball
    ["Wie viele Spieler stehen beim Baseball in der Abwehr auf dem Feld?", "9", "11", "8", "10"], // Quelle: https://de.wikipedia.org/wiki/Baseballregeln
    ["Wie viele Spieler hat eine Cricketmannschaft auf dem Feld?", "11", "9", "13", "15"], // Quelle: https://de.wikipedia.org/wiki/Batter_(Cricket)
    ["Wie viele Spieler hat ein Feldhockeyteam auf dem Feld, mit Torwart?", "11", "10", "9", "7"], // Quelle: https://de.wikipedia.org/wiki/Hockey https://en.wikipedia.org/wiki/Field_hockey
    ["Wie lange dauert ein Fußballspiel regulär?", "90 Minuten", "80 Minuten", "100 Minuten", "120 Minuten"], // Quelle: https://de.wikipedia.org/wiki/Fu%C3%9Fballregeln
    ["Wie lange dauert eine Halbzeit beim Handball der Erwachsenen?", "30 Minuten", "20 Minuten", "25 Minuten", "45 Minuten"], // Quelle: https://de.wikipedia.org/wiki/Handballregeln
    ["Wie lange dauert ein Drittel im Eishockey (reine Spielzeit)?", "20 Minuten", "15 Minuten", "25 Minuten", "30 Minuten"], // Quelle: https://de.wikipedia.org/wiki/Eishockey
    ["Wie viele Punkte zählt ein verwandelter Freiwurf im Basketball?", "1", "2", "3", "0"], // Quelle: https://de.wikipedia.org/wiki/Freiwurf_(Basketball)
    ["Wie viele Punkte braucht man im Volleyball für einen normalen Satz?", "25", "21", "15", "30"], // Quelle: https://de.wikipedia.org/wiki/Volleyball https://de.wikipedia.org/wiki/Sitzvolleyball
    ["Bis wie viele Punkte geht ein Satz im Badminton?", "21", "15", "25", "11"], // Quelle: https://de.wikipedia.org/wiki/Badminton
    ["Bis wie viele Punkte geht ein Satz im Tischtennis?", "11", "21", "15", "10"], // Quelle: https://de.wikipedia.org/wiki/Z%C3%A4hlweise_(Tischtennis)
    ["Wie heißt der Spielstand 40:40 im Tennis?", "Einstand", "Vorteil", "Satzball", "Unentschieden"], // Quelle: https://de.wikipedia.org/wiki/Tennis
    ["Welcher Punktestand folgt im Tennis auf 15?", "30", "20", "25", "45"], // Quelle: https://de.wikipedia.org/wiki/Tennis
    ["Wie viele Bauern hat jeder Spieler zu Beginn einer Schachpartie?", "8", "6", "10", "7"], // Quelle: https://de.wikipedia.org/wiki/Schach
    ["Wie viele Spielsteine hat jeder Spieler bei Mühle?", "9", "7", "12", "10"], // Quelle: https://de.wikipedia.org/wiki/M%C3%BChle_(Spiel)
    ["Wie viele Steine hat jeder Spieler beim Damespiel auf dem 8×8-Brett?", "12", "10", "16", "9"], // Quelle: https://de.wikipedia.org/wiki/Dame_(Spiel)
    ["Wie viele Punkte zählt beim Darts ein Treffer ins innere Bull?", "50", "25", "60", "100"], // Quelle: https://de.wikipedia.org/wiki/Darts
    ["Wie viele Pins stehen beim Bowling?", "10", "9", "12", "8"], // Quelle: https://de.wikipedia.org/wiki/Bowlingregeln
    ["Wie viele Löcher hat ein üblicher Golfplatz für eine volle Runde?", "18", "9", "12", "24"], // Quelle: https://de.wikipedia.org/wiki/Golfplatz
    ["Wie heißt beim Golf ein Ergebnis von einem Schlag unter Par?", "Birdie", "Bogey", "Eagle", "Albatros"], // Quelle: https://de.wikipedia.org/wiki/Glossar_von_Golfbegriffen
    ["Aus welchem Land stammt Judo?", "Japan", "China", "Korea", "Thailand"], // Quelle: https://de.wikipedia.org/wiki/Judo
    ["Aus welchem Land stammt Taekwondo?", "Korea", "Japan", "China", "Vietnam"], // Quelle: https://de.wikipedia.org/wiki/Taekwondo
    ["In welchem Land wurde Basketball erfunden?", "USA", "Kanada", "England", "Deutschland"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Wer erfand 1891 das Basketballspiel?", "James Naismith", "William G. Morgan", "Pierre de Coubertin", "Walter Camp"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["In welchem Land wurde Volleyball erfunden?", "USA", "Brasilien", "Italien", "Japan"], // Quelle: https://de.wikipedia.org/wiki/Volleyball
    ["In welchem Land wurden 1863 die ersten Fußballregeln festgelegt?", "England", "Schottland", "Deutschland", "Italien"], // Quelle: https://de.wikipedia.org/wiki/Geschichte_des_Fu%C3%9Fballs
    ["In welchem Land entstand Rugby?", "England", "Neuseeland", "Australien", "Frankreich"], // Quelle: https://de.wikipedia.org/wiki/Rugby_(Warwickshire)
    ["In welchem Land entstand Tischtennis?", "England", "China", "Japan", "Schweden"], // Quelle: https://de.wikipedia.org/wiki/Tischtennis
    ["Aus welchem Land stammt der Ringkampf Sumo?", "Japan", "China", "Mongolei", "Korea"], // Quelle: https://de.wikipedia.org/wiki/Sum%C5%8D
    ["Aus welchem Land stammt Hurling?", "Irland", "Schottland", "Wales", "England"], // Quelle: https://de.wikipedia.org/wiki/Hurling
    ["Aus welchem Land stammt das Kugelspiel Pétanque?", "Frankreich", "Italien", "Spanien", "Belgien"], // Quelle: https://de.wikipedia.org/wiki/Boule
    ["Wo fanden die antiken Olympischen Spiele statt?", "Olympia", "Athen", "Sparta", "Delphi"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Spiele_der_Antike
    ["In welchem Jahr fanden die ersten Olympischen Spiele der Neuzeit statt?", "1896", "1900", "1888", "1908"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Sommerspiele_1896
    ["In welcher Stadt fanden die ersten Olympischen Spiele der Neuzeit statt?", "Athen", "Paris", "London", "Rom"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Sommerspiele_1896
    ["Wer gilt als Begründer der Olympischen Spiele der Neuzeit?", "Pierre de Coubertin", "Jules Rimet", "James Naismith", "Friedrich Ludwig Jahn"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Spiele
    ["Wie viele Ringe hat das olympische Symbol?", "5", "4", "6", "7"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Ringe
    ["Alle wie viele Jahre finden Olympische Sommerspiele statt?", "4", "2", "3", "5"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Spiele
    ["Wo wird das olympische Feuer für die Sommerspiele entzündet?", "In Olympia", "In Athen", "In Rom", "In Sparta"], // Quelle: https://de.wikipedia.org/wiki/Olympischer_Fackellauf
    ["Aus welchen Sportarten besteht ein Triathlon?", "Schwimmen, Rad, Laufen", "Laufen, Rudern, Rad", "Schwimmen, Laufen, Reiten", "Rad, Laufen, Schießen"], // Quelle: https://de.wikipedia.org/wiki/Triathlon
    ["Welche Sportarten verbindet der Biathlon?", "Skilanglauf und Schießen", "Skispringen und Langlauf", "Abfahrt und Slalom", "Eisschnelllauf und Schießen"], // Quelle: https://de.wikipedia.org/wiki/Ski_Nordisch
    ["Welche Sportarten verbindet die Nordische Kombination?", "Skispringen und Langlauf", "Langlauf und Schießen", "Abfahrt und Skispringen", "Slalom und Langlauf"], // Quelle: https://de.wikipedia.org/wiki/Ski_Nordisch
    ["Welche Laufstrecke ist die letzte Disziplin im Zehnkampf?", "1500 m", "400 m", "800 m", "5000 m"], // Quelle: https://de.wikipedia.org/wiki/Zehnkampf
    ["Welche Laufstrecke ist die letzte Disziplin im Siebenkampf?", "800 m", "1500 m", "400 m", "200 m"], // Quelle: https://de.wikipedia.org/wiki/Siebenkampf
    ["Wie viele Hürden stehen in einem 110-m-Hürdenlauf?", "10", "8", "12", "11"], // Quelle: https://de.wikipedia.org/wiki/110-Meter-H%C3%BCrdenlauf
    ["Wie lang ist eine Runde auf der innersten Bahn eines Stadions?", "400 m", "300 m", "500 m", "200 m"], // Quelle: https://de.wikipedia.org/wiki/Aschenbahn
    ["Wie viele Versuche hat man beim Hochsprung je Höhe?", "3", "2", "4", "1"], // Quelle: https://de.wikipedia.org/wiki/Hochsprung
    ["Bei welcher Schwimmart startet man im Wasser statt vom Block?", "Rücken", "Brust", "Kraul", "Schmetterling"], // Quelle: https://de.wikipedia.org/wiki/Lagenschwimmen https://de.wikipedia.org/wiki/Startblock_(Schwimmsport)
    ["Wie lang ist ein olympisches Schwimmbecken?", "50 m", "25 m", "100 m", "33 m"], // Quelle: https://de.wikipedia.org/wiki/Schwimmbecken
    ["Welche Karte zeigt der Schiedsrichter beim Fußball für einen Platzverweis?", "Rot", "Gelb", "Grün", "Blau"], // Quelle: https://de.wikipedia.org/wiki/Disziplinarkarte
    ["Nach wie vielen Gelben Karten in einem Fußballspiel folgt Gelb-Rot?", "2", "3", "1", "4"], // Quelle: https://de.wikipedia.org/wiki/Disziplinarkarte
    ["Wie oft darf ein Volleyballteam den Ball höchstens berühren (ohne Block)?", "3", "2", "4", "5"], // Quelle: https://de.wikipedia.org/wiki/Volleyball
    ["Wie viele Schritte darf ein Handballspieler mit dem Ball machen?", "3", "2", "4", "5"], // Quelle: https://de.wikipedia.org/wiki/Handballregeln
    ["Wie viele Sekunden darf man im Handball den Ball höchstens halten?", "3", "5", "2", "10"], // Quelle: https://de.wikipedia.org/wiki/Handballregeln
    ["Wie viele Sekunden hat ein Basketballteam für einen Angriff?", "24", "30", "20", "35"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Nach wie vielen Fouls muss man im internationalen Basketball vom Feld?", "5", "6", "4", "3"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Wie lange dauert eine Zeitstrafe im Handball?", "2 Minuten", "5 Minuten", "1 Minute", "10 Minuten"], // Quelle: https://de.wikipedia.org/wiki/Handballregeln
    ["Wie lange dauert eine kleine Strafe im Eishockey?", "2 Minuten", "5 Minuten", "1 Minute", "10 Minuten"], // Quelle: https://de.wikipedia.org/wiki/Eishockey
    ["Woraus besteht ein Eishockeypuck?", "Hartgummi", "Holz", "Kork", "Metall"], // Quelle: https://de.wikipedia.org/wiki/Eishockey
    ["Wie lange dauert eine Runde im Profiboxen?", "3 Minuten", "2 Minuten", "5 Minuten", "4 Minuten"], // Quelle: https://de.wikipedia.org/wiki/Boxen
    ["Welche Form hat ein Boxring?", "Quadrat", "Kreis", "Achteck", "Sechseck"], // Quelle: https://de.wikipedia.org/wiki/Boxring
    ["An wie vielen Geräten turnen Männer im olympischen Mehrkampf?", "6", "4", "5", "8"], // Quelle: https://de.wikipedia.org/wiki/Ger%C3%A4tturnen
    ["An wie vielen Geräten turnen Frauen im olympischen Mehrkampf?", "4", "6", "5", "3"], // Quelle: https://de.wikipedia.org/wiki/Ger%C3%A4tturnen
    ["Welches Turngerät gibt es nur bei den Frauen?", "Schwebebalken", "Reck", "Ringe", "Seitpferd"], // Quelle: https://de.wikipedia.org/wiki/Schwebebalken
    ["Bei welcher Fechtwaffe ist der ganze Körper Trefferfläche?", "Degen", "Florett", "Säbel", "Rapier"], // Quelle: https://de.wikipedia.org/wiki/Degenfechten
    ["Wie viele Spielsteine hat jeder Spieler beim Backgammon?", "15", "12", "16", "10"], // Quelle: https://de.wikipedia.org/wiki/Kotra_(Backgammon)
    ["Wie viele Karten hat ein Skatblatt?", "32", "52", "36", "24"], // Quelle: https://de.wikipedia.org/wiki/Skat
    ["Wie viele Steine hat ein klassisches Domino bis Doppel-Sechs?", "28", "36", "21", "32"], // Quelle: https://de.wikipedia.org/wiki/Domino
    ["Welche Farbe beginnt beim Schach?", "Weiß", "Schwarz", "Wer ausgelost wird", "Der jüngere Spieler"], // Quelle: https://de.wikipedia.org/wiki/Schach
    ["Wie heißt der Schachzug, bei dem König und Turm zugleich ziehen?", "Rochade", "Gambit", "Patt", "En passant"], // Quelle: https://de.wikipedia.org/wiki/Rochade
    ["Wie heißt es im Schach, wenn man nicht im Schach steht, aber nicht ziehen kann?", "Patt", "Matt", "Gambit", "Rochade"], // Quelle: https://de.wikipedia.org/wiki/Schach
    ["Wie viele Spieler hat ein Team beim Beachvolleyball?", "2", "3", "4", "6"], // Quelle: https://de.wikipedia.org/wiki/Beachvolleyball
    ["Wie viele Spieler hat ein Team beim Curling?", "4", "3", "5", "6"], // Quelle: https://de.wikipedia.org/wiki/Curling
    ["Wie heißt der Zielkreis beim Curling?", "Haus", "Nest", "Tor", "Hof"], // Quelle: https://de.wikipedia.org/wiki/Curling
    ["Aus wie vielen Federn besteht ein Federball für Wettkämpfe?", "16", "12", "20", "10"], // Quelle: https://de.wikipedia.org/wiki/Federball
    ["Wie viele Reiter hat ein Poloteam auf dem Feld?", "4", "5", "6", "3"], // Quelle: https://de.wikipedia.org/wiki/Polo
    ["Bei welcher Sportart gibt es Wicket, Bowler und Batsman?", "Cricket", "Baseball", "Rugby", "Hockey"], // Quelle: https://de.wikipedia.org/wiki/Batter_(Cricket)
    ["Wie heißt der Werfer beim Baseball?", "Pitcher", "Catcher", "Batter", "Shortstop"], // Quelle: https://de.wikipedia.org/wiki/Pitcher
    ["Wie viele Outs beenden eine Spielhälfte im Baseball?", "3", "2", "4", "5"], // Quelle: https://de.wikipedia.org/wiki/Baseballregeln
    ["Wie viele Innings hat ein reguläres Baseballspiel?", "9", "7", "8", "10"], // Quelle: https://de.wikipedia.org/wiki/Inning_(Baseball)
    ["Wie viele Punkte zählt ein Touchdown im American Football?", "6", "7", "3", "5"], // Quelle: https://de.wikipedia.org/wiki/American_Football
    ["Welche ist die schnellste Grundgangart des Pferdes?", "Galopp", "Trab", "Schritt", "Passage"], // Quelle: https://de.wikipedia.org/wiki/Galopp
    ["Wo fanden die ersten Olympischen Winterspiele statt?", "Chamonix", "St. Moritz", "Oslo", "Innsbruck"], // Quelle: https://de.wikipedia.org/wiki/Olympische_Winterspiele
    ["Wie viele Tore erzielt ein Spieler bei einem Hattrick?", "3", "2", "4", "5"], // Quelle: https://de.wikipedia.org/wiki/Hattrick
    ["Welcher Sport findet in einem Velodrom statt?", "Bahnradsport", "Eisschnelllauf", "Leichtathletik", "Schwimmen"], // Quelle: https://de.wikipedia.org/wiki/Radrennbahn
    ["In welcher Sportart springt man einen Axel?", "Eiskunstlauf", "Turnen", "Skispringen", "Eisschnelllauf"], // Quelle: https://de.wikipedia.org/wiki/Axel_(Eiskunstlauf)
    ["Welche Kugel ist beim Snooker am meisten wert?", "Schwarz", "Pink", "Blau", "Grün"], // Quelle: https://de.wikipedia.org/wiki/Snooker
    ["Wie viele rote Kugeln liegen zu Beginn beim Snooker auf dem Tisch?", "15", "10", "21", "12"], // Quelle: https://de.wikipedia.org/wiki/Snooker

    ["Wie lang ist ein Marathon?", 42.195, "km"], // Quelle: https://de.wikipedia.org/wiki/Marathonlauf
    ["Wie hoch ist das Volleyballnetz bei den Männern?", 243, "cm"], // Quelle: https://de.wikipedia.org/wiki/Volleyball
    ["Wie lang ist eine Tischtennisplatte?", 274, "cm"], // Quelle: https://de.wikipedia.org/wiki/Tischtennis
    ["Wie hoch ist eine Tischtennisplatte?", 76, "cm"], // Quelle: https://de.wikipedia.org/wiki/Tischtennis
    ["Wie schwer ist der Speer beim Speerwurf der Männer?", 800, "g"], // Quelle: https://de.wikipedia.org/wiki/Speerwurf
    ["Wie schwer ist der Diskus beim Diskuswurf der Männer?", 2, "kg"], // Quelle: https://de.wikipedia.org/wiki/Diskuswurf
    ["Wie viele Kilometer fährt man beim olympischen Triathlon mit dem Rad?", 40, "km"], // Quelle: https://de.wikipedia.org/wiki/Triathlon_bei_den_Olympischen_Spielen
    ["Wie viele Punkte kann man beim Darts mit drei Pfeilen höchstens werfen?", 180, ""], // Quelle: https://de.wikipedia.org/wiki/Darts
    ["Wie viele Punkte hat ein höchstmögliches Break beim Snooker (ohne Fouls)?", 147, ""], // Quelle: https://de.wikipedia.org/wiki/Maximum_Break
    ["Wie viele Punkte hat ein perfektes Spiel beim Bowling?", 300, ""], // Quelle: https://de.wikipedia.org/wiki/Bowlingregeln
    ["Wie lang ist ein Basketballfeld?", 28, "m"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Wie lang ist ein Handballfeld?", 40, "m"], // Quelle: https://de.wikipedia.org/wiki/Handballregeln
    ["Wie viele Schnittpunkte hat ein großes Go-Brett?", 361, ""], // Quelle: https://de.wikipedia.org/wiki/Go_(Spiel)
    ["Wie viele Augen zeigen alle Steine eines Dominos bis Doppel-Sechs zusammen?", 168, ""], // Quelle: https://de.wikipedia.org/wiki/Domino
    ["Wie viele verschiedene erste Züge hat Weiß beim Schach?", 20, ""], // Quelle: https://en.wikipedia.org/wiki/Shannon_number
    ["Wie viele Personen sitzen in einem Ruder-Achter mit Steuermann?", 9, ""], // Quelle: https://de.wikipedia.org/wiki/Achter_(Rudern)
    ["Wie lang ist die längste Laufstrecke im Stadion bei Olympia?", 10000, "m"], // Quelle: https://de.wikipedia.org/wiki/10.000-Meter-Lauf
    ["In welchem Jahr fanden die ersten Olympischen Winterspiele statt?", 1924, ""], // Quelle: https://de.wikipedia.org/wiki/Olympische_Winterspiele
    ["In welchem Jahr nahmen erstmals Frauen an Olympischen Spielen der Neuzeit teil?", 1900, ""], // Quelle: https://de.wikipedia.org/wiki/Olympische_Sommerspiele_1900
    ["In welchem Jahr fanden der Überlieferung nach die ersten antiken Olympischen Spiele statt?", 776, "v. Chr."], // Quelle: https://de.wikipedia.org/wiki/Olympische_Spiele_der_Antike
    ["Wie viele Punkte, auf denen Steine stehen können, hat ein Mühlebrett?", 24, ""], // Quelle: https://de.wikipedia.org/wiki/M%C3%BChle_(Spiel) https://de.wikipedia.org/wiki/Spielnotation
    ["Wie lang ist der Hindernislauf in der Leichtathletik bei Olympia?", 3000, "m"], // Quelle: https://de.wikipedia.org/wiki/3000-Meter-Hindernislauf
    ["Welchen Innendurchmesser hat ein Basketballring?", 45, "cm"], // Quelle: https://de.wikipedia.org/wiki/Basketball
    ["Welchen Durchmesser hat ein Tischtennisball?", 40, "mm"], // Quelle: https://de.wikipedia.org/wiki/Tischtennisball

    ["Lagen beim Einzel-Lagenschwimmen in der richtigen Reihenfolge:", ["Schmetterling", "Rücken", "Brust", "Freistil"]], // Quelle: https://de.wikipedia.org/wiki/Lagenschwimmen
    ["Lagen bei der Lagenstaffel in der richtigen Reihenfolge:", ["Rücken", "Brust", "Schmetterling", "Freistil"]], // Quelle: https://de.wikipedia.org/wiki/Lagenschwimmen
    ["Bälle vom kleinsten zum größten:", ["Tischtennisball", "Golfball", "Tennisball", "Fußball"]], // Quelle: https://de.wikipedia.org/wiki/Tischtennisball https://de.wikipedia.org/wiki/Golfball https://de.wikipedia.org/wiki/Tennisball https://de.wikipedia.org/wiki/Fu%C3%9Fball_(Sportger%C3%A4t)
    ["Nach Spielern je Team auf dem Feld, von wenig zu viel:", ["Beachvolleyball", "Basketball", "Handball", "Fußball"]], // Quelle: https://de.wikipedia.org/wiki/Beachvolleyball https://de.wikipedia.org/wiki/Basketball https://de.wikipedia.org/wiki/Handball https://de.wikipedia.org/wiki/Fu%C3%9Fball
    ["Punkte in einem Tennisspiel in der Zählfolge:", ["15", "30", "40", "Spielgewinn"]], // Quelle: https://de.wikipedia.org/wiki/Tennis
    ["Schachfiguren nach Wert, vom geringsten zum höchsten:", ["Bauer", "Springer", "Turm", "Dame"]], // Quelle: https://de.wikipedia.org/wiki/Schach
    ["Olympische Sommerspiele, vom frühesten zum spätesten:", ["Amsterdam", "Berlin", "München", "Sydney"]], // Quelle: https://de.wikipedia.org/wiki/Olympiastadt
    ["Vom leichtesten zum schwersten:", ["Tennisball", "Speer (Männer)", "Diskus (Männer)", "Kugel (Männer)"]], // Quelle: https://de.wikipedia.org/wiki/Tennisball https://de.wikipedia.org/wiki/Speerwurf https://de.wikipedia.org/wiki/Diskuswurf https://de.wikipedia.org/wiki/Kugelsto%C3%9Fen
    ["Snookerkugeln nach Wert, vom geringsten zum höchsten:", ["Rot", "Gelb", "Pink", "Schwarz"]], // Quelle: https://de.wikipedia.org/wiki/Snooker
    ["Golfergebnisse an einem Loch, vom besten zum schlechtesten:", ["Albatros", "Eagle", "Birdie", "Bogey"]], // Quelle: https://de.wikipedia.org/wiki/Glossar_von_Golfbegriffen
    ["Olympische Winterspiele, vom frühesten zum spätesten:", ["Chamonix", "Garmisch-Partenkirchen", "Sapporo", "Albertville"]], // Quelle: https://de.wikipedia.org/wiki/Olympische_Winterspiele
    ["Spielabschnitte nach Dauer, vom kürzesten zum längsten:", ["Basketball-Viertel", "Eishockey-Drittel", "Handball-Halbzeit", "Fußball-Halbzeit"]], // Quelle: https://de.wikipedia.org/wiki/Basketball https://de.wikipedia.org/wiki/Eishockey https://de.wikipedia.org/wiki/Handballregeln https://de.wikipedia.org/wiki/Fu%C3%9Fballregeln
    ["Tore nach Breite, vom schmalsten zum breitesten:", ["Eishockeytor", "Handballtor", "Hockeytor", "Fußballtor"]], // Quelle: https://de.wikipedia.org/wiki/Eishockey https://de.wikipedia.org/wiki/Handball https://de.wikipedia.org/wiki/Hockey https://de.wikipedia.org/wiki/Fu%C3%9Fballtor
  ],
};
