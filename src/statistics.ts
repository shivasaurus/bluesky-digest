import { Database } from './db'

export interface PostView {
  post_uri: string
  author_did: string
  viewer_did: string
  viewed_at: string
}

export interface DailyStats {
  user_did: string
  date: string
  total_posts_viewed: number
  followee_count: number
}

export interface PostAuthorStats {
  author_did: string
  viewer_did: string
  posts_viewed_today: number
  posts_viewed_this_week: number
  posts_viewed_this_month: number
  mahoot_number: number
}

/**
 * Track a post view for a user
 */
export async function trackPostView(
  db: Database,
  postUri: string,
  authorDid: string,
  viewerDid: string,
): Promise<void> {
  const now = new Date().toISOString()
  
  await db
    .insertInto('post_statistics')
    .values({
      post_uri: postUri,
      author_did: authorDid,
      viewer_did: viewerDid,
      viewed_at: now,
    })
    .onConflict((oc) => oc.doNothing()) // Prevent duplicate views
    .execute()
}

/**
 * Get posts viewed by a user today
 */
export async function getPostsViewedToday(
  db: Database,
  viewerDid: string,
): Promise<PostView[]> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  return await db
    .selectFrom('post_statistics')
    .selectAll()
    .where('viewer_did', '=', viewerDid)
    .where('viewed_at', '>=', `${today}T00:00:00.000Z`)
    .where('viewed_at', '<', `${today}T23:59:59.999Z`)
    .execute()
}

/**
 * Get posts viewed by a user in the last N days
 */
export async function getPostsViewedInLastDays(
  db: Database,
  viewerDid: string,
  days: number,
): Promise<PostView[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  
  return await db
    .selectFrom('post_statistics')
    .selectAll()
    .where('viewer_did', '=', viewerDid)
    .where('viewed_at', '>=', cutoffDate.toISOString())
    .execute()
}

/**
 * Get posts by a specific author viewed by a user in the last N days
 */
export async function getPostsByAuthorViewedInLastDays(
  db: Database,
  viewerDid: string,
  authorDid: string,
  days: number,
): Promise<PostView[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  
  return await db
    .selectFrom('post_statistics')
    .selectAll()
    .where('viewer_did', '=', viewerDid)
    .where('author_did', '=', authorDid)
    .where('viewed_at', '>=', cutoffDate.toISOString())
    .execute()
}

/**
 * Get daily statistics for a user
 */
export async function getDailyStats(
  db: Database,
  userDid: string,
  date: string,
): Promise<DailyStats | null> {
  return await db
    .selectFrom('daily_stats')
    .selectAll()
    .where('user_did', '=', userDid)
    .where('date', '=', date)
    .executeTakeFirst() || null
}

/**
 * Update or create daily statistics for a user
 */
export async function updateDailyStats(
  db: Database,
  userDid: string,
  date: string,
  totalPostsViewed: number,
  followeeCount: number,
): Promise<DailyStats> {
  const now = new Date().toISOString()
  
  try {
    await db
      .insertInto('daily_stats')
      .values({
        user_did: userDid,
        date: date,
        total_posts_viewed: totalPostsViewed,
        followee_count: followeeCount,
      })
      .execute()
  } catch (error) {
    // If insert fails due to unique constraint, update instead
    await db
      .updateTable('daily_stats')
      .set({
        total_posts_viewed: totalPostsViewed,
        followee_count: followeeCount,
      })
      .where('user_did', '=', userDid)
      .where('date', '=', date)
      .execute()
  }

  const result = await db
    .selectFrom('daily_stats')
    .selectAll()
    .where('user_did', '=', userDid)
    .where('date', '=', date)
    .executeTakeFirst()

  if (!result) {
    throw new Error('Failed to update daily stats')
  }

  return result
}

/**
 * Get 30-day rolling statistics for a user
 */
export async function get30DayRollingStats(
  db: Database,
  userDid: string,
): Promise<{
  totalPostsViewed: number
  averagePostsPerDay: number
  followeeCount: number
  daysWithData: number
}> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)
  
  const stats = await db
    .selectFrom('daily_stats')
    .select([
      db.fn.sum('total_posts_viewed').as('total_posts'),
      db.fn.avg('total_posts_viewed').as('avg_posts'),
      db.fn.avg('followee_count').as('avg_followees'),
      db.fn.count('date').as('days_with_data'),
    ])
    .where('user_did', '=', userDid)
    .where('date', '>=', cutoffDate.toISOString().split('T')[0])
    .executeTakeFirst()

  return {
    totalPostsViewed: Number(stats?.total_posts || 0),
    averagePostsPerDay: Number(stats?.avg_posts || 0),
    followeeCount: Math.round(Number(stats?.avg_followees || 0)),
    daysWithData: Number(stats?.days_with_data || 0),
  }
}

