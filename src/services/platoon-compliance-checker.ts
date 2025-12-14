import { container } from "@sapphire/pieces"
import { MhanndalorianClient } from "./mhanndalorian/mhanndalorian-client"
import { ReconZone } from "../model/territory-battle"

export interface ComplianceViolation {
  playerAllyCode: string
  playerName: string
  missingAssignments: MissingAssignment[]
}

export interface MissingAssignment {
  zoneId: string
  platoonNumber: number
  squadNumber: number
  slotNumber: number
  unitName: string
}

export interface ComplianceCheckResult {
  tbInstanceId: number
  totalAssignments: number
  completedAssignments: number
  violations: ComplianceViolation[]
  complianceRate: number
}

export class PlatoonComplianceChecker {
  private mhannClient: MhanndalorianClient

  constructor(mhannClient: MhanndalorianClient) {
    this.mhannClient = mhannClient
  }

  /**
   * Checks platoon compliance by comparing Mhanndalorian API data with database assignments
   * @param guildId - The SWGOH guild ID
   * @returns Compliance check results with list of violations
   */
  public async checkCompliance(
    guildId: string,
  ): Promise<ComplianceCheckResult | null> {
    try {
      // Get active TB instance
      const tbInstance =
        await container.platoonAssignmentsClient.getActiveTBInstance(guildId)
      if (!tbInstance) {
        console.error("No active TB instance found")
        return null
      }

      // Get all assignments from database
      const dbAssignments =
        await container.platoonAssignmentsClient.getAssignmentsForTB(
          tbInstance.id,
        )
      if (dbAssignments.length === 0) {
        console.error("No assignments found in database")
        return null
      }

      // Fetch TB data from Mhanndalorian API
      const tbData = await this.mhannClient.getTB()
      if (!tbData.isActive) {
        console.error("No active TB found in Mhanndalorian API")
        return null
      }

      // Extract filled units from API (recon zones = platoons)
      const filledUnits = this.extractFilledUnits(tbData.reconZones)

      // Compare and find missing assignments
      const violations = this.findViolations(dbAssignments, filledUnits)

      // Calculate compliance metrics
      const totalAssignments = dbAssignments.length
      const completedAssignments = totalAssignments - violations.reduce(
        (sum, v) => sum + v.missingAssignments.length,
        0,
      )
      const complianceRate = (completedAssignments / totalAssignments) * 100

      return {
        tbInstanceId: tbInstance.id,
        totalAssignments,
        completedAssignments,
        violations,
        complianceRate,
      }
    } catch (error) {
      console.error("Error checking platoon compliance:", error)
      return null
    }
  }

  /**
   * Extracts filled unit slots from Mhanndalorian recon zones
   */
  private extractFilledUnits(
    reconZones: ReconZone[],
  ): Map<string, Set<string>> {
    const filledUnits = new Map<string, Set<string>>()

    for (const zone of reconZones) {
      const zoneId = this.normalizeZoneId(zone.status.zoneId)

      for (const platoon of zone.platoons) {
        const platoonNumber = this.extractPlatoonNumber(platoon.id)

        for (const squad of platoon.squads) {
          const squadNumber = this.extractSquadNumber(squad.id)

          for (let slotIndex = 0; slotIndex < squad.units.length; slotIndex++) {
            const unit = squad.units[slotIndex]
            if (!unit || !unit.memberId) continue

            // Unit is filled
            const slotNumber = slotIndex + 1
            const key = `${zoneId}:${platoonNumber}:${squadNumber}:${slotNumber}`

            if (!filledUnits.has(key)) {
              filledUnits.set(key, new Set())
            }
            filledUnits.get(key)!.add(unit.memberId)
          }
        }
      }
    }

    return filledUnits
  }

