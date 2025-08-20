import { Database } from './db'

export interface UserPreferences {
  user_did: string
  daily_post_limit: number
  default_mahoot_number: number
  created_at: string
  updated_at: string
}

export interface FolloweeRelationship {
  user_did: string
  followee_did: string
  mahoot_number: number
  follow_uri: string
  created_at: string
  updated_at: string
}

/**
 * Get or create user preferences for a given user DID
 */
export async function getOrCreateUserPreferences(
  db: Database,
  userDid: string,
): Promise<UserPreferences> {
  const now = new Date().toISOString()
  
  // Try to get existing preferences
  const existing = await db
    .selectFrom('user_preferences')
    .selectAll()
    .where('user_did', '=', userDid)
    .executeTakeFirst()

  if (existing) {
    return existing
  }

  // Create default preferences
  const defaultPreferences: Omit<UserPreferences, 'user_did'> = {
    daily_post_limit: 300,
    default_mahoot_number: 7,
    created_at: now,
    updated_at: now,
  }

  await db
    .insertInto('user_preferences')
    .values({
      user_did: userDid,
      ...defaultPreferences,
    })
    .execute()

  return {
    user_did: userDid,
    ...defaultPreferences,
  }
}

/**
 * Update user's daily post limit
 */
export async function updateUserDailyPostLimit(
  db: Database,
  userDid: string,
  dailyPostLimit: number,
): Promise<UserPreferences> {
  const now = new Date().toISOString()
  
  // Ensure user preferences exist
  await getOrCreateUserPreferences(db, userDid)

  // Update the daily post limit
  await db
    .updateTable('user_preferences')
    .set({
      daily_post_limit: dailyPostLimit,
      updated_at: now,
    })
    .where('user_did', '=', userDid)
    .execute()

  // Return updated preferences
  const updated = await db
    .selectFrom('user_preferences')
    .selectAll()
    .where('user_did', '=', userDid)
    .executeTakeFirst()

  if (!updated) {
    throw new Error('Failed to update user preferences')
  }

  return updated
}

/**
 * Calculate default Mahoot number based on followee count and daily post limit
 */
export async function calculateDefaultMahootNumber(
  db: Database,
  userDid: string,
): Promise<number> {
  const preferences = await getOrCreateUserPreferences(db, userDid)
  
  // Get followee count
  const followeeCount = await db
    .selectFrom('followee_relationships')
    .select(db.fn.count('followee_did').as('count'))
    .where('user_did', '=', userDid)
    .executeTakeFirst()

  const count = Number(followeeCount?.count || 0)
  
  if (count === 0) {
    return preferences.default_mahoot_number
  }

  // Calculate default Mahoot number: daily limit / followee count, with a minimum of 1
  const calculated = Math.max(1, Math.ceil(preferences.daily_post_limit / count))
  
  // Cap at a reasonable maximum to prevent excessive posts from any single followee
  return Math.min(calculated, 20)
}

/**
 * Update default Mahoot number for a user
 */
export async function updateDefaultMahootNumber(
  db: Database,
  userDid: string,
  defaultMahootNumber: number,
): Promise<UserPreferences> {
  const now = new Date().toISOString()
  
  // Ensure user preferences exist
  await getOrCreateUserPreferences(db, userDid)

  // Update the default Mahoot number
  await db
    .updateTable('user_preferences')
    .set({
      default_mahoot_number: defaultMahootNumber,
      updated_at: now,
    })
    .where('user_did', '=', userDid)
    .execute()

  // Return updated preferences
  const updated = await db
    .selectFrom('user_preferences')
    .selectAll()
    .where('user_did', '=', userDid)
    .executeTakeFirst()

  if (!updated) {
    throw new Error('Failed to update user preferences')
  }

  return updated
}

/**
 * Get all followees for a user
 */
export async function getUserFollowees(
  db: Database,
  userDid: string,
): Promise<FolloweeRelationship[]> {
  return await db
    .selectFrom('followee_relationships')
    .selectAll()
    .where('user_did', '=', userDid)
    .execute()
}

/**
 * Add or update a followee relationship
 */
export async function addOrUpdateFolloweeRelationship(
  db: Database,
  userDid: string,
  followeeDid: string,
  mahootNumber?: number,
  followUri?: string,
): Promise<FolloweeRelationship> {
  const now = new Date().toISOString()
  
  // If no Mahoot number provided, calculate the default
  const finalMahootNumber = mahootNumber ?? await calculateDefaultMahootNumber(db, userDid)

  // Try to insert, if it fails due to unique constraint, update instead
  try {
    await db
      .insertInto('followee_relationships')
      .values({
        user_did: userDid,
        followee_did: followeeDid,
        mahoot_number: finalMahootNumber,
        follow_uri: followUri || `at://${userDid}/app.bsky.graph.follow/${followeeDid}`,
        created_at: now,
        updated_at: now,
      })
      .execute()
  } catch (error) {
    // If insert fails due to unique constraint, update the existing record
    await db
      .updateTable('followee_relationships')
      .set({
        mahoot_number: finalMahootNumber,
        follow_uri: followUri || `at://${userDid}/app.bsky.graph.follow/${followeeDid}`,
        updated_at: now,
      })
      .where('user_did', '=', userDid)
      .where('followee_did', '=', followeeDid)
      .execute()
  }

  // Return the relationship
  const relationship = await db
    .selectFrom('followee_relationships')
    .selectAll()
    .where('user_did', '=', userDid)
    .where('followee_did', '=', followeeDid)
    .executeTakeFirst()

  if (!relationship) {
    throw new Error('Failed to create or update followee relationship')
  }

  return relationship
}

/**
 * Remove a followee relationship
 */
export async function removeFolloweeRelationship(
  db: Database,
  userDid: string,
  followeeDid: string,
): Promise<void> {
  await db
    .deleteFrom('followee_relationships')
    .where('user_did', '=', userDid)
    .where('followee_did', '=', followeeDid)
    .execute()
}

/**
 * Get user preferences with calculated default Mahoot number
 */
export async function getUserPreferencesWithDefaults(
  db: Database,
  userDid: string,
): Promise<UserPreferences & { calculated_default_mahoot_number: number }> {
  const preferences = await getOrCreateUserPreferences(db, userDid)
  const calculatedDefault = await calculateDefaultMahootNumber(db, userDid)
  
  return {
    ...preferences,
    calculated_default_mahoot_number: calculatedDefault,
  }
}
