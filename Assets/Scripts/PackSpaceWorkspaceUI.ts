/**
 * PackSpaceWorkspaceUI renders user-defined pack areas and item controls.
 * It is a passive spatial view and emits item IDs when a user confirms an item.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {PackPreset} from "./PackSpaceState"
import {styleFlatButton, styleFlatFrame} from "./PackSpaceFlatStyle"

const ICON_CHECK = requireAsset("../Icons/check.png") as Texture

@component
export class PackSpaceWorkspaceUI extends BaseScriptComponent {
  public onItemToggle = new Event<string>()
  private builtRoots: SceneObject[] = []
  private itemRows: {[id: string]: {content: ElementContent; name: string}} = {}

  onAwake(): void { this.sceneObject.createComponent("Component.Canvas"); this.sceneObject.enabled = false }

  public renderPreset(preset: PackPreset): void {
    this.clear()
    const count = Math.max(1, preset.areas.length)
    const columns = Math.min(3, count)
    const spacingX = 24
    const spacingY = 22

    preset.areas.forEach((area, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const root = global.scene.createSceneObject(`PackArea-${area.name}`)
      root.setParent(this.sceneObject)
      // All areas share one surface plane. Rows move down in local Y, never
      // backward in local Z (which made panels appear stacked in depth).
      root.getTransform().setLocalPosition(new vec3((column - (columns - 1) / 2) * spacingX, 0.8 - row * spacingY, 0))
      this.builtRoots.push(root)

      const frame = root.createComponent(Frame.getTypeName()) as Frame
      styleFlatFrame(frame)
      frame.autoShowHide = false
      frame.autoScaleContent = false
      frame.allowScaling = false
      frame.allowTranslation = false
      frame.onInitialized.add(() => {
        frame.interactionPlane.enabled = false
        frame.innerSize = new vec2(20, 20)
        frame.padding = new vec2(0.7, 0.7)
        this.buildArea(frame.contentTransform.getSceneObject(), area.name, area.items.map(item => ({id: item.id, name: item.name, packed: item.packed})))
      })
    })
    this.sceneObject.enabled = true
  }

  public hide(): void { this.sceneObject.enabled = false }

  /** Update one checklist row without destroying or rebuilding any Frames. */
  public updateItem(itemId: string, packed: boolean): void {
    const row = this.itemRows[itemId]
    if (!row) return
    row.content.text = packed ? row.name : `○ ${row.name}`
    row.content.leadingIcon = packed ? ICON_CHECK : null
    if (packed) row.content.leadingIconSize = 1.4
  }

  private buildArea(host: SceneObject, areaName: string, items: {id: string; name: string; packed: boolean}[]): void {
    const content = global.scene.createSceneObject(`${areaName}-Content`)
    content.setParent(host)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    this.spatialLabel(content, areaName, new vec3(0, 8, 0.1), 18, 2.5, 48)
    this.buildDropZone(content, areaName)
    this.buildChecklist(content, areaName, items)
  }

  private buildDropZone(parent: SceneObject, areaName: string): void {
    const zoneRoot = global.scene.createSceneObject(`${areaName}-PackingZone`)
    zoneRoot.setParent(parent)
    zoneRoot.getTransform().setLocalPosition(new vec3(-3.5, -1, 0.1))
    const zone = zoneRoot.createComponent(Frame.getTypeName()) as Frame
    styleFlatFrame(zone)
    zone.autoShowHide = false
    zone.autoScaleContent = false
    zone.allowScaling = false
    zone.allowTranslation = false
    zone.onInitialized.add(() => {
      zone.interactionPlane.enabled = false
      zone.innerSize = new vec2(12.5, 12.5)
      zone.padding = new vec2(0.35, 0.35)
      const zoneLabel = zone.contentTransform.getSceneObject().createComponent(ElementContent.getTypeName()) as ElementContent
      zoneLabel.text = "PACK AREA"
      zoneLabel.textSize = 38
      zoneLabel.sizeOverride = new vec2(11.5, 3)
    })
  }

  private buildChecklist(parent: SceneObject, areaName: string, items: {id: string; name: string; packed: boolean}[]): void {
    const checklist = global.scene.createSceneObject(`${areaName}-Checklist`)
    checklist.setParent(parent)
    checklist.getTransform().setLocalPosition(new vec3(5.7, 5, 0.15))
    this.spatialLabel(checklist, "CHECKLIST", vec3.zero(), 7, 2, 38)
    items.forEach((item, index) => this.itemButton(checklist, item.id, item.name, item.packed, new vec3(0, -2.2 - index * 1.75, 0.05)))
  }

  private spatialLabel(parent: SceneObject, text: string, position: vec3, width: number, height: number, size: number): void {
    const so = global.scene.createSceneObject(text)
    so.setParent(parent)
    so.getTransform().setLocalPosition(position)
    const content = so.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = text
    content.textSize = size
    content.sizeOverride = new vec2(width, height)
  }

  private itemButton(parent: SceneObject, id: string, name: string, packed: boolean, position: vec3): void {
    const so = global.scene.createSceneObject(`PackItem-${name}`)
    so.setParent(parent)
    so.getTransform().setLocalPosition(position)
    const button = so.createComponent(Button.getTypeName()) as Button
    styleFlatButton(button)
    button.size = new vec3(7, 1.6, 1)
    const content = so.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = packed ? name : `○ ${name}`
    if (packed) {
      content.leadingIcon = ICON_CHECK
      content.leadingIconSize = 1.4
    }
    content.textSize = 38
    content.sizeOverride = new vec2(6.5, 1.6)
    this.itemRows[id] = {content, name}
    button.onTriggerUp.add(() => this.onItemToggle.invoke(id))
  }

  private clear(): void {
    this.builtRoots.forEach(root => root.destroy())
    this.builtRoots = []
    this.itemRows = {}
  }
}
