"use client"

import { usePlayer } from "@/lib/player-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Button } from "./ui/button"

export function PlayerSelector() {
  const { players, selectedPlayer, setSelectedPlayer, isLoading } = usePlayer()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!selectedPlayer) {
    return (
      <div className="text-sm text-muted-foreground">
        No player registered
      </div>
    )
  }

  // If only one player, just show the name
  if (players.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium">{selectedPlayer.name || selectedPlayer.allyCode}</div>
        {selectedPlayer.isMain && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            Main
          </span>
        )}
      </div>
    )
  }

  // Multiple players - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {selectedPlayer.name || selectedPlayer.allyCode}
          {selectedPlayer.isMain && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              Main
            </span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="ml-2 h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {players.map((player, index) => (
          <div key={player.allyCode}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => setSelectedPlayer(player)}
              className={selectedPlayer.allyCode === player.allyCode ? "bg-accent" : ""}
            >
              <div className="flex w-full items-center justify-between">
                <span>{player.name || player.allyCode}</span>
                {player.isMain && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    Main
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
