type StockDetailPageProps = {
  params: Promise<{
    ticker: string;
  }>;
};

export default async function StockDetailPage({
  params,
}: StockDetailPageProps) {
  const { ticker } = await params;

  return <main className="p-6">{ticker.toUpperCase()}</main>;
}
