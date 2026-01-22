import DynamicTable from '@/components/dynamic/dynamicTable'
import { serverFetch } from '@/lib/server/server-fetch'
import { resolveRelations } from '@/lib/resolveRelation'
import { cookies } from 'next/headers'

export type Sequence = {
  id: string
  name: string
  is_active: boolean
}

export type SequenceStep = {
  id: string
  sequence_id: string
  step_number: string
  delay_days: number
}

export default async function SequenceDetailPage({
  params,
}: {
  params: { sequenceId: string }
}) {
  const { sequenceId } = await params

  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value

  console.log('sequenceId:', sequenceId)

  // ✅ Fetch parent sequence
  const sequence = (
    await serverFetch<Sequence[]>(
      `/crud/sequences?id=${sequenceId}`
    )
  )[0]

  // ✅ Fetch steps scoped to sequence
  const steps = await serverFetch<SequenceStep[]>(
    `/crud/sequence_steps?sequence_id=${sequenceId}`
  )

  // ✅ Resolve relations for dynamic table
  const relations = await resolveRelations('sequence_steps')

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold">
          {sequence?.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sequence steps
        </p>
      </div>

      {/* META */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          Status:{' '}
          <span className="font-medium">
            {sequence?.is_active ? 'Active' : 'Disabled'}
          </span>
        </div>
        <div>
          Total steps:{' '}
          <span className="font-medium">
            {steps.length}
          </span>
        </div>
      </div>

      {/* ✅ DYNAMIC TABLE */}
      <DynamicTable
        table="sequence_steps"
        data={steps}
        role={role}
        relations={relations}
        defaultValues={{
          sequence_id: sequenceId,
        }}
      />
    </div>
  )
}
