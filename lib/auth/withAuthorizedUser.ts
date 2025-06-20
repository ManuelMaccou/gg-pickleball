import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedUser } from './getAuthorizeduser'
import { ResolvedUser } from '@/app/types/databaseTypes'

type Handler = (req: NextRequest, user: ResolvedUser) => Promise<NextResponse>

export function withAuthorizedUser(handler: Handler) {
  return async function wrappedHandler(req: NextRequest): Promise<NextResponse> {
    const user = await getAuthorizedUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return handler(req, user)
  }
}
