/*
 * topology-engine.js
 *
 * Pure state computation for the network topology visualization.
 * No DOM access, no rendering concerns. Everything operates on plain
 * data: a tier config (nodes, edges, structure) plus a Set of node ids
 * currently toggled down, and returns a plain result object.
 *
 * Redundancy is dispatched per class (single / pair / mesh) plus the
 * site-level bridge fallback. Do NOT replace these with one generic
 * shortest-path pass over the whole graph: pair (active/standby) and
 * mesh (active/active) are different real-world behaviors, and a single
 * generic pass incorrectly lights both members of a pair at once.
 */

export function edgeKey(a, b) {
  return a + '--' + b;
}

/*
 * Pick-one-side resolution for an active/standby pair.
 * isUp must compose the member's own down flag with its upstream chain.
 */
export function resolvePair(primaryId, backupId, isUp) {
  if (isUp(primaryId)) return primaryId;
  if (isUp(backupId)) return backupId;
  return null;
}

/*
 * Active/active mesh reachability.
 * meshEdges: array of { a, b, id } (id is the canonical edge key).
 * An edge is active when both endpoints are up, connected to an up
 * entry, and connected to an up exit. In the dense fabrics used by the
 * tier configs this matches "lies on some surviving entry-to-exit path",
 * and every such edge lights simultaneously (active/active by design).
 * Returns { reachable, activeEdgeIds, forward } where forward is the set
 * of up nodes connected to an up entry (used for reachability display).
 */
