import type { FragenKategorie } from "./typen";

export const ESSEN: FragenKategorie = {
  id: "essen",
  name: "Essen & Trinken",
  emoji: "🍝",
  stufe: "familie",
  fragen: [
    // Auswahl
    ["Aus welchem Land stammt die Pizza?", "Italien", "Griechenland", "Spanien", "Frankreich"], // Quelle: https://de.wikipedia.org/wiki/Pizza
    ["Welche Frucht ist die Hauptzutat von Guacamole?", "Avocado", "Erbsen", "Gurke", "Kiwi"], // Quelle: https://de.wikipedia.org/wiki/Guacamole
    ["Was ist die Hauptzutat von Hummus?", "Kichererbsen", "Linsen", "Weiße Bohnen", "Erbsen"], // Quelle: https://de.wikipedia.org/wiki/Hummus
    ["Aus welchem Land stammt Sushi?", "Japan", "China", "Korea", "Thailand"], // Quelle: https://de.wikipedia.org/wiki/Sushi
    ["Welches Gewürz gilt als das teuerste der Welt?", "Safran", "Zimt", "Kardamom", "Muskat"], // Quelle: https://de.wikipedia.org/wiki/Safran
    ["Aus welchem Teil der Pflanze wird Zimt gewonnen?", "Rinde", "Wurzel", "Blüte", "Samen"], // Quelle: https://de.wikipedia.org/wiki/Zimt
    ["Woraus wird Marzipan hauptsächlich gemacht?", "Mandeln und Zucker", "Haselnüsse und Zucker", "Erdnüsse und Honig", "Walnüsse und Sahne"], // Quelle: https://de.wikipedia.org/wiki/Marzipan
    ["Welches Kraut ist die Hauptzutat im klassischen Pesto?", "Basilikum", "Petersilie", "Koriander", "Dill"], // Quelle: https://de.wikipedia.org/wiki/Pesto
    ["Welche Kerne gehören ins klassische Pesto alla genovese?", "Pinienkerne", "Kürbiskerne", "Sonnenblumenkerne", "Cashewkerne"], // Quelle: https://de.wikipedia.org/wiki/Pesto https://de.wikipedia.org/wiki/Ligurische_Küche
    ["Aus welchem Kohl wird Sauerkraut gemacht?", "Weißkohl", "Rotkohl", "Grünkohl", "Rosenkohl"], // Quelle: https://de.wikipedia.org/wiki/Sauerkraut
    ["Aus welcher Stadt stammt die Weißwurst?", "München", "Nürnberg", "Augsburg", "Regensburg"], // Quelle: https://de.wikipedia.org/wiki/Weißwurst
    ["Aus welcher Milch wird Feta traditionell hergestellt?", "Schafmilch", "Kuhmilch", "Büffelmilch", "Stutenmilch"], // Quelle: https://de.wikipedia.org/wiki/Feta
    ["Aus welcher spanischen Region stammt die Paella?", "Valencia", "Katalonien", "Galicien", "Asturien"], // Quelle: https://de.wikipedia.org/wiki/Paella
    ["Was ist Gazpacho?", "Kalte Gemüsesuppe", "Fleischeintopf", "Gebratener Reis", "Süße Nachspeise"], // Quelle: https://de.wikipedia.org/wiki/Gazpacho
    ["Aus welchem Land stammt das Gulasch?", "Ungarn", "Polen", "Rumänien", "Kroatien"], // Quelle: https://de.wikipedia.org/wiki/Gulasch
    ["Woraus wird Popcorn gemacht?", "Mais", "Weizen", "Reis", "Hirse"], // Quelle: https://de.wikipedia.org/wiki/Popcorn
    ["Welche Zutat färbt die Suppe Borschtsch rot?", "Rote Bete", "Tomaten", "Paprika", "Rotkohl"], // Quelle: https://de.wikipedia.org/wiki/Borschtsch
    ["Von welchem Fisch stammt echter Kaviar?", "Stör", "Lachs", "Forelle", "Hering"], // Quelle: https://de.wikipedia.org/wiki/Kaviar
    ["Woraus wird Butter hergestellt?", "Sahne", "Molke", "Quark", "Joghurt"], // Quelle: https://de.wikipedia.org/wiki/Butter
    ["Welche Frucht trägt ihre Nüsschen außen?", "Erdbeere", "Himbeere", "Kiwi", "Feige"], // Quelle: https://de.wikipedia.org/wiki/Erdbeeren
    ["Woraus wird Schokolade hergestellt?", "Kakaobohnen", "Kaffeebohnen", "Erdnüssen", "Vanilleschoten"], // Quelle: https://de.wikipedia.org/wiki/Schokolade
    ["Welches Gewürz macht Currypulver gelb?", "Kurkuma", "Paprika", "Pfeffer", "Ingwer"], // Quelle: https://de.wikipedia.org/wiki/Currypulver
    ["Was ist Wasabi?", "Japanischer Meerrettich", "Eingelegter Ingwer", "Getrockneter Seetang", "Sojabohnenpaste"], // Quelle: https://de.wikipedia.org/wiki/Wasabi
    ["Welches Gas lässt Hefeteig aufgehen?", "Kohlendioxid", "Sauerstoff", "Stickstoff", "Wasserstoff"], // Quelle: https://de.wikipedia.org/wiki/Backhefe
    ["Welches Vitamin steckt reichlich in Zitrusfrüchten?", "Vitamin C", "Vitamin D", "Vitamin B12", "Vitamin K"], // Quelle: https://de.wikipedia.org/wiki/Vitamin_C
    ["Welcher Zucker steckt in Milch?", "Laktose", "Fruktose", "Saccharose", "Maltose"], // Quelle: https://de.wikipedia.org/wiki/Lactose
    ["Welcher Zucker heißt auch Fruchtzucker?", "Fruktose", "Glukose", "Laktose", "Maltose"], // Quelle: https://de.wikipedia.org/wiki/Fructose
    ["Wie heißt gewöhnlicher Haushaltszucker chemisch?", "Saccharose", "Glukose", "Laktose", "Maltose"], // Quelle: https://de.wikipedia.org/wiki/Saccharose
    ["Aus welcher Pflanze wird in Europa vor allem Zucker gewonnen?", "Zuckerrübe", "Zuckerrohr", "Mais", "Ahorn"], // Quelle: https://de.wikipedia.org/wiki/Zucker
    ["Wie heißt das Klebereiweiß im Weizen?", "Gluten", "Kasein", "Pektin", "Laktose"], // Quelle: https://de.wikipedia.org/wiki/Gluten
    ["Welcher Stoff aus Früchten lässt Marmelade gelieren?", "Pektin", "Gluten", "Koffein", "Kasein"], // Quelle: https://de.wikipedia.org/wiki/Pektine
    ["Welcher anregende Stoff steckt in Kaffee?", "Koffein", "Melatonin", "Insulin", "Chlorophyll"], // Quelle: https://de.wikipedia.org/wiki/Coffein
    ["Wo liegt die Urheimat des Arabica-Kaffees?", "Äthiopien", "Brasilien", "Kolumbien", "Indien"], // Quelle: https://de.wikipedia.org/wiki/Arabica-Kaffee
    ["Welches Land erntet seit Langem am meisten Kaffee?", "Brasilien", "Vietnam", "Kolumbien", "Äthiopien"], // Quelle: https://de.wikipedia.org/wiki/Kaffeebohne
    ["Was ist Matcha?", "Gemahlener Grüntee", "Reiswein", "Sojasoße", "Bohnenpaste"], // Quelle: https://de.wikipedia.org/wiki/Matcha
    ["Welches Kaffeegetränk ist nach einem Mönchsorden benannt?", "Cappuccino", "Latte macchiato", "Espresso", "Mokka"], // Quelle: https://de.wikipedia.org/wiki/Kapuziner_(Kaffee)
    ["Womit wird Apfelsaft für eine Apfelschorle gemischt?", "Mineralwasser", "Milch", "Tee", "Sirup"], // Quelle: https://de.wikipedia.org/wiki/Apfelschorle
    ["Aus welchem Obst wird Cidre gemacht?", "Äpfeln", "Birnen", "Pflaumen", "Kirschen"], // Quelle: https://de.wikipedia.org/wiki/Cidre
    ["Welches Getreide nennt das bayerische Reinheitsgebot von 1516?", "Gerste", "Weizen", "Roggen", "Hafer"], // Quelle: https://de.wikipedia.org/wiki/Reinheitsgebot https://de.wikipedia.org/wiki/Geschichte_des_Bieres
    ["Welche Zutat macht Bier bitter?", "Hopfen", "Malz", "Hefe", "Wasser"], // Quelle: https://de.wikipedia.org/wiki/Hopfen
    ["Wie heißt die Kartoffel in Österreich auch?", "Erdapfel", "Feldrübe", "Bodenbirne", "Knollfrucht"], // Quelle: https://de.wikipedia.org/wiki/Kartoffel
    ["Was sind in Österreich „Paradeiser“?", "Tomaten", "Paprika", "Pflaumen", "Kartoffeln"], // Quelle: https://de.wikipedia.org/wiki/Tomate
    ["Welche Frucht heißt in Österreich „Marille“?", "Aprikose", "Pflaume", "Pfirsich", "Kirsche"], // Quelle: https://de.wikipedia.org/wiki/Aprikose
    ["Was ist in Österreich „Schlagobers“?", "Schlagsahne", "Quark", "Buttermilch", "Pudding"], // Quelle: https://de.wikipedia.org/wiki/Schlagsahne
    ["Was ist in Österreich „Topfen“?", "Quark", "Butter", "Joghurt", "Sahne"], // Quelle: https://de.wikipedia.org/wiki/Quark_(Milchprodukt)
    ["Wie heißt ein „Berliner“ in Berlin selbst?", "Pfannkuchen", "Krapfen", "Kreppel", "Schmalzkuchen"], // Quelle: https://de.wikipedia.org/wiki/Berliner_Pfannkuchen
    ["Aus welchem Fleisch ist ein echtes Wiener Schnitzel?", "Kalbfleisch", "Schweinefleisch", "Putenfleisch", "Lammfleisch"], // Quelle: https://de.wikipedia.org/wiki/Wiener_Schnitzel
    ["Aus welchem Land stammt Kimchi?", "Korea", "Japan", "China", "Vietnam"], // Quelle: https://de.wikipedia.org/wiki/Kimchi
    ["Aus welchem Land stammen Tacos?", "Mexiko", "Spanien", "Peru", "Argentinien"], // Quelle: https://de.wikipedia.org/wiki/Taco
    ["Aus welchem Land stammt der Gouda?", "Niederlande", "Belgien", "Dänemark", "Schweiz"], // Quelle: https://de.wikipedia.org/wiki/Gouda_(Käse)
    ["Aus welchem Land stammt der Camembert?", "Frankreich", "Belgien", "Schweiz", "Italien"], // Quelle: https://de.wikipedia.org/wiki/Camembert
    ["Welcher Käse ist für seine großen Löcher bekannt?", "Emmentaler", "Parmesan", "Feta", "Brie"], // Quelle: https://de.wikipedia.org/wiki/Emmentaler
    ["Welcher Käse gehört in ein klassisches Tiramisu?", "Mascarpone", "Ricotta", "Mozzarella", "Parmesan"], // Quelle: https://de.wikipedia.org/wiki/Tiramisu
    ["Welches Gebäck tränkt man fürs Tiramisu in Kaffee?", "Löffelbiskuits", "Waffeln", "Zwieback", "Blätterteig"], // Quelle: https://de.wikipedia.org/wiki/Tiramisu
    ["Welche Nudeln sind schräg geschnittene Röhren?", "Penne", "Farfalle", "Fusilli", "Tagliatelle"], // Quelle: https://de.wikipedia.org/wiki/Penne
    ["Welche Nudeln sehen aus wie Schmetterlinge?", "Farfalle", "Penne", "Fusilli", "Rigatoni"], // Quelle: https://de.wikipedia.org/wiki/Farfalle
    ["Was bedeutet „al dente“?", "Bissfest", "Weich gekocht", "Roh", "Überbacken"], // Quelle: https://de.wikipedia.org/wiki/Al_dente
    ["Woraus wird Polenta gemacht?", "Maisgrieß", "Weizengrieß", "Reismehl", "Kartoffeln"], // Quelle: https://de.wikipedia.org/wiki/Polenta
    ["Woraus wird Couscous meist gemacht?", "Hartweizengrieß", "Reis", "Mais", "Kartoffeln"], // Quelle: https://de.wikipedia.org/wiki/Couscous
    ["Zu welcher Pflanzenfamilie gehört die Erdnuss?", "Hülsenfrüchtler", "Gräser", "Kürbisgewächse", "Rosengewächse"], // Quelle: https://de.wikipedia.org/wiki/Erdnuss
    ["Zu welcher Pflanzenfamilie gehört der Apfel?", "Rosengewächse", "Nachtschattengewächse", "Kreuzblütler", "Doldenblütler"], // Quelle: https://de.wikipedia.org/wiki/Kulturapfel
    ["Zu welcher Pflanzenfamilie gehört die Tomate?", "Nachtschattengewächse", "Rosengewächse", "Kürbisgewächse", "Kreuzblütler"], // Quelle: https://de.wikipedia.org/wiki/Tomate
    ["Welche dieser Früchte ist botanisch eine Beere?", "Banane", "Erdbeere", "Himbeere", "Kirsche"], // Quelle: https://de.wikipedia.org/wiki/Banane
    ["Welches Obst ist eine Steinfrucht?", "Pfirsich", "Apfel", "Erdbeere", "Weintraube"], // Quelle: https://de.wikipedia.org/wiki/Steinfrucht
    ["Welches Gemüse gehört zu den Kreuzblütlern?", "Brokkoli", "Karotte", "Tomate", "Gurke"], // Quelle: https://de.wikipedia.org/wiki/Brokkoli
    ["Woraus wird Ketchup hauptsächlich gemacht?", "Tomaten", "Paprika", "Karotten", "Kürbis"], // Quelle: https://de.wikipedia.org/wiki/Ketchup
    ["Was kommt neben Öl in eine klassische Mayonnaise?", "Eigelb", "Eiweiß", "Sahne", "Milch"], // Quelle: https://de.wikipedia.org/wiki/Mayonnaise
    ["Welche Soße wird aus Butter, Eigelb und Zitrone gemacht?", "Hollandaise", "Béchamel", "Bolognese", "Vinaigrette"], // Quelle: https://de.wikipedia.org/wiki/Sauce_hollandaise
    ["Welches Gebäck hat die Form eines verschlungenen Knotens?", "Brezel", "Croissant", "Berliner", "Muffin"], // Quelle: https://de.wikipedia.org/wiki/Brezel
    ["Welche Stadt ist für ihren Christstollen berühmt?", "Dresden", "Nürnberg", "Lübeck", "Aachen"], // Quelle: https://de.wikipedia.org/wiki/Dresdner_Christstollen
    ["Welche Stadt ist für ihre Lebkuchen berühmt?", "Nürnberg", "Dresden", "Lübeck", "Bremen"], // Quelle: https://de.wikipedia.org/wiki/Nürnberger_Lebkuchen
    ["Welche Stadt ist für ihr Marzipan berühmt?", "Lübeck", "Dresden", "Nürnberg", "Aachen"], // Quelle: https://de.wikipedia.org/wiki/Lübecker_Marzipan
    ["Aus welcher Region stammen Spätzle?", "Schwaben", "Friesland", "Pommern", "Sachsen"], // Quelle: https://de.wikipedia.org/wiki/Spätzle
    ["Was sind Maultaschen?", "Gefüllte Teigtaschen", "Kartoffelklöße", "Eierkuchen", "Ein Roggenbrot"], // Quelle: https://de.wikipedia.org/wiki/Maultasche
    ["Was ist ein „Strammer Max“?", "Brot mit Schinken und Spiegelei", "Schweinshaxe mit Kraut", "Kartoffelsalat mit Wurst", "Pfannkuchen mit Speck"], // Quelle: https://de.wikipedia.org/wiki/Strammer_Max
    ["Wie heißt ein in saurer Beize eingelegter Rinderbraten?", "Sauerbraten", "Roulade", "Gulasch", "Tafelspitz"], // Quelle: https://de.wikipedia.org/wiki/Sauerbraten
    ["Was ist die Grundzutat von Risotto?", "Reis", "Nudeln", "Kartoffeln", "Grieß"], // Quelle: https://de.wikipedia.org/wiki/Risotto
    ["Welche Reissorte nimmt man klassisch für Risotto?", "Arborio", "Basmati", "Jasmin", "Langkornreis"], // Quelle: https://de.wikipedia.org/wiki/Arborio_(Reis)
    ["Aus welchem Getreide wird Pumpernickel gebacken?", "Roggen", "Weizen", "Dinkel", "Hafer"], // Quelle: https://de.wikipedia.org/wiki/Pumpernickel
    ["Welches Pseudogetreide stammt aus den Anden?", "Quinoa", "Buchweizen", "Dinkel", "Hirse"], // Quelle: https://de.wikipedia.org/wiki/Quinoa
    ["Welches Gewürz stammt von einer Orchidee?", "Vanille", "Zimt", "Nelke", "Muskat"], // Quelle: https://de.wikipedia.org/wiki/Vanille
    ["Was sind Gewürznelken?", "Getrocknete Blütenknospen", "Getrocknete Samen", "Getrocknete Rinde", "Getrocknete Wurzeln"], // Quelle: https://de.wikipedia.org/wiki/Gewürznelke
    ["Welcher Stoff macht Chilis scharf?", "Capsaicin", "Piperin", "Koffein", "Menthol"], // Quelle: https://de.wikipedia.org/wiki/Capsaicin
    ["Welcher Stoff macht Pfeffer scharf?", "Piperin", "Capsaicin", "Koffein", "Menthol"], // Quelle: https://de.wikipedia.org/wiki/Piperin
    ["Mit welcher Skala misst man die Schärfe von Chilis?", "Scoville", "Richter", "Beaufort", "Kelvin"], // Quelle: https://de.wikipedia.org/wiki/Scoville-Skala
    ["Woraus wird Tahin hergestellt?", "Sesam", "Mohn", "Leinsamen", "Sonnenblumenkernen"], // Quelle: https://de.wikipedia.org/wiki/Tahin
    ["Von welcher Insel stammt der Halloumi?", "Zypern", "Kreta", "Sizilien", "Mallorca"], // Quelle: https://de.wikipedia.org/wiki/Halloumi
    ["Welcher Fisch wird für Matjes verwendet?", "Hering", "Makrele", "Sardine", "Lachs"], // Quelle: https://de.wikipedia.org/wiki/Matjes
    ["Welche Farbe hat ein gekochter Hummer?", "Rot", "Blau", "Grün", "Schwarz"], // Quelle: https://de.wikipedia.org/wiki/Hummer
    ["Ceviche ist das Nationalgericht welchen Landes?", "Peru", "Mexiko", "Chile", "Kuba"], // Quelle: https://de.wikipedia.org/wiki/Ceviche
    ["Aus welchem Land stammt die Nudelsuppe Pho?", "Vietnam", "Thailand", "Japan", "Korea"], // Quelle: https://de.wikipedia.org/wiki/Phở
    ["Welches Land ist die Heimat von Haggis?", "Schottland", "Irland", "Wales", "Norwegen"], // Quelle: https://de.wikipedia.org/wiki/Haggis
    ["Wie heißen dicke japanische Weizennudeln?", "Udon", "Soba", "Glasnudeln", "Reisnudeln"], // Quelle: https://de.wikipedia.org/wiki/Udon
    ["Woraus werden Soba-Nudeln traditionell gemacht?", "Buchweizen", "Reis", "Mais", "Kartoffeln"], // Quelle: https://de.wikipedia.org/wiki/Soba_(Teigware)
    ["Welches dieser Vitamine ist fettlöslich?", "Vitamin A", "Vitamin C", "Vitamin B1", "Vitamin B12"], // Quelle: https://de.wikipedia.org/wiki/Vitamin_A
    ["Wofür ist Milch als Quelle besonders bekannt?", "Calcium", "Eisen", "Vitamin C", "Ballaststoffe"], // Quelle: https://de.wikipedia.org/wiki/Milch
    ["Welcher Mangel löste bei Seefahrern Skorbut aus?", "Vitamin C", "Vitamin A", "Eisen", "Jod"], // Quelle: https://de.wikipedia.org/wiki/Skorbut
    ["Welches Spurenelement wird Speisesalz oft zugesetzt?", "Jod", "Eisen", "Zink", "Magnesium"], // Quelle: https://de.wikipedia.org/wiki/Jodsalz
    ["Wie heißt Speisesalz chemisch?", "Natriumchlorid", "Kaliumchlorid", "Calciumcarbonat", "Natriumnitrat"], // Quelle: https://de.wikipedia.org/wiki/Natriumchlorid
    ["Wie heißt die Bräunungsreaktion beim Braten und Backen?", "Maillard-Reaktion", "Photosynthese", "Fermentation", "Oxidationsstopp"], // Quelle: https://de.wikipedia.org/wiki/Maillard-Reaktion
    ["Wie nennt man kurzes Überbrühen von Gemüse?", "Blanchieren", "Flambieren", "Gratinieren", "Glasieren"], // Quelle: https://de.wikipedia.org/wiki/Blanchieren
    ["Was bedeutet „gratinieren“?", "Mit Kruste überbacken", "Mit Alkohol abbrennen", "Fein pürieren", "Kurz überbrühen"], // Quelle: https://de.wikipedia.org/wiki/Gratinieren
    ["Wie heißt eine Fachkraft für Wein im Restaurant?", "Sommelier", "Konditor", "Barista", "Maître Saucier"], // Quelle: https://de.wikipedia.org/wiki/Sommelier
    ["Wie heißt ein Handwerker für Torten und Feingebäck?", "Konditor", "Metzger", "Sommelier", "Brauer"], // Quelle: https://de.wikipedia.org/wiki/Konditor
    ["Welche Frucht enthält das eiweißspaltende Enzym Bromelain?", "Ananas", "Banane", "Apfel", "Birne"], // Quelle: https://de.wikipedia.org/wiki/Bromelain
    ["Wo liegt die Urheimat der Kiwi?", "China", "Neuseeland", "Australien", "Chile"], // Quelle: https://de.wikipedia.org/wiki/Kiwifrucht
    ["Welche Frucht wird auch Butterfrucht genannt?", "Avocado", "Mango", "Papaya", "Banane"], // Quelle: https://de.wikipedia.org/wiki/Avocado
    ["Welche Frucht wächst an Palmen?", "Dattel", "Feige", "Pflaume", "Aprikose"], // Quelle: https://de.wikipedia.org/wiki/Dattelpalme
    ["Wie heißt die Frucht der Rose?", "Hagebutte", "Holunder", "Schlehe", "Vogelbeere"], // Quelle: https://de.wikipedia.org/wiki/Hagebutte
    ["Aus welchem Land kommt der meiste Ahornsirup?", "Kanada", "USA", "Schweden", "Norwegen"], // Quelle: https://de.wikipedia.org/wiki/Ahornsirup
    ["Woraus machen Bienen Honig?", "Nektar", "Blütenblättern", "Harz", "Wachs"], // Quelle: https://de.wikipedia.org/wiki/Honig
    ["Welcher Edelpilz wächst unter der Erde?", "Trüffel", "Morchel", "Pfifferling", "Steinpilz"], // Quelle: https://de.wikipedia.org/wiki/Trüffel
    ["Welche Tiere setzt man zur Trüffelsuche ein?", "Hunde und Schweine", "Katzen und Ziegen", "Pferde und Esel", "Hühner und Gänse"], // Quelle: https://de.wikipedia.org/wiki/Trüffel
    ["Wie heißt vergorener Honigwein?", "Met", "Most", "Grog", "Sekt"], // Quelle: https://de.wikipedia.org/wiki/Met
    ["Wie heißt heißer, gewürzter Rotwein im Winter?", "Glühwein", "Bowle", "Sangria", "Schorle"], // Quelle: https://de.wikipedia.org/wiki/Glühwein
    ["Wie heißt japanischer Reiswein?", "Sake", "Soju", "Sherry", "Grappa"], // Quelle: https://de.wikipedia.org/wiki/Sake
    ["Zu welcher Pflanzengattung gehört der Teestrauch?", "Kamelien", "Rosen", "Lorbeer", "Myrten"], // Quelle: https://de.wikipedia.org/wiki/Teestrauch
    ["Aus welchem Land stammt Rooibostee?", "Südafrika", "Indien", "China", "Kenia"], // Quelle: https://de.wikipedia.org/wiki/Rooibos
    ["Welcher Tee wird mit Bergamotteöl aromatisiert?", "Earl Grey", "Darjeeling", "Assam", "Matcha"], // Quelle: https://de.wikipedia.org/wiki/Earl_Grey
    ["Auf welchem Kontinent ist Mate-Tee zu Hause?", "Südamerika", "Afrika", "Asien", "Australien"], // Quelle: https://de.wikipedia.org/wiki/Mate-Tee

    // Schätzen
    ["In welchem Jahr wurde das bayerische Reinheitsgebot erlassen?", 1516, ""], // Quelle: https://de.wikipedia.org/wiki/Reinheitsgebot
    ["Bei wie viel Grad siedet Wasser auf Meereshöhe?", 100, "°C"], // Quelle: https://de.wikipedia.org/wiki/Siedepunkt
    ["Wie viele Kilokalorien liefert ein Gramm Fett?", 9, "kcal"], // Quelle: https://de.wikipedia.org/wiki/Physiologischer_Brennwert
    ["Wie viele Kilokalorien liefert ein Gramm Eiweiß?", 4, "kcal"], // Quelle: https://de.wikipedia.org/wiki/Physiologischer_Brennwert
    ["Wie viele Kilokalorien liefert ein Gramm Alkohol?", 7, "kcal"], // Quelle: https://de.wikipedia.org/wiki/Physiologischer_Brennwert
    ["Wie viele Kilokalorien liefert ein Gramm Kohlenhydrate?", 4, "kcal"], // Quelle: https://de.wikipedia.org/wiki/Physiologischer_Brennwert
    ["Wie viel Prozent Wasser enthält eine Gurke etwa?", 96, "%"], // Quelle: https://de.wikipedia.org/wiki/Gurke
    ["Wie viel Prozent Fett hat Vollmilch in Deutschland mindestens?", 3.5, "%"], // Quelle: https://de.wikipedia.org/wiki/Milch
    ["Wie viel Prozent Fett hat fettarme Milch mindestens?", 1.5, "%"], // Quelle: https://de.wikipedia.org/wiki/Milch
    ["Wie viel Prozent Fett hat Schlagsahne in Deutschland mindestens?", 30, "%"], // Quelle: https://de.wikipedia.org/wiki/Schlagsahne
    ["Wie viel Volumenprozent Alkohol hat eine Spirituose in der EU mindestens?", 15, "%"], // Quelle: https://de.wikipedia.org/wiki/Spirituose
    ["Wie viel Prozent Alkohol darf alkoholfreies Bier in Deutschland höchstens haben?", 0.5, "%"], // Quelle: https://de.wikipedia.org/wiki/Alkoholfrei
    ["Ab wie viel Gramm gilt ein Hühnerei als Größe L?", 63, "g"], // Quelle: https://de.wikipedia.org/wiki/Eierkennzeichnung
    ["In welchem Jahr wurde der Kaffeefilter aus Papier erfunden?", 1908, ""], // Quelle: https://de.wikipedia.org/wiki/Kaffeefilter
    ["Bei wie viel Grad siedet Wasser auf dem Gipfel des Mount Everest etwa?", 70, "°C"], // Quelle: https://de.wikipedia.org/wiki/Mount_Everest https://de.wikipedia.org/wiki/Siedepunkt
    ["Wie viele Monate muss Parmigiano Reggiano mindestens reifen?", 12, "Monate"], // Quelle: https://de.wikipedia.org/wiki/Parmigiano_Reggiano
    ["Wie viele Milliliter hat ein klassischer Espresso etwa?", 25, "ml"], // Quelle: https://de.wikipedia.org/wiki/Espresso
    ["Wie viel Gramm Kaffeepulver nimmt man klassisch für einen Espresso?", 7, "g"], // Quelle: https://de.wikipedia.org/wiki/Espresso
    ["Wie viel Gramm Salz am Tag empfiehlt die DGE höchstens?", 6, "g"], // Quelle: https://www.dge.de/fileadmin/dok/wissenschaft/stellungnahmen/EU03_2016_M146-M154.pdf
    ["Wie viele Portionen Obst und Gemüse am Tag werden empfohlen?", 5, "Portionen"], // Quelle: https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-empfehlungen/
    ["Wie viele Liter sollte ein Erwachsener laut DGE täglich trinken?", 1.5, "Liter"], // Quelle: https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-empfehlungen/
    ["In welchem Jahr fand das erste Münchner Oktoberfest statt?", 1810, ""], // Quelle: https://de.wikipedia.org/wiki/Oktoberfest
    ["Wie viele Liter fasst eine Maß Bier?", 1, "Liter"], // Quelle: https://de.wikipedia.org/wiki/Maßkrug
    ["Auf wie viel Grad wird Milch beim Pasteurisieren kurz erhitzt?", 72, "°C"], // Quelle: https://de.wikipedia.org/wiki/Pasteurisierung
    ["Auf wie viel Grad wird H-Milch mindestens erhitzt?", 135, "°C"], // Quelle: https://de.wikipedia.org/wiki/Ultrahocherhitzung
    ["Wie kalt muss Tiefkühlkost höchstens gelagert werden?", -18, "°C"], // Quelle: https://de.wikipedia.org/wiki/Tiefkühlkost
    ["Bis wie viel Uhr isst man traditionell Weißwürste?", 12, "Uhr"], // Quelle: https://de.wikipedia.org/wiki/Weißwurst
    ["Wie viel Gramm hat ein Pfund?", 500, "g"], // Quelle: https://de.wikipedia.org/wiki/Zentner
    ["Wie viele Liter fasst ein klassisches Barrique-Fass aus Bordeaux?", 225, "Liter"], // Quelle: https://de.wikipedia.org/wiki/Barrique
    ["Wie viele Liter fasst eine Magnumflasche?", 1.5, "Liter"], // Quelle: https://de.wikipedia.org/wiki/Weinflasche
    ["In welchem Jahrhundert kam die Kartoffel nach Europa?", 16, "Jahrhundert"], // Quelle: https://de.wikipedia.org/wiki/Kulturgeschichte_der_Kartoffel
    ["In welchem Jahr erließ Friedrich der Große den bekanntesten „Kartoffelbefehl“?", 1756, ""], // Quelle: https://de.wikipedia.org/wiki/Kartoffelbefehl

    // Ordnen
    ["Ordne die Eiergrößen von klein nach groß.", ["S", "M", "L", "XL"]], // Quelle: https://de.wikipedia.org/wiki/Eierkennzeichnung
    ["Ordne die Flaschen nach Inhalt, von klein nach groß.", ["Piccolo", "Normalflasche", "Magnum", "Doppelmagnum"]], // Quelle: https://de.wikipedia.org/wiki/Weinflasche
    ["Ordne nach Kilokalorien pro Gramm, von wenig nach viel.", ["Wasser", "Eiweiß", "Alkohol", "Fett"]], // Quelle: https://de.wikipedia.org/wiki/Physiologischer_Brennwert
    ["Ordne die Garstufen eines Steaks von roh bis durch.", ["Rare", "Medium rare", "Medium", "Well done"]], // Quelle: https://de.wikipedia.org/wiki/Garen https://de.wikipedia.org/wiki/Steak
    ["Ordne nach Schärfe, von mild bis extrem scharf.", ["Gemüsepaprika", "Jalapeño", "Habanero", "Bhut Jolokia"]], // Quelle: https://de.wikipedia.org/wiki/Scoville-Skala https://de.wikipedia.org/wiki/Bhut_Jolokia
    ["Ordne die Schritte beim Bierbrauen vom ersten zum letzten.", ["Mälzen", "Maischen", "Würze kochen", "Gären"]], // Quelle: https://de.wikipedia.org/wiki/Bierbrauen https://de.wikipedia.org/wiki/Maischen
    ["Ordne die Küchenmaße vom kleinsten zum größten Volumen.", ["Teelöffel", "Esslöffel", "Tasse", "Liter"]], // Quelle: https://de.wikipedia.org/wiki/Küchenmaße
    ["Ordne die Gewichtsmaße vom leichtesten zum schwersten.", ["Gramm", "Pfund", "Kilogramm", "Zentner"]], // Quelle: https://de.wikipedia.org/wiki/Zentner
    ["Ordne die Kaffeegetränke nach Milchanteil, von wenig nach viel.", ["Espresso", "Espresso macchiato", "Cappuccino", "Latte macchiato"]], // Quelle: https://de.wikipedia.org/wiki/Liste_von_Kaffeespezialitäten https://de.wikipedia.org/wiki/Espresso
    ["Ordne die Weinprädikate nach Mostgewicht, von niedrig nach hoch.", ["Kabinett", "Spätlese", "Auslese", "Beerenauslese"]], // Quelle: https://de.wikipedia.org/wiki/Prädikatswein
    ["Ordne die Sekt-Bezeichnungen von herb nach süß.", ["Brut", "Extra trocken", "Trocken", "Halbtrocken"]], // Quelle: https://de.wikipedia.org/wiki/Geschmacksangabe_(Wein)
    ["Ordne die Kaffeemahlgrade von fein nach grob.", ["Türkischer Mokka", "Espresso", "Filterkaffee", "Stempelkanne"]], // Quelle: https://de.wikipedia.org/wiki/Kaffeepulver https://de.wikipedia.org/wiki/Espresso https://de.wikipedia.org/wiki/Pressstempelkanne
  ],
};
