import { ClientWorkspace } from "./client-workspace";

export default async function ClientWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientWorkspace clientId={id} />;
}
