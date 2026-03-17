import SequenceBuilderClient from './SequenceBuilderClient';

export default async function SequenceDetailPage({
  params,
}: {
  params: { sequenceId: string };
}) {
  const { sequenceId } = await params;

  return <SequenceBuilderClient sequenceId={sequenceId} />;
}
