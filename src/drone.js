export function createDrone(THREE, scene, material, surfaceMaps = null) {
  const drone = new THREE.Group();
  scene.add(drone);
  const generatedFrame = new THREE.Group();
  drone.add(generatedFrame);
  const importedFrame = new THREE.Group();
  importedFrame.visible = false;
  drone.add(importedFrame);
  const frameMat = material(0x1c3038, .48, .32);
  if (surfaceMaps) {
    frameMat.map = surfaceMaps.color;
    frameMat.roughnessMap = surfaceMaps.roughness;
    frameMat.normalMap = surfaceMaps.normal;
  }
  const edgeMat = material(0xff4652, .28, .45);
  const noseMat = material(0x293f47, .34, .35);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.62, 18, 12), frameMat);
  body.scale.set(.8, .43, 1.1);
  body.castShadow = true;
  generatedFrame.add(body);
  const battery = new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .58), frameMat);
  battery.position.set(0, -.18, .24);
  generatedFrame.add(battery);
  const cameraHousing = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), noseMat);
  cameraHousing.scale.set(1, .78, .82);
  cameraHousing.position.set(0, -.01, -.57);
  generatedFrame.add(cameraHousing);
  const cameraLens = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), material(0x1c596b, .2, .55));
  cameraLens.position.set(0, -.01, -.72);
  generatedFrame.add(cameraLens);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 10), material(0xff6871, .3, .3));
  canopy.scale.set(.68, .24, .58);
  canopy.position.set(0, .17, .12);
  generatedFrame.add(canopy);
  const rotors = [];
  const payloadModels = new THREE.Group();
  drone.add(payloadModels);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const motorX = sx * .88;
    const motorZ = sz * .88;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.09, .085, 1.45), frameMat);
    arm.position.set(motorX * .48, 0, motorZ * .48);
    arm.rotation.y = Math.atan2(motorX, motorZ);
    generatedFrame.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .13, 16), edgeMat);
    motor.position.set(motorX, .07, motorZ);
    generatedFrame.add(motor);
    const rotor = new THREE.Group();
    rotor.position.set(motorX, .15, motorZ);
    generatedFrame.add(rotor);
    for (let k = 0; k < 2; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.075, .018, .56), material(0x87999a, .48, .12));
      blade.rotation.y = k * Math.PI / 2;
      rotor.add(blade);
    }
    rotors.push(rotor);
  }
  const tailLight = new THREE.PointLight(0xff3948, 3, 5);
  tailLight.position.set(0, .3, .85);
  generatedFrame.add(tailLight);

    return { drone, generatedFrame, importedFrame, frameMat, edgeMat, noseMat, rotors, payloadModels };
}