/**
 * Get post author statistics for a user
 */
export async function getPostAuthorStats(
  db: Database,
  viewerDid: string,
  authorDid: string,
): Promise<PostAuthorStats> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  // Get posts viewed today
  const todayPosts = await db
    .selectFrom('post_statistics')
    .select(db.fn.count('post_uri').as('count'))
    .where('viewer_did', '=', viewerDid)
    .where('author_did', '=', authorDid)
    .where('viewed_at', '>=', `${today}T00:00:00.000Z`)
    .executeTakeFirst()

  // Get posts viewed this week
  const weekPosts = await db
    .selectFrom('post_statistics')
    .select(db.fn.count('post_uri').as('count'))
    .where('viewer_did', '=', viewerDid)
    .where('author_did', '=', authorDid)
    .where('viewed_at', '>=', weekAgo.toISOString())
    .executeTakeFirst()

  // Get posts viewed this month
  const monthPosts = await db
    .selectFrom('post_statistics')
    .select(db.fn.count('post_uri').as('count'))
    .where('viewer_did', '=', viewerDid)
    .where('author_did', '=', authorDid)
    .where('viewed_at', '>=', monthAgo.toISOString())
    .executeTakeFirst()

  // Get Mahoot number for this author
  const relationship = await db
    .selectFrom('followee_relationships')
    .select('mahoot_number')
    .where('user_did', '=', viewerDid)
    .where('followee_did', '=', authorDid)
    .executeTakeFirst()

  return {
    author_did: authorDid,
    viewer_did: viewerDid,
    posts_viewed_today: Number(todayPosts?.count || 0),
    posts_viewed_this_week: Number(weekPosts?.count || 0),
    posts_viewed_this_month: Number(monthPosts?.count || 0),
    mahoot_number: Number(relationship?.mahoot_number || 0),
  }
}

/**
 * Get all authors with their statistics for a user
 */
export async function getAllAuthorStats(
  db: Database,
  viewerDid: string,
): Promise<PostAuthorStats[]> {
  // Get all unique authors that the user has viewed posts from
  const authors = await db
    .selectFrom('post_statistics')
    .select('author_did')
    .where('viewer_did', '=', viewerDid)
    .distinct()
    .execute()

  const authorStats: PostAuthorStats[] = []
  
  for (const author of authors) {
    const stats = await getPostAuthorStats(db, viewerDid, author.author_did)
    authorStats.push(stats)
  }

  return authorStats
}

/**
 * Clean up old statistics data (older than 60 days)
 */
export async function cleanupOldStatistics(
  db: Database,
  daysToKeep: number = 60,
): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  // Clean up old post statistics
  await db
    .deleteFrom('post_statistics')
    .where('viewed_at', '<', cutoffDate.toISOString())
    .execute()

  // Clean up old daily stats
  await db
    .deleteFrom('daily_stats')
    .where('date', '<', cutoffDate.toISOString().split('T')[0])
    .execute()

  console.log(`🧹 Cleaned up statistics older than ${daysToKeep} days`)
}

/**
 * Get posts that haven't been viewed by a user yet
 */
export async function getUnviewedPosts(
  db: Database,
  viewerDid: string,
  limit: number = 100,
): Promise<{ uri: string; cid: string; indexedAt: string }[]> {
  return await db
    .selectFrom('post')
    .select(['uri', 'cid', 'indexedAt'])
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('post_statistics')
            .select('post_uri')
            .where('post_uri', '=', eb.ref('post.uri'))
            .where('viewer_did', '=', viewerDid)
        )
      )
    )
    .orderBy('indexedAt', 'desc')
    .limit(limit)
    .execute()
}

/**
 * Get posts by a specific author that haven't been viewed by a user yet
 */
export async function getUnviewedPostsByAuthor(
  db: Database,
  viewerDid: string,
  authorDid: string,
  limit: number = 100,
): Promise<{ uri: string; cid: string; indexedAt: string }[]> {
  return await db
    .selectFrom('post')
    .select(['uri', 'cid', 'indexedAt'])
    .where('author_did', '=', authorDid)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('post_statistics')
            .select('post_uri')
            .where('post_uri', '=', eb.ref('post.uri'))
            .where('viewer_did', '=', viewerDid)
        )
      )
    )
    .orderBy('indexedAt', 'desc')
    .limit(limit)
    .execute()
}
