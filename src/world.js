export function createTargets(THREE, scene, groundY, material, layout = 'outpost') {
  const targets = [];
  const targetMaterials = {
    steel: material(0x4c5e63, .68, .32),
    dark: material(0x26383d, .53, .42),
    antenna: material(0x97a9a5, .58, .35),
    warning: new THREE.MeshBasicMaterial({ color: 0xff665c }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffb451 }),
  };

  function box(parent, size, color, position, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), color);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function makeAntenna(index, position) {
    const root = new THREE.Group();
    root.position.set(position[0], groundY, position[1]);
    const platform = box(root, [4.1, .38, 3.8], targetMaterials.dark, [0, .2, 0]);
    const cabin = box(root, [2.8, 1.7, 2.4], targetMaterials.steel, [0, 1.1, 0]);
    box(root, [1.4, .25, .9], targetMaterials.dark, [0, 2.06, .2]);
    box(root, [.13, 4.6, .13], targetMaterials.antenna, [0, 4.25, -.45]);
    box(root, [1.9, .11, .11], targetMaterials.antenna, [0, 5.1, -.45]);
    const dish = new THREE.Mesh(new THREE.TorusGeometry(.72, .08, 8, 22), targetMaterials.antenna);
    dish.position.set(.65, 3.8, -.4);
    dish.rotation.y = Math.PI / 2;
    root.add(dish);
    const sweep = new THREE.Group();
    sweep.position.set(-.72, 4.85, -.45);
    root.add(sweep);
    box(sweep, [2.1, .08, .08], targetMaterials.antenna, [0, 0, 0]);
    box(sweep, [.08, .68, .08], targetMaterials.antenna, [0, 0, 0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, .035, 5, 40), new THREE.MeshBasicMaterial({ color: 0xff655c, transparent: true, opacity: .75 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .1;
    root.add(ring);
    const light = new THREE.PointLight(0xff5d53, 1.4, 9);
    light.position.set(0, 4.5, 0);
    root.add(light);
    root.userData = { index, kind: 'antenna', label: `ANTENNA • ${String(index + 1).padStart(2, '0')}`, alive: true, radius: 4.5, hitPoint: new THREE.Vector3(0, 2.4, 0), animation: sweep, lamp: light, phase: Math.random() * 6 };
    scene.add(root);
    targets.push(root);
    return root;
  }

  function makeTank(index, position, patrolWidth) {
    const root = new THREE.Group();
    root.position.set(position[0], groundY, position[1]);
    const treadMat = material(0x202e31, .91, .12);
    const wheelMat = material(0x101a1e, .82, .16);
    box(root, [3.7, .62, 2.3], treadMat, [0, .56, 0]);
    box(root, [2.8, .77, 1.75], targetMaterials.steel, [0, 1.13, 0]);
    // Road wheels and animated track rollers on both sides.
    const rollers = [];
    for (const side of [-1, 1]) {
      for (let j = 0; j < 4; j++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .16, 12), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 1.1, .53, -.78 + j * .52);
        wheel.castShadow = true;
        root.add(wheel);
        rollers.push(wheel);
      }
      box(root, [.12, .66, 2.05], targetMaterials.dark, [side * 1.78, .57, 0]);
    }
    const turret = new THREE.Group();
    turret.position.set(0, 1.58, -.1);
    root.add(turret);
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(.82, 1.05, .5, 8), targetMaterials.dark);
    turretBase.castShadow = true;
    turret.add(turretBase);
    box(turret, [1.2, .58, 1.35], targetMaterials.steel, [0, .34, 0]);
    box(turret, [.2, .18, 2.2], targetMaterials.dark, [0, .5, -1.45]);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .12, 10), targetMaterials.antenna);
    hatch.position.set(.28, .72, .1);
    turret.add(hatch);
    const warning = new THREE.PointLight(0xff6a53, .8, 5);
    warning.position.set(0, 1.2, .2);
    turret.add(warning);
    root.userData = {
      index, kind: 'tank', label: `MOBILE ARMOR • ${String(index + 1).padStart(2, '0')}`,
      alive: true, radius: 2.8, hitPoint: new THREE.Vector3(0, 1.5, 0),
      patrol: { center: position[0], width: patrolWidth, phase: Math.random() * 6, rate: .36 + Math.random() * .16 },
      turret, rollers, warning,
    };
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, .035, 5, 40), new THREE.MeshBasicMaterial({ color: 0xff655c, transparent: true, opacity: .75 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .06;
    root.add(ring);
    scene.add(root);
    targets.push(root);
    return root;
  }

  function makeRelay(index, position) {
    const root = new THREE.Group();
    root.position.set(position[0], groundY, position[1]);
    box(root, [4.8, .42, 3.8], targetMaterials.dark, [0, .22, 0]);
    box(root, [2.9, 2.1, 2.2], targetMaterials.steel, [0, 1.42, 0]);
    box(root, [1.3, .55, .32], new THREE.MeshBasicMaterial({ color: 0xf0444d }), [0, 1.7, -1.14]);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.15, 8), targetMaterials.antenna);
    beacon.position.set(1.35, 3.02, .55);
    root.add(beacon);
    const beaconLamp = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), targetMaterials.lamp);
    beaconLamp.position.set(1.35, 3.68, .55);
    root.add(beaconLamp);
    const radar = new THREE.Group();
    radar.position.set(-1.15, 3.25, .6);
    root.add(radar);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .8, 8), targetMaterials.antenna);
    mast.position.y = .4;
    radar.add(mast);
    box(radar, [2.1, .09, .12], targetMaterials.antenna, [0, .82, 0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, .035, 5, 40), new THREE.MeshBasicMaterial({ color: 0xff655c, transparent: true, opacity: .75 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .08;
    root.add(ring);
    const light = new THREE.PointLight(0xff5d53, 1.2, 8);
    light.position.set(0, 3.8, 0);
    root.add(light);
    root.userData = { index, kind: 'relay', label: `RADAR RELAY • ${String(index + 1).padStart(2, '0')}`, alive: true, radius: 3.7, hitPoint: new THREE.Vector3(0, 1.5, 0), animation: radar, beaconLamp, lamp: light, phase: Math.random() * 6 };
    scene.add(root);
    targets.push(root);
    return root;
  }

  const layouts = {
    outpost: [
      ['antenna', [-13, -33]], ['tank', [12, -40], 5.5], ['relay', [1, -61]],
      ['tank', [-15, -77], 6.5], ['antenna', [17, -91]],
    ],
    harbor: [
      ['relay', [-16, -32]], ['tank', [11, -41], 7], ['antenna', [0, -58]],
      ['tank', [-13, -76], 8], ['relay', [17, -94]],
    ],
    highlands: [
      ['antenna', [-12, -34]], ['relay', [13, -45]], ['tank', [0, -61], 9],
      ['antenna', [-16, -79]], ['tank', [15, -94], 6],
    ],
  };
  (layouts[layout] ?? layouts.outpost).forEach(([kind, position, patrolWidth], index) => {
    if (kind === 'tank') makeTank(index, position, patrolWidth);
    else if (kind === 'relay') makeRelay(index, position);
    else makeAntenna(index, position);
  });

    return targets;
}

export function createScenarioEnvironment(THREE, scene, groundY, material, type) {
  const environment = new THREE.Group();
  const addBox = (size, position, color) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, .82, .12));
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    environment.add(mesh);
  };

  if (type === 'harbor') {
    // Container rows and dock cranes establish a fictional industrial coastline.
    const colors = [0x425d65, 0x78624a, 0x526b62, 0x4a5667];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5; i++) {
        const x = [-32, -40, 32, 40, 48][i];
        const z = -25 - row * 31;
        addBox([8, 3.4, 13], [x, groundY + 1.7, z], colors[(i + row) % colors.length]);
        addBox([8.1, .08, 13.1], [x, groundY + 3.45, z], 0xb5a077);
      }
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(30, 250), material(0x315463, .34, .3));
    water.rotation.x = -Math.PI / 2;
    water.position.set(53, groundY + .04, -67);
    environment.add(water);
    for (const x of [-34, 34]) {
      addBox([.8, 20, .8], [x, groundY + 10, -62], 0x3e535a);
      addBox([1, .8, 30], [x / 2, groundY + 20, -62], 0x687b7d);
      addBox([.4, 18, .4], [x / 2, groundY + 11, -62], 0x687b7d);
    }
  } else if (type === 'highlands') {
    const rock = material(0x75868a, .98, .02);
    const snow = material(0xc1ccca, .86, .02);
    for (let i = 0; i < 22; i++) {
      const x = (i % 2 ? -1 : 1) * (48 + Math.floor(i / 2) % 3 * 7);
      const z = -25 - i * 8;
      const height = 16 + (i % 5) * 4;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(11 + (i % 3) * 3, height, 5), rock);
      peak.position.set(x, groundY + height / 2 - 2, z);
      peak.rotation.y = (i % 4) * .31;
      environment.add(peak);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(4 + (i % 2) * 2, height * .28, 5), snow);
      cap.position.set(x, groundY + height * .83 - 2, z);
      cap.rotation.y = peak.rotation.y;
      environment.add(cap);
    }
    for (let i = 0; i < 12; i++) {
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(.25, 2.5, .25), new THREE.MeshBasicMaterial({ color: 0xf05a63 }));
      beacon.position.set((i % 2 ? 1 : -1) * (23 + (i % 3) * 2), groundY + 1.25, -14 - i * 8);
      environment.add(beacon);
    }
  }
  scene.add(environment);
  return environment;
}

