import type { MemberIncome, MemberIncomePagination } from '~/types/income/memberIncome'

export function useAgencyMemberIncomeApi() {
  const { api, normalizeError } = useApi()

  async function fetchPage(cursor: string | null): Promise<{
    agencyName: string
    members: MemberIncome[]
    nextCursor: string | null
    hasMore: boolean
  }> {
    const params: Record<string, unknown> = { per_page: 20 }
    if (cursor) params.cursor = cursor

    const response = await api<{
      status: string
      data: {
        agency_id: number
        agency_name: string
        members: MemberIncome[]
      }
      meta: {
        pagination: MemberIncomePagination
      }
    }>('/user/agency/members/income', { params })

    return {
      agencyName: response.data.agency_name,
      members: response.data.members,
      nextCursor: response.meta.pagination.next_cursor ?? null,
      hasMore: response.meta.pagination.has_more,
    }
  }

  return { fetchPage, normalizeError }
}
