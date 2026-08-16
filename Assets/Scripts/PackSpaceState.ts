/**
 * PackSpaceState owns preset editing and active-session progress.
 * It contains no scene or UI access and is serialization-ready.
 */
export type PackItem = { id: string; name: string; packed: boolean }
export type SpatialAreaPlacement = {center: {x:number;y:number;z:number}; size: {x:number;y:number}}
export type WorkspacePose = {position: {x:number;y:number;z:number}; rotation: {w:number;x:number;y:number;z:number}}
export type PackArea = { id: string; name: string; colorIndex: number; items: PackItem[]; placement?: SpatialAreaPlacement }
export type PackPreset = { id: string; name: string; areas: PackArea[]; userCreated: boolean; workspacePose?: WorkspacePose }

export class PackSpaceState {
  private static readonly STORAGE_KEY = "packspace.saved.presets.v1"
  private static readonly STORAGE_BACKUP_KEY = "packspace.saved.presets.backup.v1"
  private presets: PackPreset[] = [PackSpaceState.starterPreset()]
  private activePreset: PackPreset = PackSpaceState.clonePreset(this.presets[0])

  public static starterPreset(): PackPreset {
    return {
      id: "work-trip",
      name: "Two-Day Work Trip",
      userCreated: false,
      areas: [
        {id: "clothes", name: "Clothes", colorIndex: 0, items: PackSpaceState.items(["Shirt", "Trousers", "Underwear", "Socks"], "clothes")},
        {id: "tech", name: "Tech", colorIndex: 1, items: PackSpaceState.items(["Laptop", "Charger", "Headphones"], "tech")},
        {id: "essentials", name: "Essentials", colorIndex: 2, items: PackSpaceState.items(["Wallet", "Keys", "Medication"], "essentials")},
      ],
    }
  }

  public addCustomPreset(name: string, areas: PackArea[]): PackPreset {
    const cleanedName = PackSpaceState.clean(name, "My Packing Preset")
    const cleanedAreas = areas.slice(0, 6).map((area, index) => ({
      id: `custom-area-${this.presets.length}-${index}`,
      name: PackSpaceState.clean(area.name, `Area ${index + 1}`),
      colorIndex: index % 6,
      items: area.items.slice(0, 8).map((item, itemIndex) => ({
        id: `custom-item-${this.presets.length}-${index}-${itemIndex}`,
        name: PackSpaceState.clean(item.name, `Item ${itemIndex + 1}`),
        packed: false,
      })),
    })).filter(area => area.items.length > 0)

    if (cleanedAreas.length === 0) {
      cleanedAreas.push({id: `custom-area-${this.presets.length}-0`, name: "General", colorIndex: 0, items: PackSpaceState.items(["First item"], "general")})
    }

    const preset = {id: `custom-${this.presets.length}`, name: cleanedName, areas: cleanedAreas, userCreated: true}
    this.presets.push(PackSpaceState.clonePreset(preset))
    return PackSpaceState.clonePreset(preset)
  }

  public importRemotePreset(value: unknown): {preset: PackPreset | null; error: string | null} {
    try {
      const remote = value as {name?:unknown;categories?:unknown}
      const name = PackSpaceState.clean(typeof remote?.name === "string" ? remote.name : "", "")
      if (!name || !Array.isArray(remote?.categories) || remote.categories.length < 1 || remote.categories.length > 6) {
        return {preset:null,error:"Downloaded list is invalid"}
      }
      const presetId = `import-${Date.now()}`
      const areas: PackArea[] = []
      for (let areaIndex = 0; areaIndex < remote.categories.length; areaIndex++) {
        const category = remote.categories[areaIndex] as {name?:unknown;items?:unknown}
        const areaName = PackSpaceState.clean(typeof category?.name === "string" ? category.name : "", "")
        const rawItems = Array.isArray(category?.items) ? category.items : []
        const itemNames = rawItems.map(item => PackSpaceState.clean(typeof item === "string" ? item : "", ""))
        if (!areaName || !itemNames.length || itemNames.length > 8 || itemNames.some(item => !item)) {
          return {preset:null,error:`Downloaded category ${areaIndex + 1} is invalid`}
        }
        const areaId = `${presetId}-area-${areaIndex}`
        areas.push({
          id: areaId,
          name: areaName,
          colorIndex: areaIndex % 6,
          items: itemNames.map((itemName, itemIndex) => ({id:`${areaId}-item-${itemIndex}`,name:itemName,packed:false})),
        })
      }
      const preset: PackPreset = {id:presetId,name,userCreated:true,areas}
      this.activePreset = PackSpaceState.clonePreset(preset)
      this.upsertActivePreset()
      return {preset:PackSpaceState.clonePreset(preset),error:null}
    } catch (error) {
      return {preset:null,error:`Could not save downloaded list / ${error}`}
    }
  }

