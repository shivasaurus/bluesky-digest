import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { AtUri } from '@atproto/syntax'

// Feed metadata configuration
const feedMetadata = {
  'whats-alf': {
    displayName: "What's Alf",
    description: "A feed that shows posts from users who are asking 'What's Alf?'",
    avatar: "https://example.com/alf-avatar.png",
    likeCount: 42,
  },
  'mahoot': {
    displayName: "Mahoot - Time-Controlled Social Media",
    description: "A client-side curation protocol that limits your daily social media consumption and ensures fair exposure for all your followees. Set daily post limits and customize Mahoot numbers for each followee.",
    avatar: "https://example.com/mahoot-avatar.png",
    likeCount: 156,
    features: [
      "Daily post consumption limits",
      "Fair followee exposure (Mahoot Numbers)",
      "Followee amplification (amp up/down)",
      "Random subset selection for over-posting accounts",
      "30-day rolling statistics",
      "User preference customization"
    ],
    configuration: {
      dailyPostLimit: "Set your daily post consumption limit (default: 300)",
      mahootNumbers: "Customize how many posts to see from each followee",
      amplification: "Amp up important voices or amp down prolific posters",
      muting: "Set Mahoot number to 0 to effectively mute accounts"
    }
  }
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.describeFeedGenerator(async () => {
    const feeds = Object.keys(algos).map((shortname) => {
      const metadata = feedMetadata[shortname] || {
        displayName: shortname,
        description: `A custom feed: ${shortname}`,
        avatar: "https://example.com/default-avatar.png",
        likeCount: 0
      }
      
      return {
        uri: AtUri.make(
          ctx.cfg.publisherDid,
          'app.bsky.feed.generator',
          shortname,
        ).toString(),
        cid: "bafyrei...", // Placeholder CID
        did: ctx.cfg.serviceDid,
        creator: ctx.cfg.serviceDid,
        displayName: metadata.displayName,
        description: metadata.description,
        descriptionFacets: [],
        avatar: metadata.avatar,
        likeCount: metadata.likeCount,
        viewer: null,
        indexedAt: new Date().toISOString(),
        // Additional Mahoot-specific metadata
        ...(shortname === 'mahoot' && {
          features: metadata.features,
          configuration: metadata.configuration,
          version: "1.0.0",
          lastUpdated: new Date().toISOString()
        })
      }
    })
    
    return {
      encoding: 'application/json',
      body: {
        did: ctx.cfg.serviceDid,
        feeds,
        // Generator-level metadata
        generator: {
          displayName: "Mahoot Feed Generator",
          description: "A BlueSky feed generator implementing the Mahoot client-side curation protocol",
          avatar: "https://example.com/mahoot-generator-avatar.png",
          likeCount: 234,
          indexedAt: new Date().toISOString(),
          features: [
            "Custom feed algorithms",
            "User authentication",
            "Real-time statistics",
            "Preference management"
          ]
        }
      },
    }
  })
}
