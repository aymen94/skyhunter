export function createFlightController({ THREE, keys, drone, dronePos, velocity, selectedProfile, camera, rotors, targets, liveTargets, groundY, state }) {
  function updateFlight(dt) {
    if (state.batteryDepleted) {
      if (!state.flightStopped) {
        velocity.set(0, 0, 0);
        dronePos.y = Math.max(groundY + .3, dronePos.y - dt * 3.5);
        drone.position.copy(dronePos);
        drone.rotation.x = 0;
        drone.rotation.z = 0;
        for (const rotor of rotors) rotor.rotation.y += dt * 8;
        if (dronePos.y <= groundY + .3) state.flightStopped = true;
      }
      const landingCamera = dronePos.clone().add(new THREE.Vector3(0, 1.3, 2.1));
      camera.position.lerp(landingCamera, 1 - Math.exp(-dt * 2.1));
      camera.lookAt(dronePos);
      return;
    }
    const profile = selectedProfile();
    const cameraInput = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0);
    state.cameraAimOffset = THREE.MathUtils.clamp((state.cameraAimOffset ?? 0) + cameraInput * dt * 8, -12, 12);
    const boost = keys.has('shift');
    const maxSpeed = profile.speed * (boost ? 1.5 : 1);
    const yawInput = (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0);
    drone.rotation.y -= yawInput * dt * 1.45;
    const localInput = new THREE.Vector3(
      (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0),
      (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0),
      (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0),
    );
    const hasInput = localInput.lengthSq() > 0;
    if (hasInput) localInput.normalize();
    const desiredVelocity = localInput.applyQuaternion(drone.quaternion).multiplyScalar(maxSpeed);
    velocity.lerp(desiredVelocity, 1 - Math.exp(-dt * 2.7));
    if (!hasInput) velocity.multiplyScalar(Math.exp(-dt * .65));
    dronePos.addScaledVector(velocity, dt);
    dronePos.x = THREE.MathUtils.clamp(dronePos.x, -36, 36);
    // Keep the frame just above the terrain so it can skim low and hit ground targets.
    dronePos.y = THREE.MathUtils.clamp(dronePos.y, groundY + 0.3, profile.altitude);
    // The mission targets extend far down the sector; keep the flight corridor open to them.
    dronePos.z = THREE.MathUtils.clamp(dronePos.z, -110, 31);
    drone.position.copy(dronePos);
    drone.rotation.z = THREE.MathUtils.clamp(-velocity.x * .035, -.42, .42);
    drone.rotation.x = THREE.MathUtils.clamp(velocity.z * .027, -.35, .35);
    for (const rotor of rotors) rotor.rotation.y += dt * (boost ? 105 : 68);

    if (state.cameraMode === 'first') {
      // Pilot view: sit on the nose and look along the heading, tilted by the camera angle keys.
      drone.visible = false;
      camera.position.copy(dronePos.clone().add(new THREE.Vector3(0, .12, -.2).applyQuaternion(drone.quaternion)));
      const lookTarget = dronePos.clone().add(new THREE.Vector3(0, 0, -10).applyQuaternion(drone.quaternion));
      lookTarget.y += state.cameraAimOffset ?? 0;
      camera.lookAt(lookTarget);
      return;
    }
    if (!state.respawning) drone.visible = true;

    const heightAgl = dronePos.y - groundY;
    const groundView = 1 - THREE.MathUtils.clamp(heightAgl / 10, 0, 1);
    const cameraOffset = new THREE.Vector3(0, 1.3 + groundView * .35, 2.1).applyQuaternion(drone.quaternion);
    camera.position.lerp(dronePos.clone().add(cameraOffset), 1 - Math.exp(-dt * 2.1));
    const lookAhead = new THREE.Vector3(0, 0, -6).applyQuaternion(drone.quaternion);
    const lookTarget = dronePos.clone().add(lookAhead);
    lookTarget.y = THREE.MathUtils.lerp(dronePos.y + .8, groundY + .7, groundView) + (state.cameraAimOffset ?? 0);
    camera.lookAt(lookTarget);
  }

  function updateTargets(dt, elapsed) {
    for (const target of liveTargets()) {
      const data = target.userData;
      if (data.kind === 'tank') {
        const patrol = data.patrol;
        const previousX = target.position.x;
        target.position.x = patrol.center + Math.sin(elapsed * patrol.rate + patrol.phase) * patrol.width;
        const dx = target.position.x - previousX;
        if (Math.abs(dx) > .001) target.rotation.y = dx > 0 ? -Math.PI / 2 : Math.PI / 2;
        data.turret.rotation.y = Math.sin(elapsed * .72 + patrol.phase) * .48;
        for (const roller of data.rollers) roller.rotation.x += dt * 2.3;
        data.warning.intensity = .65 + Math.sin(elapsed * 4 + patrol.phase) * .24;
      }
      if (data.kind === 'antenna') {
        data.animation.rotation.y += dt * .7;
        data.lamp.intensity = .85 + Math.max(0, Math.sin(elapsed * 3 + data.phase)) * 1.6;
      }
      if (data.kind === 'relay') {
        data.animation.rotation.y += dt * 1.1;
        data.beaconLamp.material.color.setHex(Math.sin(elapsed * 4 + data.phase) > 0 ? 0xffb451 : 0xff685c);
        data.lamp.intensity = .8 + Math.max(0, Math.sin(elapsed * 4 + data.phase)) * 1.2;
      }
      if (data.kind === 'enemyDrone') {
        for (const rotor of data.rotors) rotor.rotation.y += dt * 76;
        if (!state.started || state.gameOver) continue;
        data.progress += dt * data.rate;
        if (data.progress >= 1) {
          data.progress = 0;
          state.resourceHealth = Math.max(0, state.resourceHealth - 25);
        }
        target.position.copy(data.start).lerp(data.destination, data.progress);
        target.position.y += Math.sin(elapsed * 2.8 + data.initialProgress * 11) * .45;
        const direction = data.destination.clone().sub(data.start);
        target.rotation.y = Math.atan2(-direction.x, -direction.z);
      }
    }
  }

  return { updateFlight, updateTargets };
}
