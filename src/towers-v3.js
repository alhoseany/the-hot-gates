import * as THREE from 'three';

function shieldFace(fill, mark) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f3e2b0';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = mark;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(38, 36);
  ctx.lineTo(64, 98);
  ctx.lineTo(90, 36);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.42,
    metalness: 0.28,
  });
  material.userData.unique = true;
  return material;
}

function mesh(geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function aspis(material, radius = 0.34) {
  const shield = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), material);
  shield.castShadow = true;
  return shield;
}

export function buildTowerV3(group, kind, { std, basic, addBands }) {
  if (kind === 'hero') buildHero(group, std, basic);
  else if (kind === 'archer') buildArcher(group, std);
  else if (kind === 'oil') buildOil(group, std, basic);
  else if (kind === 'scorpion') buildScorpion(group, std);
  else buildHoplite(group, std);
  if (kind !== 'hero' && addBands) addBands(group);
}

function buildHoplite(group, std) {
  const stone = std(0x8d867c, { roughness: 0.9 });
  const wood = std(0x6a4a30, { roughness: 0.8 });
  const bronze = std(0xd7b56a, { metalness: 0.72, roughness: 0.28 });
  group.add(mesh(new THREE.CylinderGeometry(0.86, 0.98, 0.22, 10), stone, 0, 0.11, 0));
  group.add(mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.16, 10), std(0xcfc3ae, { roughness: 0.75 }), 0, 0.28, 0));

  const aim = new THREE.Group();
  aim.position.y = 0.36;
  const figure = new THREE.Group();
  figure.add(mesh(new THREE.CapsuleGeometry(0.13, 0.28, 4, 8), std(0x8e1e22), 0, 0.42, -0.08));
  figure.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), std(0xe0c2a0), 0, 0.78, -0.06));
  const helm = mesh(new THREE.ConeGeometry(0.13, 0.16, 8), bronze, 0, 0.9, -0.06);
  figure.add(helm);
  const crest = mesh(new THREE.BoxGeometry(0.06, 0.28, 0.16), std(0xb11c1c), 0, 1.12, -0.06);
  figure.add(crest);
  const shaft = mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.35, 6), wood, 0.16, 0.7, 0.05);
  shaft.rotation.z = -0.18;
  shaft.rotation.x = 0.35;
  figure.add(shaft);
  const head = mesh(new THREE.ConeGeometry(0.05, 0.16, 6), bronze, 0.16, 1.28, 0.28);
  head.rotation.x = 0.35;
  figure.add(head);
  aim.add(figure);

  [-0.28, 0, 0.28].forEach((x, index) => {
    const face = aspis(shieldFace(index === 1 ? '#9c2a24' : '#7a221e', '#f4e2b4'), index === 1 ? 0.3 : 0.24);
    face.position.set(x, 0.48, 0.22);
    aim.add(face);
  });
  group.add(aim);
  group.userData.aim = aim;
}

function buildArcher(group, std) {
  const stone = std(0x7a736a, { roughness: 0.92 });
  const timber = std(0x6b452c, { roughness: 0.78 });
  const cloth = std(0x2f6a38, { roughness: 0.7, side: THREE.DoubleSide });
  group.add(mesh(new THREE.BoxGeometry(1.15, 0.22, 1.15), stone, 0, 0.11, 0));
  const posts = [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]];
  for (const [x, z] of posts) {
    group.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.35, 6), timber, x, 0.78, z));
  }
  group.add(mesh(new THREE.BoxGeometry(1.05, 0.08, 1.05), std(0x8a6240, { roughness: 0.75 }), 0, 1.46, 0));
  for (const [x, z] of posts) {
    const rail = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 5), timber, x * 0.92, 1.64, z * 0.92);
    group.add(rail);
  }
  group.add(mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), timber, 0, 1.76, -0.4));
  group.add(mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), timber, 0, 1.76, 0.4));

  const aim = new THREE.Group();
  aim.position.y = 1.55;
  aim.add(mesh(new THREE.CapsuleGeometry(0.11, 0.22, 3, 8), std(0x3d6a34), 0, 0.32, 0));
  aim.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), std(0xe0c2a0), 0, 0.62, 0));
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 18, Math.PI), std(0xd7b56a, { metalness: 0.4, roughness: 0.35 }));
  bow.rotation.y = Math.PI / 2;
  bow.position.set(0.05, 0.4, 0.16);
  bow.castShadow = true;
  aim.add(bow);
  const banner = mesh(new THREE.PlaneGeometry(0.22, 0.36), cloth, 0.48, 0.7, 0);
  aim.add(banner);
  group.add(aim);
  group.userData.aim = aim;
}

