import NewsSection from '@/components/news/NewsSection';
import { WebBackButton } from '@/components/WebBackButton';

/** Лента новостей. Раньше жила только на главной; теперь — пункт раздела «Ещё». */
export default function News() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <WebBackButton to="/more" />
      <NewsSection />
    </div>
  );
}
