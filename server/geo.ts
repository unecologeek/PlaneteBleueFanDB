import { db, normalizeText } from './db.ts';

export interface GeoCountryMeta {
  isoId: string;
  nameFr: string;
  lat: number;
  lng: number;
}

const COUNTRY_CATALOG: GeoCountryMeta[] = [
  { isoId: '250', nameFr: 'France', lat: 46.6, lng: 2.3 },
  { isoId: '826', nameFr: 'Royaume-Uni', lat: 54.0, lng: -2.0 },
  { isoId: '840', nameFr: 'États-Unis', lat: 39.8, lng: -98.6 },
  { isoId: '276', nameFr: 'Allemagne', lat: 51.2, lng: 10.4 },
  { isoId: '756', nameFr: 'Suisse', lat: 46.8, lng: 8.2 },
  { isoId: '578', nameFr: 'Norvège', lat: 64.5, lng: 17.0 },
  { isoId: '392', nameFr: 'Japon', lat: 36.2, lng: 138.3 },
  { isoId: '076', nameFr: 'Brésil', lat: -14.2, lng: -51.9 },
  { isoId: '466', nameFr: 'Mali', lat: 17.6, lng: -4.0 },
  { isoId: '752', nameFr: 'Suède', lat: 62.0, lng: 15.0 },
  { isoId: '012', nameFr: 'Algérie', lat: 28.0, lng: 1.7 },
  { isoId: '208', nameFr: 'Danemark', lat: 56.3, lng: 9.5 },
  { isoId: '124', nameFr: 'Canada', lat: 56.1, lng: -106.3 },
  { isoId: '036', nameFr: 'Australie', lat: -25.3, lng: 133.8 },
  { isoId: '566', nameFr: 'Nigeria', lat: 9.1, lng: 8.7 },
  { isoId: '788', nameFr: 'Tunisie', lat: 33.9, lng: 9.5 },
  { isoId: '380', nameFr: 'Italie', lat: 41.9, lng: 12.6 },
  { isoId: '643', nameFr: 'Russie', lat: 61.5, lng: 95.0 },
  { isoId: '686', nameFr: 'Sénégal', lat: 14.5, lng: -14.5 },
  { isoId: '818', nameFr: 'Égypte', lat: 26.8, lng: 30.8 },
  { isoId: '032', nameFr: 'Argentine', lat: -38.4, lng: -63.6 },
  { isoId: '275', nameFr: 'Palestine', lat: 31.9, lng: 35.2 },
  { isoId: '156', nameFr: 'Chine', lat: 35.9, lng: 104.2 },
  { isoId: '484', nameFr: 'Mexique', lat: 23.6, lng: -102.6 },
  { isoId: '040', nameFr: 'Autriche', lat: 47.5, lng: 14.6 },
  { isoId: '616', nameFr: 'Pologne', lat: 51.9, lng: 19.1 },
  { isoId: '120', nameFr: 'Cameroun', lat: 7.4, lng: 12.4 },
  { isoId: '356', nameFr: 'Inde', lat: 20.6, lng: 79.0 },
  { isoId: '300', nameFr: 'Grèce', lat: 39.1, lng: 21.8 },
  { isoId: '688', nameFr: 'Serbie', lat: 44.0, lng: 21.0 },
  { isoId: '352', nameFr: 'Islande', lat: 65.0, lng: -19.0 },
  { isoId: '710', nameFr: 'Afrique du Sud', lat: -30.6, lng: 22.9 },
  { isoId: '528', nameFr: 'Pays-Bas', lat: 52.1, lng: 5.3 },
  { isoId: '372', nameFr: 'Irlande', lat: 53.4, lng: -8.2 },
  { isoId: '504', nameFr: 'Maroc', lat: 31.8, lng: -7.1 },
  { isoId: '422', nameFr: 'Liban', lat: 33.9, lng: 35.9 },
  { isoId: '056', nameFr: 'Belgique', lat: 50.5, lng: 4.5 },
  { isoId: '218', nameFr: 'Équateur', lat: -1.8, lng: -78.2 },
  { isoId: '724', nameFr: 'Espagne', lat: 40.5, lng: -3.7 },
  { isoId: '388', nameFr: 'Jamaïque', lat: 18.1, lng: -77.3 },
  { isoId: '246', nameFr: 'Finlande', lat: 61.9, lng: 25.7 },
  { isoId: '792', nameFr: 'Turquie', lat: 39.0, lng: 35.2 },
  { isoId: '562', nameFr: 'Niger', lat: 17.6, lng: 8.1 },
  { isoId: '620', nameFr: 'Portugal', lat: 39.4, lng: -8.2 },
  { isoId: '496', nameFr: 'Mongolie', lat: 46.9, lng: 103.8 },
  { isoId: '170', nameFr: 'Colombie', lat: 4.6, lng: -74.3 },
  { isoId: '704', nameFr: 'Viêt-Nam', lat: 14.1, lng: 108.3 },
  { isoId: '233', nameFr: 'Estonie', lat: 58.6, lng: 25.0 },
  { isoId: '642', nameFr: 'Roumanie', lat: 45.9, lng: 25.0 },
  { isoId: '554', nameFr: 'Nouvelle-Zélande', lat: -40.9, lng: 174.9 },
  { isoId: '384', nameFr: 'Côte d’Ivoire', lat: 7.5, lng: -5.5 },
  { isoId: '410', nameFr: 'Corée du Sud', lat: 35.9, lng: 127.8 },
  { isoId: '376', nameFr: 'Israël', lat: 31.0, lng: 34.9 },
  { isoId: '180', nameFr: 'RD Congo', lat: -4.0, lng: 21.8 },
  { isoId: '204', nameFr: 'Bénin', lat: 9.3, lng: 2.3 },
  { isoId: '192', nameFr: 'Cuba', lat: 21.5, lng: -77.8 },
  { isoId: '152', nameFr: 'Chili', lat: -35.7, lng: -71.5 },
  { isoId: '604', nameFr: 'Pérou', lat: -9.2, lng: -75.0 },
  { isoId: '804', nameFr: 'Ukraine', lat: 48.4, lng: 31.2 },
  { isoId: '203', nameFr: 'Tchéquie', lat: 49.8, lng: 15.5 },
  { isoId: '348', nameFr: 'Hongrie', lat: 47.2, lng: 19.5 },
  { isoId: '100', nameFr: 'Bulgarie', lat: 42.7, lng: 25.5 },
  { isoId: '364', nameFr: 'Iran', lat: 32.4, lng: 53.7 },
  { isoId: '368', nameFr: 'Irak', lat: 33.2, lng: 43.7 },
  { isoId: '760', nameFr: 'Syrie', lat: 34.8, lng: 39.0 },
  { isoId: '887', nameFr: 'Yémen', lat: 15.6, lng: 48.5 },
  { isoId: '231', nameFr: 'Éthiopie', lat: 9.1, lng: 40.5 },
  { isoId: '404', nameFr: 'Kenya', lat: -0.0, lng: 37.9 },
  { isoId: '288', nameFr: 'Ghana', lat: 7.9, lng: -1.0 },
  { isoId: '854', nameFr: 'Burkina Faso', lat: 12.2, lng: -1.6 },
  { isoId: '450', nameFr: 'Madagascar', lat: -18.8, lng: 46.9 },
  { isoId: '360', nameFr: 'Indonésie', lat: -0.8, lng: 113.9 },
  { isoId: '764', nameFr: 'Thaïlande', lat: 15.9, lng: 100.9 },
  { isoId: '458', nameFr: 'Malaisie', lat: 4.2, lng: 102.0 },
  { isoId: '608', nameFr: 'Philippines', lat: 12.9, lng: 121.8 },
  { isoId: '586', nameFr: 'Pakistan', lat: 30.4, lng: 69.3 },
  { isoId: '004', nameFr: 'Afghanistan', lat: 33.9, lng: 67.7 },
  { isoId: '434', nameFr: 'Libye', lat: 26.3, lng: 17.2 },
  { isoId: '729', nameFr: 'Soudan', lat: 12.9, lng: 30.2 },
  { isoId: '178', nameFr: 'Congo', lat: -0.2, lng: 15.8 },
  { isoId: '024', nameFr: 'Angola', lat: -11.2, lng: 17.9 },
  { isoId: '148', nameFr: 'Tchad', lat: 15.5, lng: 18.7 },
  { isoId: '478', nameFr: 'Mauritanie', lat: 21.0, lng: -10.9 },
  { isoId: '270', nameFr: 'Gambie', lat: 13.4, lng: -15.3 },
  { isoId: '324', nameFr: 'Guinée', lat: 9.9, lng: -9.7 },
  { isoId: '132', nameFr: 'Cap-Vert', lat: 16.0, lng: -24.0 },
  { isoId: '862', nameFr: 'Venezuela', lat: 6.4, lng: -66.6 },
  { isoId: '068', nameFr: 'Bolivie', lat: -16.3, lng: -63.6 },
  { isoId: '858', nameFr: 'Uruguay', lat: -32.5, lng: -55.8 },
  { isoId: '600', nameFr: 'Paraguay', lat: -23.4, lng: -58.4 },
  { isoId: '332', nameFr: 'Haïti', lat: 19.0, lng: -72.3 },
  { isoId: '214', nameFr: 'Rép. Dominicaine', lat: 18.7, lng: -70.2 },
  { isoId: '630', nameFr: 'Porto Rico', lat: 18.2, lng: -66.6 },
  { isoId: '304', nameFr: 'Groenland', lat: 71.7, lng: -42.6 },
  { isoId: '191', nameFr: 'Croatie', lat: 45.1, lng: 15.2 },
  { isoId: '070', nameFr: 'Bosnie-Herzégovine', lat: 43.9, lng: 17.7 },
  { isoId: '705', nameFr: 'Slovénie', lat: 46.2, lng: 15.0 },
  { isoId: '703', nameFr: 'Slovaquie', lat: 48.7, lng: 19.7 },
  { isoId: '440', nameFr: 'Lituanie', lat: 55.2, lng: 23.9 },
  { isoId: '428', nameFr: 'Lettonie', lat: 56.9, lng: 24.6 },
  { isoId: '112', nameFr: 'Biélorussie', lat: 53.7, lng: 28.0 },
  { isoId: '268', nameFr: 'Géorgie', lat: 42.3, lng: 43.4 },
  { isoId: '051', nameFr: 'Arménie', lat: 40.1, lng: 45.0 },
  { isoId: '031', nameFr: 'Azerbaïdjan', lat: 40.1, lng: 47.6 },
  { isoId: '398', nameFr: 'Kazakhstan', lat: 48.0, lng: 66.9 },
  { isoId: '860', nameFr: 'Ouzbékistan', lat: 41.4, lng: 64.6 },
  { isoId: '116', nameFr: 'Cambodge', lat: 12.6, lng: 105.0 },
  { isoId: '418', nameFr: 'Laos', lat: 19.9, lng: 102.5 },
  { isoId: '104', nameFr: 'Myanmar', lat: 21.9, lng: 96.0 },
  { isoId: '524', nameFr: 'Népal', lat: 28.4, lng: 84.1 },
  { isoId: '144', nameFr: 'Sri Lanka', lat: 7.9, lng: 80.8 },
  { isoId: '682', nameFr: 'Arabie saoudite', lat: 23.9, lng: 45.1 },
  { isoId: '784', nameFr: 'Émirats arabes unis', lat: 23.4, lng: 53.8 },
  { isoId: '400', nameFr: 'Jordanie', lat: 30.6, lng: 36.2 },
  { isoId: '800', nameFr: 'Ouganda', lat: 1.4, lng: 32.3 },
  { isoId: '834', nameFr: 'Tanzanie', lat: -6.4, lng: 34.9 },
  { isoId: '508', nameFr: 'Mozambique', lat: -18.7, lng: 35.5 },
  { isoId: '716', nameFr: 'Zimbabwe', lat: -19.0, lng: 29.2 },
  { isoId: '894', nameFr: 'Zambie', lat: -13.1, lng: 27.8 },
  { isoId: '516', nameFr: 'Namibie', lat: -23.0, lng: 18.5 },
  { isoId: '072', nameFr: 'Botswana', lat: -22.3, lng: 24.7 },
  { isoId: '646', nameFr: 'Rwanda', lat: -1.9, lng: 29.9 },
  { isoId: '768', nameFr: 'Togo', lat: 8.6, lng: 0.8 },
  { isoId: '266', nameFr: 'Gabon', lat: -0.8, lng: 11.6 },
  { isoId: '706', nameFr: 'Somalie', lat: 5.2, lng: 46.2 },
  { isoId: '232', nameFr: 'Érythrée', lat: 15.2, lng: 39.8 },
  { isoId: '442', nameFr: 'Luxembourg', lat: 49.8, lng: 6.1 },
  { isoId: '008', nameFr: 'Albanie', lat: 41.2, lng: 20.2 },
  { isoId: '807', nameFr: 'Macédoine du Nord', lat: 41.6, lng: 21.7 },
  { isoId: '158', nameFr: 'Taïwan', lat: 23.7, lng: 121.0 },
  { isoId: '140', nameFr: 'Centrafrique', lat: 6.6, lng: 20.9 },
  { isoId: '454', nameFr: 'Malawi', lat: -13.3, lng: 34.3 },
  { isoId: '108', nameFr: 'Burundi', lat: -3.4, lng: 29.9 },
  { isoId: '417', nameFr: 'Kirghizstan', lat: 41.2, lng: 74.8 },
  { isoId: '340', nameFr: 'Honduras', lat: 15.2, lng: -86.2 },
  { isoId: '188', nameFr: 'Costa Rica', lat: 9.7, lng: -83.8 },
  { isoId: '084', nameFr: 'Belize', lat: 17.2, lng: -88.5 },
  { isoId: '320', nameFr: 'Guatemala', lat: 15.8, lng: -90.2 },
  { isoId: '090', nameFr: 'Îles Salomon', lat: -9.6, lng: 160.2 },
  { isoId: '548', nameFr: 'Vanuatu', lat: -15.4, lng: 166.9 },
  { isoId: '540', nameFr: 'Nouvelle-Calédonie', lat: -21.1, lng: 165.6 },
  { isoId: '430', nameFr: 'Libéria', lat: 6.4, lng: -9.4 },
  { isoId: '732', nameFr: 'Sahara occidental', lat: 24.2, lng: -12.9 },
  { isoId: '780', nameFr: 'Trinité-et-Tobago', lat: 10.7, lng: -61.2 },
  { isoId: '196', nameFr: 'Chypre', lat: 35.1, lng: 33.4 },
  { isoId: '242', nameFr: 'Fidji', lat: -17.7, lng: 178.1 },
  { isoId: '328', nameFr: 'Guyana', lat: 4.9, lng: -58.9 },
  { isoId: '598', nameFr: 'Papouasie-Nlle-Guinée', lat: -6.3, lng: 143.9 },
  { isoId: '174', nameFr: 'Comores', lat: -11.6, lng: 43.3 },
  { isoId: '470', nameFr: 'Malte', lat: 35.9, lng: 14.4 },
  { isoId: '480', nameFr: 'Île Maurice', lat: -20.3, lng: 57.6 },
  { isoId: '702', nameFr: 'Singapour', lat: 1.35, lng: 103.8 },
  { isoId: '258', nameFr: 'Polynésie française', lat: -17.7, lng: -149.4 },
  { isoId: '638', nameFr: 'La Réunion', lat: -21.1, lng: 55.5 },
  { isoId: '312', nameFr: 'Guadeloupe', lat: 16.3, lng: -61.5 },
  { isoId: '254', nameFr: 'Guyane', lat: 3.9, lng: -53.1 },
  { isoId: '634', nameFr: 'Qatar', lat: 25.3, lng: 51.2 },
  { isoId: '512', nameFr: 'Oman', lat: 21.5, lng: 55.9 },
];