function buildOil(group, std, basic) {
  const stone = std(0x6e6258, { roughness: 0.94 });
  group.add(mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.24, 10), stone, 0, 0.12, 0));
  for (let i = 0; i < 3; i += 1) {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5), std(0x4a4038, { metalness: 0.3 }), 0, 0.48, 0);
    const angle = i * (Math.PI * 2 / 3);
    leg.position.set(Math.cos(angle) * 0.28, 0.48, Math.sin(angle) * 0.28);
    leg.rotation.z = Math.cos(angle) * 0.35;
    leg.rotation.x = -Math.sin(angle) * 0.35;
    group.add(leg);
  }
  const pot = mesh(new THREE.SphereGeometry(0.36, 16, 12), std(0x8a5a32, { metalness: 0.62, roughness: 0.32 }), 0, 0.72, 0);
  pot.scale.y = 0.62;
  group.add(pot);
  const rim = mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 18), std(0xe0c27a, { metalness: 0.7, roughness: 0.25 }), 0, 0.86, 0);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const aim = new THREE.Group();
  aim.position.y = 0.9;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 8), basic(0xff4e12));
  flame.position.y = 0.22;
  const mid = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 7), basic(0xff8a1e));
  mid.position.y = 0.28;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), basic(0xffe08a));
  core.position.y = 0.32;
  const light = new THREE.PointLight(0xff6a22, 1.1, 7, 2);
  light.position.y = 0.3;
  aim.add(flame, mid, core, light);
  group.add(aim);
  group.userData.aim = aim;
  group.userData.flame = flame;
  group.userData.core = core;
}

function buildScorpion(group, std) {
  const stone = std(0x6a645c, { roughness: 0.94 });
  const wood = std(0x5c4030, { roughness: 0.72 });
  const iron = std(0x2a2c30, { metalness: 0.7, roughness: 0.32 });
  const rope = std(0xc2b48a, { roughness: 0.85 });
  group.add(mesh(new THREE.CylinderGeometry(0.7, 0.82, 0.18, 8), stone, 0, 0.09, 0));
  group.add(mesh(new THREE.BoxGeometry(0.7, 0.1, 1.15), wood, 0, 0.24, 0.05));

  const aim = new THREE.Group();
  aim.position.y = 0.32;
  const armGeo = new THREE.BoxGeometry(0.07, 0.08, 1.35);
  const left = mesh(armGeo, wood, -0.22, 0.16, 0.15);
  const right = mesh(armGeo, wood, 0.22, 0.16, 0.15);
  left.rotation.y = 0.08;
  right.rotation.y = -0.08;
  const stock = mesh(new THREE.BoxGeometry(0.1, 0.08, 1.05), std(0x3a3028), 0, 0.1, 0.05);
  const string = mesh(new THREE.BoxGeometry(0.46, 0.015, 0.015), rope, 0, 0.18, -0.48);
  const slider = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.28), iron, 0, 0.16, -0.05);
  const bolt = mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.85, 6), iron, 0, 0.2, 0.28);
  bolt.rotation.x = Math.PI / 2;
  const head = mesh(new THREE.ConeGeometry(0.045, 0.12, 6), std(0xd7c090, { metalness: 0.6, roughness: 0.3 }), 0, 0.2, 0.74);
  head.rotation.x = Math.PI / 2;
  const winch = mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), iron, 0, 0.16, -0.42);
  winch.rotation.y = Math.PI / 2;
  aim.add(left, right, stock, string, slider, bolt, head, winch);
  group.add(aim);
  group.userData.aim = aim;
}

function buildHero(group, std) {
  const bronze = std(0xe0c27a, { metalness: 0.7, roughness: 0.28 });
  const cloth = std(0x9a1c22, { roughness: 0.72, side: THREE.DoubleSide });
  const aim = new THREE.Group();
  aim.add(mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 8), std(0xf2efe8), 0, 0.7, 0));
  aim.add(mesh(new THREE.SphereGeometry(0.13, 12, 8), std(0xe0c2a0), 0, 1.18, 0));
  const helm = mesh(new THREE.SphereGeometry(0.15, 12, 8), bronze, 0, 1.24, 0.02);
  helm.scale.z = 1.15;
  aim.add(helm);
  const crest = mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08), std(0xc81e1e), 0, 1.42, 0);
  aim.add(crest);
  const plume = mesh(new THREE.ConeGeometry(0.07, 0.28, 6), std(0x9a1418), 0, 1.58, -0.02);
  aim.add(plume);
  const cape = mesh(new THREE.PlaneGeometry(0.55, 0.85), cloth, 0, 0.75, -0.16);
  aim.add(cape);
  const shield = aspis(shieldFace('#b08a3e', '#7a1a16'), 0.38);
  shield.position.set(-0.22, 0.78, 0.2);
  aim.add(shield);
  const spear = mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.5, 6), std(0x6a5038), 0.24, 0.95, 0.08);
  spear.rotation.z = -0.12;
  spear.rotation.x = 0.25;
  aim.add(spear);
  const point = mesh(new THREE.ConeGeometry(0.05, 0.18, 6), bronze, 0.24, 1.62, 0.24);
  point.rotation.x = 0.25;
  aim.add(point);
  aim.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.28, 6), bronze, -0.1, 0.2, 0.04));
  aim.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.28, 6), bronze, 0.1, 0.2, 0.04));
  group.add(aim);
  group.userData.aim = aim;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.18, 28),
    new THREE.MeshBasicMaterial({ color: 0xe6c36a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);
}