  public start(preset: PackPreset): PackPreset {
    this.activePreset = PackSpaceState.clonePreset(preset)
    if (preset.userCreated) this.upsertActivePreset()
    return this.snapshot()
  }

  public toggleItem(itemId: string): PackPreset {
    for (const area of this.activePreset.areas) {
      const item = area.items.find(candidate => candidate.id === itemId)
      if (item) {
        item.packed = !item.packed
        this.upsertActivePreset()
        break
      }
    }
    return this.snapshot()
  }

  public snapshot(): PackPreset { return PackSpaceState.clonePreset(this.activePreset) }

  public progress(): {packed: number; total: number; areasComplete: number} {
    let packed = 0
    let total = 0
    let areasComplete = 0
    for (const area of this.activePreset.areas) {
      total += area.items.length
      packed += area.items.filter(item => item.packed).length
      if (area.items.length > 0 && area.items.every(item => item.packed)) areasComplete++
    }
    return {packed, total, areasComplete}
  }

  public serializePresets(): string { return JSON.stringify(this.presets) }
  public customPresets(): PackPreset[] { return this.presets.filter(preset => preset.userCreated).map(PackSpaceState.clonePreset) }

  public loadPersistedPresets(): void {
    try {
      const store = global.persistentStorageSystem.store
      if (!store) return
      // Read directly: `has()` may return a stale false immediately after a
      // Lens reload even though the persisted string remains available.
      const primary = store.getString(PackSpaceState.STORAGE_KEY)
      const backup = store.getString(PackSpaceState.STORAGE_BACKUP_KEY)
      const raw = primary && primary.trim() ? primary : backup
      if (!raw || !raw.trim()) return
      const saved = JSON.parse(raw) as PackPreset[]
      if (!Array.isArray(saved)) return
      this.presets = [PackSpaceState.starterPreset()]
      saved.filter(preset => preset && preset.userCreated && Array.isArray(preset.areas)).forEach(preset => this.presets.push(PackSpaceState.clonePreset(preset)))
      console.log(`[PackSpace] Loaded ${this.presets.length - 1} saved custom preset(s)`)
    } catch (error) {
      console.warn(`[PackSpace] Could not load saved presets: ${error}`)
    }
  }

  private upsertActivePreset(): void {
    if (!this.activePreset.userCreated) return
    const index = this.presets.findIndex(preset => preset.id === this.activePreset.id)
    if (index >= 0) this.presets[index] = PackSpaceState.clonePreset(this.activePreset)
    else this.presets.push(PackSpaceState.clonePreset(this.activePreset))
    try {
      const saved = this.presets.filter(preset => preset.userCreated)
      const serialized = JSON.stringify(saved)
      const store = global.persistentStorageSystem.store
      store.putString(PackSpaceState.STORAGE_KEY, serialized)
      store.putString(PackSpaceState.STORAGE_BACKUP_KEY, serialized)
      console.log(`[PackSpace] Persisted ${saved.length} custom preset(s)`)
    } catch (error) {
      console.warn(`[PackSpace] Could not save presets: ${error}`)
    }
  }

  private static items(names: string[], prefix: string): PackItem[] {
    return names.map((name, index) => ({id: `${prefix}-${index}`, name, packed: false}))
  }

  private static clean(value: string, fallback: string): string {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed.slice(0, 28) : fallback
  }

  private static clonePreset(preset: PackPreset): PackPreset {
    return JSON.parse(JSON.stringify(preset)) as PackPreset
  }
}