const BY_ISO = new Map<string, GeoCountryMeta>(COUNTRY_CATALOG.map((c) => [c.isoId, c]));

const TOKEN_TO_ISO: Record<string, string> = {
  france: '250',
  paris: '250',
  lyon: '250',
  marseille: '250',
  grenoble: '250',
  montpellier: '250',
  nice: '250',
  bretagne: '250',
  corse: '250',
  toulouse: '250',
  nantes: '250',
  strasbourg: '250',
  bordeaux: '250',
  lille: '250',
  rennes: '250',
  uk: '826',
  'u k': '826',
  'royaume uni': '826',
  angleterre: '826',
  ecosse: '826',
  scotland: '826',
  wales: '826',
  'pays de galles': '826',
  londres: '826',
  london: '826',
  bristol: '826',
  manchester: '826',
  brighton: '826',
  nottingham: '826',
  sheffield: '826',
  leeds: '826',
  edimbourg: '826',
  glasgow: '826',
  liverpool: '826',
  birmingham: '826',
  usa: '840',
  'u s a': '840',
  'etats unis': '840',
  etatsunis: '840',
  'new york': '840',
  californie: '840',
  california: '840',
  'los angeles': '840',
  'san francisco': '840',
  chicago: '840',
  detroit: '840',
  seattle: '840',
  minneapolis: '840',
  louisiane: '840',
  texas: '840',
  floride: '840',
  miami: '840',
  boston: '840',
  philadelphie: '840',
  austin: '840',
  portland: '840',
  hawaii: '840',
  cherokee: '840',
  navajo: '840',
  allemagne: '276',
  germany: '276',
  berlin: '276',
  cologne: '276',
  koln: '276',
  dusseldorf: '276',
  munich: '276',
  hambourg: '276',
  francfort: '276',
  stuttgart: '276',
  suisse: '756',
  switzerland: '756',
  geneve: '756',
  zurich: '756',
  lausanne: '756',
  bale: '756',
  berne: '756',
  norvege: '578',
  norway: '578',
  oslo: '578',
  bergen: '578',
  tromso: '578',
  japon: '392',
  japan: '392',
  tokyo: '392',
  osaka: '392',
  kyoto: '392',
  bresil: '076',
  brazil: '076',
  'sao paulo': '076',
  rio: '076',
  'rio de janeiro': '076',
  mali: '466',
  bamako: '466',
  suede: '752',
  sweden: '752',
  stockholm: '752',
  goteborg: '752',
  gothenburg: '752',
  algerie: '012',
  algeria: '012',
  alger: '012',
  oran: '012',
  danemark: '208',
  denmark: '208',
  copenhague: '208',
  canada: '124',
  montreal: '124',
  toronto: '124',
  vancouver: '124',
  quebec: '124',
  australie: '036',
  australia: '036',
  melbourne: '036',
  sydney: '036',
  nigeria: '566',
  lagos: '566',
  tunisie: '788',
  tunis: '788',
  italie: '380',
  italy: '380',
  rome: '380',
  milan: '380',
  turin: '380',
  naples: '380',
  russie: '643',
  russia: '643',
  moscou: '643',
  'saint petersbourg': '643',
  senegal: '686',
  dakar: '686',
  egypte: '818',
  egypt: '818',
  'le caire': '818',
  argentine: '032',
  argentina: '032',
  'buenos aires': '032',
  palestine: '275',
  gaza: '275',
  ramallah: '275',
  chine: '156',
  china: '156',
  pekin: '156',
  beijing: '156',
  shanghai: '156',
  tibet: '156',
  'hong kong': '156',
  mexique: '484',
  mexico: '484',
  autriche: '040',
  austria: '040',
  vienne: '040',
  pologne: '616',
  poland: '616',
  varsovie: '616',
  cameroun: '120',
  cameroon: '120',
  inde: '356',
  india: '356',
  mumbai: '356',
  delhi: '356',
  grece: '300',
  greece: '300',
  athenes: '300',
  serbie: '688',
  serbia: '688',
  belgrade: '688',
  islande: '352',
  iceland: '352',
  reykjavik: '352',
  'afrique du sud': '710',
  'south africa': '710',
  johannesburg: '710',
  'pays bas': '528',
  hollande: '528',
  amsterdam: '528',
  rotterdam: '528',
  irlande: '372',
  ireland: '372',
  dublin: '372',
  maroc: '504',
  morocco: '504',
  casablanca: '504',
  marrakech: '504',
  liban: '422',
  lebanon: '422',
  beyrouth: '422',
  belgique: '056',
  belgium: '056',
  bruxelles: '056',
  anvers: '056',
  gand: '056',
  equateur: '218',
  ecuador: '218',
  espagne: '724',
  spain: '724',
  madrid: '724',
  barcelone: '724',
  jamaique: '388',
  jamaica: '388',
  kingston: '388',
  finlande: '246',
  finland: '246',
  helsinki: '246',
  turquie: '792',
  turkey: '792',
  istanbul: '792',
  niger: '562',
  portugal: '620',
  lisbonne: '620',
  mongolie: '496',
  mongolia: '496',
  colombie: '170',
  colombia: '170',
  bogota: '170',
  'viet nam': '704',
  vietnam: '704',
  estonie: '233',
  estonia: '233',
  roumanie: '642',
  romania: '642',
  'nouvelle zelande': '554',
  'new zealand': '554',
  "cote d'ivoire": '384',
  'cote divoire': '384',
  abidjan: '384',
  coree: '410',
  'coree du sud': '410',
  seoul: '410',
  israel: '376',
  'tel aviv': '376',
  'congo kinshasa': '180',
  rdc: '180',
  'rep dem congo': '180',
  kinshasa: '180',
  benin: '204',
  cuba: '192',
  'la havane': '192',
  chili: '152',
  chile: '152',
  perou: '604',
  peru: '604',
  ukraine: '804',
  kiev: '804',
  kyiv: '804',
  tchequie: '203',
  'republique tcheque': '203',
  prague: '203',
  hongrie: '348',
  hungary: '348',
  budapest: '348',
  bulgarie: '100',
  iran: '364',
  teheran: '364',
  irak: '368',
  iraq: '368',
  syrie: '760',
  yemen: '887',
  ethiopie: '231',
  kenya: '404',
  ghana: '288',
  'burkina faso': '854',
  madagascar: '450',
  indonesie: '360',
  thailande: '764',
  malaisie: '458',
  philippines: '608',
  pakistan: '586',
  afghanistan: '004',
  libye: '434',
  soudan: '729',
  congo: '178',
  angola: '024',
  tchad: '148',
  mauritanie: '478',
  gambie: '270',
  guinee: '324',
  'cap vert': '132',
  venezuela: '862',
  bolivie: '068',
  uruguay: '858',
  paraguay: '600',
  haiti: '332',
  'rep dominicaine': '214',
  'republique dominicaine': '214',
  'porto rico': '630',
  groenland: '304',
  croatie: '191',
  bosnie: '070',
  slovenie: '705',
  slovaquie: '703',
  lituanie: '440',
  lettonie: '428',
  bielorussie: '112',
  georgie: '268',
  armenie: '051',
  azerbaidjan: '031',
  kazakhstan: '398',
  ouzbekistan: '860',
  cambodge: '116',
  laos: '418',
  myanmar: '104',
  birmanie: '104',
  nepal: '524',
  'sri lanka': '144',
  'arabie saoudite': '682',
  'emirats arabes unis': '784',
  dubai: '784',
  jordanie: '400',
  ouganda: '800',
  tanzanie: '834',
  mozambique: '508',
  zimbabwe: '716',
  zambie: '894',
  namibie: '516',
  botswana: '072',
  rwanda: '646',
  togo: '768',
  gabon: '266',
  somalie: '706',
  erythree: '232',
  luxembourg: '442',
  albanie: '008',
  macedoine: '807',
  taiwan: '158',
  centrafrique: '140',
  'republique centrafricaine': '140',
  malawi: '454',
  burundi: '108',
  kirghizstan: '417',
  honduras: '340',
  'costa rica': '188',
  belize: '084',
  guatemala: '320',
  'iles salomon': '090',
  vanuatu: '548',
  'nouvelle caledonie': '540',
  liberia: '430',
  'ouest sahara': '732',
  'sahara occidental': '732',
  tobago: '780',
  'trinite et tobago': '780',
  chypre: '196',
  fidji: '242',
  guyana: '328',
  'papouasie nouvelle guinee': '598',
  comores: '174',
  commores: '174',
  mayotte: '174',
  malte: '470',
  maurice: '480',
  'ile maurice': '480',
  singapour: '702',
  tahiti: '258',
  'polynesie francaise': '258',
  'la reunion': '638',
  reunion: '638',
  guadeloupe: '312',
  'marie galante': '312',
  guyane: '254',
  qatar: '634',
  oman: '512',
  tuva: '643',
  touva: '643',
  siberie: '643',
  hokkaido: '392',
  'ile de paques': '152',
  'iles feroe': '208',
  laponie: '246',
  zaire: '180',
  dahomey: '204',
  gece: '300',
  'ex yougoslavie': '688',
  sarajevo: '070',
  mostar: '070',
  kabylie: '012',
  touareg: '466',
  sahara: '012',
  'pays basque': '724',
  majorque: '724',
  'palma de majorque': '724',
  ibiza: '724',
  'rhone alpes': '250',
  'saint etienne': '250',
  bonifacio: '250',
  'e u': '840',
  e: '840',
  massachusetts: '840',
  arizona: '840',
  nevada: '840',
  minnesota: '840',
  tennessee: '840',
  pennsylvanie: '840',
  oregon: '840',
  nebraska: '840',
  missouri: '840',
  maryland: '840',
  illinois: '840',
  colorado: '840',
  'caroline du nord': '840',
  oklahoma: '840',
  comanche: '840',
  brooklyn: '840',
  ny: '840',
  hawai: '840',
  sioux: '840',
  lakota: '840',
  iroquois: '840',
  apache: '840',
  mississippi: '840',
  'peaux rouges': '840',
  nunavik: '124',
  nazareth: '275',
};

