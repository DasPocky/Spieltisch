/**
 * Orte für „Spion“ – selbst geschrieben, in vier Paketen. Jeder Ort hat 5–7 Rollen.
 * Die `id` bleibt stabil (steht im Spielstand), Name und Rollen dürfen sich ändern.
 */

export type Pack = "alltag" | "urlaub" | "arbeit" | "abenteuer";

export const PACKS: { id: Pack; name: string; hint: string }[] = [
  { id: "alltag", name: "Alltag", hint: "Bahnhof, Supermarkt, Zahnarzt …" },
  { id: "urlaub", name: "Urlaub", hint: "Strand, Kreuzfahrt, Skihütte …" },
  { id: "arbeit", name: "Arbeit", hint: "Baustelle, Bank, Fernsehstudio …" },
  { id: "abenteuer", name: "Abenteuer", hint: "Piratenschiff, Raumstation, Burg …" },
];

export interface Place { id: string; name: string; pack: Pack; roles: string[] }

export const PLACES: Place[] = [
  // Alltag
  { id: "bahnhof", name: "Bahnhof", pack: "alltag", roles: ["Pendlerin", "Zugbegleiter", "Kioskverkäufer", "Taubenfütterer", "Reisende mit Rollkoffer", "Bahnhofsmission", "Schüler auf dem Heimweg"] },
  { id: "supermarkt", name: "Supermarkt", pack: "alltag", roles: ["Kassiererin", "Filialleiter", "Regalauffüller", "Kunde mit Einkaufszettel", "Kind an der Quengelkasse", "Pfandautomat-Techniker"] },
  { id: "zahnarzt", name: "Zahnarztpraxis", pack: "alltag", roles: ["Zahnärztin", "Zahnarzthelfer", "Angstpatient", "Kind mit Milchzahn", "Frau am Empfang", "Vertreter für Zahnbürsten"] },
  { id: "schule", name: "Schule", pack: "alltag", roles: ["Mathelehrerin", "Hausmeister", "Schulleiter", "Klassensprecherin", "Neuer Schüler", "Referendar", "Elternvertreterin"] },
  { id: "krankenhaus", name: "Krankenhaus", pack: "alltag", roles: ["Chirurgin", "Pfleger", "Patient mit Gipsbein", "Besucherin mit Blumen", "Notärztin", "Praktikant"] },
  { id: "friseur", name: "Friseursalon", pack: "alltag", roles: ["Friseurmeisterin", "Azubi beim Haarewaschen", "Stammkundin", "Bräutigam vor der Hochzeit", "Kind auf dem Kissen", "Mann, der nur Spitzen will"] },
  { id: "restaurant", name: "Restaurant", pack: "alltag", roles: ["Kellnerin", "Koch", "Restaurantkritiker", "Pärchen beim ersten Date", "Tellerwäscher", "Geburtstagsgesellschaft"] },
  { id: "kino", name: "Kino", pack: "alltag", roles: ["Popcornverkäufer", "Filmvorführerin", "Pärchen in der letzten Reihe", "Filmkritikerin", "Kind, das Angst hat", "Zuspätkommer"] },
  { id: "fitness", name: "Fitnessstudio", pack: "alltag", roles: ["Personal Trainerin", "Bodybuilder", "Anfänger mit Neujahrsvorsatz", "Frau an der Theke", "Yogalehrer", "Rentner auf dem Laufband"] },
  { id: "bibliothek", name: "Bibliothek", pack: "alltag", roles: ["Bibliothekarin", "Student vor der Prüfung", "Rentner mit Zeitung", "Vorleserin", "Schülerin bei den Hausaufgaben", "Autor auf Recherche"] },
  { id: "hochzeit", name: "Hochzeitsfeier", pack: "alltag", roles: ["Braut", "Bräutigam", "Trauzeugin", "Fotograf", "DJ", "Oma in der ersten Reihe", "Ex-Freund ohne Einladung"] },
  { id: "wochenmarkt", name: "Wochenmarkt", pack: "alltag", roles: ["Gemüsehändlerin", "Käseverkäufer", "Marktmeister", "Kundin mit Korb", "Straßenmusiker", "Imker"] },

  // Urlaub
  { id: "kreuzfahrt", name: "Kreuzfahrtschiff", pack: "urlaub", roles: ["Kapitänin", "Animateur", "Barkeeper", "Passagier am Buffet", "Bordärztin", "Seekranker Tourist", "Sängerin der Bordshow"] },
  { id: "flugzeug", name: "Flugzeug", pack: "urlaub", roles: ["Pilotin", "Flugbegleiter", "Passagier mit Flugangst", "Baby in Reihe 12", "Geschäftsreisende", "Copilot"] },
  { id: "strand", name: "Strand", pack: "urlaub", roles: ["Rettungsschwimmerin", "Eisverkäufer", "Surfer", "Familie mit Sandburg", "Sonnenanbeterin", "Strandkorbvermieter"] },
  { id: "camping", name: "Campingplatz", pack: "urlaub", roles: ["Platzwart", "Familie im Wohnwagen", "Zeltender Student", "Dauercamperin", "Pfadfinder", "Gitarrenspieler am Lagerfeuer"] },
  { id: "skihuette", name: "Skihütte", pack: "urlaub", roles: ["Hüttenwirtin", "Skilehrer", "Snowboarderin", "Anfänger mit blauem Fleck", "Bergretter", "Après-Ski-DJ"] },
  { id: "hotel", name: "Hotel", pack: "urlaub", roles: ["Rezeptionistin", "Page", "Zimmermädchen", "Hoteldirektor", "Gast auf Hochzeitsreise", "Hoteltester"] },
  { id: "freizeitpark", name: "Freizeitpark", pack: "urlaub", roles: ["Achterbahn-Fan", "Maskottchen im Kostüm", "Losverkäufer", "Mutter mit Kinderwagen", "Technikerin", "Kind, das zu klein ist"] },
  { id: "zoo", name: "Zoo", pack: "urlaub", roles: ["Tierpflegerin", "Tierarzt", "Schulklasse", "Fotografin", "Eisverkäufer", "Besucher, der die Tiere füttert"] },
  { id: "museum", name: "Museum", pack: "urlaub", roles: ["Museumswärter", "Kuratorin", "Kunststudent", "Reiseleiterin", "Restaurator", "Gelangweiltes Kind"] },
  { id: "therme", name: "Therme", pack: "urlaub", roles: ["Bademeister", "Masseurin", "Saunameister", "Gast im Bademantel", "Rentnerin beim Aquajogging", "Kind auf der Rutsche"] },
  { id: "jugendherberge", name: "Jugendherberge", pack: "urlaub", roles: ["Herbergsvater", "Klassenlehrerin", "Rucksacktouristin", "Schüler im Stockbett", "Köchin", "Nachtwache"] },
  { id: "volksfest", name: "Volksfest", pack: "urlaub", roles: ["Schausteller", "Bedienung im Festzelt", "Blaskapelle", "Lebkuchenherzverkäuferin", "Sanitäter", "Besucher in Tracht"] },

  // Arbeit
  { id: "bank", name: "Bank", pack: "arbeit", roles: ["Bankberaterin", "Kassierer", "Filialleiterin", "Sicherheitsmann", "Kunde mit Kredit-Wunsch", "Geldtransportfahrer"] },
  { id: "polizei", name: "Polizeiwache", pack: "arbeit", roles: ["Kommissarin", "Streifenpolizist", "Verdächtiger", "Zeugin", "Anwalt", "Mann, der sein Fahrrad sucht"] },
  { id: "feuerwache", name: "Feuerwache", pack: "arbeit", roles: ["Brandmeisterin", "Feuerwehrmann", "Freiwilliger Helfer", "Leitstelle", "Schulklasse auf Besuch", "Feuerwehrhund"] },
  { id: "baustelle", name: "Baustelle", pack: "arbeit", roles: ["Polier", "Kranführerin", "Architektin", "Maurer", "Bauherr", "Neugieriger Passant"] },
  { id: "buero", name: "Großraumbüro", pack: "arbeit", roles: ["Chefin", "Praktikant", "IT-Support", "Buchhalter", "Kollegin am Kaffeeautomaten", "Putzkraft am Abend"] },
  { id: "fernsehstudio", name: "Fernsehstudio", pack: "arbeit", roles: ["Moderatorin", "Kameramann", "Studiogast", "Maskenbildnerin", "Regisseur", "Applaus-Publikum"] },
  { id: "bauernhof", name: "Bauernhof", pack: "arbeit", roles: ["Bäuerin", "Bauer", "Erntehelfer", "Tierärztin", "Hofladen-Kundin", "Traktorfahrer"] },
  { id: "baeckerei", name: "Bäckerei", pack: "arbeit", roles: ["Bäckermeister", "Verkäuferin", "Azubi um vier Uhr früh", "Stammkunde", "Konditorin", "Lieferfahrer"] },
  { id: "werkstatt", name: "Autowerkstatt", pack: "arbeit", roles: ["Mechanikerin", "Meister", "Kunde mit Panne", "Lackierer", "Azubi", "TÜV-Prüferin"] },
  { id: "paketzentrum", name: "Paketzentrum", pack: "arbeit", roles: ["Paketbotin", "Lagerarbeiter", "Staplerfahrerin", "Schichtleiter", "Kunde mit Abholschein", "Aushilfe im Weihnachtsgeschäft"] },
  { id: "rathaus", name: "Rathaus", pack: "arbeit", roles: ["Bürgermeisterin", "Standesbeamter", "Sachbearbeiterin", "Bürger mit Wartenummer", "Lokaljournalist", "Hausmeisterin"] },
  { id: "labor", name: "Forschungslabor", pack: "arbeit", roles: ["Professorin", "Doktorand", "Laborantin", "Sicherheitsbeauftragter", "Versuchsperson", "Geldgeberin auf Besuch"] },

  // Abenteuer
  { id: "piratenschiff", name: "Piratenschiff", pack: "abenteuer", roles: ["Kapitän mit Augenklappe", "Steuerfrau", "Schiffskoch", "Gefangener", "Matrose im Ausguck", "Schatzkartenleserin"] },
  { id: "raumstation", name: "Raumstation", pack: "abenteuer", roles: ["Kommandantin", "Ingenieur", "Wissenschaftlerin", "Weltraumtourist", "Bordarzt", "Funkerin"] },
  { id: "uboot", name: "U-Boot", pack: "abenteuer", roles: ["Kapitän", "Sonaroffizierin", "Maschinist", "Smutje", "Funker", "Neuer Matrose"] },
  { id: "burg", name: "Ritterburg", pack: "abenteuer", roles: ["König", "Ritterin", "Hofnarr", "Burgfräulein", "Wachposten", "Schmied", "Gefangener im Verlies"] },
  { id: "polarstation", name: "Polarstation", pack: "abenteuer", roles: ["Stationsleiterin", "Klimaforscher", "Köchin", "Hundeschlittenführer", "Meteorologin", "Pinguinzähler"] },
  { id: "dschungel", name: "Dschungelexpedition", pack: "abenteuer", roles: ["Expeditionsleiterin", "Fährtenleser", "Insektenforscherin", "Fotograf", "Träger", "Verirrter Tourist"] },
  { id: "karawane", name: "Wüstenkarawane", pack: "abenteuer", roles: ["Karawanenführer", "Kameltreiberin", "Händler", "Archäologin", "Wasserträger", "Reisender Geschichtenerzähler"] },
  { id: "geisterbahn", name: "Geisterbahn", pack: "abenteuer", roles: ["Gespenst im Laken", "Kassiererin", "Mutiger Teenager", "Ängstlicher Fahrgast", "Techniker im Dunkeln", "Vampirdarstellerin"] },
  { id: "zirkus", name: "Zirkus", pack: "abenteuer", roles: ["Zirkusdirektorin", "Clown", "Akrobat", "Dompteurin", "Messerwerfer", "Zuschauer in der ersten Reihe"] },
  { id: "casino", name: "Spielcasino", pack: "abenteuer", roles: ["Croupier", "Glücksspielerin", "Türsteher", "Barfrau", "Falschspieler", "Millionärin"] },
  { id: "leuchtturm", name: "Leuchtturm", pack: "abenteuer", roles: ["Leuchtturmwärter", "Schiffbrüchige", "Fischer", "Malerin", "Möwenforscher", "Tourist auf der Treppe"] },
  { id: "bergwerk", name: "Bergwerk", pack: "abenteuer", roles: ["Bergmann", "Steigerin", "Sprengmeister", "Geologin", "Grubenpferd-Pfleger", "Besuchergruppe mit Helm"] },
];

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const placeName = (id: string | null | undefined) => (id ? PLACE_BY_ID[id]?.name ?? "?" : "?");
