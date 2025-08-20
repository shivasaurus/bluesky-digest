import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getOrCreateUserPreferences, getUserFollowees } from '../user-management'
import { 
  trackPostView, 
  getPostsViewedToday, 
  getPostsByAuthorViewedInLastDays,
  getUnviewedPostsByAuthor,
  updateDailyStats
} from '../statistics'

// max 15 chars
export const shortname = 'mahoot'

interface MahootFeedItem {
  post: string
  author_did: string
  mahoot_number: number
  posts_viewed_today: number
  reason?: string
  metadata?: {
    mahootNumber: number
    isCustomMahoot: boolean
    priorityLevel: 'high' | 'low' | 'normal'
    postsViewedFromFollowee: number
    followeeDid: string
    timestamp: string
  }
}

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid?: string) => {
  if (!requesterDid) {
    throw new Error('User authentication required for Mahoot feed')
  }

  // Get user preferences
  const userPrefs = await getOrCreateUserPreferences(ctx.db, requesterDid)
  
  // Get user's followees
  const followees = await getUserFollowees(ctx.db, requesterDid)
  
  if (followees.length === 0) {
    // No followees, return empty feed
    return {
      cursor: undefined,
      feed: [],
    }
  }

  // Get posts viewed today
  const postsViewedToday = await getPostsViewedToday(ctx.db, requesterDid)
  const postsViewedCount = postsViewedToday.length

  // Check if user has reached their daily limit
  if (postsViewedCount >= userPrefs.daily_post_limit) {
    return {
      cursor: undefined,
      feed: [],
    }
  }

  // Calculate remaining posts for today
  const remainingPosts = userPrefs.daily_post_limit - postsViewedCount
  const postsToShow = Math.min(remainingPosts, params.limit || 20)

  // Build Mahoot feed
  const mahootFeed: MahootFeedItem[] = []
  const today = new Date().toISOString().split('T')[0]

  // Sort followees by priority: higher Mahoot numbers first (amp up users get priority)
  const sortedFollowees = followees.sort((a, b) => b.mahoot_number - a.mahoot_number)

  // Process each followee in priority order
  for (const followee of sortedFollowees) {
    const followeeDid = followee.followee_did
    const mahootNumber = followee.mahoot_number

    // Skip followees with Mahoot number 0 (effectively muted)
    if (mahootNumber === 0) {
      continue
    }

    // Get posts viewed from this followee today
    const postsViewedFromFollowee = postsViewedToday.filter(
      post => post.author_did === followeeDid
    )
    let postsViewedFromFolloweeCount = postsViewedFromFollowee.length

    // Check if we've already shown enough posts from this followee today
    if (postsViewedFromFolloweeCount >= mahootNumber) {
      continue // Skip this followee, already shown enough posts
    }

    // Calculate how many posts we can still show from this followee
    const remainingFromFollowee = mahootNumber - postsViewedFromFolloweeCount
    const postsToShowFromFollowee = Math.min(remainingFromFollowee, postsToShow - mahootFeed.length)

    if (postsToShowFromFollowee <= 0) {
      continue
    }

    // Get unviewed posts from this followee
    const unviewedPosts = await getUnviewedPostsByAuthor(
      ctx.db, 
      requesterDid, 
      followeeDid, 
      postsToShowFromFollowee * 3 // Get more posts than needed for better random selection
    )

    if (unviewedPosts.length === 0) {
      continue // No unviewed posts from this followee
    }

    // Random subset selection: if followee has more posts than their Mahoot number,
    // randomly select which posts to show
    const postsToInclude = unviewedPosts.slice(0, postsToShowFromFollowee)
    
    // Shuffle the posts for random selection (Fisher-Yates algorithm for better randomness)
    const shuffledPosts = [...postsToInclude]
    for (let i = shuffledPosts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledPosts[i], shuffledPosts[j]] = [shuffledPosts[j], shuffledPosts[i]]
    }

      // Add posts to feed
  for (const post of shuffledPosts) {
    const isCustomMahoot = mahootNumber !== userPrefs.default_mahoot_number
    const priorityIndicator = mahootNumber > userPrefs.default_mahoot_number ? '⬆️' : 
                             mahootNumber < userPrefs.default_mahoot_number ? '⬇️' : ''

    // Create detailed reason with metadata
    const reason = `Mahoot: ${postsViewedFromFolloweeCount + 1}/${mahootNumber} posts from this followee today${priorityIndicator ? ` ${priorityIndicator}` : ''}`
    
    // Add metadata for client display
    const priorityLevel: 'high' | 'low' | 'normal' = mahootNumber > userPrefs.default_mahoot_number ? 'high' : 
                                                    mahootNumber < userPrefs.default_mahoot_number ? 'low' : 'normal'
    
    const metadata = {
      mahootNumber,
      isCustomMahoot,
      priorityLevel,
      postsViewedFromFollowee: postsViewedFromFolloweeCount + 1,
      followeeDid,
      timestamp: new Date().toISOString()
    }

    mahootFeed.push({
      post: post.uri,
      author_did: followeeDid,
      mahoot_number: mahootNumber,
      posts_viewed_today: postsViewedFromFolloweeCount,
      reason,
      metadata
    })

    // Track this post view
    await trackPostView(ctx.db, post.uri, followeeDid, requesterDid)

    // Update count for this followee
    postsViewedFromFolloweeCount++

    // Check if we've reached the limit
    if (mahootFeed.length >= postsToShow) {
      break
    }
  }

    if (mahootFeed.length >= postsToShow) {
      break
    }
  }

  // Sort feed by most recent posts first
  mahootFeed.sort((a, b) => {
    // Extract timestamp from URI for sorting (simplified approach)
    const aTime = new Date(a.post.split('/').pop() || '0').getTime()
    const bTime = new Date(b.post.split('/').pop() || '0').getTime()
    return bTime - aTime
  })

  // Update daily statistics
  const newTotalPostsViewed = postsViewedCount + mahootFeed.length
  await updateDailyStats(ctx.db, requesterDid, today, newTotalPostsViewed, followees.length)

  // Generate cursor for pagination
  let cursor: string | undefined
  if (mahootFeed.length > 0) {
    const lastPost = mahootFeed[mahootFeed.length - 1]
    cursor = `${Date.now()}::${lastPost.post}`
  }

  // Convert to feed format with enhanced metadata
  const feed = mahootFeed.map(item => ({
    post: item.post,
    reason: item.reason ? {
      $type: 'app.bsky.feed.defs#skeletonReasonRepost',
      repost: item.reason
    } : undefined,
    // Include Mahoot-specific metadata for client display
    ...(item.metadata && {
      mahoot: {
        mahootNumber: item.metadata.mahootNumber,
        isCustomMahoot: item.metadata.isCustomMahoot,
        priorityLevel: item.metadata.priorityLevel,
        postsViewedFromFollowee: item.metadata.postsViewedFromFollowee,
        followeeDid: item.metadata.followeeDid,
        timestamp: item.metadata.timestamp
      }
    })
  }))

  // Create comprehensive feed metadata
  const feedMetadata = {
    algorithm: 'mahoot',
    version: '1.0.0',
    userDid: requesterDid,
    dailyPostLimit: userPrefs.daily_post_limit,
    defaultMahootNumber: userPrefs.default_mahoot_number,
    followeeCount: followees.length,
    postsViewedToday: postsViewedCount,
    remainingPosts: userPrefs.daily_post_limit - postsViewedCount,
    feedGeneratedAt: new Date().toISOString(),
    features: {
      dailyLimits: true,
      mahootNumbers: true,
      amplification: true,
      randomSelection: true,
      statistics: true
    }
  }

  return {
    cursor,
    feed,
    metadata: feedMetadata
  }
}
