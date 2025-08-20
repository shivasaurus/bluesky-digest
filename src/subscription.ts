import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { processFollowEvents, processUnfollowEvents, updateMahootNumbersForUser } from './followee-tracking'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    // Process follow/unfollow events
    if (ops.follows.creates.length > 0) {
      await processFollowEvents(this.db, ops.follows.creates)
      
      // Update Mahoot numbers for users who gained new followees
      for (const followEvent of ops.follows.creates) {
        await updateMahootNumbersForUser(this.db, followEvent.author)
      }
    }

    if (ops.follows.deletes.length > 0) {
      await processUnfollowEvents(this.db, ops.follows.deletes)
      
      // Update Mahoot numbers for users who lost followees
      // We need to get the follower DID from the database since the delete event doesn't contain it
      for (const unfollowEvent of ops.follows.deletes) {
        const relationship = await this.db
          .selectFrom('followee_relationships')
          .select('user_did')
          .where('follow_uri', '=', unfollowEvent.uri)
          .executeTakeFirst()
        
        if (relationship) {
          await updateMahootNumbersForUser(this.db, relationship.user_did)
        }
      }
    }

    // Process posts - track all posts with author information
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates.map((create) => {
      // map all posts to a db row with author information
      return {
        uri: create.uri,
        cid: create.cid,
        indexedAt: new Date().toISOString(),
        author_did: create.author, // Store the author DID
      }
    })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }

    // Log some statistics periodically
    if (evt.seq % 100 === 0) {
      const postCount = await this.db
        .selectFrom('post')
        .select(this.db.fn.count('uri').as('count'))
        .executeTakeFirst()
      
      const followeeCount = await this.db
        .selectFrom('followee_relationships')
        .select(this.db.fn.count('followee_did').as('count'))
        .executeTakeFirst()

      console.log(`📊 Stats at seq ${evt.seq}: ${postCount?.count || 0} posts, ${followeeCount?.count || 0} followee relationships`)
    }
  }
}
