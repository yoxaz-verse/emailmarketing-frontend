import { NextResponse } from 'next/server'

export async function POST() {
  const res = await fetch(
    `${process.env.BACKEND_API_URL}/leads/validate`,
    { method: 'POST' }
  )

  const data = await res.json()
  return NextResponse.json(data)
}
