export function createGameplay({ THREE, scene, camera, state, targets, drone, dronePos, velocity, forward, selectedProfile, material, beep, explosionTexture, explosionSound, scoreEl, threatEl, toast, message, crosshair, ammoCount, groundY }) {
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

  function burst(at, color = 0x43ffe0, count = 18) {
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(new THREE.SphereGeometry(.045 + Math.random() * .07, 5, 5), new THREE.MeshBasicMaterial({ color, transparent: true }));
      particle.position.copy(at);
      scene.add(particle);
      state.particles.push({ mesh: particle, velocity: new THREE.Vector3((Math.random() - .5) * 7, Math.random() * 6, (Math.random() - .5) * 7), life: .45 + Math.random() * .55 });
    }
  }

  function playExplosionSound() {
    if (!state.sound || !explosionSound) return;
    explosionSound.currentTime = 0;
    explosionSound.volume = .48;
    explosionSound.play().catch(() => {});
  }

  function explosionFlash(at, playSound = true) {
    if (playSound) playExplosionSound();
    if (explosionTexture) {
      const texture = new THREE.Texture(explosionTexture.image);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1 / 8, 1 / 8);
      texture.colorSpace = explosionTexture.colorSpace;
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, alphaTest: .025, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.position.copy(at);
      mesh.scale.setScalar(6.7);
      mesh.quaternion.copy(camera.quaternion);
      scene.add(mesh);
      state.particles.push({ mesh, texture, material, velocity: new THREE.Vector3(), life: 1.28, maxLife: 1.28, explosionSprite: true });
    }
    for (const [color, startSize, endSize, lifetime] of [
      [0xff6a32, 1.1, 5.1, .48],
      [0xffd27a, .42, 1.18, .24],
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false }),
      );
      mesh.position.copy(at);
      scene.add(mesh);
      state.particles.push({ mesh, velocity: new THREE.Vector3(), life: lifetime, maxLife: lifetime, explosion: true, startSize, endSize });
    }
  }

  function destroyTarget(target, bonus = 1000, showExplosion = true, playSound = true) {
    if (!target?.userData.alive) return;
    target.userData.alive = false;
    target.visible = false;
    const point = targetPoint(target);
    burst(point, 0xff765e, 30);
    if (showExplosion) explosionFlash(point, playSound);
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

  function checkDroneImpact() {
    if (!state.started || state.gameOver || state.respawning) return;
    const groundImpact = dronePos.y <= groundY + .48;
    const contactRadius = Math.max(drone.scale.x, drone.scale.z) * 2.1;
    const target = groundImpact ? null : liveTargets().find((item) =>
      dronePos.distanceTo(targetPoint(item)) <= item.userData.radius + contactRadius,
    );
    if (!groundImpact && !target) return;
    const impactPoint = dronePos.clone();
    burst(impactPoint, 0xff5b3f, 42);
    burst(impactPoint, 0xffc36b, 22);
    if (target) destroyTarget(target, selectedProfile().name === 'KAMIKAZE' ? 1600 : 1000);
    else explosionFlash(impactPoint);
    state.respawning = true;
    state.respawnAt = performance.now() + 1300;
    state.firing = false;
    drone.visible = false;
    velocity.set(0, 0, 0);
    toast.innerHTML = target
      ? `${target.userData.label} HIT - AIRFRAME LOST <span>+${selectedProfile().name === 'KAMIKAZE' ? 1600 : 1000}</span>`
      : 'GROUND IMPACT - AIRFRAME LOST <span>REBUILDING</span>';
    toast.classList.add('show');
    state.toastAt = performance.now();
    beep(95, .3, 'sawtooth', .06);
  }

  function updateDroneRespawn() {
    if (!state.respawning || performance.now() < state.respawnAt) return;
    state.respawning = false;
    if (state.gameOver || liveTargets().length === 0) return;
    dronePos.set(0, 7, 14);
    velocity.set(0, 0, 0);
    drone.position.copy(dronePos);
    drone.rotation.set(0, 0, 0);
    drone.visible = true;
    toast.innerHTML = 'AIRFRAME RESET <span>READY</span>';
    toast.classList.add('show');
    state.toastAt = performance.now();
    beep(520, .12, 'triangle', .025);
  }

  function bombBlast(position, radius = 6) {
    explosionFlash(position);
    burst(position, 0xffb65e, 34);
    for (const target of liveTargets()) {
      const point = targetPoint(target);
      if (point.distanceTo(position) < radius + target.userData.radius * .25) destroyTarget(target, 1200, false, false);
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
      } else if (projectile.type === 'missile') {
        if (!projectile.target?.userData.alive) projectile.target = acquireTarget();
        if (!projectile.target) projectile.life = 0;
        if (projectile.life > 0) {
          const targetPosition = targetPoint(projectile.target);
          const toTarget = targetPosition.sub(projectile.mesh.position).normalize();
          projectile.direction.lerp(toTarget, 1 - Math.exp(-dt * 5.2)).normalize();
          projectile.speed = Math.min(92, projectile.speed + 38 * dt);
          projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * dt);
          projectile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), projectile.direction);
          if (projectile.mesh.position.distanceTo(targetPoint(projectile.target)) < projectile.target.userData.radius * .62) {
            destroyTarget(projectile.target, 1400);
            projectile.life = 0;
          }
        }
        if (projectile.life <= 0) {
          scene.remove(projectile.mesh);
          if (state.activeMissile === projectile) state.activeMissile = null;
          state.bombs.splice(i, 1);
        }
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const particle = state.particles[i];
      particle.life -= dt;
      if (particle.explosionSprite) {
        const progress = 1 - Math.max(0, particle.life) / particle.maxLife;
        const frame = Math.min(63, Math.floor(progress * 64));
        particle.texture.offset.set((frame % 8) / 8, 1 - (Math.floor(frame / 8) + 1) / 8);
        particle.mesh.quaternion.copy(camera.quaternion);
        particle.material.opacity = Math.min(1, Math.max(0, particle.life / .18));
        particle.mesh.scale.setScalar(4.1 + Math.sin(progress * Math.PI) * 2.5);
      } else if (particle.explosion) {
        const progress = 1 - Math.max(0, particle.life) / particle.maxLife;
        particle.mesh.scale.setScalar(particle.startSize + (particle.endSize - particle.startSize) * progress);
        particle.mesh.material.opacity = Math.max(0, 1 - progress) * .85;
      } else {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= 9 * dt;
        particle.mesh.material.opacity = Math.max(0, particle.life);
        particle.mesh.scale.setScalar(Math.max(.1, particle.life));
      }
      if (particle.life <= 0) {
        scene.remove(particle.mesh);
        if (particle.explosionSprite) {
          particle.mesh.geometry.dispose();
          particle.material.map.dispose();
          particle.material.dispose();
        }
        state.particles.splice(i, 1);
      }
    }
  }


    return { liveTargets, targetPoint, droneLocalToWorld, acquireTarget, updateWeapons, updateParticles, checkDroneImpact, updateDroneRespawn };
}
