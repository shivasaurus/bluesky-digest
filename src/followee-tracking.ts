import { Database } from './db'
import { addOrUpdateFolloweeRelationship, removeFolloweeRelationship, calculateDefaultMahootNumber } from './user-management'

export interface FollowEvent {
  uri: string
  cid: string
  author: string
  record: {
    subject: string // The DID being followed
    createdAt: string
  }
}

export interface UnfollowEvent {
  uri: string
}

/**
 * Process follow events from the firehose
 */
export async function processFollowEvents(
  db: Database,
  followEvents: FollowEvent[],
): Promise<void> {
  for (const event of followEvents) {
    try {
      const followerDid = event.author
      const followeeDid = event.record.subject

      // Add the followee relationship with the original follow URI
      await addOrUpdateFolloweeRelationship(db, followerDid, followeeDid, undefined, event.uri)
      
      console.log(`✅ Follow relationship added: ${followerDid} -> ${followeeDid}`)
    } catch (error) {
      console.error('Error processing follow event:', error)
    }
  }
}

/**
 * Process unfollow events from the firehose
 */
export async function processUnfollowEvents(
  db: Database,
  unfollowEvents: UnfollowEvent[],
): Promise<void> {
  for (const event of unfollowEvents) {
    try {
      // Find the followee relationship by the follow URI
      const existingRelationship = await db
        .selectFrom('followee_relationships')
        .selectAll()
        .where('follow_uri', '=', event.uri)
        .executeTakeFirst()

      if (existingRelationship) {
        await removeFolloweeRelationship(db, existingRelationship.user_did, existingRelationship.followee_did)
        console.log(`✅ Follow relationship removed: ${existingRelationship.user_did} -> ${existingRelationship.followee_did}`)
      } else {
        console.log(`⚠️  Could not find followee relationship for unfollow: ${event.uri}`)
      }
    } catch (error) {
      console.error('Error processing unfollow event:', error)
    }
  }
}

/**
 * Update Mahoot numbers for all users when followee count changes
 */
export async function updateMahootNumbersForUser(
  db: Database,
  userDid: string,
): Promise<void> {
  try {
    // Get current followee count
    const followeeCount = await db
      .selectFrom('followee_relationships')
      .select(db.fn.count('followee_did').as('count'))
      .where('user_did', '=', userDid)
      .executeTakeFirst()

    const count = Number(followeeCount?.count || 0)
    
    if (count === 0) {
      return // No followees, no need to update
    }

    // Calculate new default Mahoot number
    const newDefaultMahoot = await calculateDefaultMahootNumber(db, userDid)
    
    // Update all followee relationships that are using the default Mahoot number
    // (This is a simplified approach - in a full implementation, we'd track which
    // relationships are using custom vs default Mahoot numbers)
    await db
      .updateTable('followee_relationships')
      .set({
        mahoot_number: newDefaultMahoot,
        updated_at: new Date().toISOString(),
      })
      .where('user_did', '=', userDid)
      .execute()

    console.log(`✅ Updated Mahoot numbers for user ${userDid}: new default = ${newDefaultMahoot}`)
  } catch (error) {
    console.error('Error updating Mahoot numbers for user:', error)
  }
}

/**
 * Get followee count for a user
 */
export async function getFolloweeCount(
  db: Database,
  userDid: string,
): Promise<number> {
  const result = await db
    .selectFrom('followee_relationships')
    .select(db.fn.count('followee_did').as('count'))
    .where('user_did', '=', userDid)
    .executeTakeFirst()

  return Number(result?.count || 0)
}

/**
 * Get all users who follow a specific user
 */
export async function getFollowers(
  db: Database,
  followeeDid: string,
): Promise<string[]> {
  const results = await db
    .selectFrom('followee_relationships')
    .select('user_did')
    .where('followee_did', '=', followeeDid)
    .execute()

  return results.map(row => row.user_did)
}

/**
 * Check if a user follows another user
 */
export async function isFollowing(
  db: Database,
  followerDid: string,
  followeeDid: string,
): Promise<boolean> {
  const result = await db
    .selectFrom('followee_relationships')
    .select('user_did')
    .where('user_did', '=', followerDid)
    .where('followee_did', '=', followeeDid)
    .executeTakeFirst()

  return !!result
}
