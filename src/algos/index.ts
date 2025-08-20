import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as whatsAlf from './whats-alf'
import * as mahoot from './mahoot'

type AlgoHandler = (ctx: AppContext, params: QueryParams, requesterDid?: string) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [whatsAlf.shortname]: whatsAlf.handler,
  [mahoot.shortname]: mahoot.handler,
}

export default algos
