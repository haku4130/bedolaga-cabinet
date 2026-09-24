import NewsSection from '@/components/news/NewsSection';

/** Лента новостей. Раньше жила только на главной; теперь — пункт раздела «Ещё». */
export default function News() {
  return (
    <div className="mx-auto max-w-xl">
      <NewsSection />
    </div>
  );
}
