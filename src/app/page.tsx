"use client";

import { useState, useCallback } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ConfigurationPanel, UniverseType } from '@/components/strange-universe/ConfigurationPanel';
import { UniverseCanvas } from '@/components/strange-universe/UniverseCanvas';

type GeometryType = "cube" | "sphere" | "cone";
type Geometry = { id: number; type: GeometryType };
type PlacedWormhole = { id: number };

const initialConfig = {
  wormholeSpeed: 1.0,
  distance: 25,
  ballSize: 0.3,
  universeSize: 100,
};

export default function Home() {
  const [config, setConfig] = useState(initialConfig);
  const [geometries, setGeometries] = useState<Geometry[]>([]);
  const [universeType, setUniverseType] = useState<UniverseType>('wormhole');
  const [placedWormholes, setPlacedWormholes] = useState<PlacedWormhole[]>([]);

  const handleAddGeometry = (type: GeometryType) => {
    setGeometries(prev => [...prev, { id: Date.now(), type }]);
  };

  const handleAddWormhole = () => {
    setPlacedWormholes(prev => [...prev, { id: Date.now() }]);
  };

  const handleConfigChange = useCallback((newConfig: Partial<typeof config>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleUniverseChange = useCallback((newUniverse: UniverseType) => {
    setUniverseType(newUniverse);
    setGeometries([]);
    setPlacedWormholes([]);
    let distance = 25;
    if (newUniverse === 'portals') distance = 25;
    if (newUniverse === 'wormhole') distance = 15;
    if (newUniverse === 'infinity') distance = 35;
    setConfig(prev => ({...prev, distance }))
  }, []);
  
  return (
    <SidebarProvider>
      <ConfigurationPanel 
        universeType={universeType}
        onUniverseChange={handleUniverseChange}
        onAddGeometry={handleAddGeometry} 
        onAddWormhole={handleAddWormhole}
        onConfigChange={handleConfigChange}
        initialSpeed={config.wormholeSpeed}
        initialDistance={config.distance}
        initialBallSize={config.ballSize}
        initialUniverseSize={config.universeSize}
      />
      <SidebarInset>
        <UniverseCanvas 
          universeType={universeType}
          config={config} 
          geometries={geometries}
          placedWormholes={placedWormholes}
          onConfigChange={handleConfigChange}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
