/**
 * PackSpaceWorldController places the workspace on a real surface via World Query.
 * It owns placement only and must not own preset or item state.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"

const WorldQuery = require("LensStudio:WorldQueryModule") as WorldQueryModule

@component
export class PackSpaceWorldController extends BaseScriptComponent {
  public onPlaced = new Event<void>()
  public onAreaDrawn = new Event<{start: vec3; end: vec3; normal: vec3}>()
  public onAreaDrawProgress = new Event<{start: vec3; end: vec3; normal: vec3}>()

  @input
  @hint("Authored root that holds the spatial packing areas")
  workspaceRoot!: SceneObject

  @input
  @hint("Use the safe preview position until a real surface is selected")
  previewFallback: boolean = true

  private session: HitTestSession | null = null
  private placing = false
  private drawingArea = false
  private drawStart: vec3 | null = null
  private drawCurrent: vec3 | null = null
  private drawNormal = vec3.up()
  private placementGestureStarted = false
  private latestPosition = new vec3(0, -12, -110)
  private latestNormal = vec3.up()

  onAwake(): void {
    const options = HitTestSessionOptions.create()
    options.filter = true
    this.session = WorldQuery.createHitTestSessionWithOptions(options)
    this.session.start()
    this.createEvent("UpdateEvent").bind(() => this.updatePlacement())
  }

  public beginPlacement(): void {
    this.placing = true
    this.placementGestureStarted = false
    if (this.previewFallback) {
      this.workspaceRoot.getTransform().setWorldPosition(this.latestPosition)
      this.workspaceRoot.enabled = true
    }
  }

  public beginAreaDrawing(): void {
    this.drawingArea = true
    this.drawStart = null
    this.drawCurrent = null
    console.log("[PackSpace] Area drawing armed")
  }

  /** Stop any in-progress placement gesture when its owning UI flow closes. */
  public cancelPlacement(): void {
    this.placing = false
    this.drawingArea = false
    this.placementGestureStarted = false
    this.drawStart = null
    this.drawCurrent = null
    console.log("[PackSpace] Placement cancelled")
  }

  private updatePlacement(): void {
    if ((!this.placing && !this.drawingArea) || !this.session) return
    const interactors = SIK.InteractionManager.getTargetingInteractors()
    if (interactors.length === 0) return
    const interactor = interactors[0]
    if (!interactor.isActive() || !interactor.isTargeting()) return
    // Capture trigger edges before the asynchronous hit-test callback.
    const pressed = interactor.currentTrigger !== InteractorTriggerType.None
    const wasPressed = interactor.previousTrigger !== InteractorTriggerType.None

    // A release must complete even when the release-frame ray has no depth hit.
    if (this.drawingArea && !pressed && wasPressed && this.drawStart && this.drawCurrent) {
      const start = this.drawStart
      const end = this.drawCurrent
      this.drawingArea = false
      this.drawStart = null
      this.drawCurrent = null
      this.onAreaDrawn.invoke({start, end, normal:this.drawNormal})
      console.log("[PackSpace] Area drag completed")
      return
    }

    this.session.hitTest(interactor.startPoint, interactor.endPoint, result => {
      if (this.drawingArea) {
        if (!result) return
        if (result.normal.normalize().dot(vec3.up()) < 0.75) return
        if (pressed && !wasPressed) {
          this.drawStart = result.position
          this.drawNormal = result.normal.normalize()
        }
        if (pressed && this.drawStart) {
          this.drawCurrent = result.position
          this.onAreaDrawProgress.invoke({start: this.drawStart, end: result.position, normal:this.drawNormal})
        }
        return
      }
      // No candidate surface this frame, or a prior callback already locked it.
      if (!result || !this.placing) return

      // Only horizontal surfaces are valid packing workspaces.
      const normal = result.normal.normalize()
      if (normal.dot(vec3.up()) < 0.75) return

      // A World Query callback may arrive after another callback already locked
      // placement. Never let later cursor movement reposition the workspace.
      this.latestPosition = result.position
      this.latestNormal = result.normal
      const transform = this.workspaceRoot.getTransform()
      transform.setWorldPosition(this.latestPosition.add(this.latestNormal.uniformScale(1.0)))
      const surfaceForward = vec3.forward().sub(normal.uniformScale(vec3.forward().dot(normal))).normalize()
      transform.setWorldRotation(quat.lookAt(normal.uniformScale(-1), surfaceForward))

      if (pressed && !wasPressed) this.placementGestureStarted = true
      if (!pressed && wasPressed && this.placementGestureStarted) {
        this.placing = false
        this.placementGestureStarted = false
        this.onPlaced.invoke()
        console.log("[PackSpace] Horizontal packing surface locked")
      }
    })
  }
}
