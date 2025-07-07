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

export function UniverseCanvas({ universeType, config, geometries, placedWormholes, onConfigChange, wormholeExit }: UniverseCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const geometriesRef = useRef<THREE.Group>(new THREE.Group());
  const placedWormholesRef = useRef<THREE.Group>(new THREE.Group());
  const wormholeExitObjectRef = useRef<THREE.Mesh>();
  
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  
  const wormholeExitPosRef = useRef(wormholeExit);
  useEffect(() => { wormholeExitPosRef.current = wormholeExit; }, [wormholeExit]);

  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => { onConfigChangeRef.current = onConfigChange; }, [onConfigChange]);

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
      
      const entranceMaterial = new THREE.MeshStandardMaterial({ color: 0xBF00FF, metalness: 0.8, roughness: 0.2, emissive: 0xBF00FF, emissiveIntensity: 2 });
      const entrance = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 16, 100), entranceMaterial);
      entrance.position.set(0, 5, -25);
      entrance.name = 'wormhole-entrance';
      scene.add(entrance);
      
      const exitMaterial = new THREE.MeshStandardMaterial({ color: 0x00FFFF, metalness: 0.8, roughness: 0.2, emissive: 0x00FFFF, emissiveIntensity: 2 });
      wormholeExitObjectRef.current = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 16, 100), exitMaterial);
      wormholeExitObjectRef.current.position.set(wormholeExitPosRef.current.x, 5, wormholeExitPosRef.current.z);
      scene.add(wormholeExitObjectRef.current);
    }
    
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
        controls.rotation.x = THREE.MathUtils.clamp(controls.rotation.x, -Math.PI / 3, Math.PI / 2.5);
        const lookAtPoint = new THREE.Vector3(0, 2, 0);
        camera.position.x = lookAtPoint.x + distance * Math.sin(rotation.y) * Math.cos(rotation.x);
        camera.position.y = lookAtPoint.y + distance * Math.sin(rotation.x);
        camera.position.z = lookAtPoint.z + distance * Math.cos(rotation.y) * Math.cos(rotation.x);
        camera.position.y = Math.max(camera.position.y, 3);
        camera.lookAt(lookAtPoint);

        const entrance = scene.getObjectByName('wormhole-entrance');
        if (entrance) entrance.rotation.y += 0.01;
        if(wormholeExitObjectRef.current) {
          wormholeExitObjectRef.current.position.set(wormholeExitPosRef.current.x, 5, wormholeExitPosRef.current.z);
          wormholeExitObjectRef.current.rotation.y -= 0.01;
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
      mount.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('wheel', handleWheel);
      resizeObserver.unobserve(mount);
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
