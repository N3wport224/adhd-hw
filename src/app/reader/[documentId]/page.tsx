import { ReaderView } from "@/components/reader/ReaderView";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  return <ReaderView documentId={documentId} />;
}
