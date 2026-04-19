import { redirect } from 'next/navigation';

type Params = { id: string };

export default async function ResultsRedirect({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  redirect(`/lists/${id}`);
}
