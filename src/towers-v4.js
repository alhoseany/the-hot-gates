import * as THREE from 'three';

function piece(geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

export function buildTowerV4(group, kind, { std, basic, addBands }) {
  if (kind === 'hero') buildHero(group, std);
  else if (kind === 'archer') buildArcher(group, std);
  else if (kind === 'oil') buildOil(group, std, basic);
  else if (kind === 'scorpion') buildScorpion(group, std);
  else buildHoplite(group, std);
  if (kind !== 'hero' && addBands) addBands(group);
}

function buildHoplite(group, std) {
  const red = std(0xc42318);
  const ink = std(0x1c140e);
  const wood = std(0x8a5a32);
  group.add(piece(new THREE.CylinderGeometry(0.98, 1.05, 0.28, 6), std(0xe7dcc8), 0, 0.14, 0));
  group.add(piece(new THREE.CylinderGeometry(0.62, 0.7, 0.36, 6), std(0xf4e7c8), 0, 0.42, 0));
  const aim = new THREE.Group();
  aim.position.y = 0.62;
  aim.add(piece(new THREE.BoxGeometry(0.42, 0.62, 0.28), red, 0, 0.36, 0));
  aim.add(piece(new THREE.BoxGeometry(0.32, 0.28, 0.28), std(0xf2c9a0), 0, 0.78, 0));
  aim.add(piece(new THREE.BoxGeometry(0.08, 0.5, 0.28), red, 0, 1.12, 0));
  aim.add(piece(new THREE.CircleGeometry(0.58, 16), ink, 0, 0.42, 0.16));
  aim.add(piece(new THREE.CircleGeometry(0.46, 16), red, 0, 0.42, 0.22));
  const spear = piece(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 5), wood, 0.36, 0.72, 0.08);
  spear.rotation.z = -0.16;
  aim.add(spear);
  const tip = piece(new THREE.ConeGeometry(0.08, 0.24, 4), ink, 0.36, 1.58, 0.08);
  tip.rotation.z = -0.16;
  aim.add(tip);
  group.add(aim);
  group.userData.aim = aim;
}

function buildArcher(group, std) {
  const wood = std(0x8a5a32);
  const ink = std(0x1c140e);
  const leaf = std(0x1f6b38);
  group.add(piece(new THREE.CylinderGeometry(0.9, 0.98, 0.22, 6), std(0xe7dcc8), 0, 0.11, 0));
  for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
    group.add(piece(new THREE.BoxGeometry(0.12, 1.35, 0.12), wood, x, 0.78, z));
  }
  group.add(piece(new THREE.BoxGeometry(1.05, 0.12, 1.05), std(0xf4e7c8), 0, 1.5, 0));
  const roof = piece(new THREE.ConeGeometry(0.78, 0.5, 4), leaf, 0, 1.84, 0);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  const aim = new THREE.Group();
  aim.position.y = 1.5;
  aim.add(piece(new THREE.BoxGeometry(0.28, 0.42, 0.22), leaf, 0, 0.28, 0));
  const bow = piece(new THREE.TorusGeometry(0.36, 0.04, 5, 14, Math.PI), ink, 0, 0.34, 0.18);
  bow.rotation.y = Math.PI / 2;
  aim.add(bow);
  aim.add(piece(new THREE.PlaneGeometry(0.34, 0.5), std(0xc42318, { side: THREE.DoubleSide }), 0.46, 0.22, 0));
  group.add(aim);
  group.userData.aim = aim;
}

function buildOil(group, std, basic) {
  group.add(piece(new THREE.CylinderGeometry(0.86, 0.94, 0.26, 6), std(0xe7dcc8), 0, 0.13, 0));
  group.add(piece(new THREE.BoxGeometry(0.72, 0.42, 0.72), std(0x1c140e), 0, 0.44, 0));
  const aim = new THREE.Group();
  aim.position.y = 0.68;
  const pot = piece(new THREE.SphereGeometry(0.4, 7, 5), std(0xc47a28), 0, 0.28, 0);
  pot.scale.y = 0.72;
  aim.add(pot);
  const flame = piece(new THREE.ConeGeometry(0.2, 0.5, 4), basic(0xe23b16), 0, 0.74, 0);
  const core = piece(new THREE.ConeGeometry(0.09, 0.3, 4), basic(0xffe08a), 0, 0.8, 0);
  aim.add(flame, core);
  group.add(aim);
  group.userData.aim = aim;
  group.userData.flame = flame;
  group.userData.core = core;
}

function buildScorpion(group, std) {
  const wood = std(0x6a4328);
  const ink = std(0x1c140e);
  group.add(piece(new THREE.BoxGeometry(1.55, 0.22, 0.95), std(0xe7dcc8), 0, 0.12, 0));
  const aim = new THREE.Group();
  aim.position.y = 0.26;
  aim.add(piece(new THREE.BoxGeometry(0.32, 0.16, 1.2), wood, 0, 0.16, 0.12));
  aim.add(piece(new THREE.BoxGeometry(0.1, 0.1, 1.35), ink, -0.32, 0.3, 0.38));
  aim.add(piece(new THREE.BoxGeometry(0.1, 0.1, 1.35), ink, 0.32, 0.3, 0.38));
  aim.add(piece(new THREE.BoxGeometry(0.78, 0.06, 0.06), ink, 0, 0.3, 0.98));
  aim.add(piece(new THREE.BoxGeometry(0.07, 0.07, 0.95), std(0xf4e7c8), 0, 0.3, 0.42));
  group.add(aim);
  group.userData.aim = aim;
}

function buildHero(group, std) {
  const red = std(0xc42318);
  const aim = new THREE.Group();
  aim.add(piece(new THREE.BoxGeometry(0.52, 0.9, 0.32), red, 0, 0.72, 0));
  aim.add(piece(new THREE.BoxGeometry(0.36, 0.32, 0.32), std(0xf2c9a0), 0, 1.28, 0));
  const crest = piece(new THREE.BoxGeometry(0.46, 0.12, 0.12), red, 0, 1.58, 0);
  aim.add(crest);
  aim.add(piece(new THREE.PlaneGeometry(0.9, 1.1), std(0x7a1420, { side: THREE.DoubleSide }), 0, 0.78, -0.24));
  aim.add(piece(new THREE.CircleGeometry(0.64, 16), std(0x1c140e), -0.32, 0.78, 0.12));
  aim.add(piece(new THREE.CircleGeometry(0.5, 16), std(0xe0a030), -0.32, 0.78, 0.18));
  const spear = piece(new THREE.CylinderGeometry(0.04, 0.04, 1.95, 5), std(0x8a5a32), 0.4, 1.05, 0.1);
  spear.rotation.z = -0.12;
  aim.add(spear);
  group.add(aim);
  group.userData.aim = aim;
  const stamp = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.25, 4),
    new THREE.MeshBasicMaterial({ color: 0x1c140e, side: THREE.DoubleSide }),
  );
  stamp.material.userData.unique = true;
  stamp.rotation.x = -Math.PI / 2;
  stamp.position.y = 0.05;
  stamp.userData.noInk = true;
  group.add(stamp);
}
