/**
 * PackSpaceMain orchestrates UI, state, placement, and audio.
 * It must not construct UIKit surfaces or own low-level World Query logic.
 */
import {PackSpaceMenuUI} from "./PackSpaceMenuUI"
import {PackSpaceWorkspaceUI} from "./PackSpaceWorkspaceUI"
import {PackSpaceWorldController} from "./PackSpaceWorldController"
import {PackSpaceAudioController} from "./PackSpaceAudioController"
import {PackSpaceHUD} from "./PackSpaceHUD"
import {PackSpaceAuthoringUI} from "./PackSpaceAuthoringUI"
import {PackPreset, PackSpaceState} from "./PackSpaceState"

const DEFAULT_BACKEND_BASE_URL = "https://backend-three-sigma-52sp27gaug.vercel.app"

@component
export class PackSpaceMain extends BaseScriptComponent {
  @input
  @hint("Public PackSpace API base URL, without a trailing slash")
  backendBaseUrl: string = ""

  @input
  @hint("Launcher and custom-preset editor UI")
  menuUI!: PackSpaceMenuUI

  @input
  @hint("Spatial pack-area view")
  workspaceUI!: PackSpaceWorkspaceUI

  @input
  @hint("World Query placement controller")
  worldController!: PackSpaceWorldController

  @input
  @hint("PackSpace feedback audio controller")
  audioController!: PackSpaceAudioController

  @input
  @hint("Always-visible screen-space packing summary")
  hud!: PackSpaceHUD

  @input
  @hint("Spatial category and item authoring surface")
  authoringUI!: PackSpaceAuthoringUI

  @input
  @hint("Draw collider bounds while diagnosing interactions")
  debugColliders: boolean = false

  private state = new PackSpaceState()
  private pendingCategoryName = ""
  private authoringSurfaceSet = false
  private sequentialPreset: PackPreset | null = null
  private sequentialAreaIndex = 0
  private spatialFlowActive = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    if (!this.menuUI || !this.workspaceUI || !this.worldController || !this.audioController || !this.hud || !this.authoringUI) {
      console.error("[PackSpace] Required @input wiring is incomplete")
      return
    }
    this.state.loadPersistedPresets()
    this.menuUI.onStartPreset.add(preset => this.startPreset(preset))
    this.menuUI.onBeginSpatialPreset.add(request => this.beginSpatialAuthoring(request.presetName, request.categoryName))
    this.menuUI.onImportCode.add(code => { void this.fetchPackCode(code) })
    this.workspaceUI.onItemToggle.add(itemId => this.toggleItem(itemId))
    this.authoringUI.onItemToggle.add(itemId => this.toggleItem(itemId))
    this.authoringUI.onBackToMenu.add(() => this.returnToMainMenu())
    this.hud.onBackToMain.add(() => this.returnToMainMenu())
    this.authoringUI.onDrawCategory.add(name => {
      if (!this.spatialFlowActive) return
      this.pendingCategoryName = name
      this.worldController.beginAreaDrawing()
      this.hud.showMessage("PLACE CATEGORY\nPINCH + DRAG ON A HORIZONTAL SURFACE")
    })
    this.authoringUI.onFinishPreset.add(preset => this.finishSpatialPreset(preset))
    this.worldController.onAreaDrawn.add(result => {
      // World Query callbacks can arrive after the user has left placement.
      // Never allow a stale callback to restore the HUD over the main menu.
      if (!this.spatialFlowActive) return
      this.ensureAuthoringSurface(result.start, result.normal)
      const inverse = this.workspaceUI.sceneObject.getTransform().getInvertedWorldTransform()
      const start = inverse.multiplyPoint(result.start)
      const end = inverse.multiplyPoint(result.end)
      const center = start.add(end).uniformScale(0.5)
      const size = new vec2(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
      if (this.sequentialPreset) {
        this.completeSequentialArea(center, size)
        return
      }
      this.authoringUI.addDrawnCategory(this.pendingCategoryName || "Category", center, size)
      this.pendingCategoryName = ""
      this.hud.showMessage("CATEGORY READY\nSELECT + TO ADD ITEMS")
    })
    this.worldController.onAreaDrawProgress.add(result => {
      if (!this.spatialFlowActive) return
      this.ensureAuthoringSurface(result.start, result.normal)
      const inverse = this.workspaceUI.sceneObject.getTransform().getInvertedWorldTransform()
      this.authoringUI.updateDrawPreview(inverse.multiplyPoint(result.start), inverse.multiplyPoint(result.end))
    })
    this.worldController.onPlaced.add(() => this.audioController.playConfirm())
    this.menuUI.setSavedPresets(this.state.customPresets())
    this.menuUI.show()
    this.workspaceUI.hide()
    if (this.debugColliders) this.setColliderDebugAll(this.sceneObject, true)
    console.log("[PackSpace] Ready — choose a starter or custom preset")
  }