export function resolveCountryIsoIds(rawCountry: string | null | undefined): string[] {
  if (!rawCountry) return [];
  const parts = rawCountry
    .split(/[\/+,;&]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const ids = new Set<string>();
  for (const part of parts) {
    const norm = normalizeText(part).replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
    const normKeepApos = normalizeText(part);
    const direct = TOKEN_TO_ISO[normKeepApos] || TOKEN_TO_ISO[norm];
    if (direct) {
      ids.add(direct);
      continue;
    }
    // Try removing parentheticals or matching whole words
    const words = norm.split(' ');
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (TOKEN_TO_ISO[w]) {
        ids.add(TOKEN_TO_ISO[w]);
      }
      if (i + 1 < words.length) {
        const pair = `${w} ${words[i + 1]}`;
        if (TOKEN_TO_ISO[pair]) {
          ids.add(TOKEN_TO_ISO[pair]);
        }
      }
    }
  }
  return Array.from(ids);
}

function buildFtsQuery(raw: string): string | null {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((tok) => `"${tok}"*`).join(' AND ');
}

export interface GlobeTrackSample {
  id: number;
  title: string;
  author: string;
  duration_sec: number | null;
  preview_url: string | null;
  country: string | null;
  emission_number: number | null;
  emission_slug: string;
  broadcast_date_label: string | null;
  appearance_count: number;
}

