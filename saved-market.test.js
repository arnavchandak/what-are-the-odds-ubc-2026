import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverMarket, marketIdentity, CACHE_PREFIX } from './saved-market.js';

const market = { venue:'Polymarket', group:'meeting-place', title:'Where will the meeting take place?',
  outcomes:[{label:'Lisbon',historyId:'123',quotes:{price:0.45}}] };
const clip = {market:{key:marketIdentity(market),title:market.title}};
const now = Date.now();
const points = [[now-600000,0.4],[now-180000,0.45]];
test('recovers a legacy clipping using a different cached article for the exact market',async () => {
  const key = CACHE_PREFIX+'https://example.org/another-story';
  const storage = {getKeys:async()=>[key,'unrelated'],get:async keys=>{
    assert.deepEqual(keys,[key]);
    return {[key]:{fetchedAt:now,markets:[market],histories:{'Polymarket:123':points}}};
  }};
  const recovered = await recoverMarket([clip],storage,()=>assert.fail('unexpected request'));
  assert.deepEqual(recovered.lines[0].points,points);
});
test('reconstructs a missing chart from the provider event ID and outcome history',async () => {
  const request = async url => {
    if (String(url).includes('/events/slug/meeting-place')) return Response.json({
      slug:market.group,title:market.title,negRisk:true,markets:[{
        conditionId:'c',active:true,question:'Lisbon?',groupItemTitle:'Lisbon',
        outcomes:['Yes','No'],clobTokenIds:['123','456'],outcomePrices:['0.45','0.55'],
      }],
    });
    assert.equal(new URL(url).searchParams.get('market'),'123');
    return Response.json({history:points.map(([t,p])=>({t:t/1000,p}))});
  };
  const recovered = await recoverMarket([clip],{getKeys:async()=>[],get:async()=>({})},request);
  assert.equal(recovered.key,clip.market.key);
  assert.deepEqual(recovered.lines[0].points,points);
});
