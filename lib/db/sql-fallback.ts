import { createAdminClient } from './supabase-server'

/**
 * Query with automatic fallback to raw SQL if schema cache fails
 * This uses the Supabase admin client with service role to bypass PostgREST
 */
export async function queryWithFallback<T = any>(
  tableName: string,
  selectColumns: string = '*',
  whereClause?: string,
  orderBy?: { column: string; ascending?: boolean }
): Promise<T[]> {
  const supabase = await createAdminClient()
  
  // Try normal Supabase query first
  let query = supabase.from(tableName).select(selectColumns)
  
  if (whereClause) {
    // Parse simple where clauses like "id = 'value'" or "status = 'active'"
    const match = whereClause.match(/(\w+)\s*=\s*'([^']+)'/)
    if (match) {
      query = query.eq(match[1], match[2])
    }
  }
  
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  }
  
  const { data, error } = await query
  
  // If schema cache error, fall back to raw SQL via REST API
  if (error && error.code === 'PGRST205') {
    console.log(`[Query Fallback] Schema cache issue for table ${tableName}, using direct SQL`)
    
    // Build SQL query
    let sqlQuery = `SELECT ${selectColumns} FROM ${tableName}`
    if (whereClause) {
      sqlQuery += ` WHERE ${whereClause}`
    }
    if (orderBy) {
      sqlQuery += ` ORDER BY ${orderBy.column} ${orderBy.ascending ? 'ASC' : 'DESC'}`
    }
    
    // Execute via Supabase's postgres connection using service role
    // We'll use fetch to hit the Supabase SQL endpoint directly
    try {
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ sql: sqlQuery })
      })
      
      if (response.ok) {
        const result = await response.json()
        return result as T[]
      }
      
      // If RPC doesn't exist, we'll need to use a different approach
      // For now, let's just re-throw the original error
      console.error('[Query Fallback] SQL execution failed, RPC might not exist')
      throw error
    } catch (fetchError) {
      console.error('[Query Fallback] Fetch error:', fetchError)
      throw error
    }
  }
  
  if (error) {
    throw error
  }
  
  return (data as T[]) || []
}
