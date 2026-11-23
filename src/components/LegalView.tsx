import { ExternalLink, Globe, Heart, Music, Radio, ShieldCheck, User } from 'lucide-react';
import { useI18n } from '../i18n';

interface LegalViewProps {
  onNavigate: (tab: 'tracks' | 'stats' | 'globe') => void;
}

export function LegalView({ onNavigate }: LegalViewProps) {
  const { t } = useI18n();

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Main Creator & Fan Project Statement */}
      <article className="bg-[#FAF8F5] border border-[#DDD8D0] rounded-lg p-4 sm:p-8 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#030925] text-[#9ECAC2] flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-display font-semibold uppercase tracking-wider text-[#144980]">
              {t.legalView.kicker}
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#030925]">
              La Planète Bleue FanStats
            </h2>
          </div>
        </div>

        <div className="bg-[#ECE8E1]/65 border border-[#144980]/25 rounded-lg px-4 sm:px-5 py-4 space-y-3 text-sm sm:text-base text-[#030925] leading-relaxed">
          <p>
            {t.legalView.statementBeforeAuthor}
            <strong className="font-bold text-[#030925]">Fred Neau / un ecologeek</strong>
            {t.legalView.statementMiddle}
            <em className="italic font-semibold text-[#144980]">
              {t.legalView.statementQuote}
            </em>
            .
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <a
              href="https://laplanetebleue.com/fr/emissions"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-white text-[#144980] border border-[#DDD8D0] hover:border-[#144980] transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t.legalView.officialSiteBtn}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-2">
          <div className="bg-white border border-[#DDD8D0] rounded-lg p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#144980]">
              <Radio className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                {t.legalView.card1Title}
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              <strong>La Planète Bleue FanStats</strong> {t.legalView.card1Part1}
              <em>La Planète Bleue</em>
              {t.legalView.card1Part2}
              <strong>Yves Blanc</strong>
              {t.legalView.card1And}
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

          <div className="bg-white border border-[#DDD8D0] rounded-lg p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#144980]">
              <Music className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                {t.legalView.card2Title}
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              {t.legalView.card2Body}
            </p>
          </div>

          <div className="bg-white border border-[#DDD8D0] rounded-lg p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#144980]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                {t.legalView.card3Title}
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              {t.legalView.card3Body}
            </p>
          </div>

          <div className="bg-white border border-[#DDD8D0] rounded-lg p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#144980]">
              <User className="w-4 h-4 shrink-0" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#030925]">
                {t.legalView.card4Title}
              </h3>
            </div>
            <p className="text-sm text-[#030925]/80 leading-relaxed">
              {t.legalView.card4Body}
            </p>
            <div>
              <a
                href="https://www.linkedin.com/in/fredneau/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-[#030925] text-[#FAF8F5] hover:bg-[#144980] transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#9ECAC2]" />
                <span>{t.legalView.card4LinkedIn}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#9ECAC2]" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#DDD8D0] flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onNavigate('tracks')}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-[#030925] text-[#FAF8F5] hover:bg-[#144980] transition-colors"
          >
            {t.legalView.ctaTracks}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('stats')}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-white text-[#030925] border border-[#DDD8D0] hover:border-[#144980] transition-colors"
          >
            {t.legalView.ctaStats}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('globe')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-md bg-white text-[#144980] border border-[#DDD8D0] hover:border-[#144980] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t.legalView.ctaGlobe}</span>
          </button>
        </div>
      </article>
    </section>
  );
}
