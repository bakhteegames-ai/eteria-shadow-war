'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Swords, Shield, Wand2, Crown, Settings, Play, Users, Skull } from 'lucide-react';
import { PlatformDiagnostics } from '@/platform/state/PlatformProvider';

export default function Home() {
  const router = useRouter();
  const [selectedFaction, setSelectedFaction] = useState<'altera' | 'draktar'>('altera');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard' | 'expert'>('normal');
  const [showFactionSelect, setShowFactionSelect] = useState(false);

  const handleStartGame = () => {
    // Save settings to sessionStorage for game page
    sessionStorage.setItem('gameSettings', JSON.stringify({
      faction: selectedFaction,
      difficulty
    }));
    router.push('/game');
  };

  const factionInfo = {
    altera: {
      name: 'Altera',
      color: '#3B82F6',
      secondaryColor: '#F59E0B',
      description: 'The noble human kingdom. Masters of strategy and arcane arts.',
      stats: { offense: '★★★☆☆', defense: '★★★★☆', magic: '★★★★☆' }
    },
    draktar: {
      name: "Drak'Tar",
      color: '#EF4444',
      secondaryColor: '#1F2937',
      description: 'The fierce orcish horde. Brutal strength and dark shamanism.',
      stats: { offense: '★★★★★', defense: '★★★☆☆', magic: '★★☆☆☆' }
    }
  };

  const selected = factionInfo[selectedFaction];

  return (
    <main className="h-screen w-screen relative overflow-hidden bg-gray-900">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/menu-bg.png"
          alt="Battle Background"
          fill
          className="object-cover opacity-50"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
        {/* Logo */}
        <div className="mb-4 flex-shrink-0">
          <div className="relative w-20 h-20 sm:w-28 sm:h-28">
            <Image
              src="/game-logo.png"
              alt="Eteria: Shadow War"
              fill
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-center mt-2 text-white drop-shadow-lg">
            ETERIA: SHADOW WAR
          </h1>
          <p className="text-center text-gray-300 mt-1 text-xs sm:text-sm">
            A Browser-Portal RTS Experience
          </p>
        </div>

        {/* Menu */}
        {!showFactionSelect ? (
          <div className="flex flex-col gap-2 w-full max-w-xs flex-shrink-0">
            <Button
              size="lg"
              className="h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg"
              onClick={() => setShowFactionSelect(true)}
            >
              <Play className="mr-2 h-5 w-5" />
              Start Game
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              className="h-10 sm:h-12 text-sm sm:text-base bg-black/30 border-white/20 text-white hover:bg-black/50"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              className="h-10 sm:h-12 text-sm sm:text-base bg-black/30 border-white/20 text-white hover:bg-black/50"
            >
              <Users className="mr-2 h-4 w-4" />
              How to Play
            </Button>
          </div>
        ) : (
          <Card className="w-full max-w-sm bg-black/60 border-white/20 backdrop-blur-sm flex-shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg sm:text-xl text-white text-center">
                Choose Your Faction
              </CardTitle>
              <CardDescription className="text-gray-300 text-center text-xs">
                Select your army and prepare for battle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Faction Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`p-2 sm:p-3 rounded-lg border-2 transition-all min-h-[70px] sm:min-h-[90px] ${
                    selectedFaction === 'altera'
                      ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                      : 'border-white/20 bg-black/30 hover:border-white/40'
                  }`}
                  onClick={() => setSelectedFaction('altera')}
                >
                  <Crown className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 text-blue-400" />
                  <h3 className="text-sm sm:text-base font-bold text-white">Altera</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">Human Kingdom</p>
                </button>
                
                <button
                  className={`p-2 sm:p-3 rounded-lg border-2 transition-all min-h-[70px] sm:min-h-[90px] ${
                    selectedFaction === 'draktar'
                      ? 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/20'
                      : 'border-white/20 bg-black/30 hover:border-white/40'
                  }`}
                  onClick={() => setSelectedFaction('draktar')}
                >
                  <Skull className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 text-red-400" />
                  <h3 className="text-sm sm:text-base font-bold text-white">Drak&apos;Tar</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400">Orcish Horde</p>
                </button>
              </div>

              {/* Faction Info */}
              <div 
                className="p-2 sm:p-3 rounded-lg border border-white/10"
                style={{ background: `linear-gradient(135deg, ${selected.color}15, ${selected.secondaryColor}15)` }}
              >
                <h4 className="font-bold text-white mb-1 text-xs sm:text-sm">{selected.name}</h4>
                <p className="text-[10px] sm:text-xs text-gray-300 mb-2 line-clamp-2">{selected.description}</p>
                <div className="grid grid-cols-3 gap-1 text-[10px] sm:text-xs">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Swords className="w-3 h-3" />
                    <span>{selected.stats.offense}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Shield className="w-3 h-3" />
                    <span>{selected.stats.defense}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Wand2 className="w-3 h-3" />
                    <span>{selected.stats.magic}</span>
                  </div>
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-white">Difficulty</label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                  <SelectTrigger className="bg-black/30 border-white/20 text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="easy" className="text-white text-sm">
                      <span className="text-green-400">●</span> Easy
                    </SelectItem>
                    <SelectItem value="normal" className="text-white text-sm">
                      <span className="text-yellow-400">●</span> Normal
                    </SelectItem>
                    <SelectItem value="hard" className="text-white text-sm">
                      <span className="text-orange-400">●</span> Hard
                    </SelectItem>
                    <SelectItem value="expert" className="text-white text-sm">
                      <span className="text-red-400">●</span> Expert
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 bg-black/30 border-white/20 text-white hover:bg-black/50 text-sm"
                  onClick={() => setShowFactionSelect(false)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 h-9 font-bold text-sm"
                  style={{ background: `linear-gradient(135deg, ${selected.color}, ${selected.secondaryColor})` }}
                  onClick={handleStartGame}
                >
                  <Play className="mr-1 h-4 w-4" />
                  Battle!
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="mt-3 text-gray-500 text-[10px] sm:text-xs text-center flex-shrink-0">
          Touch controls • Pinch to zoom • Drag to select units
        </p>
        
        {/* Dev diagnostics */}
        <PlatformDiagnostics />
      </div>
    </main>
  );
}
