"use client";

import { useRef, MouseEvent } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface WormholeMinimapProps {
  exitPosition: { x: number; z: number };
  onPositionChange: (position: { x: number; z: number }) => void;
  worldSize?: number;
  className?: string;
}

export function WormholeMinimap({
  exitPosition,
  onPositionChange,
  worldSize = 100, // Represents the size of the world, e.g., 100x100 units
  className
}: WormholeMinimapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const percentX = x / rect.width;
    const percentZ = y / rect.height;

    // Convert click coordinates to world coordinates (-50 to 50)
    const newX = (percentX - 0.5) * worldSize;
    const newZ = (percentZ - 0.5) * worldSize;

    onPositionChange({ x: newX, z: newZ });
  };
  
  // Convert world coordinates to percentage for positioning the marker
  const markerLeft = `${((exitPosition.x / worldSize) + 0.5) * 100}%`;
  const markerTop = `${((exitPosition.z / worldSize) + 0.5) * 100}%`;

  return (
    <div className={cn('space-y-2', className)}>
        <Label>Wormhole Exit Position</Label>
        <div 
            ref={mapRef}
            onClick={handleMapClick}
            className="relative w-full aspect-square bg-muted/50 rounded-md cursor-pointer overflow-hidden border"
            title="Click to move wormhole exit"
        >
            {/* Exit Marker */}
            <div 
                className="absolute w-2.5 h-2.5 bg-cyan-400 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg border-2 border-background"
                style={{ left: markerLeft, top: markerTop, transition: 'left 0.2s, top 0.2s' }}
            />
            {/* Entrance Marker (Fixed) */}
            <div 
              className="absolute top-[calc(50%-12.5px)] left-1/2 w-2.5 h-2.5 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-background" 
              title="Entrance (Fixed Position)"
            />
             
        </div>
        <p className="text-xs text-muted-foreground text-center">
          <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1"></span> Entrance, 
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-1 ml-2"></span> Exit
        </p>
    </div>
  );
}