export function createDefenseMission(THREE, scene, groundY, material) {
  const environment = new THREE.Group();
  const enemies = [];
  const resourcePosition = new THREE.Vector3(0, groundY, -72);
  const dark = material(0x303437, .75, .2);
  const sand = material(0x8e7355, .92, .04);
  const metal = material(0x657477, .52, .4);
  const red = material(0x8f352f, .42, .32);
  const glow = new THREE.MeshBasicMaterial({ color: 0xff594c });
  scene.add(environment);

  // A fortified relay and solar array give this mission a distinct desert site.
  const resource = new THREE.Group();
  resource.position.copy(resourcePosition);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, .55, 12), sand);
  pad.position.y = .15;
  resource.add(pad);
  const bunker = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 6), dark);
  bunker.position.set(0, 1.8, 0);
  resource.add(bunker);
  const core = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), metal);
  core.position.set(0, 4.8, 0);
  resource.add(core);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf05a63 }));
  beacon.position.set(0, 7.2, 0);
  resource.add(beacon);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.1, .15, 5, 8), metal);
  mast.position.set(2.3, 6, -.5);
  resource.add(mast);
  const dish = new THREE.Mesh(new THREE.TorusGeometry(1.1, .12, 8, 24), metal);
  dish.position.set(2.3, 8.1, -.5);
  dish.rotation.y = Math.PI / 2;
  resource.add(dish);
  const resourceLight = new THREE.PointLight(0xf0444d, 2.2, 28);
  resourceLight.position.set(0, 8, 0);
  resource.add(resourceLight);
  environment.add(resource);

  const panelMaterial = material(0x344e59, .35, .55);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(5, .14, 2.4), panelMaterial);
      panel.position.set(side * 11, groundY + .9, -64 - row * 5);
      panel.rotation.x = -.22;
      environment.add(panel);
      const support = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.2, .18), dark);
      support.position.set(side * 11, groundY + .35, -64 - row * 5);
      environment.add(support);
    }
  }

  for (let i = 0; i < 18; i++) {
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(2 + Math.random() * 5, 7 + Math.random() * 8, 12 + Math.random() * 20, 5), sand);
    mesa.position.set(-100 + i * 12, 4, -125 - Math.random() * 35);
    mesa.rotation.y = Math.random();
    environment.add(mesa);
  }

  const starts = [
    [-23, 13, -24], [24, 16, -35], [-18, 11, -47], [17, 15, -56],
  ];
  starts.forEach((start, index) => {
    const enemy = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(.9, .28, 1.35), red);
    enemy.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.27, .6, 4), dark);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -.86;
    enemy.add(nose);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), glow);
    eye.position.set(0, 0, -.55);
    enemy.add(eye);
    const rotors = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.1, .08, .82), dark);
      arm.position.set(x * .48, 0, z * .42);
      arm.rotation.y = x * z * .45;
      enemy.add(arm);
      const rotor = new THREE.Group();
      rotor.position.set(x * .76, .12, z * .7);
      const bladeA = new THREE.Mesh(new THREE.BoxGeometry(.08, .025, .72), red);
      const bladeB = bladeA.clone();
      bladeB.rotation.y = Math.PI / 2;
      rotor.add(bladeA, bladeB);
      enemy.add(rotor);
      rotors.push(rotor);
    }
    enemy.position.set(...start);
    enemy.userData = {
      kind: 'enemyDrone', alive: true, radius: 2.2,
      label: `HOSTILE DRONE • ${String(index + 1).padStart(2, '0')}`,
      hitPoint: new THREE.Vector3(0, 0, 0), start: new THREE.Vector3(...start),
      destination: resourcePosition.clone().add(new THREE.Vector3(0, 5, 0)),
      progress: index * .12, initialProgress: index * .12, rate: .021 + index * .0015, rotors,
    };
    scene.add(enemy);
    enemies.push(enemy);
  });

  return { environment, resource, enemies };
}

