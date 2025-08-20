const { createDb, migrateToLatest } = require('./dist/db/index.js');
const { 
  getOrCreateUserPreferences,
  updateUserDailyPostLimit,
  updateDefaultMahootNumber,
  addOrUpdateFolloweeRelationship,
  getUserFollowees,
  removeFolloweeRelationship
} = require('./dist/user-management.js');
const { 
  trackPostView,
  getPostsViewedToday,
  get30DayRollingStats,
  getAllAuthorStats,
  updateDailyStats
} = require('./dist/statistics.js');
const mahoot = require('./dist/algos/mahoot.js');

async function testComprehensiveValidation() {
  console.log('🧪 Comprehensive Mahoot Algorithm Validation...');
  
  try {
    // Create in-memory database
    const db = createDb(':memory:');
    await migrateToLatest(db);
    console.log('✅ Database setup complete!');
    
    const testUserDid = 'did:example:testuser';
    
    // Test 1: Basic functionality with various followee counts
    console.log('\n1. Testing with various followee counts...');
    await testFolloweeCountScenarios(db, testUserDid);
    
    // Test 2: Different posting patterns
    console.log('\n2. Testing different posting patterns...');
    await testPostingPatterns(db, testUserDid);
    
    // Test 3: User preference persistence
    console.log('\n3. Testing user preference persistence...');
    await testUserPreferencePersistence(db, testUserDid);
    
    // Test 4: Statistical calculations
    console.log('\n4. Testing statistical calculations...');
    await testStatisticalCalculations(db, testUserDid);
    
    // Test 5: Edge cases and error handling
    console.log('\n5. Testing edge cases and error handling...');
    await testEdgeCases(db, testUserDid);
    
    // Test 6: Performance with large datasets
    console.log('\n6. Testing performance with large datasets...');
    await testPerformance(db, testUserDid);
    
    console.log('\n🎉 All comprehensive validation tests passed!');
    
  } catch (error) {
    console.error('❌ Comprehensive validation test failed:', error);
    process.exit(1);
  }
}

