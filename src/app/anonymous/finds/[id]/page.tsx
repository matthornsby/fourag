import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnonymousFindsPluralRedirect({ params }: PageProps) {
  const { id } = await params;
  permanentRedirect(`/anonymous/find/${id}`);
}
