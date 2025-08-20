import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import { validateAuth } from '../auth'
import {
  getOrCreateUserPreferences,
  updateUserDailyPostLimit,
  updateDefaultMahootNumber,
  getUserPreferencesWithDefaults,
  addOrUpdateFolloweeRelationship,
  getUserFollowees,
  removeFolloweeRelationship
} from '../user-management'
import { get30DayRollingStats, getAllAuthorStats } from '../statistics'

export default function (server: Server, ctx: AppContext) {
  // Get user preferences (using a generic endpoint)
  server.xrpc.method('com.mahoot.getPreferences', async ({ req }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    const preferences = await getUserPreferencesWithDefaults(ctx.db, requesterDid)
    const followees = await getUserFollowees(ctx.db, requesterDid)
    const stats = await get30DayRollingStats(ctx.db, requesterDid)

    return {
      encoding: 'application/json',
      body: {
        user_did: preferences.user_did,
        daily_post_limit: preferences.daily_post_limit,
        default_mahoot_number: preferences.default_mahoot_number,
        calculated_default_mahoot_number: preferences.calculated_default_mahoot_number,
        followee_count: followees.length,
        stats: {
          total_posts_viewed_30_days: stats.totalPostsViewed,
          average_posts_per_day: Math.round(stats.averagePostsPerDay * 100) / 100,
          days_with_data: stats.daysWithData
        },
        created_at: preferences.created_at,
        updated_at: preferences.updated_at
      }
    }
  })

  // Update daily post limit
  server.xrpc.method('com.mahoot.putPreferences', async ({ req, input }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    if (!input?.body) {
      throw new InvalidRequestError('Request body is required')
    }
    const { daily_post_limit, default_mahoot_number } = input.body

    if (daily_post_limit !== undefined) {
      if (typeof daily_post_limit !== 'number' || daily_post_limit < 1 || daily_post_limit > 1000) {
        throw new InvalidRequestError('Daily post limit must be between 1 and 1000')
      }
      await updateUserDailyPostLimit(ctx.db, requesterDid, daily_post_limit)
    }

    if (default_mahoot_number !== undefined) {
      if (typeof default_mahoot_number !== 'number' || default_mahoot_number < 1 || default_mahoot_number > 50) {
        throw new InvalidRequestError('Default Mahoot number must be between 1 and 50')
      }
      await updateDefaultMahootNumber(ctx.db, requesterDid, default_mahoot_number)
    }

    const updatedPreferences = await getUserPreferencesWithDefaults(ctx.db, requesterDid)

    return {
      encoding: 'application/json',
      body: {
        user_did: updatedPreferences.user_did,
        daily_post_limit: updatedPreferences.daily_post_limit,
        default_mahoot_number: updatedPreferences.default_mahoot_number,
        calculated_default_mahoot_number: updatedPreferences.calculated_default_mahoot_number,
        updated_at: updatedPreferences.updated_at
      }
    }
  })

  // Get followee relationships with Mahoot numbers
  server.xrpc.method('com.mahoot.getFollowees', async ({ req }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    const followees = await getUserFollowees(ctx.db, requesterDid)
    const authorStats = await getAllAuthorStats(ctx.db, requesterDid)

    // Create a map for quick stats lookup
    const statsMap = new Map()
    authorStats.forEach(stat => {
      statsMap.set(stat.author_did, stat)
    })

    const followeeList = followees.map(followee => {
      const stats = statsMap.get(followee.followee_did) || {
        posts_viewed_today: 0,
        posts_viewed_this_week: 0,
        posts_viewed_this_month: 0
      }

      return {
        followee_did: followee.followee_did,
        mahoot_number: followee.mahoot_number,
        posts_viewed_today: stats.posts_viewed_today,
        posts_viewed_this_week: stats.posts_viewed_this_week,
        posts_viewed_this_month: stats.posts_viewed_this_month,
        follow_uri: followee.follow_uri,
        created_at: followee.created_at,
        updated_at: followee.updated_at
      }
    })

    return {
      encoding: 'application/json',
      body: {
        followees: followeeList,
        count: followeeList.length
      }
    }
  })

  // Update followee Mahoot number (amp up/down)
  server.xrpc.method('com.mahoot.updateFollowee', async ({ req, input }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    if (!input?.body) {
      throw new InvalidRequestError('Request body is required')
    }
    const { followee_did, mahoot_number } = input.body

    if (!followee_did || typeof followee_did !== 'string') {
      throw new InvalidRequestError('followee_did is required and must be a string')
    }

    if (mahoot_number !== undefined) {
      if (typeof mahoot_number !== 'number' || mahoot_number < 0 || mahoot_number > 50) {
        throw new InvalidRequestError('Mahoot number must be between 0 and 50')
      }
    }

    const relationship = await addOrUpdateFolloweeRelationship(
      ctx.db,
      requesterDid,
      followee_did,
      mahoot_number
    )

    return {
      encoding: 'application/json',
      body: {
        followee_did: relationship.followee_did,
        mahoot_number: relationship.mahoot_number,
        follow_uri: relationship.follow_uri,
        created_at: relationship.created_at,
        updated_at: relationship.updated_at
      }
    }
  })

  // Remove followee relationship
  server.xrpc.method('com.mahoot.removeFollowee', async ({ req, input }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    if (!input?.body) {
      throw new InvalidRequestError('Request body is required')
    }
    const { followee_did } = input.body

    if (!followee_did || typeof followee_did !== 'string') {
      throw new InvalidRequestError('followee_did is required and must be a string')
    }

    await removeFolloweeRelationship(ctx.db, requesterDid, followee_did)

    return {
      encoding: 'application/json',
      body: {
        success: true,
        followee_did: followee_did
      }
    }
  })

  // Get feed configuration and help
  server.xrpc.method('com.mahoot.getFeedConfig', async ({ req }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    return {
      encoding: 'application/json',
      body: {
        algorithm: 'mahoot',
        version: '1.0.0',
        description: 'Time-controlled social media with fair followee exposure',
        features: {
          dailyLimits: {
            name: 'Daily Post Limits',
            description: 'Set a daily limit on how many posts you consume',
            default: 300,
            min: 1,
            max: 1000,
            help: 'This helps you control your social media time and avoid endless scrolling'
          },
          mahootNumbers: {
            name: 'Mahoot Numbers',
            description: 'Guaranteed minimum posts per followee per day',
            default: 7,
            min: 1,
            max: 50,
            help: 'Ensures fair exposure for all your followees, regardless of posting frequency'
          },
          amplification: {
            name: 'Followee Amplification',
            description: 'Amp up important voices or amp down prolific posters',
            help: 'Increase Mahoot numbers for important accounts, decrease for over-posters'
          },
          randomSelection: {
            name: 'Random Subset Selection',
            description: 'Randomly selects posts from over-posting followees',
            help: 'Prevents any single followee from dominating your feed'
          },
          statistics: {
            name: 'Usage Statistics',
            description: 'Track your viewing patterns and engagement',
            help: 'Monitor your social media habits and optimize your settings'
          }
        },
        configuration: {
          dailyPostLimit: {
            type: 'number',
            description: 'Maximum posts to view per day',
            endpoint: 'com.mahoot.putPreferences',
            parameter: 'daily_post_limit'
          },
          defaultMahootNumber: {
            type: 'number',
            description: 'Default posts per followee per day',
            endpoint: 'com.mahoot.putPreferences',
            parameter: 'default_mahoot_number'
          },
          followeeMahootNumbers: {
            type: 'object',
            description: 'Custom Mahoot numbers for specific followees',
            endpoint: 'com.mahoot.updateFollowee',
            parameter: 'mahoot_number'
          }
        },
        apiEndpoints: {
          getPreferences: 'com.mahoot.getPreferences',
          putPreferences: 'com.mahoot.putPreferences',
          getFollowees: 'com.mahoot.getFollowees',
          updateFollowee: 'com.mahoot.updateFollowee',
          removeFollowee: 'com.mahoot.removeFollowee',
          getStats: 'com.mahoot.getStats'
        }
      }
    }
  })

  // Get user statistics and insights
  server.xrpc.method('com.mahoot.getStats', async ({ req }) => {
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )

    const preferences = await getUserPreferencesWithDefaults(ctx.db, requesterDid)
    const followees = await getUserFollowees(ctx.db, requesterDid)
    const stats = await get30DayRollingStats(ctx.db, requesterDid)
    const authorStats = await getAllAuthorStats(ctx.db, requesterDid)

    // Calculate insights
    const totalMahootNumbers = followees.reduce((sum, f) => sum + f.mahoot_number, 0)
    const averageMahootNumber = followees.length > 0 ? totalMahootNumbers / followees.length : 0
    
    const topAuthors = authorStats
      .sort((a, b) => b.posts_viewed_this_month - a.posts_viewed_this_month)
      .slice(0, 10)
      .map(author => ({
        author_did: author.author_did,
        mahoot_number: author.mahoot_number,
        posts_viewed_today: author.posts_viewed_today,
        posts_viewed_this_week: author.posts_viewed_this_week,
        posts_viewed_this_month: author.posts_viewed_this_month
      }))

    return {
      encoding: 'application/json',
      body: {
        user_preferences: {
          daily_post_limit: preferences.daily_post_limit,
          default_mahoot_number: preferences.default_mahoot_number,
          calculated_default_mahoot_number: preferences.calculated_default_mahoot_number
        },
        followee_summary: {
          total_followees: followees.length,
          total_mahoot_numbers: totalMahootNumbers,
          average_mahoot_number: Math.round(averageMahootNumber * 100) / 100
        },
        usage_stats: {
          total_posts_viewed_30_days: stats.totalPostsViewed,
          average_posts_per_day: Math.round(stats.averagePostsPerDay * 100) / 100,
          days_with_data: stats.daysWithData,
          estimated_daily_capacity: totalMahootNumbers
        },
        top_authors: topAuthors
      }
    }
  })
}
