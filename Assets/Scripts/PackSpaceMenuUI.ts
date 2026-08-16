/**
 * PackSpaceMenuUI owns the launcher and custom-preset editor surfaces.
 * It emits user intent and must not own session progress.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {TextInputField} from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {PackArea, PackPreset, PackSpaceState} from "./PackSpaceState"
import {styleFlatButton, styleFlatFrame, styleFlatInput} from "./PackSpaceFlatStyle"

const ICON_ADD = requireAsset("../Icons/add.png") as Texture
const ICON_EDIT = requireAsset("../Icons/edit.png") as Texture
const ICON_SAVE = requireAsset("../Icons/save.png") as Texture
const ICON_PLAY = requireAsset("../Icons/play_arrow.png") as Texture

const PANEL_W = 42
const LAUNCHER_H = 42
const EDITOR_H = 34
const IMPORT_H = 28
const PAD = 1.5
const MENU_DISTANCE_CM = 135
const MENU_DROP_CM = 6
const FOLLOW_SPEED = 7

@component
export class PackSpaceMenuUI extends BaseScriptComponent {
  public onStartPreset = new Event<PackPreset>()
  public onBeginSpatialPreset = new Event<{presetName: string; categoryName: string}>()
  public onImportCode = new Event<string>()
  private presetInput: TextInputField | null = null
  private areaInput: TextInputField | null = null
  private itemInput: TextInputField | null = null
  private summary: ElementContent | null = null
  private importInput: TextInputField | null = null
  private importStatus: ElementContent | null = null
  private draftAreas: PackArea[] = []
  private frame: Frame | null = null
  private launcherPage: SceneObject | null = null
  private editorPage: SceneObject | null = null
  private importPage: SceneObject | null = null
  private savedPresetRoots: SceneObject[] = []
  private savedSectionRoot: SceneObject | null = null
  private savedPresets: PackPreset[] = []
  private launcherLayout: FlexLayout | null = null
  private contentHost: SceneObject | null = null
  private cameraTransform: Transform | null = null
  private snapToView = true

  onAwake(): void {
    this.cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform()
    this.sceneObject.createComponent("Component.Canvas")
    const frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    styleFlatFrame(frame)
    this.frame = frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = false
    frame.onInitialized.add(() => {
      // The launcher is head-following but never draggable. Disabling the
      // Frame plane also keeps its flat white outline permanently visible;
      // child buttons and text inputs retain their own interactions.
      frame.interactionPlane.enabled = false
      frame.innerSize = new vec2(PANEL_W, LAUNCHER_H)
      frame.padding = new vec2(PAD, PAD)
      this.build(frame.contentTransform.getSceneObject())
    })
    this.createEvent("UpdateEvent").bind(() => this.followView())
  }

  public show(): void {
    this.sceneObject.enabled = true
    this.snapToView = true
    this.followView()
    this.showLauncher()
  }
  public hide(): void { this.sceneObject.enabled = false }

  public setSavedPresets(presets: PackPreset[]): void {
    this.savedPresets = presets.slice(-8)
    if (!this.launcherPage || !this.contentHost) return
    this.renderSavedPresets()
  }

  private renderSavedPresets(): void {
    this.savedPresetRoots.forEach(root => root.destroy())
    this.savedPresetRoots = []
    if (this.savedSectionRoot) this.savedSectionRoot.destroy()
    this.savedSectionRoot = null
    if (!this.launcherPage || !this.contentHost) return
    if (!this.savedPresets.length) return

    const section = this.obj(this.launcherPage, "Continue where you left")
    section.getTransform().setLocalPosition(new vec3(0, -20.5, 0.7))
    this.savedSectionRoot = section

    const titleRoot = this.obj(section, "Continue where you left title")
    titleRoot.getTransform().setLocalPosition(new vec3(0, 7.3, 0.1))
    const title = titleRoot.createComponent(ElementContent.getTypeName()) as ElementContent
    title.text = "CONTINUE WHERE YOU LEFT"
    title.textSize = 56
    title.sizeOverride = new vec2(PANEL_W - 6, 2.5)

    const scrollRoot = this.obj(section, "Saved presets scroll")
    const scroll = scrollRoot.createComponent(ScrollWindow.getTypeName()) as ScrollWindow
    // Give the mask one centimeter of breathing room on each side; an exact
    // button-width viewport clips UIKit's border/hover visual at both edges.
    const listWidth = PANEL_W - 3
    const viewportHeight = 12.16
    const itemHeight = 3.6
    const itemGap = 0.5
    const contentHeight = Math.max(viewportHeight, this.savedPresets.length * (itemHeight + itemGap) - itemGap)
    scroll.windowSize = new vec2(listWidth, viewportHeight)
    scroll.scrollDimensions = new vec2(listWidth, contentHeight)
    // The fade mesh sits on the viewport plane and produces depth flicker with
    // UIKit button faces in world space, so keep only stencil clipping.
    scroll.edgeFade = false

    const list = this.obj(scrollRoot, "Saved preset list")
    // Flex content is centered around its own origin. Shift taller content
    // downward so its upper edge aligns with the viewport's upper edge.
    const topAlignedOffset = -Math.max(0, contentHeight - viewportHeight) * 0.5
    list.getTransform().setLocalPosition(new vec3(0, topAlignedOffset, 0.6))
    this.flex(list, FlexDirection.Column, listWidth, contentHeight, itemGap)
    this.savedPresets.forEach((preset, index) => {
      const root = this.addButton(list, `Resume ${preset.name}`, itemHeight, ICON_PLAY, () => this.onStartPreset.invoke(preset))
      this.savedPresetRoots.push(root)
    })
    if (this.frame) this.frame.innerSize = new vec2(PANEL_W, LAUNCHER_H)
  }

  private build(host: SceneObject): void {
    this.contentHost = host
    this.launcherPage = this.obj(host, "PackSpaceLauncherPage")
    this.launcherPage.getTransform().setLocalPosition(new vec3(0, 7.7, 0.6))
    const launcher = this.flex(this.launcherPage, FlexDirection.Column, PANEL_W - PAD * 2, 20.5, 0.8)
    this.launcherLayout = launcher.getComponent(FlexLayout.getTypeName()) as FlexLayout

    this.addLabel(launcher, "PACKSPACE", 3.5)
    this.addLabel(launcher, "Turn a real surface into a packing station", 2.2)
    this.addSpacer(launcher, 2.5)
    this.addButton(launcher, "Start Two-Day Work Trip", 3.6, ICON_PLAY, () => this.onStartPreset.invoke(PackSpaceState.starterPreset()))
    this.addButton(launcher, "Create Custom Preset", 3.6, ICON_ADD, () => this.showEditor())
    this.addButton(launcher, "Import Pack Code", 3.6, ICON_EDIT, () => this.showImport())

    this.editorPage = this.obj(host, "PackSpacePresetEditorPage")
    this.editorPage.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const editor = this.flex(this.editorPage, FlexDirection.Column, PANEL_W - PAD * 2, EDITOR_H - PAD * 2, 0.7)

    this.addLabel(editor, "NEW PRESET", 4.2)
    this.addLabel(editor, "Name the preset and its first category", 3)

    this.presetInput = this.addInput(editor, "Preset name", "Preset name — e.g. Beach trip")
    this.areaInput = this.addInput(editor, "Category name", "Category name — e.g. Clothes")
    this.addButton(editor, "Place Category", 3.6, ICON_ADD, () => this.beginSpatialPreset())
    this.addButton(editor, "Back", 3.2, ICON_PLAY, () => this.showLauncher())

    const summaryObject = this.obj(editor, "DraftSummary")
    this.summary = summaryObject.createComponent(ElementContent.getTypeName()) as ElementContent
    this.summary.text = "NEXT / place this category on a horizontal surface"
    this.summary.textSize = 50
    this.summary.sizeOverride = new vec2(PANEL_W - 5, 6)
    summaryObject.createComponent(FlexItem.getTypeName())

    this.importPage = this.obj(host, "PackSpaceImportPage")
    this.importPage.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const importer = this.flex(this.importPage, FlexDirection.Column, PANEL_W - PAD * 2, IMPORT_H - PAD * 2, 0.8)
    this.addLabel(importer, "IMPORT PACK CODE", 4.2)
    this.addLabel(importer, "Enter the 6-character code from your friend", 2.8)
    this.importInput = this.addInput(importer, "Pack code", "A7K2Q9")
    this.addButton(importer, "Import & Save", 3.8, ICON_SAVE, () => this.submitImport())
    this.addButton(importer, "Back", 3.2, ICON_PLAY, () => this.showLauncher())
    const importStatusRoot = this.obj(importer, "Import status")
    this.importStatus = importStatusRoot.createComponent(ElementContent.getTypeName()) as ElementContent
    this.importStatus.text = "6 LETTERS OR NUMBERS"
    this.importStatus.textSize = 46
    this.importStatus.sizeOverride = new vec2(PANEL_W - 5, 4)
    importStatusRoot.createComponent(FlexItem.getTypeName())
    this.renderSavedPresets()
    this.showLauncher()
  }

  private beginSpatialPreset(): void {
    this.presetInput?.editMode(false)
    this.areaInput?.editMode(false)
    const presetName = this.presetInput?.text.trim() ?? ""
    const categoryName = this.areaInput?.text.trim() ?? ""
    if (!presetName) { this.setSummary("Enter a preset name first"); return }
    if (!categoryName) { this.setSummary("Enter a category name first"); return }
    this.onBeginSpatialPreset.invoke({presetName:presetName.slice(0,28),categoryName:categoryName.slice(0,28)})
  }

  public setImportResult(message: string, success: boolean): void {
    if (this.importStatus) this.importStatus.text = `${success ? "SAVED" : "ERROR"} / ${message}`
    if (success && this.importInput) this.importInput.text = ""
  }

  private submitImport(): void {
    this.importInput?.editMode(false)
    const code = (this.importInput?.text ?? "").trim().toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) { this.setImportResult("enter exactly 6 valid characters", false); return }
    this.onImportCode.invoke(code)
  }

  private showLauncher(): void {
    if (this.launcherPage) this.launcherPage.enabled = true
    if (this.editorPage) this.editorPage.enabled = false
    if (this.importPage) this.importPage.enabled = false
    this.savedPresetRoots.forEach(root => root.enabled = true)
    if (this.frame && this.launcherPage) this.frame.innerSize = new vec2(PANEL_W, LAUNCHER_H)
  }

  private showEditor(): void {
    if (this.launcherPage) this.launcherPage.enabled = false
    if (this.editorPage) this.editorPage.enabled = true
    if (this.importPage) this.importPage.enabled = false
    this.savedPresetRoots.forEach(root => root.enabled = false)
    if (this.frame && this.editorPage) this.frame.innerSize = new vec2(PANEL_W, EDITOR_H)
  }

  private showImport(): void {
    if (this.launcherPage) this.launcherPage.enabled = false
    if (this.editorPage) this.editorPage.enabled = false
    if (this.importPage) this.importPage.enabled = true
    this.savedPresetRoots.forEach(root => root.enabled = false)
    if (this.frame) this.frame.innerSize = new vec2(PANEL_W, IMPORT_H)
  }

  private followView(): void {
    if (!this.sceneObject.enabled || !this.cameraTransform) return
    const camera = this.cameraTransform
    const target = camera.getWorldPosition()
      // Lens Studio cameras view down local -Z; Transform.forward is local +Z.
      .add(camera.forward.uniformScale(-MENU_DISTANCE_CM))
      .add(camera.up.uniformScale(-MENU_DROP_CM))
    const transform = this.sceneObject.getTransform()
    if (this.snapToView) {
      transform.setWorldPosition(target)
      this.snapToView = false
    } else {
      const alpha = 1 - Math.exp(-FOLLOW_SPEED * getDeltaTime())
      const current = transform.getWorldPosition()
      transform.setWorldPosition(current.add(target.sub(current).uniformScale(alpha)))
    }
    transform.setWorldRotation(camera.getWorldRotation())
  }

  private addArea(): void {
    this.areaInput?.editMode(false)
    const name = this.areaInput?.text.trim() ?? ""
    if (name.length === 0) { this.setSummary("Enter an area name first"); return }
    if (this.draftAreas.length >= 6) { this.setSummary("Maximum 6 areas"); return }
    this.draftAreas.push({id: `draft-${this.draftAreas.length}`, name: name.slice(0, 28), colorIndex: this.draftAreas.length, items: []})
    if (this.areaInput) this.areaInput.text = ""
    this.refreshSummary()
  }

  private addItem(): void {
    this.itemInput?.editMode(false)
    this.areaInput?.editMode(false)
    const name = this.itemInput?.text.trim() ?? ""
    if (name.length === 0) { this.setSummary("Enter an item name first"); return }
    if (this.draftAreas.length === 0) {
      const typedArea = this.areaInput?.text.trim() ?? ""
      this.draftAreas.push({id: "draft-0", name: (typedArea || "General").slice(0, 28), colorIndex: 0, items: []})
      if (this.areaInput) this.areaInput.text = ""
    }
    const area = this.draftAreas[this.draftAreas.length - 1]
    if (area.items.length >= 8) { this.setSummary(`Maximum 8 items in ${area.name}`); return }
    area.items.push({id: `${area.id}-item-${area.items.length}`, name: name.slice(0, 28), packed: false})
    if (this.itemInput) this.itemInput.text = ""
    this.refreshSummary()
    console.log(`[PackSpace] Added custom item '${name}' to '${area.name}'`)
  }

  private saveCustom(): void {
    const state = new PackSpaceState()
    const preset = state.addCustomPreset(this.presetInput?.text ?? "My Packing Preset", this.draftAreas)
    this.onStartPreset.invoke(preset)
  }

  private refreshSummary(): void {
    if (!this.summary) return
    if (this.draftAreas.length === 0) { this.summary.text = "Custom preset: add an area, then add items"; return }
    this.summary.text = this.draftAreas.map(area => `${area.name}: ${area.items.map(item => item.name).join(", ") || "add items"}`).join("  •  ")
  }

  private setSummary(message: string): void {
    if (this.summary) this.summary.text = message
  }

  private addInput(parent: SceneObject, name: string, placeholder: string): TextInputField {
    const so = this.obj(parent, name)
    const input = so.createComponent(TextInputField.getTypeName()) as TextInputField
    styleFlatInput(input)
    input.size = new vec3(PANEL_W - 5, 4, 1)
    input.fontSize = 62
    input.placeholderText = placeholder
    so.createComponent(FlexItem.getTypeName())
    return input
  }

  private addButton(parent: SceneObject, text: string, height: number, icon: Texture, action: () => void): SceneObject {
    const so = this.obj(parent, text)
    const button = so.createComponent(Button.getTypeName()) as Button
    styleFlatButton(button)
    button.size = new vec3(PANEL_W - 5, height, 1)
    const content = so.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = text
    content.leadingIcon = icon
    content.leadingIconSize = 1.7
    content.textSize = 52
    content.sizeOverride = new vec2(PANEL_W - 6, height)
    so.createComponent(FlexItem.getTypeName())
    button.onTriggerUp.add(action)
    return so
  }

  private addLabel(parent: SceneObject, text: string, height: number): void {
    const so = this.obj(parent, text)
    const label = so.createComponent(ElementContent.getTypeName()) as ElementContent
    label.text = text
    label.textSize = text === "PACKSPACE" || text === "NEW PRESET" ? 82 : 52
    label.sizeOverride = new vec2(PANEL_W - 5, height)
    so.createComponent(FlexItem.getTypeName())
  }

  private addSpacer(parent: SceneObject, height: number): void {
    const spacer = this.obj(parent, "Header Spacer")
    const item = spacer.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = PANEL_W - 5
    item.overrideHeight = height
  }

  private obj(parent: SceneObject, name: string): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    return so
  }

  private flex(parent: SceneObject, direction: FlexDirection, width: number, height: number, gap: number): SceneObject {
    const layout = parent.createComponent(FlexLayout.getTypeName()) as FlexLayout
    layout.width = width
    layout.height = height
    layout.direction = direction
    layout.rowGap = gap
    layout.alignItems = FlexAlign.Stretch
    layout.justifyContent = FlexJustify.Start
    return parent
  }
}