export interface GlobeCountryBucket {
  isoId: string;
  nameFr: string;
  lat: number;
  lng: number;
  trackCount: number;
  playCount: number;
  topAuthors: string[];
  sampleTracks: GlobeTrackSample[];
}

export interface GlobeArc {
  fromIso: string;
  toIso: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  weight: number;
  kind?: 'collab' | 'playlist';
  emissions?: Array<{
    number: number | null;
    slug: string;
  }>;
}

export function queryGlobeData(params: {
  q?: string;
  year?: number | null;
  multiOnly?: boolean;
}) {
  const whereClauses: string[] = [];
  const havingClauses: string[] = [];
  const bind: Record<string, string | number> = {};

  const ftsExpr = params.q ? buildFtsQuery(params.q) : null;
  let joinFts = '';
  if (ftsExpr) {
    joinFts = `INNER JOIN tracks_fts fts ON fts.track_id = t.id`;
    whereClauses.push(`tracks_fts MATCH @ftsExpr`);
    bind.ftsExpr = ftsExpr;
  }

  if (params.year) {
    whereClauses.push(`e.year = @year`);
    bind.year = params.year;
  }

  if (params.multiOnly) {
    havingClauses.push(`COUNT(DISTINCT ta.emission_id) > 1 OR COUNT(ta.id) > 1`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const havingSql = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `
      SELECT
        t.id,
        t.title,
        t.author,
        t.duration_sec,
        t.preview_url,
        COALESCE(MAX(ta.country), t.country) AS country,
        COUNT(DISTINCT ta.emission_id) AS appearance_count,
        COUNT(ta.id) AS play_count,
        GROUP_CONCAT(DISTINCT e.id || '|' || COALESCE(CAST(e.number AS TEXT), '') || '|' || e.slug) AS emission_refs,
        MAX(e.number) AS latest_emission_number,
        (SELECT e2.slug FROM track_appearances ta2 INNER JOIN emissions e2 ON e2.id = ta2.emission_id WHERE ta2.track_id = t.id ORDER BY COALESCE(ta2.broadcast_date, '') DESC, e2.number DESC LIMIT 1) AS latest_emission_slug,
        (SELECT ta2.broadcast_date_label FROM track_appearances ta2 WHERE ta2.track_id = t.id ORDER BY COALESCE(ta2.broadcast_date, '') DESC LIMIT 1) AS latest_date_label
      FROM tracks t
      ${joinFts}
      INNER JOIN track_appearances ta ON ta.track_id = t.id
      INNER JOIN emissions e ON e.id = ta.emission_id
      ${whereSql}
      GROUP BY t.id
      ${havingSql}
      ORDER BY COALESCE(MAX(ta.broadcast_date), '') DESC, appearance_count DESC
    `
    )
    .all(bind) as Array<{
    id: number;
    title: string;
    author: string;
    duration_sec: number | null;
    preview_url: string | null;
    country: string | null;
    appearance_count: number;
    play_count: number;
    emission_refs: string | null;
    latest_emission_number: number | null;
    latest_emission_slug: string;
    latest_date_label: string | null;
  }>;

  const buckets = new Map<
    string,
    {
      meta: GeoCountryMeta;
      trackCount: number;
      playCount: number;
      authorCounts: Map<string, number>;
      sampleTracks: GlobeTrackSample[];
    }
  >();

  const emissionCountries = new Map<string, Set<string>>();
  const emissionMeta = new Map<string, { number: number | null; slug: string }>();

  for (const row of rows) {
    const isoIds = resolveCountryIsoIds(row.country);
    if (isoIds.length === 0) continue;

    for (const isoId of isoIds) {
      const meta = BY_ISO.get(isoId);
      if (!meta) continue;
      let b = buckets.get(isoId);
      if (!b) {
        b = {
          meta,
          trackCount: 0,
          playCount: 0,
          authorCounts: new Map<string, number>(),
          sampleTracks: [],
        };
        buckets.set(isoId, b);
      }
      b.trackCount += 1;
      b.playCount += row.play_count;
      b.authorCounts.set(row.author, (b.authorCounts.get(row.author) ?? 0) + row.play_count);
      if (b.sampleTracks.length < 30) {
        b.sampleTracks.push({
          id: row.id,
          title: row.title,
          author: row.author,
          duration_sec: row.duration_sec,
          preview_url: row.preview_url,
          country: row.country,
          emission_number: row.latest_emission_number,
          emission_slug: row.latest_emission_slug,
          broadcast_date_label: row.latest_date_label,
          appearance_count: row.appearance_count,
        });
      }
    }

    if (row.emission_refs) {
      const refs = row.emission_refs.split(',');
      for (const ref of refs) {
        if (!ref) continue;
        const [emId, numStr, slug] = ref.split('|');
        if (!emId || !slug) continue;
        if (!emissionMeta.has(emId)) {
          emissionMeta.set(emId, {
            number: numStr ? Number(numStr) : null,
            slug,
          });
        }
        let set = emissionCountries.get(emId);
        if (!set) {
          set = new Set<string>();
          emissionCountries.set(emId, set);
        }
        for (const isoId of isoIds) {
          if (BY_ISO.has(isoId)) set.add(isoId);
        }
      }
    }
  }

  // Build balanced global musical network linking countries that appeared in the same emission
  const coEmissionScore = new Map<string, number>();
  const pairEmissions = new Map<string, Map<string, { number: number | null; slug: string }>>();

  emissionCountries.forEach((set, emId) => {
    if (set.size < 2 || set.size > 32) return;
    const emInfo = emissionMeta.get(emId);
    if (!emInfo) return;
    const arr = Array.from(set).sort();
    const stepScore = 1 / Math.sqrt(arr.length);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}::${arr[j]}`;
        coEmissionScore.set(key, (coEmissionScore.get(key) ?? 0) + stepScore);
        let pMap = pairEmissions.get(key);
        if (!pMap) {
          pMap = new Map();
          pairEmissions.set(key, pMap);
        }
        pMap.set(emId, emInfo);
      }
    }
  });

  const scoredPairs: Array<{
    key: string;
    fromIso: string;
    toIso: string;
    affinity: number;
    weight: number;
    emissions: Array<{ number: number | null; slug: string }>;
  }> = [];

  pairEmissions.forEach((emMap, key) => {
    const [fromIso, toIso] = key.split('::');
    const bA = buckets.get(fromIso);
    const bB = buckets.get(toIso);
    if (!bA || !bB) return;
    const rawScore = coEmissionScore.get(key) ?? emMap.size;
    // Cosine / Ochiai normalization keeps giant hubs (France, UK, USA) from monopolizing links
    const affinity = rawScore / Math.sqrt((bA.trackCount + 4) * (bB.trackCount + 4));
    const sortedEmissions = Array.from(emMap.values()).sort(
      (a, b) => (b.number ?? 0) - (a.number ?? 0)
    );
    scoredPairs.push({
      key,
      fromIso,
      toIso,
      affinity,
      weight: emMap.size,
      emissions: sortedEmissions.slice(0, 12),
    });
  });

  scoredPairs.sort((a, b) => b.affinity - a.affinity);

  const degree = new Map<string, number>();
  const selectedKeys = new Set<string>();
  const selectedPairs: typeof scoredPairs = [];
  const MAX_DEGREE = 4;
  const MAX_EDGES = 135;

  // Pass 1: ensure wide geographic coverage so active countries link via shared emissions
  for (const edge of scoredPairs) {
    if (selectedPairs.length >= MAX_EDGES) break;
    const dA = degree.get(edge.fromIso) ?? 0;
    const dB = degree.get(edge.toIso) ?? 0;
    if ((dA < 2 || dB < 2) && dA < MAX_DEGREE && dB < MAX_DEGREE) {
      selectedKeys.add(edge.key);
      selectedPairs.push(edge);
      degree.set(edge.fromIso, dA + 1);
      degree.set(edge.toIso, dB + 1);
    }
  }

  // Pass 2: fill remaining network density respecting degree cap
  for (const edge of scoredPairs) {
    if (selectedPairs.length >= MAX_EDGES) break;
    if (selectedKeys.has(edge.key)) continue;
    const dA = degree.get(edge.fromIso) ?? 0;
    const dB = degree.get(edge.toIso) ?? 0;
    if (dA < MAX_DEGREE && dB < MAX_DEGREE) {
      selectedKeys.add(edge.key);
      selectedPairs.push(edge);
      degree.set(edge.fromIso, dA + 1);
      degree.set(edge.toIso, dB + 1);
    }
  }

  const countries: GlobeCountryBucket[] = Array.from(buckets.values())
    .map((b) => ({
      isoId: b.meta.isoId,
      nameFr: b.meta.nameFr,
      lat: b.meta.lat,
      lng: b.meta.lng,
      trackCount: b.trackCount,
      playCount: b.playCount,
      topAuthors: Array.from(b.authorCounts.entries())
        .sort((a, c) => c[1] - a[1])
        .slice(0, 4)
        .map(([author]) => author),
      sampleTracks: b.sampleTracks,
    }))
    .sort((a, b) => b.trackCount - a.trackCount);

  const arcs: GlobeArc[] = selectedPairs
    .map((edge) => {
      const fromMeta = BY_ISO.get(edge.fromIso)!;
      const toMeta = BY_ISO.get(edge.toIso)!;
      return {
        fromIso: edge.fromIso,
        toIso: edge.toIso,
        fromLat: fromMeta.lat,
        fromLng: fromMeta.lng,
        toLat: toMeta.lat,
        toLng: toMeta.lng,
        weight: edge.weight,
        kind: 'playlist' as const,
        emissions: edge.emissions,
      };
    })
    .filter((a) => a.fromIso && a.toIso);

  return {
    countries,
    arcs,
    matchedTracksCount: rows.length,
    matchedCountriesCount: countries.length,
    catalog: COUNTRY_CATALOG,
  };
}

export function resolveMatchingCountryStrings(countryQuery: string): string[] | null {
  const normQuery = normalizeText(countryQuery);
  if (!normQuery) return null;

  const matchedCatalog = COUNTRY_CATALOG.find((c) => normalizeText(c.nameFr) === normQuery);
  if (!matchedCatalog) return null;

  const distinctRows = db
    .prepare(
      `SELECT DISTINCT country FROM tracks WHERE country IS NOT NULL AND TRIM(country) != ''`
    )
    .all() as Array<{ country: string }>;

  const matchedStrings: string[] = [];
  for (const row of distinctRows) {
    const ids = resolveCountryIsoIds(row.country);
    if (ids.includes(matchedCatalog.isoId)) {
      matchedStrings.push(row.country);
    }
  }
  return matchedStrings;
}

