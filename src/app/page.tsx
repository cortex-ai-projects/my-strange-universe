"use client";

import { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ConfigurationPanel } from '@/components/strange-universe/ConfigurationPanel';
import { UniverseCanvas } from '@/components/strange-universe/UniverseCanvas';

type GeometryType = "cube" | "sphere" | "cone";
type Geometry = { id: number; type: GeometryType };

const initialConfig = {
  wormholeSpeed: 1.0,
};

export default function Home() {
  const [config, setConfig] = useState(initialConfig);
  const [geometries, setGeometries] = useState<Geometry[]>([]);

  const handleAddGeometry = (type: GeometryType) => {
    setGeometries(prev => [...prev, { id: Date.now(), type }]);
  };

  const handleConfigChange = (newConfig: { wormholeSpeed: number }) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  return (
    <SidebarProvider>
      <ConfigurationPanel 
        onAddGeometry={handleAddGeometry} 
        onConfigChange={handleConfigChange}
        initialSpeed={initialConfig.wormholeSpeed}
      />
      <SidebarInset>
        <UniverseCanvas config={config} geometries={geometries} />
      </SidebarInset>
    </SidebarProvider>
  );
}
