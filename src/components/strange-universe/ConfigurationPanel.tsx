"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
} from "@/components/ui/sidebar";
import { Box, Cone, Circle, GitCommitHorizontal } from "lucide-react";

export type UniverseType = "wormhole" | "portals" | "infinity";
type GeometryType = "cube" | "sphere" | "cone";

interface ConfigurationPanelProps {
  universeType: UniverseType;
  onUniverseChange: (type: UniverseType) => void;
  onAddGeometry: (type: GeometryType) => void;
  onAddWormhole: () => void;
  onConfigChange: (config: { wormholeSpeed?: number; distance?: number, ballSize?: number, universeSize?: number }) => void;
  initialSpeed: number;
  initialDistance: number;
  initialBallSize: number;
  initialUniverseSize: number;
}

export function ConfigurationPanel({ 
  universeType,
  onUniverseChange,
  onAddGeometry, 
  onAddWormhole,
  onConfigChange, 
  initialSpeed, 
  initialDistance,
  initialBallSize,
  initialUniverseSize,
}: ConfigurationPanelProps) {
  const handleSpeedChange = (newSpeed: number[]) => {
    onConfigChange({ wormholeSpeed: newSpeed[0] });
  };

  const handleDistanceChange = (newDistance: number[]) => {
    onConfigChange({ distance: newDistance[0] });
  };

  const handleBallSizeChange = (newSize: number[]) => {
    onConfigChange({ ballSize: newSize[0] });
  };

  const handleUniverseSizeChange = (newSize: number[]) => {
    onConfigChange({ universeSize: newSize[0] });
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <h2 className="text-2xl font-headline font-bold text-primary-foreground/90">Strange Universe</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="space-y-2 mb-4">
            <Label htmlFor="universe-type">Universe Type</Label>
            <Select onValueChange={(value: UniverseType) => onUniverseChange(value)} value={universeType}>
              <SelectTrigger id="universe-type">
                <SelectValue placeholder="Select a universe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wormhole">Wormhole</SelectItem>
                <SelectItem value="portals">Portals</SelectItem>
                <SelectItem value="infinity">Infinity Universe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3", "item-4", "item-5", "item-6", "item-7", "item-8"]} className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Camera Controls</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="camera-distance">Camera Distance</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="camera-distance"
                      min={5}
                      max={80}
                      step={1}
                      value={[initialDistance]}
                      onValueChange={handleDistanceChange}
                    />
                    <span className="text-sm text-muted-foreground w-8 text-center">{initialDistance.toFixed(0)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {universeType === 'wormhole' && (
              <>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Universe Controls</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="wormhole-speed">Wormhole Speed</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="wormhole-speed"
                          min={0.1}
                          max={2}
                          step={0.1}
                          value={[initialSpeed]}
                          onValueChange={handleSpeedChange}
                        />
                        <span className="text-sm text-muted-foreground w-8 text-center">{initialSpeed.toFixed(1)}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Add Geometry</AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-4">
                    <Button onClick={() => onAddGeometry("cube")} className="w-full justify-start" variant="ghost">
                      <Box className="mr-2 h-4 w-4" />
                      Add Cube
                    </Button>
                    <Button onClick={() => onAddGeometry("sphere")} className="w-full justify-start" variant="ghost">
                      <Circle className="mr-2 h-4 w-4" />
                      Add Sphere
                    </Button>
                    <Button onClick={() => onAddGeometry("cone")} className="w-full justify-start" variant="ghost">
                      <Cone className="mr-2 h-4 w-4" />
                      Add Cone
                    </Button>
                  </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-4">
                  <AccordionTrigger>Add Wormhole</AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-4">
                    <Button onClick={onAddWormhole} className="w-full justify-start" variant="ghost">
                      <GitCommitHorizontal className="mr-2 h-4 w-4" />
                      Add Wormhole Entrance
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </>
            )}

            {universeType === 'portals' && (
              <>
                <AccordionItem value="item-6">
                  <AccordionTrigger>Portal Controls</AccordionTrigger>
                  <AccordionContent className="pt-4 text-sm text-muted-foreground">
                    <p className="font-medium">Use keyboard to place portals:</p>
                    <div className="mt-2 space-y-1">
                      <div><code className="font-mono p-1 text-xs bg-muted rounded-sm">P</code> — Place Entrance Portal (Blue)</div>
                      <div><code className="font-mono p-1 text-xs bg-muted rounded-sm">O</code> — Place Exit Portal (Red)</div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-7">
                  <AccordionTrigger>Object Controls</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="ball-size">Ball Size</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            id="ball-size"
                            min={0.1}
                            max={1.5}
                            step={0.1}
                            value={[initialBallSize]}
                            onValueChange={handleBallSizeChange}
                          />
                          <span className="text-sm text-muted-foreground w-8 text-center">{initialBallSize.toFixed(1)}</span>
                        </div>
                      </div>
                    </AccordionContent>
                </AccordionItem>
              </>
            )}
            
            {universeType === 'infinity' && (
              <>
                <AccordionItem value="item-8">
                  <AccordionTrigger>Universe Controls</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="universe-size">Universe Size</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="universe-size"
                          min={50}
                          max={500}
                          step={10}
                          value={[initialUniverseSize]}
                          onValueChange={handleUniverseSizeChange}
                        />
                        <span className="text-sm text-muted-foreground w-8 text-center">{initialUniverseSize.toFixed(0)}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-7">
                  <AccordionTrigger>Object Controls</AccordionTrigger>
                  <AccordionContent className="pt-4 text-sm text-muted-foreground">
                    <p className="font-medium">Press <code className="font-mono p-1 text-xs bg-muted rounded-sm">F</code> to generate an object in front of you.</p>
                  </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-6">
                  <AccordionTrigger>Flight Controls</AccordionTrigger>
                  <AccordionContent className="pt-4 text-sm text-muted-foreground">
                    <div className="mt-2 space-y-1">
                      <div><code className="font-mono p-1 text-xs bg-muted rounded-sm">Shift</code> — Fly Up</div>
                      <div><code className="font-mono p-1 text-xs bg-muted rounded-sm">Control</code> — Fly Down</div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </>
            )}


            <AccordionItem value="item-5">
              <AccordionTrigger>Code Example</AccordionTrigger>
              <AccordionContent className="pt-2">
                <p className="text-sm text-muted-foreground pb-2">Create a custom object:</p>
                <pre className="bg-muted/50 p-3 rounded-md overflow-x-auto">
                  <code className="font-code text-xs text-accent-foreground/80">
                    {`const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0xBF00FF,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);`}
                  </code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
