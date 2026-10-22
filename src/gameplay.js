export function createGameplay({ THREE, scene, state, targets, drone, dronePos, velocity, forward, selectedProfile, material, beep, scoreEl, threatEl, toast, message, crosshair, ammoCount, groundY }) {
  function liveTargets() { return targets.filter((target) => target.userData.alive); }
  // All targets are direct children of the scene, so compose their world-space
  // hit point from their local position. This avoids reading a stale WASM matrix
  // between the frame's transform updates and the renderer's matrix flush.
  function targetPoint(target) {
    return target.position.clone().add(target.userData.hitPoint);
  }
  function droneLocalToWorld(point) {
    return point.multiply(drone.scale).applyQuaternion(drone.quaternion).add(dronePos);
  }
  function acquireTarget() {
    const aim = forward.clone().applyQuaternion(drone.quaternion).normalize();
    const candidates = liveTargets().map((target) => {
      const point = targetPoint(target);
      const offset = point.clone().sub(dronePos);
      const distance = offset.length();
      const alignment = offset.normalize().dot(aim);
      return { target, point, distance, alignment, score: distance * (1.18 - Math.max(-.2, alignment)) };
    }).filter((entry) => entry.alignment > -.05);
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]?.target ?? liveTargets().sort((a, b) => a.position.distanceTo(dronePos) - b.position.distanceTo(dronePos))[0] ?? null;
  }

  function setFire(on) {
    if (!state.started || state.gameOver) return;
    state.firing = on;
    if (on && state.selected === 'striker') firePulse();
    else if (on && (state.selected === 'bomber' || state.selected === 'fiber')) launchPayload();
  }

  function makeProjectile(color, radius = .09) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), new THREE.MeshBasicMaterial({ color }));
    scene.add(mesh);
    return mesh;
  }

  function firePulse() {
    if (!state.started || state.gameOver || performance.now() - state.shotAt < state.shotCooldown) return;
    state.shotAt = performance.now();
    crosshair.classList.add('firing');
    setTimeout(() => crosshair.classList.remove('firing'), 75);
    beep(180, .055, 'sawtooth', .014);
    const origin = droneLocalToWorld(new THREE.Vector3(0, 0, -1.15));
    const direction = forward.clone().applyQuaternion(drone.quaternion).normalize();
    const mesh = makeProjectile(0x9affeb, .085);
    mesh.position.copy(origin);
    state.bombs.push({ type: 'pulse', mesh, direction, life: 2.3 });
  }

  function launchPayload() {
    const profile = selectedProfile();
    if (state.selected === 'fiber' && state.activeFiber) return;
    if (profile.ammo <= 0) { beep(110, .12, 'square', .025); return; }
    const target = acquireTarget();
    if (!target) return;
    profile.ammo--;
    ammoCount.textContent = String(profile.ammo).padStart(2, '0');
    const origin = droneLocalToWorld(new THREE.Vector3(0, -.25, -.9));
    crosshair.classList.add('firing');
    setTimeout(() => crosshair.classList.remove('firing'), 120);

    if (state.selected === 'bomber') {
      const bomb = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, .82, 8), material(0xd3a44b, .43, .37));
      shell.rotation.x = Math.PI / 2;
      bomb.add(shell);
      const noseCone = new THREE.Mesh(new THREE.ConeGeometry(.18, .32, 8), material(0x665536, .52, .3));
      noseCone.rotation.x = -Math.PI / 2;
      noseCone.position.z = -.54;
      bomb.add(noseCone);
      bomb.position.copy(origin);
      scene.add(bomb);
      state.bombs.push({ type: 'bomb', mesh: bomb, velocity: new THREE.Vector3(0, -1.2, 0), life: 6 });
      beep(230, .13, 'sawtooth', .025);
    } else {
      const mesh = makeProjectile(0xffd37a, .18);
      mesh.position.copy(origin);
      const geometry = new THREE.BufferGeometry().setFromPoints([origin, origin]);
      const cable = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe5bd75, transparent: true, opacity: .65 }));
      scene.add(cable);
      const fiber = { type: 'fiber', mesh, cable, target, life: 6, direction: forward.clone().applyQuaternion(drone.quaternion).normalize() };
      state.bombs.push(fiber);
      state.activeFiber = fiber;
      beep(310, .12, 'triangle', .024);
    }
  }

  function burst(at, color = 0x43ffe0, count = 18) {
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(new THREE.SphereGeometry(.045 + Math.random() * .07, 5, 5), new THREE.MeshBasicMaterial({ color, transparent: true }));
      particle.position.copy(at);
      scene.add(particle);
      state.particles.push({ mesh: particle, velocity: new THREE.Vector3((Math.random() - .5) * 7, Math.random() * 6, (Math.random() - .5) * 7), life: .45 + Math.random() * .55 });
    }
  }

  function destroyTarget(target, bonus = 1000) {
    if (!target?.userData.alive) return;
    target.userData.alive = false;
    target.visible = false;
    const point = targetPoint(target);
    burst(point, 0xff765e, 30);
    state.score += bonus;
    scoreEl.textContent = String(state.score).padStart(6, '0');
    threatEl.textContent = String(liveTargets().length).padStart(2, '0');
    toast.innerHTML = `${target.userData.label} DISABLED <span>+${bonus}</span>`;
    toast.classList.add('show');
    state.toastAt = performance.now();
    beep(660, .12, 'triangle', .035);
    setTimeout(() => beep(880, .16, 'triangle', .026), 80);
    if (liveTargets().length === 0) {
      state.gameOver = true;
      state.firing = false;
      message.querySelector('#messageTitle').textContent = state.missionCompleteTitle ?? 'SECTOR CLEARED';
      message.querySelector('#messageDetail').textContent = state.missionCompleteDetail ?? 'ALL HOSTILE ASSETS DISABLED';
      message.classList.add('visible');
    }
  }

  function checkKamikazeImpact() {
    if (!state.started || state.gameOver || state.respawning || state.selected !== 'kamikaze') return;
    // Collision is based on the target's whole footprint, so a slow or low-speed
    // touch still detonates and the drone does not need to hit one exact point.
    const target = liveTargets().find((item) => dronePos.distanceTo(targetPoint(item)) <= item.userData.radius + 1.1);
    if (!target) return;
    const impactPoint = dronePos.clone();
    burst(impactPoint, 0xff5b3f, 42);
    burst(impactPoint, 0xffc36b, 22);
    destroyTarget(target, 1600);
    state.respawning = true;
    state.respawnAt = performance.now() + 1300;
    state.firing = false;
    drone.visible = false;
    velocity.set(0, 0, 0);
    toast.innerHTML = `${target.userData.label} DESTROYED — FRAME LOST <span>+1600</span>`;
    toast.classList.add('show');
    state.toastAt = performance.now();
    beep(95, .3, 'sawtooth', .06);
  }

  function updateKamikazeRespawn() {
    if (!state.respawning || performance.now() < state.respawnAt) return;
    state.respawning = false;
    if (state.gameOver || liveTargets().length === 0) return;
    dronePos.set(0, 7, 14);
    velocity.set(0, 0, 0);
    drone.position.copy(dronePos);
    drone.rotation.set(0, 0, 0);
    drone.visible = true;
    toast.innerHTML = 'RAZOR REBUILT <span>READY</span>';
    toast.classList.add('show');
    state.toastAt = performance.now();
    beep(520, .12, 'triangle', .025);
  }

  function bombBlast(position, radius = 6) {
    burst(position, 0xffb65e, 34);
    for (const target of liveTargets()) {
      const point = targetPoint(target);
      if (point.distanceTo(position) < radius + target.userData.radius * .25) destroyTarget(target, 1200);
    }
    beep(95, .3, 'sawtooth', .06);
  }

  function updateWeapons(dt) {
    for (let i = state.bombs.length - 1; i >= 0; i--) {
      const projectile = state.bombs[i];
      projectile.life -= dt;
      if (projectile.type === 'pulse') {
        projectile.mesh.position.addScaledVector(projectile.direction, 105 * dt);
        let hit = null;
        for (const target of liveTargets()) if (projectile.mesh.position.distanceTo(targetPoint(target)) < target.userData.radius * .45) { hit = target; break; }
        if (hit) destroyTarget(hit);
        if (hit || projectile.life <= 0) {
          scene.remove(projectile.mesh);
          state.bombs.splice(i, 1);
        }
      } else if (projectile.type === 'bomb') {
        projectile.velocity.y -= 9.8 * dt;
        projectile.mesh.position.addScaledVector(projectile.velocity, dt);
        projectile.mesh.rotation.x += dt * .7;
        if (projectile.mesh.position.y <= groundY + .5 || projectile.life <= 0) {
          const blastPosition = projectile.mesh.position.clone();
          scene.remove(projectile.mesh);
          state.bombs.splice(i, 1);
          bombBlast(blastPosition, 7.3);
        }
      } else if (projectile.type === 'fiber') {
        if (!projectile.target.userData.alive) projectile.target = acquireTarget();
        if (!projectile.target) projectile.life = 0;
        if (projectile.life > 0) {
          const toTarget = targetPoint(projectile.target).sub(projectile.mesh.position).normalize();
          projectile.direction.lerp(toTarget, 1 - Math.exp(-dt * 3.4)).normalize();
          projectile.mesh.position.addScaledVector(projectile.direction, 47 * dt);
          const positions = projectile.cable.geometry.attributes.position.array;
          const start = dronePos;
          const end = projectile.mesh.position;
          positions[0] = start.x; positions[1] = start.y; positions[2] = start.z;
          positions[3] = end.x; positions[4] = end.y; positions[5] = end.z;
          projectile.cable.geometry.attributes.position.needsUpdate = true;
          projectile.cable.geometry.computeBoundingSphere();
          if (projectile.mesh.position.distanceTo(targetPoint(projectile.target)) < projectile.target.userData.radius * .5) {
            destroyTarget(projectile.target, 1400);
            projectile.life = 0;
          }
        }
        if (projectile.life <= 0) {
          scene.remove(projectile.mesh);
          scene.remove(projectile.cable);
          if (state.activeFiber === projectile) state.activeFiber = null;
          state.bombs.splice(i, 1);
        }
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.velocity.y -= 9 * dt;
      particle.mesh.material.opacity = Math.max(0, particle.life);
      particle.mesh.scale.setScalar(Math.max(.1, particle.life));
      if (particle.life <= 0) {
        scene.remove(particle.mesh);
        state.particles.splice(i, 1);
      }
    }
  }


    return { liveTargets, targetPoint, droneLocalToWorld, acquireTarget, setFire, updateWeapons, updateParticles, checkKamikazeImpact, updateKamikazeRespawn };
}
