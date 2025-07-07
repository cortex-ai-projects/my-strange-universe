"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
} from "@/components/ui/sidebar";
import { Box, Cone } from "lucide-react";

type GeometryType = "cube" | "sphere" | "cone";

interface ConfigurationPanelProps {
  onAddGeometry: (type: GeometryType) => void;
  onConfigChange: (config: { wormholeSpeed: number }) => void;
  initialSpeed: number;
}

export function ConfigurationPanel({ onAddGeometry, onConfigChange, initialSpeed }: ConfigurationPanelProps) {
  const [speed, setSpeed] = useState(initialSpeed);

  const handleSpeedChange = (newSpeed: number[]) => {
    setSpeed(newSpeed[0]);
    onConfigChange({ wormholeSpeed: newSpeed[0] });
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <h2 className="text-2xl font-headline font-bold text-primary-foreground/90">Strange Universe</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="w-full">
            <AccordionItem value="item-1">
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
                      value={[speed]}
                      onValueChange={handleSpeedChange}
                    />
                    <span className="text-sm text-muted-foreground w-8 text-center">{speed.toFixed(1)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Add Geometry</AccordionTrigger>
              <AccordionContent className="space-y-2 pt-4">
                <Button onClick={() => onAddGeometry("cube")} className="w-full justify-start" variant="ghost">
                  <Box className="mr-2 h-4 w-4" />
                  Add Cube
                </Button>
                <Button onClick={() => onAddGeometry("sphere")} className="w-full justify-start" variant="ghost">
                  Add Sphere
                </Button>
                <Button onClick={() => onAddGeometry("cone")} className="w-full justify-start" variant="ghost">
                  <Cone className="mr-2 h-4 w-4" />
                  Add Cone
                </Button>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
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