  private beginSpatialAuthoring(presetName: string, categoryName: string): void {
    this.spatialFlowActive = true
    this.menuUI.hide()
    this.workspaceUI.sceneObject.enabled = true
    this.authoringSurfaceSet = false
    this.pendingCategoryName = categoryName
    this.authoringUI.begin(presetName)
    this.hud.showMessage("PLACE CATEGORY\nPINCH + DRAG ON A HORIZONTAL SURFACE")
    this.worldController.beginAreaDrawing()
    console.log(`[PackSpace] Placing '${categoryName}' for '${presetName}'`)
  }

  private async fetchPackCode(code: string): Promise<void> {
    const backendBaseUrl = this.backendBaseUrl.trim() || DEFAULT_BACKEND_BASE_URL
    if (!global.deviceInfoSystem.isInternetAvailable()) { this.menuUI.setImportResult("no internet connection", false); return }
    this.menuUI.setImportResult("fetching list…", true)
    try {
      const internetModule: InternetModule = require("LensStudio:InternetModule")
      const url = `${backendBaseUrl.replace(/\/$/, "")}/v1/lists/${code}`
      const response = await internetModule.fetch(url, {method:"GET"})
      const body = await response.json() as {preset?:unknown;error?:string}
      if (response.status !== 200 || !body.preset) {
        this.menuUI.setImportResult(body.error || (response.status === 404 ? "code not found" : `service error ${response.status}`), false)
        return
      }
      const result = this.state.importRemotePreset(body.preset)
      if (!result.preset) { this.menuUI.setImportResult(result.error || "downloaded list is invalid", false); return }
      this.menuUI.setSavedPresets(this.state.customPresets())
      this.menuUI.setImportResult(`${result.preset.name} / ${result.preset.areas.length} categories`, true)
      this.audioController.playConfirm()
      console.log(`[PackSpace] Downloaded and saved code ${code} as '${result.preset.name}'`)
    } catch (error) {
      this.menuUI.setImportResult(`could not reach sharing service / ${error}`, false)
    }
  }

  private ensureAuthoringSurface(position: vec3, normal: vec3): void {
    if (this.authoringSurfaceSet) return
    const n = normal.normalize()
    const surfaceForward = vec3.forward().sub(n.uniformScale(vec3.forward().dot(n))).normalize()
    const transform = this.workspaceUI.sceneObject.getTransform()
    transform.setWorldPosition(position.add(n.uniformScale(1)))
    // UIKit content faces local +Z. Align +Z with the surface normal so
    // one-sided text and buttons face the user above the horizontal surface.
    transform.setWorldRotation(quat.lookAt(n, surfaceForward))
    this.authoringSurfaceSet = true
  }

  private startPreset(preset: PackPreset): void {
    if (preset.userCreated && preset.workspacePose && preset.areas.every(area => !!area.placement)) {
      this.resumeSpatialPreset(preset)
      return
    }
    this.beginSequentialPresetPlacement(preset)
  }

  private beginSequentialPresetPlacement(preset: PackPreset): void {
    this.spatialFlowActive = true
    this.sequentialPreset = JSON.parse(JSON.stringify(preset)) as PackPreset
    if (!this.sequentialPreset.userCreated) {
      this.sequentialPreset.id = `placed-${this.sequentialPreset.id}`
      this.sequentialPreset.userCreated = true
    }
    this.sequentialAreaIndex = 0
    this.authoringSurfaceSet = false
    this.menuUI.hide()
    this.workspaceUI.sceneObject.enabled = true
    this.authoringUI.begin(this.sequentialPreset.name)
    this.armNextSequentialArea()
  }

  private armNextSequentialArea(): void {
    if (!this.sequentialPreset) return
    const area = this.sequentialPreset.areas[this.sequentialAreaIndex]
    this.pendingCategoryName = area.name
    this.hud.showMessage(`PLACE ${this.sequentialAreaIndex + 1}/${this.sequentialPreset.areas.length}\n${area.name.toUpperCase()}\nPINCH + DRAG ON SURFACE`)
    this.worldController.beginAreaDrawing()
    console.log(`[PackSpace] Waiting to place area ${this.sequentialAreaIndex + 1}: '${area.name}'`)
  }

