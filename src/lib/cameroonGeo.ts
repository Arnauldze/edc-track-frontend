// ══════════════════════════════════════════════════════════════
// DÉCOUPAGE ADMINISTRATIF DU CAMEROUN
// Région → Département → Villes. Partagé par l'assistant de création
// et la modale d'édition des informations projet.
// ══════════════════════════════════════════════════════════════

export const CAMEROON_DATA: Record<string, Record<string, string[]>> = {
    "Région de l'Est": {
        "Lom-et-Djérem": ["Bertoua", "Bélabo", "Garoua-Boulaï", "Diang", "Ngoura"],
        "Kadey": ["Batouri", "Kette", "Ndelele", "Mbang", "Kentzou"],
        "Boumba-et-Ngoko": ["Yokadouma", "Moloundou", "Salapoumbé", "Gari-Gombo"],
        "Haut-Nyong": ["Abong-Mbang", "Doumé", "Lomié", "Messamena", "Mindourou"],
    },
    "Région du Sud": {
        "Mvila": ["Ebolowa", "Ambam", "Biwong-Bane", "Mengong"],
        "Dja-et-Lobo": ["Sangmélima", "Djoum", "Mintom", "Meyomessala", "Bengbis"],
        "Océan": ["Kribi", "Lolodorf", "Akom II", "Campo", "Bipindi"],
        "Vallée-du-Ntem": ["Ambam", "Ma'an", "Olamze", "Kyé-Ossi"],
    },
    "Région du Centre": {
        "Mfoundi": ["Yaoundé"],
        "Lékié": ["Monatélé", "Obala", "Okola", "Sa'a", "Evodoula"],
        "Mefou-et-Afamba": ["Mfou", "Nkolafamba", "Awae", "Edzendouan"],
        "Nyong-et-So'o": ["Mbalmayo", "Ngoumou", "Akoeman"],
        "Mbam-et-Inoubou": ["Bafia", "Kiiki", "Ndikinimeki", "Bokito"],
    },
    "Région du Littoral": {
        "Wouri": ["Douala"],
        "Sanaga-Maritime": ["Édéa", "Dizangué", "Mouanko", "Pouma", "Ndom"],
        "Nkam": ["Yabassi", "Nkondjock", "Yingui", "Nord-Makombé"],
        "Moungo": ["Nkongsamba", "Loum", "Manjo", "Mbanga", "Melong"],
    },
    "Région de l'Ouest": {
        "Mifi": ["Bafoussam"],
        "Menoua": ["Dschang", "Penka-Michel", "Nkong-Ni", "Fongo-Tongo"],
        "Bamboutos": ["Mbouda", "Galim", "Batcham"],
        "Haut-Nkam": ["Bafang", "Bandja", "Bana", "Kekem"],
        "Koung-Khi": ["Bandjoun", "Bayangam", "Poumougne"],
    },
    "Région de l'Adamaoua": {
        "Vina": ["Ngaoundéré", "Belel", "Martap", "Mbé"],
        "Mbere": ["Meiganga", "Dir", "Djohong", "Ngaoui"],
        "Djerem": ["Tibati", "Ngaoundal", "Banyo"],
        "Mayo-Banyo": ["Banyo", "Mayo-Darlé", "Bankim"],
    },
    "Région du Nord": {
        "Bénoué": ["Garoua", "Lagdo", "Pitoa", "Bibémi"],
        "Mayo-Louti": ["Guider", "Figuil", "Mayo-Oulo"],
        "Faro": ["Poli", "Béka"],
        "Mayo-Rey": ["Tcholliré", "Rey-Bouba", "Touboro", "Madingring"],
    },
    "Région de l'Extrême-Nord": {
        "Diamaré": ["Maroua", "Bogo", "Pétté", "Gazawa"],
        "Logone-et-Chari": ["Kousséri", "Goulfey", "Makary", "Blangoua"],
        "Mayo-Danay": ["Yagoua", "Maga", "Vélé", "Kar-Hay"],
        "Mayo-Tsanaga": ["Mokolo", "Koza", "Mora", "Bourha"],
        "Mayo-Sava": ["Mora", "Tokombéré", "Kolofata"],
    },
    "Région du Nord-Ouest": {
        "Mezam": ["Bamenda", "Bali", "Santa", "Tubah"],
        "Bui": ["Kumbo", "Noni", "Jakiri", "Mbiame"],
        "Ngo-Ketunjia": ["Ndop", "Babessi", "Balikumbat"],
        "Donga-Mantung": ["Nkambé", "Ako", "Misaje", "Ndu"],
    },
    "Région du Sud-Ouest": {
        "Fako": ["Buéa", "Limbé", "Tiko", "Muyuka", "Idenau"],
        "Mémé": ["Kumba", "Mbonge", "Konye"],
        "Ndian": ["Mundemba", "Bamusso", "Isanguele", "Ekondo-Titi"],
        "Koupé-Manengouba": ["Bangem", "Tombel", "Nguti"],
    },
};

