export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  user_preferences: UserPreferences
  followee_relationships: FolloweeRelationship
  post_statistics: PostStatistics
  daily_stats: DailyStats
}

export type Post = {
  uri: string
  cid: string
  indexedAt: string
  author_did: string
}

export type SubState = {
  service: string
  cursor: number
}

export type UserPreferences = {
  user_did: string
  daily_post_limit: number
  default_mahoot_number: number
  created_at: string
  updated_at: string
}

export type FolloweeRelationship = {
  user_did: string
  followee_did: string
  mahoot_number: number
  follow_uri: string
  created_at: string
  updated_at: string
}

export type PostStatistics = {
  post_uri: string
  author_did: string
  viewer_did: string
  viewed_at: string
}

export type DailyStats = {
  user_did: string
  date: string
  total_posts_viewed: number
  followee_count: number
}