  private completeSequentialArea(center: vec3, size: vec2): void {
    if (!this.sequentialPreset) return
    const area = this.sequentialPreset.areas[this.sequentialAreaIndex]
    area.placement = {center:{x:center.x,y:center.y,z:center.z},size:{x:size.x,y:size.y}}
    this.authoringUI.clearDrawPreview()
    this.authoringUI.showPlacedPresetArea(area, center, size)
    this.sequentialAreaIndex++
    this.audioController.playConfirm()
    if (this.sequentialAreaIndex < this.sequentialPreset.areas.length) {
      this.armNextSequentialArea()
      return
    }
    const transform = this.workspaceUI.sceneObject.getTransform()
    const position = transform.getWorldPosition()
    const rotation = transform.getWorldRotation()
    this.sequentialPreset.workspacePose = {
      position:{x:position.x,y:position.y,z:position.z},
      rotation:{w:rotation.w,x:rotation.x,y:rotation.y,z:rotation.z}
    }
    const completed = this.state.start(this.sequentialPreset)
    this.authoringUI.resumePreset(completed)
    this.hud.showPreset(completed)
    this.menuUI.setSavedPresets(this.state.customPresets())
    console.log(`[PackSpace] Sequential placement complete for '${completed.name}'`)
    this.sequentialPreset = null
    this.pendingCategoryName = ""
  }

  private finishSpatialPreset(preset: PackPreset): void {
    const transform = this.workspaceUI.sceneObject.getTransform()
    const position = transform.getWorldPosition()
    const rotation = transform.getWorldRotation()
    preset.workspacePose = {
      position:{x:position.x,y:position.y,z:position.z},
      rotation:{w:rotation.w,x:rotation.x,y:rotation.y,z:rotation.z}
    }
    const active = this.state.start(preset)
    this.menuUI.setSavedPresets(this.state.customPresets())
    this.hud.showPreset(active)
    this.audioController.playConfirm()
    this.spatialFlowActive = false
    console.log(`[PackSpace] Finished spatial preset '${active.name}' — authored areas preserved`)
  }

  private resumeSpatialPreset(preset: PackPreset): void {
    this.spatialFlowActive = false
    const active = this.state.start(preset)
    const pose = active.workspacePose!
    const transform = this.workspaceUI.sceneObject.getTransform()
    transform.setWorldPosition(new vec3(pose.position.x, pose.position.y, pose.position.z))
    transform.setWorldRotation(new quat(pose.rotation.w, pose.rotation.x, pose.rotation.y, pose.rotation.z))
    this.menuUI.hide()
    this.workspaceUI.sceneObject.enabled = true
    this.authoringUI.resumePreset(active)
    this.hud.showPreset(active)
    this.audioController.playConfirm()
    console.log(`[PackSpace] Resumed spatial preset '${active.name}' at its saved pose`)
  }

  private returnToMainMenu(): void {
    // Invalidate the spatial flow before hiding UI so any late hit-test or
    // release callback cannot call hud.showMessage() and restore the button.
    this.spatialFlowActive = false
    this.worldController.cancelPlacement()
    this.sequentialPreset = null
    this.sequentialAreaIndex = 0
    this.pendingCategoryName = ""
    this.authoringSurfaceSet = false
    this.authoringUI.clearDrawPreview()
    this.authoringUI.sceneObject.enabled = false
    this.workspaceUI.hide()
    this.hud.hide()
    this.menuUI.setSavedPresets(this.state.customPresets())
    this.menuUI.show()
    console.log("[PackSpace] Returned to main menu")
  }

  private toggleItem(itemId: string): void {
    const active = this.state.toggleItem(itemId)
    const progress = this.state.progress()
    const toggledItem = active.areas
      .reduce((items, area) => items.concat(area.items), [])
      .find(item => item.id === itemId)
    if (toggledItem) {
      this.workspaceUI.updateItem(itemId, toggledItem.packed)
      this.hud.updateItem(itemId, toggledItem.packed)
    }
    if (progress.total > 0 && progress.packed === progress.total) {
      this.audioController.playComplete()
      console.log(`[PackSpace] Complete — ${progress.packed}/${progress.total} items packed`)
    } else if (toggledItem && !toggledItem.packed) {
      this.audioController.playWarning()
      console.log(`[PackSpace] Unpacked item — ${progress.packed}/${progress.total} items packed`)
    } else {
      this.audioController.playConfirm()
      console.log(`[PackSpace] Progress — ${progress.packed}/${progress.total} items packed`)
    }
  }

  private setColliderDebugAll(root: SceneObject, enabled: boolean): void {
    const colliders = root.getComponents("Physics.ColliderComponent")
    colliders.forEach(collider => { (collider as ColliderComponent).debugDrawEnabled = enabled })
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebugAll(root.getChild(i), enabled)
  }
}
