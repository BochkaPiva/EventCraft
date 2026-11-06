import { ProposalEditor } from "../../../components/proposal-editor.tsx";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalEditor id={id} />;
}
