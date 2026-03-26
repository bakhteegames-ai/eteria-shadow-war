'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Gem, Sparkles, Sword, Shield, Target, Crown, Wand2,
  Pause, Play, Settings, Home, Building2, Users,
  X, Check
} from 'lucide-react';
import { useGameStore } from '@/lib/game/store';
import { UNIT_STATS, BUILDING_STATS } from '@/lib/game/constants';
import type { UnitType, BuildingType } from '@/lib/game/types';

interface GameUIProps {
  onBuildUnit: (unitType: UnitType) => void;
  onBuildBuilding: (buildingType: BuildingType) => void;
  onPause: () => void;
  onResume: () => void;
  isPlacingBuilding: BuildingType | null;
  onCancelPlacement: () => void;
}

const BUILDING_NAMES: Record<BuildingType, string> = {
  townCenter: 'Town Center',
  barracks: 'Barracks',
  stable: 'Stable',
  tower: 'Defense Tower',
  academy: 'Academy'
};

const UNIT_NAMES: Record<UnitType, string> = {
  worker: 'Worker',
  warrior: 'Warrior',
  archer: 'Archer',
  knight: 'Knight',
  mage: 'Mage'
};

export default function GameUI({ onBuildUnit, onBuildBuilding, onPause, onResume, isPlacingBuilding, onCancelPlacement }: GameUIProps) {
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  
  const playerResources = useGameStore(s => s.playerResources);
  const playerUnits = useGameStore(s => s.playerUnits);
  const playerBuildings = useGameStore(s => s.playerBuildings);
  const selectedUnits = useGameStore(s => s.selectedUnits);
  const selectedBuilding = useGameStore(s => s.selectedBuilding);
  const gameTime = useGameStore(s => s.gameTime);
  const isPaused = useGameStore(s => s.isPaused);
  const dispatch = useGameStore(s => s.dispatch);

  const selectedUnitObjects = playerUnits.filter(u => selectedUnits.includes(u.id));
  const selectedBuildingObject = playerBuildings.find(b => b.id === selectedBuilding);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const getUnitIcon = (type: UnitType) => {
    switch (type) {
      case 'worker': return <Users className="w-4 h-4" />;
      case 'warrior': return <Sword className="w-4 h-4" />;
      case 'archer': return <Target className="w-4 h-4" />;
      case 'knight': return <Crown className="w-4 h-4" />;
      case 'mage': return <Wand2 className="w-4 h-4" />;
    }
  };

  const canAffordUnit = (type: UnitType) => {
    const c = UNIT_STATS[type].cost;
    return playerResources.crystals >= c.crystals && playerResources.essence >= c.essence;
  };

  const canAffordBuilding = (type: BuildingType) => {
    const c = BUILDING_STATS[type].cost;
    return playerResources.crystals >= c.crystals && playerResources.essence >= c.essence;
  };

  const handlePauseClick = () => { setShowPauseMenu(true); onPause(); };
  const handleResumeClick = () => { setShowPauseMenu(false); onResume(); };
  const handleQuitClick = () => dispatch({ type: 'END_GAME', payload: { victory: false } });

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 pointer-events-auto">
        <div className="flex justify-between items-center px-2 py-1.5 bg-black/60 backdrop-blur-sm">
          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-blue-900/50 px-2 py-0.5 rounded-full">
              <Gem className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-sm">{Math.floor(playerResources.crystals)}</span>
            </div>
            <div className="flex items-center gap-1 bg-purple-900/50 px-2 py-0.5 rounded-full">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-white font-bold text-sm">{Math.floor(playerResources.essence)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20 text-xs">
              {formatTime(gameTime)}
            </Badge>
            <div className="flex items-center gap-1 text-white text-sm">
              <Users className="w-4 h-4" />
              <span>{playerUnits.length}</span>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handlePauseClick}>
            <Pause className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Minimap */}
      <div className="absolute pointer-events-auto left-2 bottom-24 w-24 h-24 sm:w-32 sm:h-32">
        <Card className="w-full h-full bg-black/60 border-white/20 overflow-hidden">
          <CardContent className="p-0 w-full h-full">
            <div className="w-full h-full bg-green-900/50 relative">
              {/* Player base marker - bottom left */}
              <div className="absolute w-2 h-2 bg-blue-500 rounded-sm left-[20%] bottom-[20%]" />
              {/* AI base marker - top right */}
              <div className="absolute w-2 h-2 bg-red-500 rounded-sm right-[20%] top-[20%]" />
              {/* Player units */}
              {playerUnits.slice(0, 10).map((u, i) => (
                <div key={i} className="absolute w-1 h-1 bg-blue-400 rounded-full"
                  style={{ left: `${(u.position.x / 40) * 100}%`, top: `${(u.position.z / 40) * 100}%` }} />
              ))}
              {/* AI units */}
              {useGameStore.getState().aiUnits.slice(0, 10).map((u, i) => (
                <div key={`ai${i}`} className="absolute w-1 h-1 bg-red-400 rounded-full"
                  style={{ left: `${(u.position.x / 40) * 100}%`, top: `${(u.position.z / 40) * 100}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Info */}
      {(selectedUnitObjects.length > 0 || selectedBuildingObject) && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 pointer-events-auto max-w-xs">
          <Card className="bg-black/70 border-white/20 backdrop-blur-sm">
            <CardContent className="p-2">
              {selectedBuildingObject ? (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-white font-bold text-sm">{BUILDING_NAMES[selectedBuildingObject.type]}</h3>
                    <Badge className="text-[10px] bg-blue-500">
                      {selectedBuildingObject.isConstructing ? 'Building...' : 'Active'}
                    </Badge>
                  </div>
                  <div className="mb-1">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>HP</span>
                      <span>{Math.floor(selectedBuildingObject.stats.health)}/{selectedBuildingObject.stats.maxHealth}</span>
                    </div>
                    <Progress value={(selectedBuildingObject.stats.health / selectedBuildingObject.stats.maxHealth) * 100} className="h-1" />
                  </div>
                  {selectedBuildingObject.stats.producesUnits && (
                    <div className="mt-1">
                      <p className="text-[10px] text-gray-400 mb-1">Train:</p>
                      <div className="flex gap-1 flex-wrap">
                        {selectedBuildingObject.stats.producesUnits.map(ut => (
                          <Button key={ut} size="sm" variant={canAffordUnit(ut) ? "default" : "outline"}
                            className="p-0 w-8 h-8" disabled={!canAffordUnit(ut)} onClick={() => onBuildUnit(ut)}>
                            {getUnitIcon(ut)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedUnitObjects.length === 1 ? (
                <div>
                  <h3 className="text-white font-bold text-sm mb-1">{UNIT_NAMES[selectedUnitObjects[0].type]}</h3>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div><span className="text-gray-400">HP: </span><span className="text-white">{Math.floor(selectedUnitObjects[0].stats.health)}/{selectedUnitObjects[0].stats.maxHealth}</span></div>
                    <div><span className="text-gray-400">DMG: </span><span className="text-white">{selectedUnitObjects[0].stats.damage}</span></div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-white font-bold text-sm mb-1">{selectedUnitObjects.length} Units Selected</h3>
                  <p className="text-[10px] text-gray-400">Click to move, right-click to attack</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Build Button */}
      <div className="absolute pointer-events-auto right-2 bottom-24">
        <Button
          className="rounded-full shadow-lg w-12 h-12"
          style={{ background: isPlacingBuilding ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
          onClick={() => isPlacingBuilding ? onCancelPlacement() : setShowBuildMenu(!showBuildMenu)}
        >
          {isPlacingBuilding ? <X className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
        </Button>
      </div>

      {/* Build Menu */}
      {showBuildMenu && !isPlacingBuilding && (
        <div className="absolute pointer-events-auto right-2 bottom-40">
          <Card className="bg-black/80 border-white/20 backdrop-blur-sm w-48">
            <CardContent className="p-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-white font-bold text-xs">Build</h3>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400" onClick={() => setShowBuildMenu(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {(Object.keys(BUILDING_STATS) as BuildingType[]).map(bt => {
                    const can = canAffordBuilding(bt);
                    return (
                      <button key={bt} className={`w-full p-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${can ? 'border-white/30 bg-white/5 hover:bg-white/10' : 'border-white/10 bg-white/5 opacity-50'}`}
                        disabled={!can} onClick={() => { if (can) { onBuildBuilding(bt); setShowBuildMenu(false); } }}>
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 text-left">
                          <p className="text-white text-[10px]">{BUILDING_NAMES[bt]}</p>
                          <div className="flex gap-1.5 text-[9px]">
                            <span className={can ? 'text-cyan-400' : 'text-red-400'}>{BUILDING_STATS[bt].cost.crystals}💎</span>
                            {BUILDING_STATS[bt].cost.essence > 0 && <span className={can ? 'text-purple-400' : 'text-red-400'}>{BUILDING_STATS[bt].cost.essence}✨</span>}
                          </div>
                        </div>
                        {can && <Check className="w-3 h-3 text-green-400" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pause Menu */}
      {showPauseMenu && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
          <Card className="bg-gray-900 border-white/20 w-64">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-lg font-bold text-white text-center">⏸️ Paused</h2>
              <Button className="w-full text-sm bg-gradient-to-r from-blue-600 to-purple-600" onClick={handleResumeClick}>
                <Play className="mr-2 h-4 w-4" /> Resume
              </Button>
              <Button variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 text-sm">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
              <Button variant="outline" className="w-full bg-transparent border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm" onClick={handleQuitClick}>
                <Home className="mr-2 h-4 w-4" /> Quit Game
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-2 left-2 text-white/50 text-[10px] pointer-events-none hidden sm:block">
        Left: Select/Move | Right: Attack/Move | Right-drag: Pan | Scroll: Zoom
      </div>
    </div>
  );
}
