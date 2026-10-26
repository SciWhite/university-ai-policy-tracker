import {readFileSync} from 'node:fs';
import {V6ArtifactStore, type ShardIndex} from '../apps/web/lib/v6-artifact-store';
import type {PublishedV6Package} from '../apps/web/lib/policy-v6-published';
import type {V6RecordPackage} from '../apps/web/lib/v6-effective-records';
import {acceptV6Release} from './lib/v6-release-contract';
import {historyManifest} from '../apps/web/lib/public-change-history';
const read = <T,>(family: string, key: string) => {
  const root = `data/${family}`;
  const pointer = JSON.parse(readFileSync(`${root}/current.json`, 'utf8'));
  const index = JSON.parse(readFileSync(`${root}/sharded/index.json`, 'utf8')) as ShardIndex;
  return new V6ArtifactStore(root, index).view<T>(pointer[key], pointer.sha256)!;
};
async function main() {
  const coverage=acceptV6Release(read<PublishedV6Package>('public-v6-pages','releaseId'), read<V6RecordPackage>('public-v6-records','revision'));
  const {manifest}=await historyManifest();
  console.log(JSON.stringify({...coverage,changeHistoryBasisVerified:true,changeHistoryBasisSha256:manifest.basisSha256}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
