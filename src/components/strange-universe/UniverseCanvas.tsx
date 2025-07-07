
"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UniverseType } from './ConfigurationPanel';

interface UniverseCanvasProps {
  universeType: UniverseType;
  config: {
    wormholeSpeed: number;
    distance: number;
  };
  geometries: { id: number; type: 'cube' | 'sphere' | 'cone' }[];
  placedWormholes: { id: number }[];
  onConfigChange: (config: { distance: number }) => void;
  wormholeExit: { x: number, z: number };
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

const fieryGlowVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fieryGlowFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormal;

  // Simple pseudo-random function
  float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  // Noise function
  float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);
    
    float res = mix(
      mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
      mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
  }

  void main() {
    float time = uTime * 0.5;
    
    // Animate noise
    float motion = noise(vNormal.xy * 4.0 + time);
    motion += noise(vNormal.xy * 8.0 + time * 0.5) * 0.5;

    // Rim effect
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    
    // Combine for fire effect
    vec3 fireColor = uColor * rim * (0.5 + motion * 1.5);

    // Make it transparent
    gl_FragColor = vec4(fireColor, (rim + motion) * 0.8);
  }
`;

type ThrownObject = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  canTeleport: boolean;
};

export function UniverseCanvas({ universeType, config, geometries, placedWormholes, onConfigChange, wormholeExit }: UniverseCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const geometriesRef = useRef<THREE.Group>(new THREE.Group());
  const placedWormholesRef = useRef<THREE.Group>(new THREE.Group());
  const thrownObjectsRef = useRef<ThrownObject[]>([]);
  const wormholeExitObjectRef = useRef<THREE.Mesh>();
  const wormholeExitLightRef = useRef<THREE.PointLight>();
  const characterPosition = useRef(new THREE.Vector3(0, 2, 0));
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  
  const wormholeExitPosRef = useRef(wormholeExit);
  useEffect(() => { wormholeExitPosRef.current = wormholeExit; }, [wormholeExit]);

  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => { onConfigChangeRef.current = onConfigChange; }, [onConfigChange]);

  const entranceMaterialRef = useRef<THREE.ShaderMaterial>();
  const exitMaterialRef = useRef<THREE.ShaderMaterial>();
  const teleportCooldown = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    } else if (universeType === 'my-wormholes') {
      scene.background = new THREE.Color(0x111122);
      scene.fog = new THREE.Fog(0x111122, 50, 150);

      const hemisphereLight = new THREE.HemisphereLight(0x77AADD, 0x448855, 1);
      scene.add(hemisphereLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 2);
      dirLight.position.set(20, 30, 10);
      dirLight.castShadow = true;
      scene.add(dirLight);

      const groundGeometry = new THREE.PlaneGeometry(100, 100);
      const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x336633 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const riverGeometry = new THREE.BoxGeometry(100, 0.2, 5);
      const riverMaterial = new THREE.MeshPhongMaterial({ color: 0x3366AA, shininess: 100 });
      const river = new THREE.Mesh(riverGeometry, riverMaterial);
      river.position.y = 0.1;
      river.position.z = -15;
      scene.add(river);

      const mountainMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
      for (let i = 0; i < 20; i++) {
        const height = Math.random() * 20 + 5;
        const radius = Math.random() * 5 + 2;
        const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), mountainMaterial);
        mountain.position.set((Math.random() - 0.5) * 100, height / 2 - 0.1, (Math.random() - 0.5) * 100);
        mountain.castShadow = true;
        scene.add(mountain);
      }
      
      entranceMaterialRef.current = new THREE.ShaderMaterial({
        vertexShader: fieryGlowVertexShader,
        fragmentShader: fieryGlowFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0xFF8C00) },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      const entrance = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 16, 100), entranceMaterialRef.current);
      entrance.position.set(0, 5, -25);
      entrance.name = 'wormhole-entrance';
      scene.add(entrance);
      const entranceLight = new THREE.PointLight(0xFF8C00, 10, 30);
      entranceLight.position.copy(entrance.position);
      scene.add(entranceLight);
      
      exitMaterialRef.current = new THREE.ShaderMaterial({
        vertexShader: fieryGlowVertexShader,
        fragmentShader: fieryGlowFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0x00FFFF) },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      wormholeExitObjectRef.current = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 16, 100), exitMaterialRef.current);
      wormholeExitObjectRef.current.position.set(wormholeExitPosRef.current.x, 5, wormholeExitPosRef.current.z);
      scene.add(wormholeExitObjectRef.current);
      wormholeExitLightRef.current = new THREE.PointLight(0x00FFFF, 10, 30);
      scene.add(wormholeExitLightRef.current);
    }
    
    const handleKeyboardDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'f'].includes(key)) {
        event.preventDefault();
      }
      keysPressed.current[key] = true;

      if (key === 'f' && universeType === 'my-wormholes') {
        const throwSpeed = 0.8;
        const projectileGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.castShadow = true;
        
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        projectile.position.copy(characterPosition.current).add(direction.clone().multiplyScalar(2));
        
        const velocity = direction.multiplyScalar(throwSpeed);
        scene.add(projectile);
        thrownObjectsRef.current.push({ mesh: projectile, velocity, lifetime: 500, canTeleport: true });
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
      const { distance, wormholeSpeed } = configRef.current;
      
      if (universeType === 'my-wormholes') {
        const moveSpeed = 0.2;
        const rotateSpeed = 0.02;
        const camDirection = new THREE.Vector3();
        camera.getWorldDirection(camDirection);
        camDirection.y = 0;
        camDirection.normalize();

        const strafeDirection = new THREE.Vector3();
        strafeDirection.crossVectors(camera.up, camDirection);

        if (keysPressed.current['w']) characterPosition.current.addScaledVector(camDirection, moveSpeed);
        if (keysPressed.current['s']) characterPosition.current.addScaledVector(camDirection, -moveSpeed);
        if (keysPressed.current['a']) characterPosition.current.addScaledVector(strafeDirection, moveSpeed);
        if (keysPressed.current['d']) characterPosition.current.addScaledVector(strafeDirection, -moveSpeed);

        if (keysPressed.current['q']) controls.rotation.y -= rotateSpeed;
        if (keysPressed.current['e']) controls.rotation.y += rotateSpeed;
        
        const entrancePosition = new THREE.Vector3(0, 5, -25);
        const exitPosition = new THREE.Vector3(wormholeExitPosRef.current.x, 5, wormholeExitPosRef.current.z);
        const teleportThreshold = 3.5;

        if (!teleportCooldown.current) {
          if (characterPosition.current.distanceTo(entrancePosition) < teleportThreshold) {
            characterPosition.current.copy(exitPosition);
            teleportCooldown.current = true;
          } else if (characterPosition.current.distanceTo(exitPosition) < teleportThreshold) {
            characterPosition.current.copy(entrancePosition);
            teleportCooldown.current = true;
          }
        } else {
          if (characterPosition.current.distanceTo(entrancePosition) > teleportThreshold + 1 &&
              characterPosition.current.distanceTo(exitPosition) > teleportThreshold + 1) {
            teleportCooldown.current = false;
          }
        }

        const objectsToRemove: number[] = [];
        thrownObjectsRef.current.forEach((obj, index) => {
          obj.mesh.position.add(obj.velocity);
          obj.lifetime--;

          if (obj.lifetime <= 0) {
            objectsToRemove.push(index);
            scene.remove(obj.mesh);
            obj.mesh.geometry.dispose();
            (obj.mesh.material as THREE.Material).dispose();
          } else {
            const distToEntrance = obj.mesh.position.distanceTo(entrancePosition);
            const distToExit = obj.mesh.position.distanceTo(exitPosition);

            if (obj.canTeleport) {
              if (distToEntrance < teleportThreshold) {
                obj.mesh.position.copy(exitPosition);
                obj.canTeleport = false;
              } else if (distToExit < teleportThreshold) {
                obj.mesh.position.copy(entrancePosition);
                obj.canTeleport = false;
              }
            } else {
              if (distToEntrance > teleportThreshold + 1 && distToExit > teleportThreshold + 1) {
                obj.canTeleport = true;
              }
            }
          }
        });

        for (let i = objectsToRemove.length - 1; i >= 0; i--) {
          thrownObjectsRef.current.splice(objectsToRemove[i], 1);
        }

        controls.rotation.x = THREE.MathUtils.clamp(controls.rotation.x, -Math.PI / 3, Math.PI / 2.5);
        const lookAtPoint = characterPosition.current;
        camera.position.x = lookAtPoint.x + distance * Math.sin(rotation.y) * Math.cos(rotation.x);
        camera.position.y = lookAtPoint.y + distance * Math.sin(rotation.x);
        camera.position.z = lookAtPoint.z + distance * Math.cos(rotation.y) * Math.cos(rotation.x);
        camera.position.y = Math.max(camera.position.y, 3);
        camera.lookAt(lookAtPoint);

        if(wormholeExitObjectRef.current && wormholeExitLightRef.current) {
          const exitPos = new THREE.Vector3(wormholeExitPosRef.current.x, 5, wormholeExitPosRef.current.z);
          wormholeExitObjectRef.current.position.copy(exitPos);
          wormholeExitLightRef.current.position.copy(exitPos);
        }

        if (entranceMaterialRef.current) {
            entranceMaterialRef.current.uniforms.uTime.value = elapsedTime;
        }
        if (exitMaterialRef.current) {
            exitMaterialRef.current.uniforms.uTime.value = elapsedTime;
        }

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
  }, [universeType]);

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


  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
}
