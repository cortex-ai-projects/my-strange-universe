"use client";

import { useState, useCallback } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ConfigurationPanel } from '@/components/strange-universe/ConfigurationPanel';
import { UniverseCanvas } from '@/components/strange-universe/UniverseCanvas';

type GeometryType = "cube" | "sphere" | "cone";
type Geometry = { id: number; type: GeometryType };

const initialConfig = {
  wormholeSpeed: 1.0,
  distance: 15,
};

export default function Home() {
  const [config, setConfig] = useState(initialConfig);
  const [geometries, setGeometries] = useState<Geometry[]>([]);

  const handleAddGeometry = (type: GeometryType) => {
    setGeometries(prev => [...prev, { id: Date.now(), type }]);
  };

  const handleConfigChange = useCallback((newConfig: Partial<typeof config>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return (
    <SidebarProvider>
      <ConfigurationPanel 
        onAddGeometry={handleAddGeometry} 
        onConfigChange={handleConfigChange}
        initialSpeed={config.wormholeSpeed}
        initialDistance={config.distance}
      />
      <SidebarInset>
        <UniverseCanvas 
          config={config} 
          geometries={geometries}
          onConfigChange={handleConfigChange}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
