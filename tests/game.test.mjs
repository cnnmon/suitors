import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'suitors-tests-'));
for (const file of readdirSync('lib/lobby').filter(f => f.endsWith('.ts'))) {
  const target = join(output, file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, ts.transpileModule(readFileSync(`lib/lobby/${file}`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
after(() => rmSync(output, { recursive: true, force: true }));
const require = createRequire(resolve('package.json'));
const engine = require(join(output, 'engine.js'));
const { createRoom, ensureJoined, join: enter, advance, heartbeat, leave, submit, nextPrincess, nextSpeaker, resetCourt, enterCourt, view, turnKey, likedScore } = engine;
const { TURN_COUNT, TURN_MS, PRESENCE_MS, LOBBY_MS } = require(join(output, 'settings.js'));
const { responseSign } = require(join(output, 'sign.js'));
const { interpretShortPreferences, validPreferences } = require(join(output, 'preferences.js'));
const { questionFor } = require(join(output, 'prompts.js'));
const { preferenceEdits } = require(join(output, 'preferenceEdits.js'));
const { claimRound, finishRound } = require(join(output, 'round.js'));
const { execute } = require(join(output, 'commands.js'));
const { scriptedDialogue, npcText } = require(join(output, 'dialogue.js'));
const { lineagesFrom } = require(join(output, 'lineage.js'));
const preferences = (prompt) => ({ prompt, weights: interpretShortPreferences(prompt), source: 'scripted' });
function tick(room, now) {
  for (const id of Object.keys(room.members)) heartbeat(room, id, now);
  advance(room, now);
}
function start(count = 1) {
  const room = createRoom();
  for (let i = 0; i < count; i++) enter(room, `person-${i}`, `Player ${i}`, 0);
  for (let i = 0; i < count; i++) enterCourt(room, `person-${i}`, LOBBY_MS);
  return room;
}
function pass(room) {
  const now = room.turnStartedAt + 1_000;
  if (room.phase === 'dialogue') {
    for (const seat of room.seats) if (seat.owner && !room.submissions[seat.id]) submit(room, seat.owner, turnKey(room), seat.owner === 'person-0' ? 'Trust me. I know, I am certain and confident.' : 'Hello there.', now);
    claimRound(room, 'person-0', now, false);
  }
  for (let step = 0; step < room.seats.length && room.phase === 'results'; step++) nextSpeaker(room, 'person-0', now + step);

}
function finishReign(room) {
  for (let turn = 0; turn < TURN_COUNT; turn++) {
    assert.equal(room.phase, 'dialogue');
    assert.equal(room.turn, turn);
    pass(room);
    assert.equal(room.phase, 'feedback');
    tick(room, room.deadline);
  }
  assert.equal(room.phase, 'reveal');
}

for (let humans = 1; humans <= 5; humans++) test(`${humans} browsers share the court and finish three timed turns`, () => {
  const room = start(humans);
  const size = humans <= 1 ? 4 : Math.min(5, humans + 2);
  assert.equal(room.seats.length, size);
  assert.equal(room.seats.filter(s => s.owner).length, humans);
  assert.equal(room.seats.filter(s => !s.owner).length, size - humans);
  finishReign(room);
  assert.equal(room.history.length, TURN_COUNT);
  for (const seat of room.seats) assert.equal(seat.total, room.history.reduce((sum, t) => sum + t[seat.id].score, 0));
  assert.ok(room.winner);
});

test('a solo court has no dialogue timer; two people do', () => {
  const soloRoom = createRoom();
  enter(soloRoom, 'person-0', 'Player 0', 0);
  assert.equal(soloRoom.phase, 'lobby');
  assert.equal(view(soloRoom, 'person-0', 0).deadline, null);
  enterCourt(soloRoom, 'person-0', LOBBY_MS);
  assert.equal(soloRoom.phase, 'dialogue');
  assert.equal(soloRoom.deadline, null);
  assert.equal(view(soloRoom, 'person-0', soloRoom.turnStartedAt).deadline, null);
  tick(soloRoom, soloRoom.turnStartedAt + 120_000);
  assert.equal(soloRoom.phase, 'dialogue');
  const room = start(2);
  assert.equal(room.deadline, room.turnStartedAt + TURN_MS);
  assert.equal(view(room, 'person-0', room.turnStartedAt).deadline, room.deadline);
});

test('a new browser replaces an NPC and existing browsers keep their seats', () => {
  const room = start();
  const original = room.members['person-0'].seatId;
  enter(room, 'second', 'Second', 7000);
  assert.equal(room.members['person-0'].seatId, original);
  assert.equal(view(room, 'second', 7000).you.role, 'suitor');
  assert.equal(view(room, 'person-0', 7000).seats.filter(s => s.kind === 'human').length, 2);
});

test('arrivals inherit an NPC seat without changing the pending batch', () => {
  const room = start();
  submit(room, 'person-0', turnKey(room), 'Hello', 7000);
  const job = claimRound(room, 'person-0', 7001, true);
  enter(room, 'late', 'Late', 7002);
  assert.equal(view(room, 'late', 7002).you.role, 'suitor');
  assert.equal(view(room, 'late', 7002).you.submitted, true);
  assert.equal(view(room, 'late', 7002).you.dialogue, null);
  assert.equal(job.suitors.length, room.seats.length);
  finishRound(room, job.key, 'person-0', undefined, 7003);
  pass(room); tick(room, room.deadline);
  assert.equal(view(room, 'late', room.turnStartedAt).you.role, 'suitor');
});

test('full courts queue spectators and promote them when a seat opens', () => {
  const room = start(5); enter(room, 'sixth', 'Sixth', 7000);
  assert.equal(view(room, 'sixth', 7000).you.role, 'spectator');
  leave(room, 'person-2', 8000);
  assert.equal(view(room, 'sixth', 8000).you.role, 'suitor');
  assert.equal(room.seats.filter(s => s.owner).length, 5);
});

test('expired participants become NPCs; refreshed sessions retain active seats', () => {
  const room = start(2);
  const firstSeat = room.members['person-0'].seatId;
  heartbeat(room, 'person-0', PRESENCE_MS + 7000);
  advance(room, PRESENCE_MS + 7000);
  assert.equal(room.members['person-0'].seatId, firstSeat);
  assert.equal(room.members['person-1'].seatId, null);
  assert.equal(room.seats[1].owner, null);
  assert.equal(room.seats[1].name, room.seats[1].npcName);
});

test('server deadlines close a silent human and open the next suitor', () => {
  const room = start(2);
  const ownId = room.members['person-0'].seatId;
  tick(room, room.deadline);
  assert.equal(room.phase, 'dialogue');
  const own = room.submissions[ownId];
  assert.equal(own.score, 0); assert.equal(own.timedOut, true);
  assert.notEqual(view(room, 'person-0', room.deadline).speakerId, ownId);
});

test('each session submits once, for the current turn only, before the deadline', () => {
  const room = start(); const key = turnKey(room);
  assert.throws(() => submit(room, 'stranger', key, 'Hello', 7000));
  assert.throws(() => submit(room, 'person-0', 'stale', 'Hello', 7000));
  assert.throws(() => submit(room, 'person-0', key, 'x'.repeat(241), 7000));
  submit(room, 'person-0', key, 'Hello', 7000);
  assert.throws(() => submit(room, 'person-0', key, 'Again', 7001));
  const room2 = start(2);
  assert.throws(() => submit(room2, 'person-0', turnKey(room2), 'Late', room2.deadline));
  assert.doesNotThrow(() => submit(room2, 'person-1', turnKey(room2), 'Any order', room2.turnStartedAt + 1));
});

test('results show one response sign at a time after the batch finishes', () => {
  const room = start(2);
  submit(room, 'person-1', turnKey(room), 'Second seat first.', 7000);
  submit(room, 'person-0', turnKey(room), 'First seat second.', 7100);
  claimRound(room, 'person-0', 7200, false);
  let state = view(room, 'person-0', 7200);
  assert.equal(responseSign(state.seats, state.speakerId).name, 'Player 0');
  nextSpeaker(room, 'person-0', 8000);
  state = view(room, 'person-0', 8000);
  assert.equal(responseSign(state.seats, state.speakerId).name, 'Player 1');
});

test('answers stay hidden until evaluation; preferences and identities stay private', () => {
  const room = start(2);
  submit(room, 'person-0', turnKey(room), 'PRIVATE ALPHA', 7000);
  submit(room, 'person-1', turnKey(room), 'PRIVATE BETA', 7000);
  const waiting = view(room, 'person-0', 7000);
  assert.equal(waiting.you.dialogue.text, 'PRIVATE ALPHA');
  assert.ok(waiting.seats.every(s => s.line === null && s.mark === null));
  assert.equal(waiting.you.dialogue.reply, '');
  claimRound(room, 'person-0', 7100, false);
  const state = view(room, 'person-0', 7100);
  assert.equal(state.seats[1].line, 'PRIVATE BETA');
  const serialized = JSON.stringify(state);
  for (const secret of [room.preferences.prompt, 'person-1', 'weights', 'members', 'vulnerability']) assert.equal(serialized.includes(secret), false);
  pass(room);
  const logged = view(room, 'person-0', room.deadline - 1);
  assert.ok(logged.log.some(e => e.name === 'Player 0' && e.note && e.reply));
  assert.equal(view(room, null, 7100).you, null);
});

test('late or duplicate batch results cannot change completed scores', () => {
  const room = start();
  submit(room, 'person-0', turnKey(room), 'Hello', 7000);
  const job = claimRound(room, 'person-0', 7001, true);
  assert.throws(() => nextSpeaker(room, 'person-0', 7002));
  finishRound(room, job.key, 'person-0', undefined, 7003);
  pass(room);
  const before = structuredClone(room);
  finishRound(room, job.key, 'person-0', [], 7004);
  assert.deepEqual(room, before);
});

test('winner creates the new princess and returns under a new name in the same seat', () => {
  const room = start(5); room.preferences = preferences('Likes confidence.');
  finishReign(room); assert.equal(room.winner.memberId, 'person-0');
  assert.ok(view(room, 'person-1', room.deadline - 1).revealedPreference);
  tick(room, room.deadline);
  assert.equal(room.phase, 'creating');
  assert.equal(view(room, 'person-0', room.deadline - 1).canCreate, true);
  assert.equal(view(room, 'person-1', room.deadline - 1).canCreate, false);
  nextPrincess(room, preferences('Likes humor.'), room.deadline - 1);
  assert.equal(room.reign, 2); assert.equal(room.turn, 0);
  assert.equal(view(room, 'person-0', room.turnStartedAt).you.role, 'suitor');
  assert.equal(room.seats.length, 5); assert.equal(room.seats.filter(s => !s.owner).length, 0);
  assert.ok(room.seats.every(s => s.total === 0));
  assert.equal(view(room, 'person-1', room.turnStartedAt).revealedPreference, null);
});

test('creation timeout automatically starts the next reign', () => {
  const room = start(5); room.preferences = preferences('Likes confidence.');
  finishReign(room); tick(room, room.deadline);
  const deadline = room.deadline;
  tick(room, deadline); assert.equal(room.phase, 'dialogue'); assert.equal(room.reign, 2);
  assert.equal(room.preferences.source, 'npc');
});

test('an empty court does not run endless NPC reigns', () => {
  const room = start(); leave(room, 'person-0', 7000);
  advance(room, 10_000_000); assert.equal(room.reign, 1); assert.equal(room.turn, 0);
});

test('preference strings have a real effect on text-only scoring', () => {
  const a = scriptedDialogue('A funny joke about a ridiculous banana.', preferences('Likes humor. Hates confidence.'), 0);
  const b = scriptedDialogue('A funny joke about a ridiculous banana.', preferences('Hates humor. Likes confidence.'), 0);
  assert.ok(a.score > b.score);
  assert.match(a.feedback, /Funny/);
  assert.match(b.feedback, /Too funny/);
  assert.equal(interpretShortPreferences("Don't reward confidence. Likes jokes.").confidence, -2);
  assert.equal(interpretShortPreferences('unrecognized preference'), null);
  assert.equal(validPreferences({ ...preferences('Likes humor.'), prompt: 'x'.repeat(81) }), false);
});

test('liking weighs later turns more and does not count a finished turn twice', () => {
  assert.equal(likedScore([]), 0);
  assert.equal(likedScore([40, 80]), 67);
  const room = start();
  const seatId = room.members['person-0'].seatId;
  submit(room, 'person-0', turnKey(room), 'Trust me. I know, I am certain and confident.', room.turnStartedAt + 1);
  claimRound(room, 'person-0', room.turnStartedAt + 2, false);
  const during = view(room, 'person-0', room.turnStartedAt + 2).seats.find(seat => seat.id === seatId).liked;
  assert.equal(during, likedScore([room.submissions[seatId].score]));
  pass(room);
  assert.equal(room.phase, 'feedback');
  assert.equal(view(room, 'person-0', room.deadline - 1).seats.find(seat => seat.id === seatId).liked, during);
});

test('the win pose is public once a suitor is picked', () => {
  const room = start();
  finishReign(room);
  const shown = view(room, 'person-0', room.deadline - 1);
  assert.equal(shown.phase, 'reveal');
  assert.equal(shown.winner.seatId, room.winner.seatId);
  assert.equal(shown.seats.find(seat => seat.id === shown.winner.seatId).liked, likedScore(room.history.map(turn => turn[shown.winner.seatId].score)));
});

test('reset removes every other human and waits for Enter', () => {
  const room = start();
  const previous = room.id;
  submit(room, 'person-0', turnKey(room), 'Hello', room.turnStartedAt + 1);
  const other = start(2);
  resetCourt(other, 'person-0', other.turnStartedAt + 2);
  assert.equal(other.seats.filter(seat => seat.owner).length, 1);
  assert.equal(other.members['person-1'], undefined);
  assert.equal(other.phase, 'lobby');
  enterCourt(other, 'person-0', other.turnStartedAt + 3);
  assert.equal(other.phase, 'dialogue');
  resetCourt(room, 'person-0', room.turnStartedAt + 2);
  assert.notEqual(room.id, previous);
  assert.equal(room.reign, 1);
  assert.equal(room.turn, 0);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.history.length, 0);
  assert.equal(room.seats.find(seat => seat.owner === 'person-0').total, 0);
  assert.equal(room.seats.find(seat => seat.owner === 'person-0').name, 'Player 0');
  advance(room, room.turnStartedAt + 120_000);
  assert.equal(room.phase, 'lobby');
});

test('duplicate names and blank joins fail without occupying extra seats', () => {
  const room = start();
  assert.throws(() => enter(room, 'second', 'player 0', 7000));
  assert.throws(() => enter(room, 'second', '   ', 7000));
  assert.equal(room.seats.filter(s => s.owner).length, 1);
});


test('questions are shared, change each turn, and NPCs answer the current question', () => {
  const room = start(2);
  const questions = new Set();
  for (let turn = 0; turn < TURN_COUNT; turn++) {
    room.turn = turn;
    const question = view(room, 'person-0', 7000).prompt;
    assert.equal(view(room, 'person-1', 7000).prompt, question);
    assert.equal(view(room, null, 7000).prompt, question);
    assert.equal(questionFor(room.reign, turn).question, question);
    questions.add(question);
    for (let seat = 0; seat < 5; seat++) {
      assert.ok(questionFor(room.reign, turn).answers.includes(npcText(seat, turn, room.reign)));
    }
  }
  assert.equal(questions.size, TURN_COUNT);
  assert.notEqual(questionFor(1, 0).question, questionFor(2, 0).question);
});


test('automatic seat → three turns → winner rewrites preferences → new name and next reign', () => {
  const room = createRoom();
  const firstAnswer = "Imagine a new, unusual moon that tells a funny joke. Honestly, I feel nervous asking.";
  const initialQuestion = view(room, null, 0).prompt;
  ensureJoined(room, 'person-0', 0);
  enterCourt(room, 'person-0', 0);
  const seatId = room.members['person-0'].seatId;
  assert.equal(view(room, 'person-0', 0).you.dialogue, null);
  submit(room, 'person-0', turnKey(room), firstAnswer, 0);
  const joined = view(room, 'person-0', 0);
  assert.match(joined.you.name, /^[A-Z][a-z]+$/);
  assert.equal(joined.phase, 'dialogue');
  assert.equal(joined.prompt, initialQuestion);
  assert.equal(joined.you.dialogue.text, firstAnswer);
  assert.equal(joined.you.submitted, true);
  assert.equal(joined.revealedPreference, null);
  assert.throws(() => submit(room, 'person-0', turnKey(room), 'Duplicate', 1));
  for (let turn = 0; turn < TURN_COUNT; turn++) {
    if (turn > 0) submit(room, 'person-0', turnKey(room), firstAnswer, room.turnStartedAt + 1);
    pass(room);
    assert.equal(room.phase, 'feedback');
    assert.equal(room.history.length, turn + 1);
    tick(room, room.deadline);
  }
  assert.equal(room.phase, 'reveal');
  assert.equal(room.winner.seatId, seatId);
  tick(room, room.deadline);
  assert.equal(view(room, 'person-0', room.deadline - 1).canCreate, true);
  const revisedPrompt = room.preferences.prompt.replace('Likes humor', 'Hates humor');
  nextPrincess(room, preferences(revisedPrompt), room.deadline - 1);
  const next = view(room, 'person-0', room.turnStartedAt);
  assert.equal(next.reign, 2);
  assert.equal(next.turn, 0);
  assert.equal(next.you.role, 'suitor');
  assert.notEqual(next.you.name, joined.you.name);
  assert.equal(next.you.seatId, seatId);
  ensureJoined(room, 'person-0', room.turnStartedAt + 1);
  assert.equal(view(room, 'person-0', room.turnStartedAt + 1).you.name, next.you.name);
  assert.doesNotThrow(() => submit(room, 'person-0', turnKey(room), 'Back again.', room.turnStartedAt + 2));
  assert.equal(next.canCreate, false);
  assert.equal(next.revealedPreference, null);
  assert.notEqual(next.prompt, initialQuestion);
  assert.equal(room.preferences.prompt, revisedPrompt);
  assert.equal(room.history.length, 0);
});

test('lineages keep a finished winner, their words, and that princess preference', () => {
  const reigns = [
    { reign: 1, status: 'completed', preferences: { prompt: 'Likes jokes.' }, winner: { seatId: 'a', name: 'Pip' } },
    { reign: 2, status: 'active', preferences: { prompt: 'SECRET' }, winner: null },
    { reign: 3, status: 'reset', preferences: { prompt: 'Gone.' }, winner: { seatId: 'a', name: 'Pip' } },
  ];
  const rounds = [
    { reign: 1, turn: 2, status: 'completed', question: 'Second?', answers: { a: { text: '  Later. ' } } },
    { reign: 1, turn: 1, status: 'completed', question: 'First?', answers: { a: { text: 'Hello.' }, b: { text: 'Nope.' } } },
    { reign: 1, turn: 3, status: 'completed', question: 'Silent?', answers: { a: { text: '   ' } } },
    { reign: 2, turn: 1, status: 'completed', question: 'Now?', answers: { a: { text: 'SECRET LINE' } } },
  ];
  const lines = lineagesFrom(reigns, rounds);
  assert.deepEqual(lines, [{
    reign: 1, preference: 'Likes jokes.', winner: 'Pip',
    said: [{ question: 'First?', text: 'Hello.' }, { question: 'Second?', text: 'Later.' }],
  }]);
});

test('only the final human claims one batch, and all results finish together', () => {
  const room = start(2);
  const first = execute(room, { action: 'say', id: 'person-1', key: turnKey(room), text: 'My answer.', live: true }, 7000);
  assert.equal(first.evaluation, undefined);
  const last = execute(room, { action: 'say', id: 'person-0', key: turnKey(room), text: 'A tiny moon.', live: true }, 7001);
  assert.equal(last.evaluation.suitors.length, room.seats.length);
  assert.equal(last.state.thinking, true);
  assert.equal(execute(room, { action: 'sync', id: 'person-1', live: true }, 7002).evaluation, undefined);
  const evaluations = last.evaluation.suitors.map(s => ({ seatId: s.seatId, text: 'Model rewrite.', reply: 'word '.repeat(40), feedback: 'nice '.repeat(20), score: 80 }));
  const done = execute(room, { action: 'finishRound', id: 'person-0', key: last.evaluation.key, evaluations }, 7003);
  assert.equal(done.state.phase, 'results');
  assert.equal(done.state.thinking, false);
  assert.equal(room.submissions[room.members['person-1'].seatId].text, 'My answer.');
  for (const entry of Object.values(room.submissions)) {
    assert.equal(entry.pending, false);
    assert.ok(entry.reply.length <= 80 && entry.reply.split(/\s+/).length <= 12);
    assert.ok(entry.feedback.length <= 48 && entry.feedback.split(/\s+/).length <= 6);
  }
});

test('expired batch falls back once and ignores late completion', () => {
  const room = start();
  const result = execute(room, { action: 'say', id: 'person-0', key: turnKey(room), text: 'Hello', live: true }, 7000);
  const expired = execute(room, { action: 'sync', id: 'person-0', live: true }, room.deadline);
  assert.equal(expired.evaluation, undefined);
  assert.equal(expired.state.phase, 'results');
  assert.ok(Object.values(room.submissions).every(e => !e.pending && e.mode === 'scripted'));
  const before = structuredClone(room.submissions);
  finishRound(room, result.evaluation.key, 'person-0', [], 28000);
  assert.deepEqual(room.submissions, before);
});

test('automatic seating is idempotent and gives each browser a unique noun', () => {
  const room = createRoom();
  ensureJoined(room, 'first', 0);
  const original = structuredClone(room.members.first);
  ensureJoined(room, 'first', 1);
  assert.equal(room.members.first.name, original.name);
  assert.equal(room.members.first.seatId, original.seatId);
  assert.equal(Object.keys(room.submissions).length, 0);
  enterCourt(room, 'first', 1);
  ensureJoined(room, 'second', 2);
  assert.notEqual(room.members.first.name, room.members.second.name);
  assert.notEqual(room.members.first.seatId, room.members.second.seatId);
  assert.equal(room.seats.filter(seat => seat.owner).length, 2);
});


test('preference edits count insertions, deletions, replacements and Unicode characters', () => {
  assert.equal(preferenceEdits('Likes humor.', 'Likes humor.'), 0);
  assert.equal(preferenceEdits('Likes humor.', 'Likes humor.!'), 1);
  assert.equal(preferenceEdits('Likes humor.', 'Likes humor'), 1);
  assert.equal(preferenceEdits('Likes humor.', 'Likes Humor.'), 1);
  assert.equal(preferenceEdits('Likes humor.', 'Likes 🍄humor.'), 1);
  assert.equal(preferenceEdits('Likes humor.', '  Likes humor.  '), 0);
  assert.equal(preferenceEdits('abc', 'zabc'), 1);
});

test('winner may change exactly 20 characters but not 21, even through completion', () => {
  const room = start();
  room.preferences = preferences('Likes humor.');
  room.phase = 'creating'; room.deadline = 100_000;
  room.winner = { seatId: room.members['person-0'].seatId, name: 'Player 0', memberId: 'person-0', total: 100 };
  const original = room.preferences.prompt;
  const tooMuch = original + 'x'.repeat(21);
  const rejected = execute(room, { action: 'create', id: 'person-0', key: turnKey(room), text: tooMuch }, 7000);
  assert.match(rejected.error.message, /at most 20/);
  assert.equal(room.creationPending, false);
  assert.equal(room.preferences.prompt, original);
  assert.throws(() => nextPrincess(room, { ...room.preferences, prompt: tooMuch }, 7000), /at most 20/);
  const accepted = execute(room, { action: 'create', id: 'person-0', key: turnKey(room), text: original + 'x'.repeat(20) }, 7000);
  assert.ok(accepted.creation);
  const completed = execute(room, { action: 'finishCreation', id: 'person-0', key: accepted.creation.key, preferences: { ...room.preferences, prompt: accepted.creation.prompt } }, 7001);
  assert.equal(completed.error, undefined);
  assert.equal(room.reign, 2);
});

test('creation timeout and NPC succession stay within the edit budget', () => {
  const room = start(5); room.preferences = preferences('Likes confidence.');
  finishReign(room); tick(room, room.deadline);
  const previous = room.preferences.prompt;
  tick(room, room.deadline);
  assert.equal(room.preferences.prompt, previous);
  room.phase = 'creating'; room.deadline = 100_000;
  room.winner = { seatId: room.seats[0].id, name: 'Pip', memberId: null, total: 0 };
  engine.defaultNextPrincess(room, room.turnStartedAt + 1);
  assert.ok(preferenceEdits(previous, room.preferences.prompt) <= 20);
});

test('a human who misses two rounds is replaced by that seat’s NPC', () => {
  const room = start(2);
  const idle = 'person-1';
  const seatId = room.members[idle].seatId;
  const npcName = room.seats.find(seat => seat.id === seatId).npcName;
  for (let turn = 0; turn < 2; turn++) {
    const now = room.turnStartedAt + 1000;
    submit(room, 'person-0', turnKey(room), 'Hello there.', now);
    tick(room, room.deadline);
    claimRound(room, 'person-0', room.deadline, false);
    for (let step = 0; step < room.seats.length && room.phase === 'results'; step++) nextSpeaker(room, 'person-0', room.deadline + step);
    assert.equal(room.phase, 'feedback');
    if (turn === 0) assert.equal(room.members[idle].seatId, seatId);
    tick(room, room.deadline);
  }
  assert.equal(room.seats.find(seat => seat.id === seatId).owner, null);
  assert.equal(room.seats.find(seat => seat.id === seatId).name, npcName);
  assert.equal(room.members[idle].seatId, null);
  assert.equal(view(room, idle, room.deadline).you.role, 'spectator');
});

test('the last silent human times out before the single batch is claimed', () => {
  const room = start(2);
  execute(room, { action: 'say', id: 'person-0', key: turnKey(room), text: 'Hello', live: true }, 7000);
  const deadline = room.deadline;
  heartbeat(room, 'person-1', deadline);
  const result = execute(room, { action: 'sync', id: 'person-0', live: true }, deadline);
  assert.ok(result.evaluation);
  const silent = result.evaluation.suitors.find(s => s.seatId === room.members['person-1'].seatId);
  assert.equal(silent.timedOut, true);
  assert.equal(silent.npc, false);
  const evaluations = result.evaluation.suitors.map(s => ({ seatId: s.seatId, text: 'Invented.', reply: 'Yes.', feedback: 'Bold.', score: 99 }));
  finishRound(room, result.evaluation.key, 'person-0', evaluations, deadline + 1);
  assert.equal(room.submissions[silent.seatId].text, '');
  assert.equal(room.submissions[silent.seatId].score, 0);
});

test('a disconnected unanswered browser becomes an NPC and releases the batch', () => {
  const room = start(2);
  const now = room.turnStartedAt + 1;
  const waiting = execute(room, { action: 'say', id: 'person-0', key: turnKey(room), text: 'Hello', live: true }, now);
  assert.equal(waiting.evaluation, undefined);
  const result = execute(room, { action: 'sync', id: 'person-0', live: true }, now + PRESENCE_MS + 1);
  assert.ok(result.evaluation);
  assert.equal(result.evaluation.suitors.filter(s => !s.npc).length, 1);
  assert.equal(result.state.thinking, true);
});

test('Next shows the selected scorecard immediately and keeps it visible', () => {
  const room = start();
  submit(room, 'person-0', turnKey(room), 'A pocket moon.', 7000);
  claimRound(room, 'person-0', 7001, false);
  nextSpeaker(room, 'person-0', 7002);
  const state = view(room, 'person-0', 7002);
  assert.equal(responseSign(state.seats, state.speakerId).name, room.seats[1].name);
  assert.equal(responseSign(state.seats, state.speakerId).name, room.seats[1].name);
});

test('returning spectator inherits an NPC in results and can answer next round', () => {
  const room = start();
  pass(room);
  ensureJoined(room, 'returning', 8000);
  const first = view(room, 'returning', 8000);
  assert.equal(first.you.role, 'suitor');
  assert.equal(first.you.dialogue, null);
  const count = room.seats.length;
  ensureJoined(room, 'returning', 8001);
  assert.equal(room.seats.length, count);
  assert.equal(view(room, 'returning', 8001).you.seatId, first.you.seatId);
  tick(room, room.deadline);
  assert.doesNotThrow(() => submit(room, 'returning', turnKey(room), 'My own answer.', room.turnStartedAt + 1));
});

test('no scorecards replay during feedback or between rounds', () => {
  const room = start(); pass(room);
  const state = view(room, 'person-0', room.deadline - 1);
  assert.ok(state.seats.some(s => s.mark !== null));
  assert.equal(responseSign(state.seats, state.speakerId), null);
  tick(room, room.deadline);
  const next = view(room, 'person-0', room.turnStartedAt);
  assert.equal(responseSign(next.seats, next.speakerId), null);
});

test('an existing advisor rejoins once with a new name and no duplicate seat', () => {
  const room = start();
  room.creator = { name: room.members['person-0'].name, memberId: 'person-0' };
  const seat = room.seats.find(s => s.owner === 'person-0');
  seat.owner = null; seat.name = seat.npcName; room.members['person-0'].seatId = null;
  ensureJoined(room, 'person-0', 7000);
  const name = room.members['person-0'].name;
  assert.notEqual(name, room.creator.name);
  assert.equal(view(room, 'person-0', 7000).you.role, 'suitor');
  ensureJoined(room, 'person-0', 7001);
  assert.equal(room.members['person-0'].name, name);
  assert.equal(room.seats.filter(s => s.owner === 'person-0').length, 1);
});

test('bots receive only the previously revealed preference, retained across rounds and cleared on reset', () => {
  const room = start();
  assert.equal(room.lastRevealedPreference, null);
  const original = room.preferences.prompt;
  finishReign(room); tick(room, room.deadline);
  const changed = original.replace('Likes humor', 'Hates humor');
  nextPrincess(room, preferences(changed), room.deadline - 1);
  assert.equal(room.lastRevealedPreference, original);
  for (let turn = 0; turn < 2; turn++) {
    submit(room, 'person-0', turnKey(room), 'A moon.', room.turnStartedAt + 1);
    const job = claimRound(room, 'person-0', room.turnStartedAt + 2, true);
    assert.equal(job.lastRevealedPreference, original);
    assert.equal(job.preferences.prompt, changed);
    finishRound(room, job.key, 'person-0', undefined, room.turnStartedAt + 3);
    pass(room); tick(room, room.deadline);
  }
  resetCourt(room, 'person-0', room.turnStartedAt + 1);
  assert.equal(room.lastRevealedPreference, null);
});

for (const capacity of [2, 15]) test(`invite court fits ${capacity} human players and completes a reign`, () => {
  const room = createRoom(capacity);
  for (let i = 0; i < capacity; i++) { enter(room, `person-${i}`, `Player ${i}`, 0); enterCourt(room, `person-${i}`, 1); }
  assert.equal(room.seats.length, capacity);
  assert.equal(room.seats.filter(s => s.owner).length, capacity);
  enter(room, 'overflow', 'Overflow', 2); enterCourt(room, 'overflow', 2);
  assert.equal(view(room, 'overflow', 2).you.role, 'spectator');
  finishReign(room);
  assert.equal(room.history.length, TURN_COUNT);
});

test('sit-out setting applies at succession and lasts exactly one contest', () => {
  const room = start(2); room.ownerId = 'person-0'; room.winnerSitsOut = true;
  room.preferences = preferences('Likes confidence.');
  finishReign(room); tick(room, room.deadline);
  const originalName = room.members['person-0'].name;
  heartbeat(room, 'person-1', room.deadline - 1);
  nextPrincess(room, preferences('Likes confidence.'), room.deadline - 1);
  assert.equal(view(room, 'person-0', room.turnStartedAt).you.role, 'advisor');
  ensureJoined(room, 'person-0', room.turnStartedAt + 1);
  assert.equal(room.members['person-0'].name, originalName);
  assert.equal(room.members['person-0'].seatId, null);
  const changed = execute(room, { action: 'configure', id: 'person-0', winnerSitsOut: false }, room.turnStartedAt + 2);
  assert.equal(changed.error, undefined);
  assert.equal(changed.state.you.role, 'advisor');
  room.phase = 'creating';
  room.winner = { seatId: room.seats[1].id, memberId: 'person-1', name: room.members['person-1'].name, total: 100 };
  nextPrincess(room, preferences('Likes confidence.'), room.turnStartedAt + 3);
  assert.equal(view(room, 'person-0', room.turnStartedAt).you.role, 'suitor');
  assert.notEqual(room.members['person-0'].name, originalName);
  assert.equal(view(room, 'person-1', room.turnStartedAt).you.role, 'suitor');
});

test('timers off allows untimed answers and manual progression through a whole reign', () => {
  const room = start(2); room.ownerId = 'person-0';
  room.preferences = preferences('Likes confidence.');
  execute(room, { action: 'configure', id: 'person-0', timersEnabled: false }, 7000);
  assert.equal(room.deadline, null);
  tick(room, 200000);
  assert.equal(room.phase, 'dialogue');
  assert.equal(Object.keys(room.submissions).length, 0);
  let now = 200001;
  for (let turn = 0; turn < TURN_COUNT; turn++) {
    for (const seat of room.seats.filter(s => s.owner)) execute(room, { action: 'say', id: seat.owner, key: turnKey(room), text: seat.owner === 'person-0' ? 'Trust me. I know, I am certain and confident.' : 'Hello.' }, now++);
    while (room.phase === 'results') execute(room, { action: 'next', id: 'person-0', key: turnKey(room), phase: room.phase, speakerId: room.seats[room.speaker].id }, now++);
    assert.equal(room.phase, 'feedback');
    assert.equal(room.deadline, null);
    tick(room, now += 1000);
    assert.equal(room.phase, 'feedback');
    execute(room, { action: 'next', id: 'person-0', key: turnKey(room), phase: 'feedback' }, now++);
  }
  assert.equal(room.phase, 'reveal');
  tick(room, now += 1000);
  assert.equal(room.phase, 'reveal');
  execute(room, { action: 'next', id: 'person-0', key: turnKey(room), phase: 'reveal' }, now++);
  assert.equal(room.phase, 'creating');
  const created = execute(room, { action: 'create', id: 'person-0', key: turnKey(room), text: room.preferences.prompt }, now++);
  assert.equal(created.error, undefined);
  execute(room, { action: 'finishCreation', id: 'person-0', key: created.creation.key, preferences: room.preferences }, now++);
  assert.equal(room.reign, 2);
  assert.equal(room.deadline, null);
  assert.equal(room.phase, 'dialogue');
});

test('minimum humans gates entry; NPCs do not count', () => {
  const room = createRoom(5); room.minPlayers = 2;
  ensureJoined(room, 'one', 0); enterCourt(room, 'one', 0);
  assert.equal(room.phase, 'lobby');
  assert.ok(room.seats.some(s => !s.owner));
  ensureJoined(room, 'two', 1); enterCourt(room, 'two', 1);
  assert.equal(room.phase, 'dialogue');
});
