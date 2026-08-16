/** Screen-space packing summary rendered by the dedicated ortho camera. */
import {PackPreset} from "./PackSpaceState"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {styleFlatButton} from "./PackSpaceFlatStyle"

@component
export class PackSpaceHUD extends BaseScriptComponent {
  public onBackToMain = new Event<void>()

  @input
  @hint("Screen Text component used for the always-visible packing list")
  listText!: Text

  private active: PackPreset | null = null
  private backRoot: SceneObject | null = null
  private cameraTransform: Transform | null = null

  onAwake(): void {
    this.cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform()
    this.buildBackControl()
    this.createEvent("UpdateEvent").bind(() => this.followBackControl())
    this.sceneObject.enabled = false
  }

  public showPreset(preset: PackPreset): void {
    this.active = preset
    this.sceneObject.enabled = true
    if (this.backRoot) this.backRoot.enabled = true
    this.followBackControl()
    this.refresh()
  }

  public showMessage(message: string): void {
    this.active = null
    this.sceneObject.enabled = true
    if (this.backRoot) this.backRoot.enabled = true
    this.followBackControl()
    if (this.listText) this.listText.text = message
  }

  public hide(): void {
    this.active = null
    if (this.backRoot) this.backRoot.enabled = false
    this.sceneObject.enabled = false
  }

  public updateItem(itemId: string, packed: boolean): void {
    if (!this.active) return
    this.active.areas.forEach(area => area.items.forEach(item => {
      if (item.id === itemId) item.packed = packed
    }))
    this.refresh()
  }

  private refresh(): void {
    if (!this.active || !this.listText) return
    const progress = this.progress()
    const lines: string[] = [`PACKSPACE  ${progress.packed}/${progress.total}`]
    this.active.areas.forEach(area => {
      lines.push(`\n${area.name.toUpperCase()}`)
      area.items.forEach(item => lines.push(`${item.packed ? "✓" : "○"} ${item.name}`))
    })
    this.listText.text = lines.join("\n")
  }

  private progress(): {packed: number; total: number} {
    let packed = 0
    let total = 0
    this.active!.areas.forEach(area => area.items.forEach(item => {
      total++
      if (item.packed) packed++
    }))
    return {packed, total}
  }

  private buildBackControl(): void {
    const root = global.scene.createSceneObject("PackSpace Headlocked Back Control")
    root.createComponent("Component.Canvas")
    const button = root.createComponent(Button.getTypeName()) as Button
    styleFlatButton(button)
    button.size = new vec3(16, 5.5, 1)
    const content = root.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = "[ MAIN MENU ]"
    content.textSize = 58
    content.sizeOverride = new vec2(15, 5)
    button.onTriggerUp.add(() => this.onBackToMain.invoke())
    root.enabled = false
    this.backRoot = root
  }

  private followBackControl(): void {
    if (!this.backRoot || !this.backRoot.enabled || !this.cameraTransform) return
    const camera = this.cameraTransform
    const position = camera.getWorldPosition()
      .add(camera.forward.uniformScale(-105))
      .add(camera.right.uniformScale(21))
      .add(camera.up.uniformScale(-17))
    this.backRoot.getTransform().setWorldPosition(position)
    this.backRoot.getTransform().setWorldRotation(camera.getWorldRotation())
  }
}