export function meshActiveEdges(entryIds, exitIds, meshEdges, isUp) {
  const adjacency = new Map();
  const addAdj = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  };
  for (const e of meshEdges) {
    if (!isUp(e.a) || !isUp(e.b)) continue;
    addAdj(e.a, e.b);
    addAdj(e.b, e.a);
  }

  const flood = (startIds) => {
    const seen = new Set();
    const queue = [];
    for (const id of startIds) {
      if (isUp(id) && !seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const next of adjacency.get(cur) || []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };

  const forward = flood(entryIds);
  const backward = flood(exitIds);

  const activeEdgeIds = new Set();
  for (const e of meshEdges) {
    if (!isUp(e.a) || !isUp(e.b)) continue;
    if (forward.has(e.a) && forward.has(e.b) &&
        backward.has(e.a) && backward.has(e.b)) {
      activeEdgeIds.add(e.id || edgeKey(e.a, e.b));
    }
  }

  const reachable = exitIds.some((x) => isUp(x) && forward.has(x));
  return { reachable, activeEdgeIds, forward };
}

/*
 * Site-level upstream check: does this site's own local fabric (its own
 * ISP tier into its own firewall/switch mesh) still have a surviving
 * path? The bridge edge must never be part of this pass.
 */
export function siteHasLocalUpstream(site, isUp) {
  return meshActiveEdges(site.ispIds, site.switchIds, site.localMeshEdges, isUp).reachable;
}

/*
 * Cross-site fallback. Local is always preferred; the bridge is a
 * last resort that only activates when siteA has zero local upstream.
 * siteB is checked local-only (never its own bridge fallback), which
 * avoids circular dependency: if both sites lose local upstream at the
 * same time, the bridge correctly helps neither.
 */
export function resolveSiteUpstream(siteA, siteB, bridgeEdgeUp, isUp) {
  if (siteHasLocalUpstream(siteA, isUp)) {
    return { reachable: true, viaBridge: false };
  }
  if (bridgeEdgeUp && siteHasLocalUpstream(siteB, isUp)) {
    return { reachable: true, viaBridge: true };
  }
  return { reachable: false, viaBridge: false };
}

/*
 * Sink rollup for one site. Generalizes to any number of sink classes.
 */
export function rollupSinks(reachableFlags) {
  const total = reachableFlags.length;
  const up = reachableFlags.filter(Boolean).length;
  if (up === total) return 'ok';
  if (up === 0) return 'danger';
  return 'warn';
}

/*
 * Global rollup across sites: green only when every site is green,
 * red only when every site is red, amber otherwise. One site fully red
 * while the other covers is a real degraded event and reads amber.
 */
export function rollupGlobal(siteStatuses) {
  if (siteStatuses.every((s) => s === 'ok')) return 'ok';
  if (siteStatuses.every((s) => s === 'danger')) return 'danger';
  return 'warn';
}

/*
 * Main entry point.
 *
 * config: tier config (see tiers.js) with nodes, edges, and a structure
 * block that names each site's fabric roles and sink classes.
 * downSet: Set of node ids currently toggled offline.
 *
 * Returns:
 * {
 *   nodes: Map<id, { down, reachable, role }>,   role: 'active'|'standby'|null
 *   activeEdgeIds: Set<edgeKey>,
 *   sinks: [{ id, label, siteId, reachable }],
 *   sites: [{ id, label, status, viaBridge }],
 *   global: 'ok'|'warn'|'danger'
 * }
 */
export function computeState(config, downSet) {
  const isDown = (id) => downSet.has(id);
  const nodeUp = (id) => !isDown(id);

  const edgeIndex = new Map();
  for (const e of config.edges) {
    const id = edgeKey(e.a, e.b);
    edgeIndex.set(e.a + '|' + e.b, id);
    edgeIndex.set(e.b + '|' + e.a, id);
  }
  const lookupEdge = (a, b) => edgeIndex.get(a + '|' + b);

  const nodes = new Map();
  for (const n of config.nodes) {
    nodes.set(n.id, { down: isDown(n.id), reachable: false, role: null });
  }
  const setNode = (id, patch) => Object.assign(nodes.get(id), patch);

  const activeEdgeIds = new Set();
  const sinksOut = [];
  const sitesOut = [];

  const fabricEdgesFor = (site) => {
    const f = site.fabric;
    const members = new Set([...f.isps, ...f.fws, ...f.switches]);
    return config.edges
      .filter((e) => e.kind !== 'sync' && e.kind !== 'bridge' &&
                     members.has(e.a) && members.has(e.b))
      .map((e) => ({ a: e.a, b: e.b, id: edgeKey(e.a, e.b) }));
  };

  /*
   * Phase 1: local fabric pass per site. Produces, per site:
   * switchUp (Map switchId -> bool), fabric active edges, and enough
   * info for the bridge phase to run afterwards.
   */
  const siteWork = new Map();
  for (const site of config.structure.sites) {
    const work = {
      site,
      switchUp: new Map(),
      fabricActive: new Set(),
      localReachable: false,
      viaBridge: false,
    };
    const f = site.fabric;

    if (f.kind === 'chain') {
      // Serial dependency: each link is up only if everything before it is.
      let upstreamOk = true;
      for (const id of f.chain) {
        const ok = upstreamOk && nodeUp(id);
        setNode(id, { reachable: ok });
        upstreamOk = ok;
      }
      const last = f.chain[f.chain.length - 1];
      work.switchUp.set(last, nodes.get(last).reachable);
      work.localReachable = nodes.get(last).reachable;
      // Chain edges activate later, only if at least one sink is served.
      work.pendingChain = f.chain;
    } else if (f.kind === 'pair-fabric') {
      // WAN pair (roots) then firewall pair, then mesh into the switches.
      const wp = f.wanPair;
      const isUpWan = (id) => nodeUp(id);
      const activeWan = resolvePair(wp.primary, wp.backup, isUpWan);
      for (const id of [wp.primary, wp.backup]) {
        const up = isUpWan(id);
        setNode(id, {
          reachable: up,
          role: !up ? null : (id === activeWan ? 'active' : 'standby'),
        });
      }

      const fp = f.fwPair;
      // A pair member is only up if its own upstream chain is intact:
      // both firewalls are dual-homed to both WANs, so the chain is
      // intact as long as any WAN survives.
      const isUpFw = (id) => nodeUp(id) && activeWan !== null;
      const activeFw = resolvePair(fp.primary, fp.backup, isUpFw);
      for (const id of [fp.primary, fp.backup]) {
        const up = isUpFw(id);
        setNode(id, {
          reachable: up,
          role: !up ? null : (id === activeFw ? 'active' : 'standby'),
        });
      }

      // Mesh pass: entry is ONLY the active firewall. The standby
      // firewall's links must stay dark (active/standby, not
      // active/active) even though the standby itself is healthy.
      const meshEdges = fabricEdgesFor(site).filter((e) => {
        const inCore = (id) => f.switches.includes(id) || id === activeFw;
        return inCore(e.a) && inCore(e.b);
      });
      const pass = activeFw === null
        ? { reachable: false, activeEdgeIds: new Set(), forward: new Set() }
        : meshActiveEdges([activeFw], f.switches, meshEdges, nodeUp);

      for (const sw of f.switches) {
        const ok = pass.forward.has(sw);
        work.switchUp.set(sw, ok);
        setNode(sw, { reachable: ok });
      }
      for (const id of pass.activeEdgeIds) work.fabricActive.add(id);

      // Upstream segment lights only when it feeds a live fabric.
      if (activeWan !== null && activeFw !== null && pass.reachable) {
        const upstreamEdge = lookupEdge(activeWan, activeFw);
        if (upstreamEdge) work.fabricActive.add(upstreamEdge);
      }
      work.localReachable = pass.reachable;
    } else if (f.kind === 'mesh-fabric') {
      // Whole local fabric (ISPs, all firewalls from every stack, and
      // the shared switch mesh) resolved in one reachability pass.
      const meshEdges = fabricEdgesFor(site);
      const pass = meshActiveEdges(f.isps, f.switches, meshEdges, nodeUp);
      work.localPass = pass;
      work.localReachable = pass.reachable;
      work.meshEdgesNoIsp = meshEdges.filter(
        (e) => !f.isps.includes(e.a) && !f.isps.includes(e.b)
      );
    }

    siteWork.set(site.id, work);
  }

  /*
   * Phase 2: bridge resolution for mesh-fabric sites without local
   * upstream. Local is always preferred; the bridges only activate when
   * a site's own ISP tier has zero surviving path into its own fabric.
   * With multiple bridges (one per stack pairing), every usable bridge
   * carries at once (active/active, consistent with the mesh rule).
   */
  const bridges = config.structure.bridges || [];
  for (const site of config.structure.sites) {
    if (site.fabric.kind !== 'mesh-fabric') continue;
    const work = siteWork.get(site.id);
    let pass = work.localPass;
    let usable = work.localReachable;

    if (!work.localReachable && bridges.length > 0) {
      // A bridge is a physically independent stack-to-stack link:
      // usable only while at least one firewall of its paired stack is
      // up at BOTH ends, and only while the donor site still has its
      // own local upstream (checked local-only, never recursively, so
      // two dark sites cannot rescue each other).
      const anyUp = (ids) => ids.some(nodeUp);
      const usableBridges = [];
      for (const bridge of bridges) {
        const thisEnd = bridge.ends.find((end) => end.siteId === site.id);
        const otherEnd = bridge.ends.find((end) => end.siteId !== site.id);
        if (!thisEnd || !otherEnd) continue;
        const otherWork = siteWork.get(otherEnd.siteId);
        if (!otherWork || !otherWork.localReachable) continue;
        if (anyUp(thisEnd.fwIds) && anyUp(otherEnd.fwIds)) {
          usableBridges.push({ bridge, thisEnd });
        }
      }
      if (usableBridges.length > 0) {
        const entries = [...new Set(
          usableBridges.flatMap((u) => u.thisEnd.fwIds.filter(nodeUp))
        )];
        const bridgePass = meshActiveEdges(
          entries,
          site.fabric.switches,
          work.meshEdgesNoIsp,
          nodeUp
        );
        if (bridgePass.reachable) {
          pass = bridgePass;
          usable = true;
          work.viaBridge = true;
          // Light each usable bridge whose landing firewalls actually
          // carry traffic into the fabric (have an active edge).
          const fwCarries = (fw) => work.meshEdgesNoIsp.some(
            (e) => (e.a === fw || e.b === fw) && bridgePass.activeEdgeIds.has(e.id)
          );
          for (const u of usableBridges) {
            if (u.thisEnd.fwIds.some((fw) => nodeUp(fw) && fwCarries(fw))) {
              activeEdgeIds.add(edgeKey(u.bridge.edge.a, u.bridge.edge.b));
            }
          }
        }
      }
    }

    for (const sw of site.fabric.switches) {
      const ok = usable && pass.forward.has(sw);
      work.switchUp.set(sw, ok);
    }
    for (const id of site.fabric.isps.concat(site.fabric.fws, site.fabric.switches)) {
      setNode(id, { reachable: usable ? pass.forward.has(id) : false });
    }
    if (usable) {
      for (const id of pass.activeEdgeIds) work.fabricActive.add(id);
    }
  }

  /*
   * Phase 3: sinks, per-site rollup, chain edge activation.
   */
  for (const site of config.structure.sites) {
    const work = siteWork.get(site.id);
    const swUp = (id) => work.switchUp.get(id) === true;
    const siteSinkFlags = [];

    for (const sink of site.sinks) {
      let reachable = false;
      if (sink.kind === 'single') {
        reachable = nodeUp(sink.node) && swUp(sink.via);
        setNode(sink.node, { reachable });
        if (reachable) {
          const e = lookupEdge(sink.via, sink.node);
          if (e) activeEdgeIds.add(e);
        }
      } else if (sink.kind === 'pair') {
        const members = [sink.primary, sink.backup];
        const isUpMember = (id) => {
          const m = members.find((mm) => mm.node === id);
          return nodeUp(id) && swUp(m.via);
        };
        const active = resolvePair(sink.primary.node, sink.backup.node, isUpMember);
        for (const m of members) {
          const up = isUpMember(m.node);
          setNode(m.node, {
            reachable: up,
            role: !up ? null : (m.node === active ? 'active' : 'standby'),
          });
        }
        reachable = active !== null;
        if (active !== null) {
          const m = members.find((mm) => mm.node === active);
          const e = lookupEdge(m.via, m.node);
          if (e) activeEdgeIds.add(e);
        }
      }
      siteSinkFlags.push(reachable);
      sinksOut.push({ id: sink.id, label: sink.label, siteId: site.id, reachable });
    }

    // Chain fabrics: the serial path lights only when it serves a sink.
    if (work.pendingChain && siteSinkFlags.some(Boolean)) {
      const chain = work.pendingChain;
      for (let i = 0; i < chain.length - 1; i += 1) {
        if (nodes.get(chain[i]).reachable && nodes.get(chain[i + 1]).reachable) {
          const e = lookupEdge(chain[i], chain[i + 1]);
          if (e) activeEdgeIds.add(e);
        }
      }
    }
    for (const id of work.fabricActive) activeEdgeIds.add(id);

    let status = rollupSinks(siteSinkFlags);
    // Riding the bridge is a real degraded state even when it fully
    // masks the downstream impact: cap at amber, never green.
    if (work.viaBridge && status === 'ok') status = 'warn';
    sitesOut.push({
      id: site.id,
      label: site.label,
      status,
      viaBridge: work.viaBridge,
    });
  }

  const global = rollupGlobal(sitesOut.map((s) => s.status));

  return { nodes, activeEdgeIds, sinks: sinksOut, sites: sitesOut, global };
}
