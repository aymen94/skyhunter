export function createMissionCatalog({ outpostTargets, defenseMission, harborTargets, harborEnvironment, highlandTargets, highlandsEnvironment }) {
  return {
    outpost: {
      title: 'OUTPOST KESTREL', heading: 'SECTOR<br /><span>INTERCEPT</span>',
      copy: 'Sweep a remote industrial zone. Disable marked installations and mobile armor.',
      objective: 'CLEAR THE OUTPOST', readiness: 'AIRSPACE CLEAR',
      subtitle: 'Remote outpost sweep.<br />Mixed stationary and moving contacts.',
      completeTitle: 'SECTOR CLEARED', completeDetail: 'ALL HOSTILE ASSETS DISABLED',
      targets: outpostTargets, environment: null, background: 0x8299aa, ground: 0x526365, grid: 0x8c4b56, fog: .0075,
    },
    relay: {
      title: 'RELAY DEFENSE', heading: 'RELAY<br /><span>DEFENSE</span>',
      copy: 'Protect the communications relay from incoming hostile drones.',
      objective: 'PROTECT THE COMMS RELAY', readiness: 'INBOUND CONTACTS',
      subtitle: 'Intercept incoming drones before<br />they reach the protected relay.',
      completeTitle: 'AIRSPACE SECURED', completeDetail: 'ALL INBOUND CONTACTS STOPPED',
      targets: defenseMission.enemies, environment: defenseMission.environment, background: 0xc08d63, ground: 0x806b52, grid: 0xbe765c, fog: .009,
    },
    harbor: {
      title: 'HARBOR WATCH', heading: 'HARBOR<br /><span>WATCH</span>',
      copy: 'Patrol the industrial harbor. Clear marked assets across the container lanes.',
      objective: 'SECURE THE HARBOR', readiness: 'COASTAL PATROL',
      subtitle: 'Industrial harbor patrol.<br />Watch for mobile contacts between docks.',
      completeTitle: 'HARBOR SECURED', completeDetail: 'ALL MARKED CONTACTS CLEARED',
      targets: harborTargets, environment: harborEnvironment, background: 0x587581, ground: 0x3b565d, grid: 0x94545c, fog: .009,
    },
    highlands: {
      title: 'FROSTLINE PASS', heading: 'FROSTLINE<br /><span>PASS</span>',
      copy: 'Navigate a highland pass and disable the marked radar and armor contacts.',
      objective: 'CLEAR THE RIDGELINE', readiness: 'WEATHER WATCH',
      subtitle: 'Highland patrol in low visibility.<br />Follow the ridge beacons between targets.',
      completeTitle: 'PASS SECURED', completeDetail: 'ALL MARKED CONTACTS CLEARED',
      targets: highlandTargets, environment: highlandsEnvironment, background: 0x778a94, ground: 0x626f75, grid: 0xae777b, fog: .013,
    },
  };
}
