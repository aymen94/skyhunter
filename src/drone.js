export function createDrone(THREE, scene, material) {
  const drone = new THREE.Group();
  scene.add(drone);
  const frameMat = material(0x1c3038, .36, .55);
  const edgeMat = material(0xff4652, .28, .45);
  const noseMat = material(0x293f47, .34, .5);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, .36, 1.75), frameMat);
  body.castShadow = true;
  drone.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.47, .85, 4), noseMat);
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.z = Math.PI / 4;
  nose.position.z = -1.08;
  drone.add(nose);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(.62, .2, .65), material(0xff6871, .16, .45));
  canopy.position.set(0, .25, -.18);
  drone.add(canopy);
  const rotors = [];
  const payloadModels = new THREE.Group();
  drone.add(payloadModels);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .11, 1.15), frameMat);
    arm.position.set(sx * .62, 0, sz * .63);
    arm.rotation.y = sx * sz * .44;
    drone.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, .16, 12), edgeMat);
    motor.position.set(sx * .95, .08, sz * .99);
    drone.add(motor);
    const rotor = new THREE.Group();
    rotor.position.set(sx * .95, .19, sz * .99);
    drone.add(rotor);
    for (let k = 0; k < 2; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.13, .025, .86), material(0xb4d4d2, .3, .2));
      blade.rotation.y = k * Math.PI / 2;
      rotor.add(blade);
    }
    rotors.push(rotor);
  }
  const tailLight = new THREE.PointLight(0xff3948, 3, 5);
  tailLight.position.set(0, .3, .85);
  drone.add(tailLight);

    return { drone, frameMat, edgeMat, noseMat, rotors, payloadModels };
}
