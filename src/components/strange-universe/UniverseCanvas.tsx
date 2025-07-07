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

export function UniverseCanvas({ universeType, config, geometries, placedWormholes, onConfigChange }: UniverseCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const geometriesRef = useRef<THREE.Group>(new THREE.Group());
  const placedWormholesRef = useRef<THREE.Group>(new THREE.Group());
  
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  
  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => { onConfigChangeRef.current = onConfigChange; }, [onConfigChange]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    const controls = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      rotation: { x: 0, y: 0 },
    };

    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xBF00FF, 2, 100);
    pointLight.position.set(0, 0, 15);
    scene.add(pointLight);

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
    } else if (universeType === 'red-circle') {
      const circleGeometry = new THREE.TorusGeometry(5, 0.1, 16, 100);
      const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, toneMapped: false });
      const circle = new THREE.Mesh(circleGeometry, circleMaterial);
      circle.name = "red-circle";
      camera.add(circle);
      circle.position.z = -10;
      scene.add(camera);
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
      controls.rotation.x = THREE.MathUtils.clamp(controls.rotation.x, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
      controls.previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      let newDistance = configRef.current.distance + event.deltaY * 0.02;
      newDistance = THREE.MathUtils.clamp(newDistance, 5, 40);
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
      camera.position.x = distance * Math.sin(rotation.y) * Math.cos(rotation.x);
      camera.position.y = distance * Math.sin(rotation.x);
      camera.position.z = distance * Math.cos(rotation.y) * Math.cos(rotation.x);
      camera.lookAt(scene.position);

      stars.rotation.y = elapsedTime * 0.01;
      
      if(universeType === 'wormhole' && wormholeMaterial) {
          wormholeMaterial.uniforms.uTime.value = elapsedTime;
          wormholeMaterial.uniforms.uSpeed.value = wormholeSpeed;
          geometriesRef.current.children.forEach((child, i) => {
              child.rotation.x += 0.002 + i * 0.0001;
              child.rotation.y += 0.002 + i * 0.0001;
          });
      } else if (universeType === 'red-circle') {
          const circle = camera.getObjectByName('red-circle');
          if(circle) {
              const scale = 1.0 + Math.sin(elapsedTime * 2) * 0.1;
              circle.scale.set(scale, scale, scale);
          }
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
