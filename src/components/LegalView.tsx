import { ExternalLink, Globe, Heart, Music, Radio, ShieldCheck, User } from 'lucide-react';

interface LegalViewProps {
  onNavigate: (tab: 'tracks' | 'stats' | 'globe') => void;
}

export function LegalView({ onNavigate }: LegalViewProps) {
  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Main Creator & Fan Project Statement */}
      <article className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#030925] text-[#9ECAC2] flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-display font-semibold uppercase tracking-wider text-[#144980]">
              À propos du projet · Mentions légales
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#030925]">
              La Planète Bleue FanStats
            </h2>
          </div>
        </div>

        <div className="bg-[#ECE8E1]/65 border-l-4 border-[#144980] rounded-r-md px-5 py-4 space-y-3 text-sm sm:text-base text-[#030925] leading-relaxed">
          <p>
            Ce site a été conçu et développé par{' '}
            <strong className="font-bold text-[#030925]">Fred Neau / un ecologeek</strong>, en pur
            fan et pour mon propre plaisir, en espérant que ça plaira et permettra à plein de gens
            de découvrir{' '}
            <em className="italic font-semibold text-[#144980]">
              le meilleur podcast de l’univers connu
            </em>
            .
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <a
              href="https://laplanetebleue.com/fr/emissions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md bg-white text-[#144980] border border-[#DDD8D0] hover:border-[#144980] transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Site officiel de La Planète Bleue</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="bg-white border border-[#DDD8D0] rounded-lg p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#144980]">
              <Radio className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                Projet fan indépendant
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              <strong>La Planète Bleue FanStats</strong> est une archive analytique et exploratoire
              non officielle, sans aucun but lucratif ni publicitaire. L’émission{' '}
              <em>La Planète Bleue</em>, ses sélections musicales, son nom et ses textes éditoriaux
              restent la propriété exclusive d’<strong>Yves Blanc</strong> et de{' '}
              <a
                href="https://laplanetebleue.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#144980] font-semibold hover:underline"
              >
                laplanetebleue.com
              </a>
              .
            </p>
          </div>

          <div className="bg-white border border-[#DDD8D0] rounded-lg p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#144980]">
              <Music className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                Données, visuels &amp; extraits audio
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              Les playlists indexées proviennent des fiches publiques des émissions. Les durées
              manquantes et courts extraits audio de 30 secondes sont récupérés à des fins
              documentaires via les API publiques Deezer et Apple iTunes. Aucune illustration ou
              photographie soumise à des droits d’auteur n’est utilisée : tous les visuels orbitaux
              et le globe 3D sont générés procéduralement.
            </p>
          </div>

          <div className="bg-white border border-[#DDD8D0] rounded-lg p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#144980]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                Données personnelles &amp; cookies
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              Ce site ne requiert aucune création de compte, ne collecte aucune donnée personnelle,
              n’effectue aucun profilage et ne dépose aucun cookie publicitaire ou de suivi
              statistique tiers.
            </p>
          </div>

          <div className="bg-white border border-[#DDD8D0] rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#144980]">
              <User className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                Contact &amp; demandes
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              Pour toute remarque, suggestion d’amélioration ou demande concernant ce projet fan,
              vous pouvez contacter Fred Neau / un ecologeek directement sur LinkedIn :
            </p>
            <div>
              <a
                href="https://www.linkedin.com/in/fredneau/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#030925] text-[#FAF8F5] hover:bg-[#144980] transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#9ECAC2]" />
                <span>Profil LinkedIn de Fred Neau</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#9ECAC2]" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#DDD8D0] flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('tracks')}
            className="px-4 py-2 text-xs font-semibold rounded-md bg-[#030925] text-[#FAF8F5] hover:bg-[#144980] transition-colors"
          >
            Explorer la base des titres
          </button>
          <button
            type="button"
            onClick={() => onNavigate('stats')}
            className="px-4 py-2 text-xs font-semibold rounded-md bg-white text-[#030925] border border-[#DDD8D0] hover:border-[#144980] transition-colors"
          >
            Voir les statistiques
          </button>
          <button
            type="button"
            onClick={() => onNavigate('globe')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-white text-[#144980] border border-[#DDD8D0] hover:border-[#144980] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Ouvrir la Vue 3D</span>
          </button>
        </div>
      </article>
    </section>
  );
}