  /**
   * Finds violations by comparing DB assignments with filled units from API
   */
  private findViolations(
    dbAssignments: Array<{
      zone_id: string
      platoon_number: number
      squad_number: number
      slot_number: number
      assigned_ally_code: string
      assigned_unit_name: string
    }>,
    filledUnits: Map<string, Set<string>>,
  ): ComplianceViolation[] {
    const violationMap = new Map<string, ComplianceViolation>()

    for (const assignment of dbAssignments) {
      const key = `${assignment.zone_id}:${assignment.platoon_number}:${assignment.squad_number}:${assignment.slot_number}`
      const filledMembers = filledUnits.get(key)

      // Check if this slot is NOT filled by the assigned player
      if (!filledMembers || !filledMembers.has(assignment.assigned_ally_code)) {
        // Player did not complete their assignment
        if (!violationMap.has(assignment.assigned_ally_code)) {
          violationMap.set(assignment.assigned_ally_code, {
            playerAllyCode: assignment.assigned_ally_code,
            playerName: "", // Will be resolved later
            missingAssignments: [],
          })
        }

        violationMap.get(assignment.assigned_ally_code)!.missingAssignments.push({
          zoneId: assignment.zone_id,
          platoonNumber: assignment.platoon_number,
          squadNumber: assignment.squad_number,
          slotNumber: assignment.slot_number,
          unitName: assignment.assigned_unit_name,
        })
      }
    }

    return Array.from(violationMap.values())
  }

  /**
   * Normalizes zone ID from Mhanndalorian format to database format
   * Example: "TERRITORY_WAR_ZONE_1" → "top"
   */
  private normalizeZoneId(apiZoneId: string): string {
    // This mapping depends on how zones are named in the API
    // May need to adjust based on actual API data
    if (apiZoneId.includes("1") || apiZoneId.toLowerCase().includes("top")) {
      return "top"
    } else if (
      apiZoneId.includes("2") ||
      apiZoneId.toLowerCase().includes("mid")
    ) {
      return "mid"
    } else if (
      apiZoneId.includes("3") ||
      apiZoneId.toLowerCase().includes("bottom")
    ) {
      return "bottom"
    }
    return apiZoneId.toLowerCase()
  }

  /**
   * Extracts platoon number from platoon ID
   * Example: "platoon_1" → 1
   */
  private extractPlatoonNumber(platoonId: string): number {
    const match = platoonId.match(/(\d+)/)
    return match && match[1] ? parseInt(match[1], 10) : 0
  }

  /**
   * Extracts squad number from squad ID
   * Example: "squad_2" → 2
   */
  private extractSquadNumber(squadId: string): number {
    const match = squadId.match(/(\d+)/)
    return match && match[1] ? parseInt(match[1], 10) : 0
  }

  /**
   * Resolves player names from ally codes using guild data
   */
  public async resolvePlayerNames(
    guildId: string,
    violations: ComplianceViolation[],
  ): Promise<void> {
    try {
      const guildData = await container.cachedComlinkClient.getGuild(
        guildId,
        true,
      )
      if (!guildData?.guild?.member) {
        console.warn("Could not fetch guild member data for name resolution")
        return
      }

      // Create ally code → player name map
      const allyCodeMap = new Map<string, string>()
      for (const member of guildData.guild.member) {
        if (member.playerId && member.playerName) {
          // Fetch ally code for this player
          const playerData = await container.comlinkClient.getPlayer(
            undefined,
            member.playerId,
          )
          if (playerData?.allyCode) {
            const allyCode = playerData.allyCode.toString().replace(/\D/g, "")
            if (allyCode.length === 9) {
              allyCodeMap.set(allyCode, member.playerName)
            }
          }
        }
      }

      // Resolve names for violations
      for (const violation of violations) {
        const playerName = allyCodeMap.get(violation.playerAllyCode)
        if (playerName) {
          violation.playerName = playerName
        } else {
          violation.playerName = `Unknown (${violation.playerAllyCode})`
        }
      }
    } catch (error) {
      console.error("Error resolving player names:", error)
    }
  }
}
