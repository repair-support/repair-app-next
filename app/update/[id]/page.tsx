import PublicUpdateForm from "@/components/form/PublicUpdateForm";

export default async function UpdatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token = "" } = await searchParams;
  return <main className="p-4 sm:p-8"><PublicUpdateForm id={id} token={token} /></main>;
}
