/** Spatial custom-preset authoring: category rectangles plus inline item entry. */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {TextInputField} from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {PackArea, PackPreset} from "./PackSpaceState"
import {styleFlatButton, styleFlatFrame, styleFlatInput} from "./PackSpaceFlatStyle"

const AREA_TITLE_TEXT_SIZE = 94
const AREA_CONTENT_TEXT_SIZE = 84
const AREA_ROW_STEP = 2.65

@component
export class PackSpaceAuthoringUI extends BaseScriptComponent {
  public onDrawCategory = new Event<string>()
  public onFinishPreset = new Event<PackPreset>()
  public onItemToggle = new Event<string>()
  public onBackToMenu = new Event<void>()

  private presetName = ""
  private categoryInput: TextInputField | null = null
  private status: ElementContent | null = null
  private toolbar: SceneObject | null = null
  private drawPreviewRoot: SceneObject | null = null
  private drawPreviewFrame: Frame | null = null
  private drawPreviewReady = false
  private drawPreviewSize = new vec2(8, 8)
  private areas: PackArea[] = []
  private areaRoots: SceneObject[] = []
  private areaViews: {host: SceneObject; plusRoot: SceneObject; area: PackArea; size: vec2}[] = []
  private packingMode = false

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.enabled = false
  }

  public begin(presetName: string): void {
    this.clear()
    this.presetName = presetName
    this.areas = []
    this.areaViews = []
    this.packingMode = false
    this.sceneObject.enabled = true
  }

  public resumePreset(preset: PackPreset): void {
    this.clear()
    this.presetName = preset.name
    this.areas = preset.areas
    this.areaViews = []
    this.packingMode = true
    this.sceneObject.enabled = true
    preset.areas.forEach(area => {
      if (!area.placement) return
      const p = area.placement
      this.buildCategory(area, new vec3(p.center.x, p.center.y, p.center.z), new vec2(p.size.x, p.size.y), "packing")
    })
  }

  public addDrawnCategory(name: string, localCenter: vec3, size: vec2): void {
    this.clearDrawPreview()
    const index = this.areas.length
    const area: PackArea = {id: `draft-area-${index}`, name: name || `Category ${index + 1}`, colorIndex: index, items: []}
    area.placement = {center:{x:localCenter.x,y:localCenter.y,z:localCenter.z},size:{x:size.x,y:size.y}}
    this.areas.push(area)
    this.buildCategory(area, localCenter, size, "authoring")
    this.setStatus(`READY  /  category drawn`)
    if (this.categoryInput) this.categoryInput.text = ""
  }

  public updateDrawPreview(localStart: vec3, localEnd: vec3): void {
    const rawSize = new vec2(Math.abs(localEnd.x - localStart.x), Math.abs(localEnd.y - localStart.y))
    this.drawPreviewSize = new vec2(Math.max(4, Math.min(30, rawSize.x)), Math.max(4, Math.min(30, rawSize.y)))
    const center = localStart.add(localEnd).uniformScale(0.5)

    if (!this.drawPreviewRoot) this.createDrawPreview()
    // Local Z is the workspace surface normal. Preserve it so the preview
    // follows whichever horizontal surface is currently under the hand ray.
    this.drawPreviewRoot!.getTransform().setLocalPosition(new vec3(center.x, center.y, center.z + 0.55))
    if (this.drawPreviewReady && this.drawPreviewFrame) this.drawPreviewFrame.innerSize = this.drawPreviewSize
  }

  public clearDrawPreview(): void {
    if (this.drawPreviewRoot) this.drawPreviewRoot.destroy()
    this.drawPreviewRoot = null
    this.drawPreviewFrame = null
    this.drawPreviewReady = false
  }

  /** Show a completed sequential-placement area immediately, without edit controls. */
  public showPlacedPresetArea(area: PackArea, localCenter: vec3, size: vec2): void {
    this.buildCategory(area, localCenter, size, "placement")
  }

  private createDrawPreview(): void {
    const root = global.scene.createSceneObject("ASCII Live Draw Preview")
    root.setParent(this.sceneObject)
    this.drawPreviewRoot = root
    const frame = root.createComponent(Frame.getTypeName()) as Frame
    styleFlatFrame(frame)
    this.drawPreviewFrame = frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = false
    frame.onInitialized.add(() => {
      frame.interactionPlane.enabled = false
      frame.innerSize = this.drawPreviewSize
      frame.padding = new vec2(0.2, 0.2)
      this.makeFrameVisualOnly(root)
      this.text(frame.contentTransform.getSceneObject(), "+  DRAWING  +", vec3.zero(), Math.max(6, this.drawPreviewSize.x - 1), 2)
      this.drawPreviewReady = true
    })
  }

  private buildToolbar(): void {
    const root = global.scene.createSceneObject("ASCII Preset Toolbar")
    root.setParent(this.sceneObject)
    root.getTransform().setLocalPosition(new vec3(0, 16, 0.4))
    this.toolbar = root
    const frame = root.createComponent(Frame.getTypeName()) as Frame
    styleFlatFrame(frame)
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = false
    frame.onInitialized.add(() => {
      frame.interactionPlane.enabled = false
      frame.innerSize = new vec2(38, 10)
      frame.padding = new vec2(0.6, 0.6)
      const host = frame.contentTransform.getSceneObject()
      this.text(host, `+-- ${this.presetName.toUpperCase()} / CATEGORY LAYOUT --+`, new vec3(0, 3.4, 0.1), 36, 2)
      const inputRoot = this.obj(host, "Category name", new vec3(-7, 0.5, 0.1))
      this.categoryInput = inputRoot.createComponent(TextInputField.getTypeName()) as TextInputField
      styleFlatInput(this.categoryInput)
      this.categoryInput.size = new vec3(22, 3, 1)
      this.categoryInput.placeholderText = "Category name — e.g. Clothes"
      this.button(host, "[ DRAW CATEGORY ]", new vec3(11.5, 0.5, 0.1), 12, 3, () => this.requestDraw())
      this.button(host, "[ FINISH PRESET ]", new vec3(11.5, -3, 0.1), 12, 2.6, () => this.finish())
      this.status = this.text(host, "STEP  /  name category, then pinch-drag a square", new vec3(-5, -3, 0.1), 24, 2)
    })
  }

  private requestDraw(): void {
    this.categoryInput?.editMode(false)
    const name = this.categoryInput?.text.trim() ?? ""
    if (!name) { this.setStatus("ERROR / enter a category name first"); return }
    this.setStatus(`DRAW  /  pinch-drag the ${name} square`)
    this.onDrawCategory.invoke(name.slice(0, 28))
  }

  private finish(): void {
    const nonEmpty = this.areas.filter(area => area.items.length > 0)
    if (!nonEmpty.length) { this.setStatus("ERROR / add at least one item to a category"); return }
    this.packingMode = true
    this.areaViews.forEach(view => {
      this.renderAreaItems(view.host, view.plusRoot, view.area, view.size)
      this.destroyChild(view.host, "+")
      this.destroyChild(view.host, "[ ADD CATEGORY ]")
      this.destroyChild(view.host, "[ FINISH ]")
      this.destroyChild(view.host, `${view.area.name} Item Editor`)
      this.destroyChild(view.host, "Next Category Editor")
    })
    this.onFinishPreset.invoke({id:`custom-${Date.now()}`,name:this.presetName,userCreated:true,areas:nonEmpty})
  }

  private buildCategory(area: PackArea, center: vec3, requestedSize: vec2, mode: "authoring" | "placement" | "packing"): void {
    const size = new vec2(Math.max(14, Math.min(30, requestedSize.x)), Math.max(14, Math.min(30, requestedSize.y)))
    // Do not flatten every category onto the first detected surface. The
    // stored local Z retains the height delta for tables, chairs, floors, etc.
    const root = this.obj(this.sceneObject, `ASCII Category ${area.name}`, new vec3(center.x, center.y, center.z + 0.25))
    this.areaRoots.push(root)
    const frame = root.createComponent(Frame.getTypeName()) as Frame
    styleFlatFrame(frame)
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = false
    frame.onInitialized.add(() => {
      frame.interactionPlane.enabled = false
      frame.innerSize = size
      frame.padding = new vec2(0.4, 0.4)
      this.makeFrameVisualOnly(root)
      const host = frame.contentTransform.getSceneObject()
      this.buildNamedCategory(host, area, size, mode)
    })
  }

  private buildCategoryNaming(host: SceneObject, area: PackArea, size: vec2): void {
    const editor = this.obj(host, "Name category", vec3.zero())
    const inputRoot = this.obj(editor, "Category name", new vec3(0, 1.8, 0.1))
    const input = inputRoot.createComponent(TextInputField.getTypeName()) as TextInputField
    styleFlatInput(input)
    input.size = new vec3(Math.max(10, size.x - 3), 3, 1)
    input.placeholderText = "Name this category"
    this.button(editor, "[ SAVE NAME ]", new vec3(0, -2, 0.1), Math.max(10, size.x - 3), 2.6, () => {
      input.editMode(false)
      const name = input.text.trim()
      if (!name) return
      area.name = name.slice(0, 28)
      editor.destroy()
      this.buildNamedCategory(host, area, size)
    })
  }

  private buildNamedCategory(host: SceneObject, area: PackArea, size: vec2, mode: "authoring" | "placement" | "packing" = "authoring"): void {
    const title = this.text(host, area.name.toUpperCase(), new vec3(0, size.y * 0.38 + 10, 0.35), size.x - 1, 3.2)
    title.textSize = AREA_TITLE_TEXT_SIZE
    if (mode === "placement") {
      this.renderPlacedItems(host, area, size)
      return
    }
    // Keep the action above the Frame backplate and make the Button itself the
    // tracked root. The previous nested zero-depth root could be occluded.
    let plusRoot: SceneObject
    plusRoot = this.button(host, "+", this.plusPosition(size), 5, 5, () => this.openItemEntry(host, plusRoot, area, size))
    this.areaViews.push({host, plusRoot, area, size})
    if (mode === "packing" || this.packingMode) {
      plusRoot.enabled = false
      this.renderAreaItems(host, plusRoot, area, size)
      return
    }
    this.button(host, "[ ADD CATEGORY ]", new vec3(-size.x * 0.22, -size.y * 0.38, 0.45), Math.max(7, size.x * 0.48), 2.2, () => this.openNextCategoryEntry(host, size))
    this.button(host, "[ FINISH ]", new vec3(size.x * 0.25, -size.y * 0.38, 0.45), Math.max(7, size.x * 0.35), 2.2, () => this.finish())
  }

  private renderPlacedItems(host: SceneObject, area: PackArea, size: vec2): void {
    const listWidth = Math.max(10, size.x - 3)
    const list = this.obj(host, `${area.name} Placement Items`, new vec3(0, size.y * 0.5 - 1.5, 0.5))
    const heading = this.text(list, "TO COLLECT", vec3.zero(), listWidth, 3)
    heading.textSize = AREA_CONTENT_TEXT_SIZE
    heading.contentAlignment = "left"
    area.items.forEach((item, index) => {
      const row = this.text(list, `> ${item.name}`, new vec3(0, -(index + 1) * AREA_ROW_STEP, 0), listWidth, 2.5)
      row.textSize = AREA_CONTENT_TEXT_SIZE
      row.contentAlignment = "left"
    })
  }

  private openNextCategoryEntry(host: SceneObject, size: vec2): void {
    const existing = this.findChild(host, "Next Category Editor")
    if (existing) existing.destroy()
    const editor = this.obj(host, "Next Category Editor", new vec3(0, -size.y * 0.5 - 5, 0))
    const inputRoot = this.obj(editor, "Next category name", new vec3(0, 1.8, 0.7))
    const input = inputRoot.createComponent(TextInputField.getTypeName()) as TextInputField
    styleFlatInput(input)
    input.size = new vec3(Math.max(10, size.x - 3), 3.8, 1)
    input.fontSize = 60
    input.placeholderText = "New category name"
    this.button(editor, "[ PLACE CATEGORY ]", new vec3(0, -2, 0.7), Math.max(10, size.x - 3), 2.6, () => {
      input.editMode(false)
      const name = input.text.trim()
      if (!name) return
      editor.destroy()
      this.onDrawCategory.invoke(name.slice(0, 28))
    })
  }

  private openItemEntry(host: SceneObject, plusRoot: SceneObject, area: PackArea, size: vec2): void {
    plusRoot.enabled = false
    const editor = this.obj(host, `${area.name} Item Editor`, vec3.zero())
    const inputRoot = this.obj(editor, "Item name", new vec3(0, 1.8, 0.7))
    const input = inputRoot.createComponent(TextInputField.getTypeName()) as TextInputField
    styleFlatInput(input)
    input.size = new vec3(Math.max(10, size.x - 3), 3.8, 1)
    input.fontSize = 60
    input.placeholderText = "Item name"
    this.button(editor, "[ ADD ITEM ]", new vec3(0, -2, 0.7), Math.max(10, size.x - 3), 2.6, () => {
      input.editMode(false)
      const name = input.text.trim()
      if (!name) return
      area.items.push({id:`${area.id}-item-${area.items.length}`,name:name.slice(0,28),packed:false})
      editor.destroy()
      this.renderAreaItems(host, plusRoot, area, size)
      this.setStatus(`ADDED / ${name} -> ${area.name}`)
    })
  }

  private renderAreaItems(host: SceneObject, plusRoot: SceneObject, area: PackArea, size: vec2): void {
    const old = this.findChild(host, `${area.name} Items`)
    if (old) old.destroy()
    const listWidth = Math.max(10, size.x - 3)
    const list = this.obj(host, `${area.name} Items`, new vec3(0, size.y * 0.5 - 1.5, 0.5))
    const heading = this.text(list, "TO COLLECT", vec3.zero(), listWidth, 3)
    heading.textSize = AREA_CONTENT_TEXT_SIZE
    heading.contentAlignment = "left"
    area.items.forEach((item, index) => {
      const position = new vec3(0, -(index + 1) * AREA_ROW_STEP, 0)
      if (this.packingMode) {
        const rowRoot = this.obj(list, `Collect ${item.name}`, position)
        const rowButton = rowRoot.createComponent(Button.getTypeName()) as Button
        styleFlatButton(rowButton)
        rowButton.size = new vec3(listWidth, 2.5, 1)
        const row = rowRoot.createComponent(ElementContent.getTypeName()) as ElementContent
        const refresh = () => { row.text = item.packed ? `[X] ${item.name}` : `[ ] ${item.name}` }
        refresh()
        row.textSize = AREA_CONTENT_TEXT_SIZE
        row.sizeOverride = new vec2(listWidth - 0.5, 2.5)
        row.contentAlignment = "left"
        rowButton.onTriggerUp.add(() => {
          item.packed = !item.packed
          refresh()
          this.onItemToggle.invoke(item.id)
        })
      } else {
        const row = this.text(list, `> ${item.name}`, position, listWidth, 2.5)
        row.textSize = AREA_CONTENT_TEXT_SIZE
        row.contentAlignment = "left"
      }
    })
    if (!this.packingMode) {
      plusRoot.enabled = true
      plusRoot.getTransform().setLocalPosition(this.plusPosition(size))
    }
  }

  private plusPosition(size: vec2): vec3 {
    return new vec3(size.x * 0.5 - 2.8, size.y * 0.38 + 10, 0.6)
  }

  private button(parent: SceneObject, label: string, position: vec3, width: number, height: number, action:()=>void): SceneObject {
    const root = this.obj(parent, label, position)
    const button = root.createComponent(Button.getTypeName()) as Button
    styleFlatButton(button)
    button.size = new vec3(width, height, 1)
    const content = root.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = label
    content.textSize = label === "+" ? 90 : 62
    content.sizeOverride = new vec2(width - 0.5, height)
    button.onTriggerUp.add(action)
    return root
  }

  private text(parent:SceneObject,value:string,position:vec3,width:number,height:number):ElementContent {
    const root=this.obj(parent,value,position)
    const content=root.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text=value; content.textSize=48; content.sizeOverride=new vec2(width,height)
    return content
  }

  private obj(parent:SceneObject,name:string,position:vec3):SceneObject {
    const root=global.scene.createSceneObject(name); root.setParent(parent); root.getTransform().setLocalPosition(position); return root
  }

  private findChild(parent:SceneObject,name:string):SceneObject|null {
    for(let i=0;i<parent.getChildrenCount();i++){const child=parent.getChild(i);if(child.name===name)return child} return null
  }

  private destroyChild(parent: SceneObject, name: string): void {
    const child = this.findChild(parent, name)
    if (child) child.destroy()
  }

  private setStatus(message:string):void { if(this.status)this.status.text=message }
  private makeFrameVisualOnly(root: SceneObject): void {
    const interactable = root.getComponent(Interactable.getTypeName()) as Interactable | null
    if (interactable) interactable.enabled = false
    const collider = root.getComponent("Physics.ColliderComponent") as ColliderComponent | null
    if (collider) collider.enabled = false
  }
  private clear():void {
    this.clearDrawPreview()
    if(this.toolbar)this.toolbar.destroy()
    this.areaRoots.forEach(root=>root.destroy())
    this.areaRoots=[]; this.areaViews=[]; this.toolbar=null
  }
}
