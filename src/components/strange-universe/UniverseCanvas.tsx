
"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UniverseType } from './ConfigurationPanel';

interface UniverseCanvasProps {
  universeType: UniverseType;
  config: {
    wormholeSpeed: number;
    distance: number;
    ballSize: number;
    universeSize: number;
  };
  geometries: { id: number; type: 'cube' | 'sphere' | 'cone' }[];
  placedWormholes: { id: number }[];
  onConfigChange: (config: { distance: number }) => void;
}

const wormholeVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const wormholeFragmentShader = `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float time = uTime * uSpeed * 0.1;
    float stripe = smoothstep(0.5, 0.51, fract(uv.x * 5.0 + uv.y * 10.0 - time));
    float wave = sin(uv.y * 20.0 + time * 2.0) * 0.1 + 0.9;
    vec3 color = uColor * (stripe * 0.5 + 0.5) * wave;
    gl_FragColor = vec4(color, 1.0);
  }
`;

type ThrownObject = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  canTeleport: boolean;
};

export function UniverseCanvas({ universeType, config, geometries, placedWormholes, onConfigChange }: UniverseCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const geometriesRef = useRef<THREE.Group>(new THREE.Group());
  const placedWormholesRef = useRef<THREE.Group>(new THREE.Group());
  const thrownObjectsRef = useRef<ThrownObject[]>([]);
  const entrancePortalsRef = useRef<THREE.Mesh[]>([]);
  const exitPortalsRef = useRef<THREE.Mesh[]>([]);
  const characterRef = useRef<THREE.Group>();
  const characterPosition = useRef(new THREE.Vector3(0, 5, 5));
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  
  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => { onConfigChangeRef.current = onConfigChange; }, [onConfigChange]);

  const teleportCooldown = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    camera.position.set(0, 5, configRef.current.distance);

    const controls = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      rotation: { x: -0.2, y: 0 },
    };

    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const starVertices: number[] = [];
    for (let i = 0; i < 15000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    let wormholeMaterial: THREE.ShaderMaterial | null = null;
    if (universeType === 'wormhole') {
      scene.background = new THREE.Color(0x000000);
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
      scene.add(ambientLight);
      const pointLight = new THREE.PointLight(0xBF00FF, 2, 100);
      pointLight.position.set(0, 0, 15);
      scene.add(pointLight);

      const path = new THREE.CatmullRomCurve3(Array.from({ length: 5 }, (_, i) => 
          new THREE.Vector3(Math.sin(i * 1.5) * 15, Math.cos(i) * 10, i * 15 - 30)
      ), true, 'catmullrom', 0.5);
      
      const tubeGeometry = new THREE.TubeGeometry(path, 100, 3, 16, false);
      wormholeMaterial = new THREE.ShaderMaterial({
        vertexShader: wormholeVertexShader,
        fragmentShader: wormholeFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: configRef.current.wormholeSpeed },
          uColor: { value: new THREE.Color(0xBF00FF) },
        },
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      const wormhole = new THREE.Mesh(tubeGeometry, wormholeMaterial);
      scene.add(wormhole);
      scene.add(geometriesRef.current);
      scene.add(placedWormholesRef.current);
    } else if (universeType === 'portals' || universeType === 'infinity') {
      scene.background = new THREE.Color(0x87CEEB); // Light Sky Blue
      scene.fog = new THREE.Fog(0x87CEEB, 75, 400);

      const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x448855, 2.5);
      scene.add(hemisphereLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 4);
      dirLight.position.set(50, 50, 50);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      scene.add(dirLight);

      const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
      const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x99ff99 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);


      characterRef.current = new THREE.Group();
      scene.add(characterRef.current);
      
      const isInfinity = universeType === 'infinity';
      const shirtColor = isInfinity ? 0x0033cc : 0x0066ff;
      const pantsColor = isInfinity ? 0xcc0000 : 0x222266;

      const bodyMaterial = new THREE.MeshStandardMaterial({ color: shirtColor });

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16), bodyMaterial);
      torso.position.y = 1.2;
      torso.castShadow = true;
      characterRef.current.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
      head.position.y = 1.8;
      head.castShadow = true;
      characterRef.current.add(head);

      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      hair.position.y = 1.8;
      characterRef.current.add(hair);
      
      const legMaterial = new THREE.MeshStandardMaterial({ color: pantsColor });
      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.8, 16), legMaterial);
      leftLeg.position.set(-0.15, 0.4, 0);
      leftLeg.castShadow = true;
      characterRef.current.add(leftLeg);

      const rightLeg = leftLeg.clone();
      rightLeg.position.set(0.15, 0.4, 0);
      characterRef.current.add(rightLeg);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7, 16), bodyMaterial);
      arm.castShadow = true;
      
      const leftArm = arm.clone();
      leftArm.position.set(-0.4, 1.2, 0);
      leftArm.rotation.z = Math.PI / 8;
      characterRef.current.add(leftArm);

      const rightArm = arm.clone();
      rightArm.position.set(0.4, 1.2, 0);
      rightArm.rotation.z = -Math.PI / 8;
      characterRef.current.add(rightArm);

      if (isInfinity) {
          const cape = new THREE.Mesh(
              new THREE.BoxGeometry(0.6, 1, 0.1),
              new THREE.MeshStandardMaterial({ color: 0xcc0000 })
          );
          cape.position.y = 0.8;
          cape.position.z = -0.3;
          cape.castShadow = true;
          characterRef.current.add(cape);
      } else {
          const propeller = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.08), new THREE.MeshStandardMaterial({ color: 0xff0000, side: THREE.DoubleSide }));
          propeller.name = 'propeller';
          propeller.position.y = 2.2;
          propeller.castShadow = true;

          const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffdd00 }));
          hatBase.position.y = 2.05;
          hatBase.castShadow = true;
          characterRef.current.add(hatBase);

          const hatStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x999999 }));
          hatStem.position.y = 2.15;
          hatStem.castShadow = true;
          characterRef.current.add(hatStem);
          characterRef.current.add(propeller);
      }
      
      if (isInfinity) {
        for (let i = 0; i < 200; i++) {
          const size = Math.random() * 3 + 1;
          const sphereGeo = new THREE.SphereGeometry(size, 16, 16);
          const sphereMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(Math.random(), Math.random(), Math.random()) });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          const halfWorld = configRef.current.universeSize / 2;
          sphere.position.set(
            (Math.random() - 0.5) * configRef.current.universeSize,
            Math.random() * 20 + size,
            (Math.random() - 0.5) * configRef.current.universeSize,
          );
          sphere.castShadow = true;
          thrownObjectsRef.current.push({ mesh: sphere, velocity: new THREE.Vector3(), canTeleport: false });
          scene.add(sphere);
        }
      } else {
         const grid = new THREE.GridHelper(100, 100);
         scene.add(grid);
      }
    }
    
    const handleKeyboardDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'f', 'p', 'o', 'shift', 'control'].includes(key)) {
        event.preventDefault();
      }
      keysPressed.current[key] = true;

      if (key === 'f') {
        const isInfinity = universeType === 'infinity';
        const throwSpeed = isInfinity ? 2.5 : 0.8;
        const projectileGeometry = new THREE.SphereGeometry(isInfinity ? 2 : configRef.current.ballSize, 16, 16);
        const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.castShadow = true;
        
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        const characterHeadPos = characterPosition.current.clone().add(new THREE.Vector3(0, 1.5, 0));
        projectile.position.copy(characterHeadPos).add(direction.clone().multiplyScalar(isInfinity ? 4 : 1.5));
        
        const velocity = direction.multiplyScalar(throwSpeed);
        if(!isInfinity) {
            velocity.y += 0.2; // slight upward toss
        }
        scene.add(projectile);
        thrownObjectsRef.current.push({ mesh: projectile, velocity, canTeleport: true });
      }

      if ((key === 'p' || key === 'o') && universeType === 'portals' && characterRef.current) {
        const isEntrance = key === 'p';
        const portalColor = isEntrance ? 0x0000ff : 0xff0000;
        const portalsArrayRef = isEntrance ? entrancePortalsRef : exitPortalsRef;
    
        const portalSize = 4;
        const portalGeometry = new THREE.PlaneGeometry(portalSize, portalSize);
        const portalMaterial = new THREE.MeshStandardMaterial({
            color: portalColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        portal.castShadow = true;
    
        const direction = new THREE.Vector3();
        characterRef.current.getWorldDirection(direction);
        direction.multiplyScalar(-1); 
    
        const portalPosition = characterPosition.current.clone().add(direction.multiplyScalar(3));
        portalPosition.y = portalSize / 2;
        portal.position.copy(portalPosition);
    
        portal.rotation.copy(characterRef.current.rotation);
        
        scene.add(portal);
        portalsArrayRef.current.push(portal);
      }
    };
    const handleKeyboardUp = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = false;
    };
    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      controls.isDragging = true;
      controls.previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    const handleMouseUp = () => {
      controls.isDragging = false;
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!controls.isDragging) return;
      event.preventDefault();
      const deltaX = event.clientX - controls.previousMousePosition.x;
      const deltaY = event.clientY - controls.previousMousePosition.y;
      controls.rotation.y += deltaX * 0.005;
      controls.rotation.x -= deltaY * 0.005;
      controls.previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      let newDistance = configRef.current.distance + event.deltaY * 0.05;
      newDistance = THREE.MathUtils.clamp(newDistance, 5, 80);
      onConfigChangeRef.current({ distance: newDistance });
    };

    window.addEventListener('keydown', handleKeyboardDown);
    window.addEventListener('keyup', handleKeyboardUp);
    mount.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    mount.addEventListener('mousemove', handleMouseMove);
    mount.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!mountRef.current) return;
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    handleResize();

    const clock = new THREE.Clock();
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      
      const { rotation } = controls;
      const { distance, wormholeSpeed, universeSize } = configRef.current;
      
      if (universeType === 'portals' || universeType === 'infinity') {
        const isInfinity = universeType === 'infinity';
        const moveSpeed = isInfinity ? 1.0 : 0.2;
        const rotateSpeed = 0.02;
        const camDirection = new THREE.Vector3();
        camera.getWorldDirection(camDirection);

        if (!isInfinity) {
          camDirection.y = 0;
          camDirection.normalize();
        }

        const strafeDirection = new THREE.Vector3();
        strafeDirection.crossVectors(new THREE.Vector3(0, 1, 0), camDirection).normalize();
        
        if (keysPressed.current['w']) characterPosition.current.addScaledVector(camDirection, moveSpeed);
        if (keysPressed.current['s']) characterPosition.current.addScaledVector(camDirection, -moveSpeed);
        if (keysPressed.current['a']) characterPosition.current.addScaledVector(strafeDirection, moveSpeed);
        if (keysPressed.current['d']) characterPosition.current.addScaledVector(strafeDirection, -moveSpeed);
        
        if(isInfinity){
          if(keysPressed.current['shift']) characterPosition.current.y += moveSpeed;
          if(keysPressed.current['control']) characterPosition.current.y -= moveSpeed;
        }

        if (keysPressed.current['q']) controls.rotation.y -= rotateSpeed;
        if (keysPressed.current['e']) controls.rotation.y += rotateSpeed;
        
        if (isInfinity) {
          const halfWorld = universeSize / 2;
          if (characterPosition.current.x > halfWorld) characterPosition.current.x = -halfWorld;
          if (characterPosition.current.x < -halfWorld) characterPosition.current.x = halfWorld;
          if (characterPosition.current.z > halfWorld) characterPosition.current.z = -halfWorld;
          if (characterPosition.current.z < -halfWorld) characterPosition.current.z = halfWorld;
          // optional y-axis wrapping
          // if (characterPosition.current.y > halfWorld) characterPosition.current.y = -halfWorld;
          // if (characterPosition.current.y < -halfWorld) characterPosition.current.y = halfWorld;
        }


        const entrancePortals = entrancePortalsRef.current;
        const exitPortals = exitPortalsRef.current;
        const allPortals = [...entrancePortals, ...exitPortals];

        if (allPortals.length > 0) {
          const teleportThreshold = 2.5;
          const charHeadPos = characterPosition.current.clone().add(new THREE.Vector3(0,1.5,0));
          if (!teleportCooldown.current) {
            let teleported = false;
            if (exitPortals.length > 0) {
              for (const portal of entrancePortals) {
                  if (charHeadPos.distanceTo(portal.position) < teleportThreshold) {
                      const exitPortal = exitPortals[Math.floor(Math.random() * exitPortals.length)];
                      characterPosition.current.copy(exitPortal.position).add(new THREE.Vector3(0,0,1)); // Emerge in front
                      teleportCooldown.current = true;
                      teleported = true;
                      break;
                  }
              }
            }
            if (!teleported && entrancePortals.length > 0) {
                for (const portal of exitPortals) {
                    if (charHeadPos.distanceTo(portal.position) < teleportThreshold) {
                        const entrancePortal = entrancePortals[Math.floor(Math.random() * entrancePortals.length)];
                        characterPosition.current.copy(entrancePortal.position).add(new THREE.Vector3(0,0,1)); // Emerge in front
                        teleportCooldown.current = true;
                        break;
                    }
                }
            }
          } else {
            let clearOfAllPortals = true;
            for (const portal of allPortals) { if (charHeadPos.distanceTo(portal.position) <= teleportThreshold + 1) { clearOfAllPortals = false; break; } }
            if (clearOfAllPortals) { teleportCooldown.current = false; }
          }
          thrownObjectsRef.current.forEach((obj) => {
            if (obj.canTeleport) {
              let teleported = false;
              if (exitPortals.length > 0) {
                  for (const portal of entrancePortals) {
                      if (obj.mesh.position.distanceTo(portal.position) < teleportThreshold) {
                          const exitPortal = exitPortals[Math.floor(Math.random() * exitPortals.length)];
                          obj.mesh.position.copy(exitPortal.position).add(new THREE.Vector3(0,0,1));
                          obj.canTeleport = false;
                          teleported = true;
                          break;
                      }
                  }
              }
              if (!teleported && entrancePortals.length > 0) {
                  for (const portal of exitPortals) {
                      if (obj.mesh.position.distanceTo(portal.position) < teleportThreshold) {
                          const entrancePortal = entrancePortals[Math.floor(Math.random() * entrancePortals.length)];
                          obj.mesh.position.copy(entrancePortal.position).add(new THREE.Vector3(0,0,1));
                          obj.canTeleport = false;
                          break;
                      }
                  }
              }
            } else {
              let clearOfAllPortals = true;
              for (const portal of allPortals) { if (obj.mesh.position.distanceTo(portal.position) <= teleportThreshold + 1) { clearOfAllPortals = false; break; } }
              if (clearOfAllPortals) { obj.canTeleport = true; }
            }
          });
        }
        
        if (!isInfinity) {
          const gravity = new THREE.Vector3(0, -0.01, 0);
          const groundLevel = 0;
          thrownObjectsRef.current.forEach((obj) => {
            const ballRadius = (obj.mesh.geometry as THREE.SphereGeometry).parameters.radius;
            if (obj.mesh.position.y > groundLevel + ballRadius) { obj.velocity.add(gravity); }
            obj.mesh.position.add(obj.velocity);
            if (obj.mesh.position.y < groundLevel + ballRadius) {
              obj.mesh.position.y = groundLevel + ballRadius;
              obj.velocity.y *= -0.3;
              if (Math.abs(obj.velocity.y) < 0.05) { obj.velocity.y = 0; }
            }
          });
        }
        
        const objects = thrownObjectsRef.current;
        for (let i = 0; i < objects.length; i++) {
          for (let j = i + 1; j < objects.length; j++) {
            const obj1 = objects[i];
            const obj2 = objects[j];

            const distVec = new THREE.Vector3().subVectors(obj1.mesh.position, obj2.mesh.position);
            const dist = distVec.length();

            const r1 = (obj1.mesh.geometry as THREE.SphereGeometry).parameters.radius;
            const r2 = (obj2.mesh.geometry as THREE.SphereGeometry).parameters.radius;
            const radiiSum = r1 + r2;

            if (dist < radiiSum) {
              const overlap = radiiSum - dist;
              const separationVec = distVec.clone().normalize().multiplyScalar(overlap * 0.5);
              obj1.mesh.position.add(separationVec);
              obj2.mesh.position.sub(separationVec);

              const normal = distVec.normalize();
              const vRel = new THREE.Vector3().subVectors(obj1.velocity, obj2.velocity);
              const speed = vRel.dot(normal);

              if (speed < 0) {
                const impulse = -speed * 1.8;
                obj1.velocity.add(normal.clone().multiplyScalar(impulse));
                obj2.velocity.sub(normal.clone().multiplyScalar(impulse));
              }
            }
          }
           if (isInfinity) {
              const halfWorld = universeSize / 2;
              if (objects[i].mesh.position.x > halfWorld) objects[i].mesh.position.x = -halfWorld;
              if (objects[i].mesh.position.x < -halfWorld) objects[i].mesh.position.x = halfWorld;
              if (objects[i].mesh.position.z > halfWorld) objects[i].mesh.position.z = -halfWorld;
              if (objects[i].mesh.position.z < -halfWorld) objects[i].mesh.position.z = halfWorld;
            }
        }

        if (characterRef.current) {
          characterRef.current.position.copy(characterPosition.current);
          characterRef.current.rotation.y = rotation.y + Math.PI;

          const propeller = characterRef.current.getObjectByName('propeller');
          if (propeller) { propeller.rotation.y += 0.3; }
        }

        controls.rotation.x = THREE.MathUtils.clamp(controls.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);
        const lookAtPoint = characterPosition.current.clone().add(new THREE.Vector3(0, 1.5, 0));

        const offset = new THREE.Vector3(
          distance * Math.sin(rotation.y) * Math.cos(rotation.x),
          distance * Math.sin(rotation.x),
          distance * Math.cos(rotation.y) * Math.cos(rotation.x)
        );

        camera.position.copy(lookAtPoint).add(offset);
        if(!isInfinity) {
          camera.position.y = Math.max(camera.position.y, 1.0);
        }
        camera.lookAt(lookAtPoint);
      } else {
        controls.rotation.x = THREE.MathUtils.clamp(controls.rotation.x, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
        camera.position.x = distance * Math.sin(rotation.y) * Math.cos(rotation.x);
        camera.position.y = distance * Math.sin(rotation.x);
        camera.position.z = distance * Math.cos(rotation.y) * Math.cos(rotation.x);
        camera.lookAt(scene.position);
      }

      stars.rotation.y = elapsedTime * 0.01;
      
      if(universeType === 'wormhole' && wormholeMaterial) {
          wormholeMaterial.uniforms.uTime.value = elapsedTime;
          wormholeMaterial.uniforms.uSpeed.value = wormholeSpeed;
          geometriesRef.current.children.forEach((child, i) => {
              child.rotation.x += 0.002 + i * 0.0001;
              child.rotation.y += 0.002 + i * 0.0001;
          });
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyboardDown);
      window.removeEventListener('keyup', handleKeyboardUp);
      mount.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('wheel', handleWheel);
      resizeObserver.unobserve(mount);
      
      thrownObjectsRef.current.forEach(obj => {
        scene.remove(obj.mesh);
        obj.mesh.geometry.dispose();
        (obj.mesh.material as THREE.Material).dispose();
      });
      thrownObjectsRef.current = [];
      
      entrancePortalsRef.current.forEach(portal => { scene.remove(portal); portal.geometry.dispose(); (portal.material as THREE.Material).dispose(); });
      exitPortalsRef.current.forEach(portal => { scene.remove(portal); portal.geometry.dispose(); (portal.material as THREE.Material).dispose(); });
      entrancePortalsRef.current = [];
      exitPortalsRef.current = [];

      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material as THREE.Material | THREE.Material[];
          if(Array.isArray(material)) {
            material.forEach(m => m.dispose());
          } else {
            material.dispose();
          }
        }
      });
      scene.clear();
      renderer.dispose();
    };
  }, [universeType, config.universeSize]);

  // Manage geometries
  useEffect(() => {
    if (universeType !== 'wormhole') {
      geometriesRef.current.clear(); // Clear geometries when not in wormhole universe
      return;
    }
    const group = geometriesRef.current;
    
    const currentMeshes = new Map(group.children.map(c => [c.userData.id, c]));
    const geometriesMap = new Map(geometries.map(g => [g.id, g]));

    currentMeshes.forEach((mesh, id) => {
      if(!geometriesMap.has(id)) {
        group.remove(mesh);
      }
    });

    geometriesMap.forEach((geo, id) => {
      if(!currentMeshes.has(id)){
        let geometry: THREE.BufferGeometry;
        const geoScale = 2;
        switch (geo.type) {
          case 'cube': geometry = new THREE.BoxGeometry(geoScale, geoScale, geoScale); break;
          case 'sphere': geometry = new THREE.SphereGeometry(geoScale * 0.75, 32, 16); break;
          case 'cone': geometry = new THREE.ConeGeometry(geoScale * 0.75, geoScale * 1.5, 32); break;
        }
        const material = new THREE.MeshStandardMaterial({
          color: 0x4B0082, metalness: 0.6, roughness: 0.1, emissive: 0x4B0082, emissiveIntensity: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.id = id;
        
        mesh.position.set(
          (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30 - 20
        );
        group.add(mesh);
      }
    })

  }, [geometries, universeType]);

  // Manage placed wormholes
  useEffect(() => {
    if (universeType !== 'wormhole') {
      placedWormholesRef.current.clear(); // Clear wormholes when not in wormhole universe
      return;
    }
    const group = placedWormholesRef.current;
    
    const currentMeshes = new Map(group.children.map(c => [c.userData.id, c]));
    const newItemsMap = new Map(placedWormholes.map(g => [g.id, g]));

    currentMeshes.forEach((mesh, id) => {
      if(!newItemsMap.has(id)) {
        group.remove(mesh);
      }
    });

    newItemsMap.forEach((item, id) => {
      if(!currentMeshes.has(id)){
        const geometry = new THREE.TorusGeometry(1.5, 0.2, 16, 100);
        const material = new THREE.MeshStandardMaterial({
          color: 0xBF00FF, metalness: 0.8, roughness: 0.2, emissive: 0xBF00FF, emissiveIntensity: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.id = id;
        
        mesh.position.set(
          (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40 - 20
        );
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;
        group.add(mesh);
      }
    });
  }, [placedWormholes, universeType]);


  return (
    <>
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      {(universeType === 'portals' || universeType === 'infinity') && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-2xl font-mono pointer-events-none opacity-50 select-none"
        >
          +
        </div>
      )}
    </>
  );
}