export const REGIONS = Object.keys(CAMEROON_DATA);

// Coordonnées GPS approximatives des villes, pour positionner un projet
// lorsque seule la ville est connue.
export const CITY_COORDS: Record<string, [number, number]> = {
    // Est
    "Bertoua": [4.5772, 13.6846], "Bélabo": [4.9333, 13.3000], "Garoua-Boulaï": [5.8917, 14.5500],
    "Diang": [5.1500, 13.2000], "Ngoura": [4.8833, 14.1667], "Batouri": [4.4333, 14.3500],
    "Kette": [4.1667, 14.2000], "Ndelele": [4.0500, 14.9167], "Mbang": [4.5833, 13.7333],
    "Kentzou": [4.1500, 14.5500], "Yokadouma": [3.5167, 15.0500], "Moloundou": [2.0500, 15.2167],
    "Salapoumbé": [2.8667, 14.9000], "Gari-Gombo": [3.4667, 15.0667], "Abong-Mbang": [3.9833, 13.1833],
    "Doumé": [4.2333, 13.4500], "Lomié": [3.1583, 13.6167], "Messamena": [3.6333, 12.8500],
    "Mindourou": [3.5833, 14.0833],
    // Sud
    "Ebolowa": [2.9000, 11.1500], "Ambam": [2.3833, 11.2833], "Biwong-Bane": [2.8667, 11.0333],
    "Mengong": [2.7167, 11.0333], "Sangmélima": [2.9333, 11.9833], "Djoum": [2.6667, 12.6667],
    "Mintom": [2.4167, 13.2667], "Meyomessala": [3.1000, 11.7500], "Bengbis": [3.1667, 12.1833],
    "Kribi": [2.9500, 9.9167], "Lolodorf": [3.2333, 10.7333], "Akom II": [2.7833, 10.5667],
    "Campo": [2.3667, 9.8333], "Bipindi": [3.0833, 10.4000],
    "Ma'an": [2.3833, 10.6167], "Olamze": [2.1000, 11.4000], "Kyé-Ossi": [2.1833, 11.3333],
    // Centre
    "Yaoundé": [3.8480, 11.5021], "Monatélé": [4.2500, 11.2000], "Obala": [4.1667, 11.5333],
    "Okola": [4.0167, 11.3833], "Sa'a": [4.3667, 11.4500], "Evodoula": [4.0833, 11.2000],
    "Mfou": [3.7167, 11.6333], "Nkolafamba": [3.7000, 11.6667], "Awae": [3.6500, 11.6833],
    "Edzendouan": [3.6500, 11.5500], "Mbalmayo": [3.5167, 11.5000], "Ngoumou": [3.6500, 11.3667],
    "Akoeman": [3.4667, 11.3667], "Bafia": [4.7500, 11.2333], "Kiiki": [4.7000, 11.0000],
    "Ndikinimeki": [4.7667, 10.8333], "Bokito": [4.5667, 11.1167],
    // Littoral
    "Douala": [4.0511, 9.7679], "Édéa": [3.8000, 10.1333], "Dizangué": [3.7667, 9.9833],
    "Mouanko": [3.6167, 9.7833], "Pouma": [3.9167, 10.5667], "Ndom": [4.0000, 10.5500],
    "Yabassi": [4.4500, 9.9667], "Nkondjock": [4.7500, 9.9500], "Yingui": [4.6333, 9.8833],
    "Nord-Makombé": [4.6833, 9.9333], "Nkongsamba": [4.9500, 9.9333], "Loum": [4.7167, 9.7333],
    "Manjo": [4.8333, 9.8167], "Mbanga": [4.5000, 9.5667], "Melong": [5.1167, 9.9667],
    // Ouest
    "Bafoussam": [5.4737, 10.4176], "Dschang": [5.4500, 10.0667], "Penka-Michel": [5.5333, 10.0500],
    "Nkong-Ni": [5.5667, 10.1167], "Fongo-Tongo": [5.5000, 10.0000], "Mbouda": [5.6333, 10.2500],
    "Galim": [5.6667, 10.4000], "Batcham": [5.6167, 10.2833], "Bafang": [5.1500, 10.1833],
    "Bandja": [5.1500, 10.3667], "Bana": [5.1500, 10.0667], "Kekem": [5.2000, 9.8667],
    "Bandjoun": [5.3833, 10.4167], "Bayangam": [5.3333, 10.3500], "Poumougne": [5.3500, 10.3000],
    // Adamaoua
    "Ngaoundéré": [7.3167, 13.5833], "Belel": [7.0667, 14.4667], "Martap": [7.3333, 13.7333],
    "Mbé": [7.8500, 13.6000], "Meiganga": [6.5167, 14.2833], "Dir": [6.4000, 14.0667],
    "Djohong": [6.8333, 14.7000], "Ngaoui": [6.4833, 15.3167], "Tibati": [6.4667, 12.6333],
    "Ngaoundal": [6.4833, 13.2667], "Banyo": [6.7500, 11.8167], "Mayo-Darlé": [6.5833, 11.5333],
    "Bankim": [6.0833, 11.4667],
    // Nord
    "Garoua": [9.3000, 13.4000], "Lagdo": [9.0500, 13.6667], "Pitoa": [9.3833, 13.5000],
    "Bibémi": [9.3167, 13.8667], "Guider": [9.9333, 13.9500], "Figuil": [9.7667, 13.9667],
    "Mayo-Oulo": [9.7667, 13.7333], "Poli": [8.4833, 13.2333], "Béka": [8.0167, 12.9167],
    "Tcholliré": [8.4000, 14.1667], "Rey-Bouba": [8.6667, 14.1833], "Touboro": [7.7833, 15.3500],
    "Madingring": [7.5833, 14.8167],
    // Extrême-Nord
    "Maroua": [10.5958, 14.3159], "Bogo": [10.7333, 14.6000], "Pétté": [10.4833, 14.4333],
    "Gazawa": [10.5167, 14.2167], "Kousséri": [12.0833, 15.0333], "Goulfey": [12.3833, 14.9167],
    "Makary": [12.5667, 14.4667], "Blangoua": [12.6333, 14.5500], "Yagoua": [10.3500, 15.2333],
    "Maga": [10.8333, 14.9500], "Vélé": [10.2500, 15.1500], "Kar-Hay": [10.5000, 14.9833],
    "Mokolo": [10.7333, 13.8000], "Koza": [10.8833, 13.8833], "Mora": [11.0500, 14.1500],
    "Bourha": [10.3833, 13.6833], "Tokombéré": [10.8667, 14.1833], "Kolofata": [11.1667, 14.0833],
    // Nord-Ouest
    "Bamenda": [5.9631, 10.1591], "Bali": [5.8833, 10.0167], "Santa": [5.7833, 10.1500],
    "Tubah": [5.9500, 10.2000], "Kumbo": [6.2000, 10.6833], "Noni": [6.1667, 10.8000],
    "Jakiri": [6.1000, 10.6500], "Mbiame": [6.2667, 10.8500], "Ndop": [5.9667, 10.4167],
    "Babessi": [6.0333, 10.4833], "Balikumbat": [5.9500, 10.3667], "Nkambé": [6.6167, 10.6667],
    "Ako": [6.8000, 10.9167], "Misaje": [6.4833, 10.9667], "Ndu": [6.3833, 10.7500],
    // Sud-Ouest
    "Buéa": [4.1560, 9.2632], "Limbé": [4.0204, 9.2072], "Tiko": [4.0750, 9.3500],
    "Muyuka": [4.2833, 9.4167], "Idenau": [4.2167, 8.9833], "Kumba": [4.6333, 9.4333],
    "Mbonge": [4.5333, 9.1667], "Konye": [4.9500, 9.4833], "Mundemba": [4.9500, 8.8833],
    "Bamusso": [4.4167, 8.9000], "Isanguele": [4.7667, 8.5667], "Ekondo-Titi": [4.9667, 9.1833],
    "Bangem": [5.1500, 9.6833], "Tombel": [4.7500, 9.6667], "Nguti": [5.3333, 9.4167],
};
