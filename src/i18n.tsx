import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'fr' | 'en';

export const TRANSLATIONS = {
  fr: {
    seo: {
      title: 'La Planète Bleue FanStats — Archive, Statistiques & Globe 3D',
      description:
        'Explorez l’archive musicale de La Planète Bleue (1995–2026) : globe 3D interactif, 7 100+ titres indexés, classements, extraits audio et playlists.',
    },
    nav: {
      home: 'Accueil',
      globe: 'Vue 3D',
      tracks: 'Titres',
      multi: 'Multi-diffusions',
      emissions: 'Émissions',
      stats: 'Statistiques',
      legal: 'Mentions légales',
      sync: 'Synchroniser',
      syncShort: 'Sync',
      syncing: 'Synchronisation…',
      syncingShort: 'Sync…',
      syncAria: 'Synchroniser la base',
      openMenu: 'Ouvrir le menu',
      closeMenu: 'Fermer le menu',
      mainNavAria: 'Navigation principale',
      switchToFlag: '🇬🇧',
      switchToLabel: 'Switch to English',
    },
    hero: {
      legal: 'Mentions légales & À propos',
      emissions: 'Archive des émissions',
      stats: 'Statistiques & classements de la discothèque',
      multi: 'Titres diffusés dans plusieurs émissions',
      tracks: 'Base de données des titres diffusés',
      subtitle:
        'Qu’est-ce qu’on écoutera dans 10 ans ? Et dans 100 ans ? — Index complet des titres, auteurs, durées, émissions et dates de diffusion (1995–2026).',
      enrichDurations: 'Enrichir durées',
      exportCsv: 'Exporter CSV',
    },
    kpi: {
      uniqueTracks: 'Titres uniques indexés',
      appearances: 'Passages en émission',
      archivedEmissions: 'Émissions archivées',
      multiTracks: 'Titres multi-diffusions',
    },
    home: {
      globeKicker: '01. Vue 3D',
      globeSubkicker: 'Globe Sonore Ligne Claire',
      globeAlt: 'Globe Sonore 3D de La Planète Bleue FanStats reliant les pays par émissions',
      globeTitle: 'La carte vivante de La Planète Bleue en 3D',
      globeDesc:
        'Explorez les origines musicales de chaque pays sur un globe topographique interactif, suivez les connexions tissées entre pays diffusés au fil d’une même émission et écoutez les extraits directement depuis le relief.',
      emissionsUnit: 'émissions',
      tracksUnit: 'titres',
      playsUnit: 'passages',
      globeCta: 'Explorer la Vue 3D',

      tracksKicker: '02. Titres',
      tracksUnique: 'titres uniques',
      tracksTitle: 'Recherchez des morceaux diffusés depuis 1995',
      tracksDesc:
        'Interrogez l’index complet des titres programmés de 1995 à 2026 par artiste, morceau, label, pays, année ou numéro d’émission. Écoutez des extraits audio de 30 secondes, vérifiez les durées et exportez vos recherches en CSV.',
      tracksPlaceholder: 'Rechercher un artiste, titre, label ou pays…',
      tracksSearchBtn: 'Rechercher',
      tracksOpenBtn: 'Ouvrir les titres',
      tracksIndexedPlays: 'passages indexés',
      tracksKnownDurations: 'durées renseignées',
      tracksExploreAll: 'Explorer toute la base',

      officialKicker: '03. Site officiel',
      officialBannerAlt: 'Logo officiel La Planète Bleue avec parabole',
      officialTitle: 'Découvrez le site officiel de La Planète Bleue',
      officialDesc:
        'Retrouvez les émissions complètes en écoute, les playlists éditoriales, les chroniques d’Yves Blanc et toute l’actualité sonore du meilleur podcast de l’univers connu directement sur le site officiel.',
      officialCta: 'Visiter laplanetebleue.com',

      multiKicker: '04. Multi-diffusions',
      multiTitle: 'Les classiques revenus à l’antenne',
      multiDesc:
        'Retrouvez uniquement les titres sélectionnés à plusieurs reprises dans l’histoire de La Planète Bleue, classés par nombre d’émissions pour repérer les œuvres phares de la discothèque.',
      multiStatSub: 'titres programmés dans au moins deux émissions distinctes',
      multiCta: 'Voir les multi-diffusions',

      statsKicker: '05. Statistiques',
      statsKnownPct: '% durées renseignées',
      statsTitle: 'Classements auteurs, titres, pays et années',
      statsDesc:
        'Consultez les palmarès complets des artistes et des pays les plus représentés, la répartition annuelle des diffusions et l’avancement de l’enrichissement des durées musicales.',
      statsTopAuthors: 'Auteurs en tête',
      statsTopCountries: 'Origines principales',
      statsPlaysAbbr: 'diff.',
      statsCta: 'Ouvrir les statistiques',
    },
    tracksView: {
      searchPlaceholder: 'Rechercher titre, auteur, label, pays ou nº…',
      clearSearch: 'Effacer la recherche',
      authorPlaceholder: 'Filtrer par auteur…',
      authorAria: 'Filtrer par auteur',
      emissionPlaceholder: 'Nº émission',
      emissionAria: "Filtrer par numéro d'émission",
      yearAria: 'Filtrer par année',
      allYears: 'Toutes années',
      countryAria: 'Filtrer par pays',
      allCountries: 'Tous pays',
      durationAll: 'Toutes',
      durationKnown: 'Durée OK',
      durationMissing: 'Sans durée',
      multiOnly: 'Diffusés plusieurs fois uniquement',
      reset: 'Réinitialiser',
      resultSingular: 'résultat',
      resultPlural: 'résultats',
      sortAria: 'Trier les résultats',
      sortLatest: 'Diffusion : plus récents',
      sortOldest: 'Diffusion : plus anciens',
      sortAppearances: 'Plus diffusés',
      sortTitle: 'Titre (A–Z)',
      sortAuthor: 'Auteur (A–Z)',
      sortDurationDesc: 'Durée décroissante',
      sortDurationAsc: 'Durée croissante',
      emptyTitle: 'Aucun titre ne correspond à vos critères',
      emptyDesc: 'Essayez un autre mot-clé, supprimez un filtre ou lancez une synchronisation.',
      emptyReset: 'Réinitialiser les filtres',
      colTitleLabel: 'Titre & Label',
      colAuthor: 'Auteur',
      colDuration: 'Durée',
      colOrigin: 'Origine',
      colEmissions: 'Émissions & dates de diffusion',
      playTitle: 'Écouter un extrait audio de 30 secondes',
      playAriaPrefix: 'Extrait de',
      durationSearchBtn: 'Durée',
      durationSearchTitle: 'Rechercher la durée sur Deezer / iTunes',
      editDurationAriaPrefix: 'Modifier la durée de',
      manualDurationAriaPrefix: 'Saisir manuellement la durée de',
      saveDurationAria: 'Enregistrer la durée',
      cancelAria: 'Annuler',
      durationTitle: 'Modifier la durée',
      sourcePrefix: 'Source :',
      filterByPrefix: 'Filtrer par',
      dateUnknown: 'Date inconnue',
      otherBroadcastSingular: 'autre diffusion',
      otherBroadcastPlural: 'autres diffusions',
      collapse: 'Réduire',
      fetchError: 'Erreur lors de la recherche dans la base.',
      notFoundManual: 'Introuvable — saisie mm:ss',
      invalidFormat: 'Format invalide',
      networkError: 'Erreur réseau',
    },
    statsView: {
      coverageTitle: 'Couverture des durées musicales',
      coverageDesc:
        'Les playlists d’origine ne précisent pas la durée individuelle des morceaux. L’enrichissement interroge Deezer et iTunes pour associer la durée exacte de chaque titre.',
      coverageCountSuffix: 'titres renseignés',
      enrichBtn: 'Enrichir 250 durées',
      quickJumpAria: 'Accès rapide aux classements',
      jumpAuthors: 'Auteurs',
      jumpTracks: 'Titres',
      jumpCountries: 'Pays',
      jumpYears: 'Années',
      authorsTitle: 'Classement des auteurs',
      authorsPlaceholder: 'Filtrer dans le classement des auteurs…',
      playsAbbr: 'diff.',
      emissionsAbbr: 'ém.',
      topTracksTitle: 'Titres les plus diffusés',
      topTracksSub: 'Morceaux programmés à plusieurs reprises',
      countriesTitle: 'Origines géographiques',
      countriesPlaceholder: 'Filtrer par pays ou ville…',
      tracksUnit: 'titres',
      yearsTitle: 'Émissions par année',
      yearsSub: 'Volume annuel d’émissions et de titres programmés',
      tracksAbbr: 't.',
    },
    emissionsView: {
      searchPlaceholder: 'Filtrer par numéro (ex : 1054), date ou mot-clé…',
      yearAria: 'Filtrer par année',
      allYears: 'Toutes les années',
      emissionSingular: 'émission',
      emissionPlural: 'émissions',
      emptyTitle: 'Aucune émission trouvée',
      emptyDesc: 'Modifiez votre recherche ou réinitialisez le filtre d’année.',
      cardTitlePrefix: 'La Planète Bleue nº',
      tracksUnit: 'titres',
      dateUnknown: 'Date inconnue',
    },
    drawer: {
      dialogAria: 'Détails de l’émission',
      kicker: 'Archive des diffusions',
      emissionFallback: 'Émission',
      closeAria: 'Fermer le panneau',
      loading: 'Chargement de la playlist…',
      loadError: 'Impossible de charger cette émission.',
      broadcastLabel: 'Diffusion :',
      unknown: 'Inconnue',
      trackSingular: 'titre',
      trackPlural: 'titres',
      formatLabel: 'Format',
      officialSheet: 'Voir la fiche sur laplanetebleue.com',
      listenPodcast: 'Écouter le podcast complet',
      mp3File: 'Fichier MP3',
      playlistUnlimited: 'La Playlist — Version Unlimited',
      playlistRadio: 'La Playlist — Version Radio',
      playlistStandard: 'La Playlist de l’émission',
      playTitle: 'Écouter un extrait de 30s',
      playAriaPrefix: 'Écouter un extrait de',
      alsoFeaturedIn: 'Également diffusé dans :',
      durationBtn: 'Durée',
      durationSearchTitle: 'Rechercher la durée (Deezer / iTunes)',
    },
    legalView: {
      kicker: 'À propos du projet · Mentions légales',
      statementBeforeAuthor: 'Ce site a été conçu et développé par ',
      statementMiddle:
        ', en pur fan et pour mon propre plaisir, en espérant que ça plaira et permettra à plein de gens de découvrir ',
      statementQuote: 'le meilleur podcast de l’univers connu',
      officialSiteBtn: 'Site officiel de La Planète Bleue',
      card1Title: 'Projet fan indépendant',
      card1Part1: 'est une archive analytique et exploratoire non officielle, sans aucun but lucratif ni publicitaire. L’émission ',
      card1Part2: ', ses sélections musicales, son nom et ses textes éditoriaux restent la propriété exclusive d’',
      card1And: ' et de ',
      card2Title: 'Données, visuels & extraits audio',
      card2Body:
        'Les playlists indexées proviennent des fiches publiques des émissions. Les durées manquantes et courts extraits audio de 30 secondes sont récupérés à des fins documentaires via les API publiques Deezer et Apple iTunes. Aucune illustration ou photographie soumise à des droits d’auteur n’est utilisée : tous les visuels orbitaux et le globe 3D sont générés procéduralement.',
      card3Title: 'Données personnelles & cookies',
      card3Body:
        'Ce site ne requiert aucune création de compte, ne collecte aucune donnée personnelle, n’effectue aucun profilage et ne dépose aucun cookie publicitaire ou de suivi statistique tiers.',
      card4Title: 'Contact & demandes',
      card4Body:
        'Pour toute remarque, suggestion d’amélioration ou demande concernant ce projet fan, vous pouvez contacter Fred Neau / un ecologeek directement sur LinkedIn :',
      card4LinkedIn: 'Profil LinkedIn de Fred Neau',
      ctaTracks: 'Explorer la base des titres',
      ctaStats: 'Voir les statistiques',
      ctaGlobe: 'Ouvrir la Vue 3D',
    },
    globeView: {
      loadError: 'Erreur lors du chargement des données géographiques.',
      hudTitle: 'Globe Sonore',
      hudSubtitle: '· Ligne Claire',
      loading: 'Chargement…',
      tracksUnit: 'titres',
      countriesUnit: 'pays',
      linksUnit: 'liens',
      relief: 'Relief',
      sameBroadcast: 'Même émission',
      fivePlusBroadcasts: '5+ émissions',
      trackSingular: 'titre',
      trackPlural: 'titres',
      playSingular: 'diffusion',
      playPlural: 'diffusions',
      clickToInspect: 'Cliquer pour inspecter',
      noMatchCountry: 'Aucun titre indexé pour cette sélection',
      sharedBroadcastSingular: 'émission en commun',
      sharedBroadcastPlural: 'émissions en commun',
      clickToOpenBroadcast: 'Cliquer pour ouvrir l’émission nº',
      selectedCountry: 'Pays sélectionné',
      passageSingular: 'passage',
      passagePlural: 'passages',
      noMatchFilters: 'Aucun titre correspondant aux filtres actifs',
      closeCountryAria: 'Fermer la fiche pays',
      topAuthors: 'Artistes principaux',
      connectedCountries: 'Pays reliés par les mêmes émissions',
      emissionsTooltipPrefix: 'Émissions :',
      playSampleTitle: 'Écouter un extrait musical (30s)',
      playSampleAriaPrefix: 'Écouter un extrait de',
      sampleUnavailable: 'Extrait audio indisponible',
      emissionPrefix: 'Émission nº',
      openInTable: 'Ouvrir dans la table des titres',
      contextLostTitle: 'Contexte 3D interrompu',
      contextLostDesc:
        'Le navigateur a libéré le contexte WebGL. Rechargez l’onglet pour restaurer le globe.',
      dockShortcutTitle: 'Raccourci clavier : H',
      showControls: 'Afficher les contrôles',
      hideControls: 'Masquer les contrôles',
      searchPlaceholder: 'Rechercher artiste, titre, pays…',
      clearSearchAria: 'Effacer la recherche',
      yearAria: 'Filtrer par année',
      allYears: 'Toutes années',
      multiOnly: 'Multi-diffusions',
      network: 'Réseau',
      clouds: 'Nuages',
      rotationTitle: 'Activer ou suspendre la rotation du globe',
      rotation: 'Rotation',
      reset: 'Réinitialiser',
      activeCountries: 'Pays actifs',
    },
    sentinel: {
      shown: 'affichés',
      loading: 'Chargement…',
      loadMore: 'Charger la suite',
    },
    footer: {
      by: 'Par',
      legal: 'Mentions légales',
      officialSource: 'Source officielle : laplanetebleue.com',
    },
  },
  en: {
    seo: {
      title: 'La Planète Bleue FanStats — Archive, Stats & 3D Globe',
      description:
        'Explore the musical archive of La Planète Bleue (1995–2026): interactive 3D globe, 7,100+ indexed tracks, rankings, audio previews and playlists.',
    },
    nav: {
      home: 'Home',
      globe: '3D View',
      tracks: 'Tracks',
      multi: 'Replays',
      emissions: 'Broadcasts',
      stats: 'Statistics',
      legal: 'Legal Notice',
      sync: 'Synchronize',
      syncShort: 'Sync',
      syncing: 'Syncing…',
      syncingShort: 'Sync…',
      syncAria: 'Synchronize database',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      mainNavAria: 'Main navigation',
      switchToFlag: '🇫🇷',
      switchToLabel: 'Passer en français',
    },
    hero: {
      legal: 'Legal Notice & About',
      emissions: 'Broadcasts Archive',
      stats: 'Discography Statistics & Rankings',
      multi: 'Tracks Played Across Multiple Shows',
      tracks: 'Indexed Broadcast Tracks Database',
      subtitle:
        'What will we listen to in 10 years? And in 100 years? — Complete index of tracks, artists, durations, broadcasts and air dates (1995–2026).',
      enrichDurations: 'Enrich durations',
      exportCsv: 'Export CSV',
    },
    kpi: {
      uniqueTracks: 'Unique indexed tracks',
      appearances: 'Broadcast appearances',
      archivedEmissions: 'Archived broadcasts',
      multiTracks: 'Multi-broadcast tracks',
    },
    home: {
      globeKicker: '01. 3D View',
      globeSubkicker: 'Ligne Claire Sonic Globe',
      globeAlt: '3D Sonic Globe of La Planète Bleue FanStats linking countries by broadcasts',
      globeTitle: 'The living 3D map of La Planète Bleue',
      globeDesc:
        'Explore the musical origins of every country on an interactive topographic globe, trace connections woven between countries featured in the same broadcast, and listen to audio previews directly from the relief.',
      emissionsUnit: 'broadcasts',
      tracksUnit: 'tracks',
      playsUnit: 'plays',
      globeCta: 'Explore the 3D View',

      tracksKicker: '02. Tracks',
      tracksUnique: 'unique tracks',
      tracksTitle: 'Search tracks broadcast since 1995',
      tracksDesc:
        'Query the complete index of tracks aired from 1995 to 2026 by artist, title, label, country, year, or episode number. Listen to 30-second audio previews, verify track durations, and export results as CSV.',
      tracksPlaceholder: 'Search an artist, track, label or country…',
      tracksSearchBtn: 'Search',
      tracksOpenBtn: 'Open tracks',
      tracksIndexedPlays: 'indexed plays',
      tracksKnownDurations: 'known durations',
      tracksExploreAll: 'Explore full database',

      officialKicker: '03. Official Website',
      officialBannerAlt: 'Official La Planète Bleue satellite dish logo',
      officialTitle: 'Discover the official La Planète Bleue website',
      officialDesc:
        'Listen to full episodes, browse editorial playlists, read Yves Blanc’s chronicles, and follow the latest sonic updates from the greatest podcast in the known universe directly on the official site.',
      officialCta: 'Visit laplanetebleue.com',

      multiKicker: '04. Replays',
      multiTitle: 'Classics that returned on air',
      multiDesc:
        'Browse exclusively the tracks selected multiple times across the history of La Planète Bleue, ranked by broadcast count to uncover the signature works of the collection.',
      multiStatSub: 'tracks aired in at least two distinct broadcasts',
      multiCta: 'View multi-broadcasts',

      statsKicker: '05. Statistics',
      statsKnownPct: '% durations known',
      statsTitle: 'Rankings by artist, track, country and year',
      statsDesc:
        'Inspect complete charts of the most featured artists and geographic origins, annual broadcast volume, and progress on track duration enrichment.',
      statsTopAuthors: 'Top artists',
      statsTopCountries: 'Top origins',
      statsPlaysAbbr: 'plays',
      statsCta: 'Open statistics',
    },
    tracksView: {
      searchPlaceholder: 'Search title, artist, label, country or #…',
      clearSearch: 'Clear search',
      authorPlaceholder: 'Filter by artist…',
      authorAria: 'Filter by artist',
      emissionPlaceholder: 'Show #',
      emissionAria: 'Filter by broadcast number',
      yearAria: 'Filter by year',
      allYears: 'All years',
      countryAria: 'Filter by country',
      allCountries: 'All countries',
      durationAll: 'All',
      durationKnown: 'Duration OK',
      durationMissing: 'No duration',
      multiOnly: 'Multi-broadcasts only',
      reset: 'Reset',
      resultSingular: 'result',
      resultPlural: 'results',
      sortAria: 'Sort results',
      sortLatest: 'Broadcast: newest first',
      sortOldest: 'Broadcast: oldest first',
      sortAppearances: 'Most broadcast',
      sortTitle: 'Title (A–Z)',
      sortAuthor: 'Artist (A–Z)',
      sortDurationDesc: 'Duration descending',
      sortDurationAsc: 'Duration ascending',
      emptyTitle: 'No tracks match your filters',
      emptyDesc: 'Try a different keyword, clear a filter, or run a sync.',
      emptyReset: 'Reset filters',
      colTitleLabel: 'Title & Label',
      colAuthor: 'Artist',
      colDuration: 'Duration',
      colOrigin: 'Origin',
      colEmissions: 'Broadcasts & air dates',
      playTitle: 'Play 30-second audio preview',
      playAriaPrefix: 'Preview of',
      durationSearchBtn: 'Duration',
      durationSearchTitle: 'Look up duration on Deezer / iTunes',
      editDurationAriaPrefix: 'Edit duration for',
      manualDurationAriaPrefix: 'Manually enter duration for',
      saveDurationAria: 'Save duration',
      cancelAria: 'Cancel',
      durationTitle: 'Edit duration',
      sourcePrefix: 'Source:',
      filterByPrefix: 'Filter by',
      dateUnknown: 'Unknown date',
      otherBroadcastSingular: 'other broadcast',
      otherBroadcastPlural: 'other broadcasts',
      collapse: 'Collapse',
      fetchError: 'Error while searching the database.',
      notFoundManual: 'Not found — enter mm:ss',
      invalidFormat: 'Invalid format',
      networkError: 'Network error',
    },
    statsView: {
      coverageTitle: 'Track duration coverage',
      coverageDesc:
        'Original playlists do not specify individual track lengths. Enrichment queries Deezer and iTunes to match the exact duration of each track.',
      coverageCountSuffix: 'tracks enriched',
      enrichBtn: 'Enrich 250 durations',
      quickJumpAria: 'Quick jump to rankings',
      jumpAuthors: 'Artists',
      jumpTracks: 'Tracks',
      jumpCountries: 'Countries',
      jumpYears: 'Years',
      authorsTitle: 'Artist ranking',
      authorsPlaceholder: 'Filter artist ranking…',
      playsAbbr: 'plays',
      emissionsAbbr: 'shows',
      topTracksTitle: 'Most broadcast tracks',
      topTracksSub: 'Tracks aired on multiple occasions',
      countriesTitle: 'Geographic origins',
      countriesPlaceholder: 'Filter by country or city…',
      tracksUnit: 'tracks',
      yearsTitle: 'Broadcasts per year',
      yearsSub: 'Annual volume of broadcasts and aired tracks',
      tracksAbbr: 'tr.',
    },
    emissionsView: {
      searchPlaceholder: 'Filter by number (e.g. 1054), date or keyword…',
      yearAria: 'Filter by year',
      allYears: 'All years',
      emissionSingular: 'broadcast',
      emissionPlural: 'broadcasts',
      emptyTitle: 'No broadcasts found',
      emptyDesc: 'Adjust your search or reset the year filter.',
      cardTitlePrefix: 'La Planète Bleue #',
      tracksUnit: 'tracks',
      dateUnknown: 'Unknown date',
    },
    drawer: {
      dialogAria: 'Broadcast details',
      kicker: 'Broadcast archive',
      emissionFallback: 'Broadcast',
      closeAria: 'Close panel',
      loading: 'Loading playlist…',
      loadError: 'Unable to load this broadcast.',
      broadcastLabel: 'Aired:',
      unknown: 'Unknown',
      trackSingular: 'track',
      trackPlural: 'tracks',
      formatLabel: 'Format',
      officialSheet: 'View episode on laplanetebleue.com',
      listenPodcast: 'Listen to full podcast',
      mp3File: 'MP3 file',
      playlistUnlimited: 'Playlist — Unlimited Version',
      playlistRadio: 'Playlist — Radio Version',
      playlistStandard: 'Broadcast Playlist',
      playTitle: 'Play 30s preview',
      playAriaPrefix: 'Play preview of',
      alsoFeaturedIn: 'Also aired in:',
      durationBtn: 'Duration',
      durationSearchTitle: 'Look up duration (Deezer / iTunes)',
    },
    legalView: {
      kicker: 'About the project · Legal Notice',
      statementBeforeAuthor: 'This website was designed and built by ',
      statementMiddle:
        ', purely as a fan and for my own pleasure, hoping it will delight visitors and help many people discover ',
      statementQuote: 'the greatest podcast in the known universe',
      officialSiteBtn: 'Official La Planète Bleue website',
      card1Title: 'Independent fan project',
      card1Part1: 'is an unofficial analytical and exploratory archive, strictly non-profit and ad-free. The show ',
      card1Part2: ', its music selections, name, and editorial texts remain the exclusive property of ',
      card1And: ' and ',
      card2Title: 'Data, visuals & audio previews',
      card2Body:
        'Indexed playlists come from public broadcast listings. Missing durations and short 30-second audio previews are fetched for documentary purposes via the public Deezer and Apple iTunes APIs. No copyrighted artwork or photography is used: all orbital emblems and the 3D globe are procedurally generated.',
      card3Title: 'Personal data & cookies',
      card3Body:
        'This site requires no account creation, collects no personal data, performs no profiling, and sets no advertising or third-party tracking cookies.',
      card4Title: 'Contact & inquiries',
      card4Body:
        'For any feedback, improvement ideas, or inquiries regarding this fan project, you can contact Fred Neau / un ecologeek directly on LinkedIn:',
      card4LinkedIn: 'Fred Neau’s LinkedIn Profile',
      ctaTracks: 'Explore track database',
      ctaStats: 'View statistics',
      ctaGlobe: 'Open 3D View',
    },
    globeView: {
      loadError: 'Error loading geographic data.',
      hudTitle: 'Sonic Globe',
      hudSubtitle: '· Ligne Claire',
      loading: 'Loading…',
      tracksUnit: 'tracks',
      countriesUnit: 'countries',
      linksUnit: 'links',
      relief: 'Relief',
      sameBroadcast: 'Same broadcast',
      fivePlusBroadcasts: '5+ broadcasts',
      trackSingular: 'track',
      trackPlural: 'tracks',
      playSingular: 'play',
      playPlural: 'plays',
      clickToInspect: 'Click to inspect',
      noMatchCountry: 'No indexed track for this selection',
      sharedBroadcastSingular: 'shared broadcast',
      sharedBroadcastPlural: 'shared broadcasts',
      clickToOpenBroadcast: 'Click to open broadcast #',
      selectedCountry: 'Selected country',
      passageSingular: 'play',
      passagePlural: 'plays',
      noMatchFilters: 'No track matching active filters',
      closeCountryAria: 'Close country panel',
      topAuthors: 'Featured artists',
      connectedCountries: 'Countries linked by shared broadcasts',
      emissionsTooltipPrefix: 'Broadcasts:',
      playSampleTitle: 'Play 30s music preview',
      playSampleAriaPrefix: 'Play preview of',
      sampleUnavailable: 'Audio preview unavailable',
      emissionPrefix: 'Broadcast #',
      openInTable: 'Open in tracks table',
      contextLostTitle: '3D context interrupted',
      contextLostDesc:
        'The browser released the WebGL context. Reload this tab to restore the globe.',
      dockShortcutTitle: 'Keyboard shortcut: H',
      showControls: 'Show controls',
      hideControls: 'Hide controls',
      searchPlaceholder: 'Search artist, track, country…',
      clearSearchAria: 'Clear search',
      yearAria: 'Filter by year',
      allYears: 'All years',
      multiOnly: 'Multi-broadcasts',
      network: 'Network',
      clouds: 'Clouds',
      rotationTitle: 'Toggle globe rotation',
      rotation: 'Rotation',
      reset: 'Reset',
      activeCountries: 'Active countries',
    },
    sentinel: {
      shown: 'shown',
      loading: 'Loading…',
      loadMore: 'Load more',
    },
    footer: {
      by: 'By',
      legal: 'Legal Notice',
      officialSource: 'Official source: laplanetebleue.com',
    },
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends object
    ? { readonly [K in keyof T]: Widen<T[K]> }
    : T;

export type TranslationDict = Widen<(typeof TRANSLATIONS)['fr']>;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: TranslationDict;
  formatNum: (n: number | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'lpb_lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      return saved === 'en' ? 'en' : 'fr';
    } catch {
      return 'fr';
    }
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'fr' ? 'en' : 'fr';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  }, []);

  const t: TranslationDict = TRANSLATIONS[lang];

  const formatNum = useCallback(
    (n: number | null | undefined) => {
      if (n === null || n === undefined) return '0';
      return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(n);
    },
    [lang]
  );

  // Sync <html lang>, document.title, canonical URL, and OpenGraph/Twitter meta tags
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.seo.title;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) el.content = content;
    };

    setMeta('meta[name="description"]', t.seo.description);
    setMeta('meta[property="og:title"]', t.seo.title);
    setMeta('meta[property="og:description"]', t.seo.description);
    setMeta('meta[property="og:locale"]', lang === 'en' ? 'en_US' : 'fr_FR');
    setMeta('meta[name="twitter:title"]', t.seo.title);
    setMeta('meta[name="twitter:description"]', t.seo.description);

    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalUrl;

    const absoluteOgImage = `${window.location.origin}/src/assets/images/og_share_planet_1795456375233.jpg`;
    setMeta('meta[property="og:image"]', absoluteOgImage);
    setMeta('meta[name="twitter:image"]', absoluteOgImage);
  }, [lang, t]);

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t, formatNum }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
