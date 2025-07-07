"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface UniverseCanvasProps {
  config: {
    wormholeSpeed: number;
  };
  geometries: { id: number; type: 'cube' | 'sphere' | 'cone' }[];
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

export function UniverseCanvas({ config, geometries }: UniverseCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const geometriesRef = useRef<THREE.Group>(new THREE.Group());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef({
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    rotation: { x: 0, y: 0 },
    distance: 15,
  });

  useEffect(() => {
    if (!mountRef.current || rendererRef.current) return;
    const mount = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xBF00FF, 2, 100);
    pointLight.position.set(0, 0, 15);
    scene.add(pointLight);

    const starVertices = [];
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

    const path = new THREE.CatmullRomCurve3(Array.from({ length: 5 }, (_, i) => 
        new THREE.Vector3(Math.sin(i * 1.5) * 15, Math.cos(i) * 10, i * 15 - 30)
    ), true, 'catmullrom', 0.5);
    
    const tubeGeometry = new THREE.TubeGeometry(path, 100, 3, 16, false);
    const wormholeMaterial = new THREE.ShaderMaterial({
      vertexShader: wormholeVertexShader,
      fragmentShader: wormholeFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: config.wormholeSpeed },
        uColor: { value: new THREE.Color(0xBF00FF) },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const wormhole = new THREE.Mesh(tubeGeometry, wormholeMaterial);
    scene.add(wormhole);

    scene.add(geometriesRef.current);

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      controlsRef.current.isDragging = true;
      controlsRef.current.previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = (event: MouseEvent) => {
      controlsRef.current.isDragging = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!controlsRef.current.isDragging) return;
      event.preventDefault();

      const deltaX = event.clientX - controlsRef.current.previousMousePosition.x;
      const deltaY = event.clientY - controlsRef.current.previousMousePosition.y;

      controlsRef.current.rotation.y += deltaX * 0.005;
      controlsRef.current.rotation.x -= deltaY * 0.005;

      controlsRef.current.rotation.x = THREE.MathUtils.clamp(controlsRef.current.rotation.x, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);

      controlsRef.current.previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      controlsRef.current.distance += event.deltaY * 0.02;
      controlsRef.current.distance = THREE.MathUtils.clamp(controlsRef.current.distance, 5, 40);
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
    const animate = () => {
      if(!rendererRef.current) return;
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      
      const { rotation, distance } = controlsRef.current;
      camera.position.x = distance * Math.sin(rotation.y) * Math.cos(rotation.x);
      camera.position.y = distance * Math.sin(rotation.x);
      camera.position.z = distance * Math.cos(rotation.y) * Math.cos(rotation.x);
      camera.lookAt(scene.position);

      wormholeMaterial.uniforms.uTime.value = elapsedTime;
      
      geometriesRef.current.children.forEach((child, i) => {
        child.rotation.x += 0.002 + i * 0.0001;
        child.rotation.y += 0.002 + i * 0.0001;
      });

      stars.rotation.y = elapsedTime * 0.01;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mount.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('wheel', handleWheel);
      if(mount) {
        resizeObserver.unobserve(mount);
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      }
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    const wormhole = scene.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.TubeGeometry) as THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial> | undefined;
    if(wormhole) {
      wormhole.material.uniforms.uSpeed.value = config.wormholeSpeed;
    }
  }, [config]);

  useEffect(() => {
    const group = geometriesRef.current;
    if (!group) return;

    const existingIds = group.children.map(c => c.uuid);
    const newIds = geometries.map(g => g.id.toString());
    
    // Naive diffing for simplicity
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

  }, [geometries]);


  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
}