export function createChargingStations(THREE, scene, groundY, material) {
  function makeStation(position, label, tint) {
    const root = new THREE.Group();
    root.position.set(position[0], groundY, position[1]);
    const baseMat = material(0x303b3d, .72, .25);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.8, .22, 32), baseMat);
    pad.position.y = .1;
    root.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.55, .09, 8, 40), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: .95 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .24;
    root.add(ring);
    for (let i = 0; i < 4; i++) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(1.1, .04, .16), new THREE.MeshBasicMaterial({ color: tint }));
      marker.position.set(0, .24, -2.7 + i * 1.8);
      root.add(marker);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 2.8, 8), material(0x53656a, .48, .45));
    mast.position.set(4.1, 1.4, 0);
    root.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), new THREE.MeshBasicMaterial({ color: tint }));
    beacon.position.set(4.1, 2.9, 0);
    root.add(beacon);
    const light = new THREE.PointLight(tint, 1.2, 11);
    light.position.set(4.1, 2.9, 0);
    root.add(light);
    root.userData.chargePoint = new THREE.Vector3(position[0], groundY + 1.8, position[1]);
    root.userData.label = label;
    root.visible = false;
    scene.add(root);
    return root;
  }

  const outpost = [
    makeStation([0, 10], 'KESTREL FORWARD PAD', 0xf0444d),
    makeStation([0, -52], 'MID-SECTOR CHARGE PAD', 0xf0444d),
    makeStation([12, -82], 'EAST RIDGE CHARGE PAD', 0xf0444d),
  ];
  const relay = [
    makeStation([0, 10], 'RELAY LAUNCH PAD', 0xe7bd70),
    makeStation([12, -43], 'SOLAR FIELD CHARGE PAD', 0xe7bd70),
    makeStation([18, -84], 'RELAY CHARGE PAD', 0xe7bd70),
  ];
  const harbor = [
    makeStation([0, 10], 'HARBOR SERVICE PAD', 0xf0444d),
    makeStation([0, -55], 'DOCK CHARGE PAD', 0xf0444d),
    makeStation([14, -89], 'BREAKWATER CHARGE PAD', 0xf0444d),
  ];
  const highlands = [
    makeStation([0, 10], 'RIDGE LAUNCH PAD', 0x9bc8e0),
    makeStation([-12, -55], 'PASS CHARGE PAD', 0x9bc8e0),
    makeStation([15, -88], 'SUMMIT CHARGE PAD', 0x9bc8e0),
  ];
  return { outpost, relay, harbor, highlands };
}
