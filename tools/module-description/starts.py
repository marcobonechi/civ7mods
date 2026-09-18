# -*- coding: utf-8 -*-
# Every true start the description lists, in the order it lists them, and why each one is
# where it is. build.py checks this table against GEO.tsl in europe-large-geo.js before it
# writes anything: every civilization of every age must appear exactly once, and the city
# named here must be where its start actually is - so the description cannot drift from the
# map again the way the old pairs.json did (it still said Gaul started in Paris).
#
# (civ, city, reason) - reason is a key into REASONS in prose.py, or None when the city says
# it all. "home" is where the civilization really was; "standin" is a civilization with no
# history in Europe holding a region the map would otherwise leave empty.

STARTS = {
    "Antiquity": {
        "home": [
            ("ROME", "Rome", None),
            ("GAUL", "Lausanne", "gaul"),
            ("ETRUSCANS", "Populonia", "etruscans"),
            ("GREECE", "Thermaic Gulf", "greece"),
            ("BYZANTIUM", "Constantinople", None),
            ("CARTHAGE", "Carthage", None),
            ("EGYPT", "Memphis", None),
            ("ASSYRIA", "Nineveh", None),
            ("BABYLON", "Babylon", None),
            ("PERSIA", "Susa", None),
            ("AKSUM", "Axum", None),
        ],
        "standin": [
            ("MISSISSIPPIAN", "Uppsala", "mississippian"),
            ("HEIAN", "Dublin", "heian"),
            ("MAURYA", "Madrid", "maurya"),
            ("HAN", "Kyiv", "han"),
            ("MAYA", "Berlin", "maya"),
            ("KHMER", "Bucharest", "khmer"),
            ("SILLA", "Ankara", "silla"),
            ("TONGA", "Syracuse", "tonga"),
        ],
    },
    "Exploration": {
        "home": [
            ("ENGLAND", "London", None),
            ("BYZANTIUM", "Constantinople", None),
            ("ETRUSCANS", "Populonia", None),
            ("TUSCANY", "Florence", None),
            ("BULGARIA", "Veliko Tarnovo", "bulgaria"),
            ("SPAIN", "Madrid", None),
            ("NORMAN", "Rouen", None),
            ("ABBASID", "Baghdad", None),
            ("ICELAND", "Reykjavik", None),
            ("MONGOLIA", "Sarai on the lower Volga", "mongolia"),
            ("SONGHAI", "Gao", None),
            ("PIRATE_REPUBLIC", "Algiers", "pirate"),
        ],
        "standin": [
            ("SENGOKU", "Copenhagen", "sengoku"),
            ("MAJAPAHIT", "Dublin", "majapahit"),
            ("CHOLA", "Lisbon", "chola"),
            ("GORYEO", "Athens", "goryeo"),
            ("DAI_VIET", "Alexandria", "daiviet"),
            ("INCA", "Tbilisi", "inca"),
            ("HAWAII", "Syracuse", "hawaii"),
            ("SHAWNEE", "Warsaw", "shawnee"),
            ("MING", "Moscow", "ming"),
        ],
    },
    "Modern": {
        "home": [
            ("GREAT_BRITAIN", "London", None),
            ("AMERICA", "Dublin", "america"),
            ("FRENCH_EMPIRE", "Paris", None),
            ("PRUSSIA", "Berlin", None),
            ("RUSSIA", "Moscow", None),
            ("OTTOMANS", "Ankara", "ottomans"),
            ("QAJAR", "Tehran", None),
            ("BYZANTIUM", "Constantinople", None),
            ("ETRUSCANS", "Populonia", None),
        ],
        "standin": [
            ("MEXICO", "Seville", "mexico"),
            ("JOSEON", "Athens", "joseon"),
            ("MEIJI", "Uppsala", "meiji"),
            ("QING", "Vienna", "qing"),
            ("SIAM", "Naples", "siam"),
            ("MUGHAL", "Warsaw", "mughal"),
            ("NEPAL", "Tbilisi", "nepal"),
            ("BUGANDA", "Gondar", "buganda"),
        ],
    },
}

# Civilizations from other people's Workshop mods that also have a start (GEO.tsl keys).
WORKSHOP = [
    ("SCYTHIA_CUSTOM", "SCYTHIA", "Kamianka"),
    ("KUSH_CLEAN", "KUSH", "Meroe"),
    ("SUMER_TEST", "SUMER", "Ur"),
    ("DEVONISLAND_AUSTRIA_HUNGARY", "AUSTRIA_HUNGARY", "Vienna"),
    ("ICTH_DUTCH_REPUBLIC", "DUTCH_REPUBLIC", "Amsterdam"),
]

# Where each city is, for the check against GEO.tsl. Cities that are also fallback sites are
# read from GEO.fallbackSites; these are the ones that are not.
CITY_LL = {
    "Lausanne": (6.63, 46.52),
    "Populonia": (10.50, 42.99),
    "Florence": (11.25, 43.77),
    "Thermaic Gulf": (22.79, 39.28),
    "Constantinople": (28.61, 41.69),
    "Babylon": (44.42, 32.54),
    "Madrid": (-3.7, 40.4),
    "Ankara": (32.9, 39.9),
    "Veliko Tarnovo": (25.6, 43.85),
    "Sarai on the lower Volga": (47.0, 48.0),
    "Gondar": (37.47, 12.6),
    "Kamianka": (34.40, 47.50),
    "Ur": (46.10, 30.90),
    "Amsterdam": (4.90, 52.37),
}

# The fallback sites the description names; the rest are counted.
FALLBACK_NAMED = ["London", "Dublin", "Kyiv", "Uppsala", "Fez", "Krakow", "Trondheim", "Copenhagen", "Marrakesh"]
