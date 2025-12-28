"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface Player {
  allyCode: string
  name: string | null
  isMain: boolean
}

interface Permissions {
  isOfficerOrLeader: boolean
  isLeader: boolean
  memberLevel: number | null
}

interface PlayerContextType {
  players: Player[]
  selectedPlayer: Player | null
  setSelectedPlayer: (player: Player) => void
  permissions: Permissions
  isLoading: boolean
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayer, setSelectedPlayerState] = useState<Player | null>(null)
  const [permissions, setPermissions] = useState<Permissions>({
    isOfficerOrLeader: false,
    isLeader: false,
    memberLevel: null,
  })
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

  useEffect(() => {
    async function fetchPermissions() {
      if (!selectedPlayer) {
        setPermissions({
          isOfficerOrLeader: false,
          isLeader: false,
          memberLevel: null,
        })
        return
      }

      try {
        const response = await fetch(
          `/api/permissions?allyCode=${selectedPlayer.allyCode}`
        )
        if (!response.ok) throw new Error("Failed to fetch permissions")

        const data = await response.json()
        setPermissions(data)
      } catch (error) {
        console.error("Error fetching permissions:", error)
        setPermissions({
          isOfficerOrLeader: false,
          isLeader: false,
          memberLevel: null,
        })
      }
    }

    fetchPermissions()
  }, [selectedPlayer])

  const setSelectedPlayer = (player: Player) => {
    setSelectedPlayerState(player)
  }

  return (
    <PlayerContext.Provider
      value={{ players, selectedPlayer, setSelectedPlayer, permissions, isLoading }}
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
