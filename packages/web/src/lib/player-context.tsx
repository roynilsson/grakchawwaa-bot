"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface Player {
  allyCode: string
  name: string | null
  isMain: boolean
}

interface PlayerContextType {
  players: Player[]
  selectedPlayer: Player | null
  setSelectedPlayer: (player: Player) => void
  isLoading: boolean
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayer, setSelectedPlayerState] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await fetch("/api/players")
        if (!response.ok) throw new Error("Failed to fetch players")

        const data = await response.json()
        setPlayers(data.players)

        // Select main player or first player
        const mainPlayer = data.players.find((p: Player) => p.isMain)
        setSelectedPlayerState(mainPlayer || data.players[0] || null)
      } catch (error) {
        console.error("Error fetching players:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  const setSelectedPlayer = (player: Player) => {
    setSelectedPlayerState(player)
  }

  return (
    <PlayerContext.Provider
      value={{ players, selectedPlayer, setSelectedPlayer, isLoading }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider")
  }
  return context
}