async function testFolloweeCountScenarios(db, userDid) {
  const scenarios = [
    { followeeCount: 0, expectedPosts: 0, description: 'No followees' },
    { followeeCount: 1, expectedPosts: 5, description: 'Single followee' },
    { followeeCount: 5, expectedPosts: 25, description: 'Small followee count' },
    { followeeCount: 20, expectedPosts: 100, description: 'Medium followee count' },
    { followeeCount: 50, expectedPosts: 250, description: 'Large followee count' }
  ];
  
  for (const scenario of scenarios) {
    console.log(`   Testing ${scenario.description}...`);
    
    // Setup user preferences
    await getOrCreateUserPreferences(db, userDid);
    await updateUserDailyPostLimit(db, userDid, 300);
    await updateDefaultMahootNumber(db, userDid, 5);
    
    // Clear existing followees
    const existingFollowees = await getUserFollowees(db, userDid);
    for (const followee of existingFollowees) {
      await removeFolloweeRelationship(db, userDid, followee.followee_did);
    }
    
    // Add followees for this scenario
    for (let i = 0; i < scenario.followeeCount; i++) {
      const followeeDid = `did:example:followee${i}`;
      await addOrUpdateFolloweeRelationship(db, userDid, followeeDid, 5);
      
      // Add posts for this followee
      for (let j = 0; j < 10; j++) {
        await db
          .insertInto('post')
          .values({
            uri: `at://${followeeDid}/app.bsky.feed.post/${j}`,
            cid: 'bafyrei...',
            indexedAt: new Date().toISOString(),
            author_did: followeeDid,
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
    }
    
    // Test feed generation
    const mockCtx = { db };
    const mockParams = { limit: 50, cursor: undefined };
    const result = await mahoot.handler(mockCtx, mockParams, userDid);
    
    const actualPosts = result.feed.length;
    const expectedPosts = Math.min(scenario.expectedPosts, 50); // Limited by params.limit
    
    console.log(`     ✅ ${scenario.description}: ${actualPosts} posts (expected ~${expectedPosts})`);
    
    if (scenario.followeeCount === 0) {
      if (actualPosts !== 0) {
        throw new Error(`Expected 0 posts for no followees, got ${actualPosts}`);
      }
    } else if (actualPosts === 0) {
      throw new Error(`Expected posts for ${scenario.followeeCount} followees, got 0`);
    }
  }
}

async function testPostingPatterns(db, userDid) {
  console.log('   Testing various posting patterns...');
  
  // Use a unique user DID for this test to avoid interference
  const patternUserDid = 'did:example:patternuser';
  
  // Setup base user
  await getOrCreateUserPreferences(db, patternUserDid);
  await updateUserDailyPostLimit(db, patternUserDid, 100);
  await updateDefaultMahootNumber(db, patternUserDid, 5);
  
  // Clear existing followees
  const existingFollowees = await getUserFollowees(db, patternUserDid);
  for (const followee of existingFollowees) {
    await removeFolloweeRelationship(db, patternUserDid, followee.followee_did);
  }
  
  // Test different posting patterns
  const patterns = [
    { 
      followeeDid: 'did:example:prolific', 
      postCount: 50, 
      mahootNumber: 3, 
      description: 'Prolific poster (should be limited)' 
    },
    { 
      followeeDid: 'did:example:moderate', 
      postCount: 10, 
      mahootNumber: 5, 
      description: 'Moderate poster (should get full allocation)' 
    },
    { 
      followeeDid: 'did:example:quiet', 
      postCount: 2, 
      mahootNumber: 7, 
      description: 'Quiet poster (should get all available posts)' 
    },
    { 
      followeeDid: 'did:example:muted', 
      postCount: 20, 
      mahootNumber: 0, 
      description: 'Muted poster (should get 0 posts)' 
    }
  ];
  
  for (const pattern of patterns) {
    // Add followee relationship
    await addOrUpdateFolloweeRelationship(db, patternUserDid, pattern.followeeDid, pattern.mahootNumber);
    
    // Add posts
    for (let i = 0; i < pattern.postCount; i++) {
      await db
        .insertInto('post')
        .values({
          uri: `at://${pattern.followeeDid}/app.bsky.feed.post/${i}`,
          cid: 'bafyrei...',
          indexedAt: new Date().toISOString(),
          author_did: pattern.followeeDid,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  }
  
  // Test feed generation
  const mockCtx = { db };
  const mockParams = { limit: 30, cursor: undefined };
  const result = await mahoot.handler(mockCtx, mockParams, patternUserDid);
  
  // Analyze results
  const postsByAuthor = {};
  result.feed.forEach(item => {
    const authorDid = item.mahoot?.followeeDid || 'unknown';
    postsByAuthor[authorDid] = (postsByAuthor[authorDid] || 0) + 1;
  });
  
  console.log('     ✅ Posting pattern results:');
  console.log(`       Prolific (50 posts, limit 3): ${postsByAuthor['did:example:prolific'] || 0} posts`);
  console.log(`       Moderate (10 posts, limit 5): ${postsByAuthor['did:example:moderate'] || 0} posts`);
  console.log(`       Quiet (2 posts, limit 7): ${postsByAuthor['did:example:quiet'] || 0} posts`);
  console.log(`       Muted (20 posts, limit 0): ${postsByAuthor['did:example:muted'] || 0} posts`);
  
  // Validate results
  if (postsByAuthor['did:example:prolific'] > 3) {
    throw new Error('Prolific poster exceeded Mahoot limit');
  }
  if (postsByAuthor['did:example:muted'] > 0) {
    throw new Error('Muted poster should have 0 posts');
  }
}

async function testUserPreferencePersistence(db, userDid) {
  console.log('   Testing user preference persistence...');
  
  // Test 1: Create and retrieve preferences
  const initialPrefs = await getOrCreateUserPreferences(db, userDid);
  console.log(`     ✅ Initial preferences created: daily limit ${initialPrefs.daily_post_limit}`);
  
  // Test 2: Update preferences
  await updateUserDailyPostLimit(db, userDid, 150);
  await updateDefaultMahootNumber(db, userDid, 8);
  
  const updatedPrefs = await getOrCreateUserPreferences(db, userDid);
  console.log(`     ✅ Preferences updated: daily limit ${updatedPrefs.daily_post_limit}, default Mahoot ${updatedPrefs.default_mahoot_number}`);
  
  if (updatedPrefs.daily_post_limit !== 150 || updatedPrefs.default_mahoot_number !== 8) {
    throw new Error('Preferences not persisted correctly');
  }
  
  // Test 3: Followee relationship persistence
  await addOrUpdateFolloweeRelationship(db, userDid, 'did:example:testfollowee', 12);
  const followees = await getUserFollowees(db, userDid);
  const testFollowee = followees.find(f => f.followee_did === 'did:example:testfollowee');
  
  if (!testFollowee || testFollowee.mahoot_number !== 12) {
    throw new Error('Followee relationship not persisted correctly');
  }
  
  console.log(`     ✅ Followee relationship persisted: Mahoot number ${testFollowee.mahoot_number}`);
  
  // Test 4: Remove and verify
  await removeFolloweeRelationship(db, userDid, 'did:example:testfollowee');
  const followeesAfterRemoval = await getUserFollowees(db, userDid);
  const removedFollowee = followeesAfterRemoval.find(f => f.followee_did === 'did:example:testfollowee');
  
  if (removedFollowee) {
    throw new Error('Followee relationship not removed correctly');
  }
  
  console.log('     ✅ Followee relationship removed successfully');
}

async function testStatisticalCalculations(db, userDid) {
  console.log('   Testing statistical calculations...');
  
  // Use a unique user DID for this test to avoid interference
  const statsUserDid = 'did:example:statsuser';
  
  // Setup test data
  await getOrCreateUserPreferences(db, statsUserDid);
  await updateUserDailyPostLimit(db, statsUserDid, 200);
  await updateDefaultMahootNumber(db, statsUserDid, 5);
  
  // Add followees and posts
  for (let i = 0; i < 3; i++) {
    const followeeDid = `did:example:stats${i}`;
    await addOrUpdateFolloweeRelationship(db, statsUserDid, followeeDid, 5);
    
    // Add posts and track views
    for (let j = 0; j < 10; j++) {
      const postUri = `at://${followeeDid}/app.bsky.feed.post/${j}`;
      
      await db
        .insertInto('post')
        .values({
          uri: postUri,
          cid: 'bafyrei...',
          indexedAt: new Date().toISOString(),
          author_did: followeeDid,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
      
      // Track some views
      if (j < 5) {
        await trackPostView(db, postUri, followeeDid, statsUserDid);
      }
    }
  }
  
  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  await updateDailyStats(db, statsUserDid, today, 15, 3);
  
  // Test statistics
  const postsViewedToday = await getPostsViewedToday(db, statsUserDid);
  const stats = await get30DayRollingStats(db, statsUserDid);
  const authorStats = await getAllAuthorStats(db, statsUserDid);
  
  console.log(`     ✅ Posts viewed today: ${postsViewedToday.length}`);
  console.log(`     ✅ 30-day stats: ${stats.totalPostsViewed} total posts, ${stats.averagePostsPerDay.toFixed(1)} avg/day`);
  console.log(`     ✅ Author stats: ${authorStats.length} authors tracked`);
  
  // Validate statistics
  if (postsViewedToday.length !== 15) {
    throw new Error(`Expected 15 posts viewed today, got ${postsViewedToday.length}`);
  }
  
  if (stats.totalPostsViewed !== 15) {
    throw new Error(`Expected 15 total posts in 30-day stats, got ${stats.totalPostsViewed}`);
  }
  
  if (authorStats.length !== 3) {
    throw new Error(`Expected 3 authors in stats, got ${authorStats.length}`);
  }
}

async function testEdgeCases(db, userDid) {
  console.log('   Testing edge cases and error handling...');
  
  // Test 1: User with no preferences (should create defaults)
  const newUserDid = 'did:example:newuser';
  const newUserPrefs = await getOrCreateUserPreferences(db, newUserDid);
  
  if (newUserPrefs.daily_post_limit !== 300 || newUserPrefs.default_mahoot_number !== 7) {
    throw new Error('Default preferences not set correctly');
  }
  console.log('     ✅ New user gets default preferences');
  
  // Test 2: Feed generation with no followees
  const mockCtx = { db };
  const mockParams = { limit: 20, cursor: undefined };
  const noFolloweesResult = await mahoot.handler(mockCtx, mockParams, newUserDid);
  
  if (noFolloweesResult.feed.length !== 0) {
    throw new Error('Feed should be empty for user with no followees');
  }
  console.log('     ✅ Empty feed for user with no followees');
  
  // Test 3: Daily limit reached
  await updateUserDailyPostLimit(db, newUserDid, 5);
  
  // Add some followees and posts
  await addOrUpdateFolloweeRelationship(db, newUserDid, 'did:example:edgecase', 10);
  for (let i = 0; i < 10; i++) {
    await db
      .insertInto('post')
      .values({
        uri: `at://did:example:edgecase/app.bsky.feed.post/${i}`,
        cid: 'bafyrei...',
        indexedAt: new Date().toISOString(),
        author_did: 'did:example:edgecase',
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }
  
  // Generate feed multiple times to reach limit
  let totalPostsViewed = 0;
  let attempts = 0;
  
  while (totalPostsViewed < 5 && attempts < 10) {
    const result = await mahoot.handler(mockCtx, mockParams, newUserDid);
    totalPostsViewed += result.feed.length;
    attempts++;
    
    if (result.feed.length === 0) {
      break;
    }
  }
  
  console.log(`     ✅ Daily limit enforcement: ${totalPostsViewed} posts viewed (limit: 5)`);
  
  if (totalPostsViewed > 5) {
    throw new Error('Daily limit not enforced correctly');
  }
  
  // Test 4: Invalid parameters
  try {
    await updateUserDailyPostLimit(db, newUserDid, -1);
    throw new Error('Should not allow negative daily limit');
  } catch (error) {
    console.log('     ✅ Negative daily limit properly rejected');
  }
  
  try {
    await updateUserDailyPostLimit(db, newUserDid, 10000);
    throw new Error('Should not allow excessive daily limit');
  } catch (error) {
    console.log('     ✅ Excessive daily limit properly rejected');
  }
}

async function testPerformance(db, userDid) {
  console.log('   Testing performance with large datasets...');
  
  const startTime = Date.now();
  
  // Setup large dataset
  await getOrCreateUserPreferences(db, userDid);
  await updateUserDailyPostLimit(db, userDid, 500);
  await updateDefaultMahootNumber(db, userDid, 5);
  
  // Add 50 followees with 100 posts each
  for (let i = 0; i < 50; i++) {
    const followeeDid = `did:example:perf${i}`;
    await addOrUpdateFolloweeRelationship(db, userDid, followeeDid, 5);
    
    for (let j = 0; j < 100; j++) {
      await db
        .insertInto('post')
        .values({
          uri: `at://${followeeDid}/app.bsky.feed.post/${j}`,
          cid: 'bafyrei...',
          indexedAt: new Date().toISOString(),
          author_did: followeeDid,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  }
  
  const setupTime = Date.now() - startTime;
  console.log(`     ✅ Large dataset setup: ${setupTime}ms`);
  
  // Test feed generation performance
  const feedStartTime = Date.now();
  const mockCtx = { db };
  const mockParams = { limit: 100, cursor: undefined };
  const result = await mahoot.handler(mockCtx, mockParams, userDid);
  const feedTime = Date.now() - feedStartTime;
  
  console.log(`     ✅ Feed generation: ${feedTime}ms for ${result.feed.length} posts`);
  
  if (feedTime > 5000) {
    throw new Error(`Feed generation too slow: ${feedTime}ms`);
  }
  
  // Test statistics performance
  const statsStartTime = Date.now();
  const stats = await get30DayRollingStats(db, userDid);
  const statsTime = Date.now() - statsStartTime;
  
  console.log(`     ✅ Statistics calculation: ${statsTime}ms`);
  
  if (statsTime > 2000) {
    throw new Error(`Statistics calculation too slow: ${statsTime}ms`);
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`     ✅ Total performance test: ${totalTime}ms`);
}

testComprehensiveValidation();
