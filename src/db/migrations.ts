import { Kysely, Migration, MigrationProvider } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'integer', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('sub_state').execute()
  },
}

migrations['002'] = {
  async up(db: Kysely<unknown>) {
    // User preferences table
    await db.schema
      .createTable('user_preferences')
      .addColumn('user_did', 'varchar', (col) => col.primaryKey())
      .addColumn('daily_post_limit', 'integer', (col) => col.notNull().defaultTo(300))
      .addColumn('default_mahoot_number', 'integer', (col) => col.notNull().defaultTo(7))
      .addColumn('created_at', 'varchar', (col) => col.notNull())
      .addColumn('updated_at', 'varchar', (col) => col.notNull())
      .execute()

    // Followee relationships table with unique constraint
    await db.schema
      .createTable('followee_relationships')
      .addColumn('user_did', 'varchar', (col) => col.notNull())
      .addColumn('followee_did', 'varchar', (col) => col.notNull())
      .addColumn('mahoot_number', 'integer', (col) => col.notNull())
      .addColumn('follow_uri', 'varchar', (col) => col.notNull()) // Track the original follow URI
      .addColumn('created_at', 'varchar', (col) => col.notNull())
      .addColumn('updated_at', 'varchar', (col) => col.notNull())
      .addUniqueConstraint('followee_relationships_user_followee_unique', ['user_did', 'followee_did'])
      .execute()

    // Post statistics table
    await db.schema
      .createTable('post_statistics')
      .addColumn('post_uri', 'varchar', (col) => col.notNull())
      .addColumn('author_did', 'varchar', (col) => col.notNull())
      .addColumn('viewer_did', 'varchar', (col) => col.notNull())
      .addColumn('viewed_at', 'varchar', (col) => col.notNull())
      .execute()

    // Daily stats table with unique constraint
    await db.schema
      .createTable('daily_stats')
      .addColumn('user_did', 'varchar', (col) => col.notNull())
      .addColumn('date', 'varchar', (col) => col.notNull())
      .addColumn('total_posts_viewed', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('followee_count', 'integer', (col) => col.notNull().defaultTo(0))
      .addUniqueConstraint('daily_stats_user_date_unique', ['user_did', 'date'])
      .execute()

    // Create indexes for efficient querying
    await db.schema
      .createIndex('followee_relationships_user_did_idx')
      .on('followee_relationships')
      .column('user_did')
      .execute()

    await db.schema
      .createIndex('followee_relationships_followee_did_idx')
      .on('followee_relationships')
      .column('followee_did')
      .execute()

    await db.schema
      .createIndex('followee_relationships_user_followee_idx')
      .on('followee_relationships')
      .columns(['user_did', 'followee_did'])
      .execute()

    await db.schema
      .createIndex('followee_relationships_follow_uri_idx')
      .on('followee_relationships')
      .column('follow_uri')
      .execute()

    await db.schema
      .createIndex('post_statistics_viewer_did_idx')
      .on('post_statistics')
      .column('viewer_did')
      .execute()

    await db.schema
      .createIndex('post_statistics_author_did_idx')
      .on('post_statistics')
      .column('author_did')
      .execute()

    await db.schema
      .createIndex('post_statistics_viewed_at_idx')
      .on('post_statistics')
      .column('viewed_at')
      .execute()

    await db.schema
      .createIndex('daily_stats_user_did_idx')
      .on('daily_stats')
      .column('user_did')
      .execute()

    await db.schema
      .createIndex('daily_stats_date_idx')
      .on('daily_stats')
      .column('date')
      .execute()

    await db.schema
      .createIndex('daily_stats_user_date_idx')
      .on('daily_stats')
      .columns(['user_did', 'date'])
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('user_preferences').execute()
    await db.schema.dropTable('followee_relationships').execute()
    await db.schema.dropTable('post_statistics').execute()
    await db.schema.dropTable('daily_stats').execute()
  },
}

migrations['003'] = {
  async up(db: Kysely<unknown>) {
    // Add author_did column to post table
    await db.schema
      .alterTable('post')
      .addColumn('author_did', 'varchar', (col) => col.notNull().defaultTo('unknown'))
      .execute()

    // Create index for author lookups
    await db.schema
      .createIndex('post_author_did_idx')
      .on('post')
      .column('author_did')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropIndex('post_author_did_idx').execute()
    await db.schema.alterTable('post').dropColumn('author_did').execute()
  },
}
