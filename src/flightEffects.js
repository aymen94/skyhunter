const WIND = {
  outpost: { speed: 9, color: 0xd2dce0 },
  relay: { speed: 16, color: 0xe5c9a1 },
  harbor: { speed: 22, color: 0xb7d7dc },
  highlands: { speed: 29, color: 0xe1eff2 },
};

export function createFlightEffects({ THREE, scene, app, dronePos, state }) {
  const streakMaterial = new THREE.MeshBasicMaterial({
    color: 0xd2dce0, transparent: true, opacity: .15, depthWrite: false,
  });
  const streakGeometry = new THREE.BoxGeometry(.025, .025, 1.5);
  const streaks = Array.from({ length: 38 }, () => {
    const streak = new THREE.Mesh(streakGeometry, streakMaterial);
    streak.userData.speed = .7 + Math.random() * 1.2;
    scene.add(streak);
    return streak;
  });
  const linkBars = document.querySelector('#signalBars');
  const bars = linkBars ? Array.from(linkBars.children) : [];
  const linkStatus = document.querySelector('#linkStatus');
  const windStatus = document.querySelector('#windSpeed');
  const linkOrigin = new THREE.Vector3(0, 7, 14);

  function update(dt, elapsed) {
    const profile = WIND[state.mission] ?? WIND.outpost;
    const gust = Math.max(0, Math.sin(elapsed * .31) * .55 + Math.sin(elapsed * .83) * .25);
    const windSpeed = profile.speed + gust * 10;
    const direction = new THREE.Vector3(Math.sin(elapsed * .045 + .7), 0, Math.cos(elapsed * .045 + .7)).normalize();
    state.wind = { x: direction.x * windSpeed / 3.6 * .022, z: direction.z * windSpeed / 3.6 * .022 };

    streakMaterial.color.setHex(profile.color);
    streakMaterial.opacity = .08 + Math.min(.25, windSpeed * .005);
    for (const streak of streaks) {
      if (!streak.userData.seeded) {
        streak.position.set(
          dronePos.x + (Math.random() - .5) * 34,
          dronePos.y + (Math.random() - .5) * 19,
          dronePos.z + (Math.random() - .5) * 34,
        );
        streak.userData.seeded = true;
      }
      streak.position.x += (direction.x * (2 + windSpeed * .13) + Math.sin(elapsed + streak.position.z) * .15) * dt * streak.userData.speed;
      streak.position.z += (direction.z * (2 + windSpeed * .13)) * dt * streak.userData.speed;
      streak.rotation.y = Math.atan2(direction.x, direction.z);
      if (streak.position.distanceTo(dronePos) > 29) {
        streak.position.set(
          dronePos.x - direction.x * 18 + (Math.random() - .5) * 18,
          dronePos.y + (Math.random() - .5) * 16,
          dronePos.z - direction.z * 18 + (Math.random() - .5) * 18,
        );
      }
    }

    const distance = dronePos.distanceTo(linkOrigin);
    const quality = THREE.MathUtils.clamp(100 - Math.max(0, distance - 34) * 1.15, 8, 100);
    state.linkQuality = Math.round(quality);
    const linkLabel = quality < 24 ? 'WEAK' : quality < 52 ? 'DEGRADED' : 'STABLE';
    if (linkStatus && linkStatus.textContent !== linkLabel) linkStatus.textContent = linkLabel;
    const windLabel = String(Math.round(windSpeed)).padStart(2, '0');
    if (windStatus && windStatus.textContent !== windLabel) windStatus.textContent = windLabel;
    if (linkBars) {
      bars.forEach((bar, index) => {
        bar.style.opacity = quality > index * 25 ? '1' : '.18';
      });
      linkBars.classList.toggle('weak', quality < 35);
    }
    app.classList.toggle('low-link', quality < 35);
  }

  return { update };
}
