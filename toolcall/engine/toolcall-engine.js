/*
 * Engine for the "generate vs. call" exhibit. Pure functions over the scripted
 * data in tiers.js, zero DOM. frameAt(tier, t) describes everything visible at
 * time t, so the renderer holds no timing logic and a paused frame is exactly
 * reproducible.
 *
 * There is no randomness anywhere: the variation between runs is authored in
 * tiers.js, and time is the only input.
 */

import {
  GENERATED, OVERREACH, COMPLIANCE, COMPLIANCE_LINES, TOOL_CALL, TOOL_LOG
} from '../tiers/tiers.js';

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function progress(rt, start, end) {
  return clamp01((rt - start) / (end - start));
}

/* What the agent produced on one run, independent of time. */
export function runRecord(tier, run) {
  const runs = tier.shared.runs;
  const r = ((run % runs) + runs) % runs;

  if (tier.mode === 'tool') {
    return {
      run: r,
      codeKind: 'tool',
      code: TOOL_CALL.slice(),
      changed: TOOL_CALL.map(() => false),
      overreach: false,
      logKind: 'structured',
      log: TOOL_LOG.map(([k, v]) => [k, v]),
      undoKind: 'ready',
      usable: true
    };
  }

  const base = GENERATED[r];
  const compliance = tier.logging === 'instructed' ? COMPLIANCE[r] : 'none';
  const code = base.concat(COMPLIANCE_LINES[compliance]);

  /* A line is "changed" when the previous run had something different at the
     same position. Run 1 compares against run 10, so the loop has no seam. */
  const prevIndex = (r + runs - 1) % runs;
  const prevCompliance = tier.logging === 'instructed' ? COMPLIANCE[prevIndex] : 'none';
  const prev = GENERATED[prevIndex].concat(COMPLIANCE_LINES[prevCompliance]);
  const changed = code.map((line, i) => line !== prev[i]);

  let logKind = 'none';
  let undoKind = 'none';
  if (compliance === 'full') {
    logKind = 'freeform';
    undoKind = 'untested';
  } else if (compliance === 'partial') {
    logKind = 'freeform';
    undoKind = 'nolog';
  }

  return {
    run: r,
    codeKind: 'generated',
    code,
    changed,
    overreach: OVERREACH[r],
    logKind,
    /* The log shows what the log() calls wrote, not the calls themselves. */
    log: COMPLIANCE_LINES[compliance].map((line) => line.replace(/^log\("(.*)"\)$/, '$1')),
    undoKind,
    usable: undoKind === 'untested'
  };
}

/* Number of runs in the full cycle that leave a usable undo record. */
export function usableCount(tier) {
  let n = 0;
  for (let i = 0; i < tier.shared.runs; i += 1) {
    if (runRecord(tier, i).usable) n += 1;
  }
  return n;
}

export function cycleLength(tier) {
  return tier.shared.runs * tier.shared.runLength;
}

/* Everything visible at time t (seconds, any non-negative value; it wraps). */
export function frameAt(tier, t) {
  const S = tier.shared;
  const T = S.timing;
  const cycle = cycleLength(tier);
  /* Wrap and split in whole microseconds. Float modulo and subtraction both
     drift (94.6 % 90 is 4.5999..., and 67.6 - 63 is too), which lands an exact
     timing mark on the wrong side - a frozen ?t= frame or the reduced-motion
     opening frame would then show the wrong state. Integer math cannot drift. */
  const US = 1e6;
  const cycleUs = Math.round(cycle * US);
  const runUs = Math.round(S.runLength * US);
  let us = Math.round(t * US) % cycleUs;
  if (us < 0) us += cycleUs;
  const run = Math.floor(us / runUs);
  const rt = (us - run * runUs) / US;
  const rec = runRecord(tier, run);

  const requestText = S.request.join(' ');
  const promptChars = Math.round(progress(rt, 0, T.typeEnd) * requestText.length);

  /* Generated code types out character by character; a tool call is selected,
     not written, so it appears whole. */
  const workP = progress(rt, T.workStart, T.workEnd);
  const totalChars = rec.code.reduce((s, l) => s + l.length, 0);
  let codeChars = rec.codeKind === 'tool'
    ? (rt >= T.workStart ? totalChars : 0)
    : Math.round(workP * totalChars);
  const codeVisible = rec.code.map((line) => {
    const take = Math.min(line.length, Math.max(0, codeChars));
    codeChars -= line.length;
    return line.slice(0, take);
  });

  const dots = [];
  if (rt >= T.typeEnd && rt < T.toAgentEnd) {
    dots.push({ edge: 'request-agent', p: progress(rt, T.typeEnd, T.toAgentEnd) });
  }
  if (rt >= T.workEnd && rt < T.toTargetEnd) {
    dots.push({ edge: 'work-target', p: progress(rt, T.workEnd, T.toTargetEnd) });
  }

  const applied = rt >= T.toTargetEnd;
  let undone = false;
  let undo = 'waiting';
  if (rt >= T.logEnd) undo = rec.undoKind;
  if (rec.undoKind === 'ready' && rt >= T.undoPress) {
    undo = 'pressed';
    if (rt < T.undoEnd) {
      dots.push({ edge: 'work-target', p: 1 - progress(rt, T.undoPress, T.undoEnd), reverse: true });
    } else {
      undo = 'done';
      undone = true;
    }
  }

  const ssids = {};
  for (const name of S.ssids) ssids[name] = { on: true, unintended: false };
  if (applied && !undone) {
    ssids.Guest.on = false;
    if (rec.overreach) {
      for (const name of S.ssids) {
        if (name !== 'Guest') ssids[name] = { on: false, unintended: true };
      }
    }
  }

  const logP = progress(rt, T.logStart, T.logEnd);
  const logLines = rec.logKind === 'none' ? 0 : Math.ceil(logP * rec.log.length);
  const at = T.toTargetEnd.toFixed(1);
  const log = rec.log.map((entry) => (Array.isArray(entry)
    ? [entry[0], entry[1].replace('{run}', String(run + 1)).replace('{at}', at)]
    : entry));

  const pips = [];
  for (let i = 0; i < S.runs; i += 1) {
    const done = i < run || (i === run && rt >= T.logEnd);
    pips.push(done ? (runRecord(tier, i).usable ? 'usable' : 'empty') : 'pending');
  }

  return {
    run,
    runTime: rt,
    prompt: {
      lines: S.request,
      chars: promptChars
    },
    agentActive: rt >= T.toAgentEnd && rt < T.workEnd,
    code: {
      kind: rec.codeKind,
      lines: codeVisible,
      full: rec.code,
      changed: rec.changed,
      started: rt >= T.workStart
    },
    dots,
    ssids,
    log: {
      kind: rec.logKind,
      lines: log,
      shown: logLines,
      reverted: undone
    },
    undo,
    pips
  };
}
