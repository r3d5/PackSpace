import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {TextInputField} from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

const PANEL_FILL = new vec4(1, 1, 1, 0.055)
const CONTROL_FILL = new vec4(1, 1, 1, 0.035)
const OUTLINE = new vec4(1, 1, 1, 1)
const PANEL_BORDER_SIZE = 0.28
const PANEL_CORNER_RADIUS = 1.15

type InitializableElement = {
  sceneObject: SceneObject
  onInitialized: {add(callback: () => void): void}
}

/** Replace UIKit's glass treatment with PackSpace's flat outlined language. */
export function styleFlatFrame(frame: Frame): void {
  // SnapOS3 uses a plain RoundedRectangle visual rather than the frosted-glass shader.
  ;(frame as unknown as {_themeOverride: string})._themeOverride = "SnapOS3"
  frame.onInitialized.add(() => {
    frame.cornerRadius = PANEL_CORNER_RADIUS
    // Keep the Frame body flat, but do not depend on its hover-managed border.
    applyRoundedRectangle(frame.roundedRectangle, PANEL_FILL, 0, PANEL_CORNER_RADIUS)
    createPersistentFrameOutline(frame)
  })
}

export function styleFlatButton(button: Button): void {
  button.setVariant({theme: "SnapOS3", shape: "Rectangle", style: "Secondary"})
  styleElement(button, CONTROL_FILL, 0.12, 0.42)
}

export function styleFlatInput(input: TextInputField): void {
  styleElement(input, CONTROL_FILL, 0.12, 0.42)
}

function styleElement(element: InitializableElement, fill: vec4, borderSize: number, cornerRadius: number): void {
  element.onInitialized.add(() => {
    const rounded = findRoundedRectangle(element.sceneObject)
    if (rounded) applyRoundedRectangle(rounded, fill, borderSize, cornerRadius)
  })
}

function applyRoundedRectangle(
  rounded: RoundedRectangle | null,
  fill: vec4,
  borderSize: number,
  cornerRadius: number
): void {
  if (!rounded) return
  rounded.backgroundColor = fill
  rounded.cornerRadius = cornerRadius
  rounded.border = borderSize > 0
  if (borderSize > 0) {
    rounded.borderSize = borderSize
    rounded.borderColor = OUTLINE
  }
  rounded.renderMeshVisual.mainPass.border = borderSize > 0 ? 1 : 0
  rounded.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto
}

function createPersistentFrameOutline(frame: Frame): void {
  const outlineRoot = global.scene.createSceneObject("PackSpace Persistent White Outline")
  outlineRoot.setParent(frame.sceneObject)
  outlineRoot.layer = frame.sceneObject.layer
  // UIKit Frames are roughly 1 cm thick. Keep the independent stroke beyond
  // the front face so depth testing cannot bury it inside the panel body.
  outlineRoot.getTransform().setLocalPosition(new vec3(0, 0, 0.62))

  const outline = outlineRoot.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  outline.initialize()
  outline.size = frame.totalSize
  outline.cornerRadius = PANEL_CORNER_RADIUS
  outline.backgroundColor = new vec4(0, 0, 0, 0)
  outline.opacity = 1
  outline.border = true
  outline.borderSize = PANEL_BORDER_SIZE
  outline.borderType = "Color"
  outline.borderSoftness = 0
  outline.borderColor = OUTLINE
  outline.renderMeshVisual.mainPass.border = 1
  outline.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto
  outline.renderMeshVisual.mainPass.depthTest = true
  outline.renderMeshVisual.mainPass.depthWrite = false

  frame.onScalingUpdate.add(() => {
    outline.size = frame.totalSize
    outline.cornerRadius = PANEL_CORNER_RADIUS
  })
}

function findRoundedRectangle(root: SceneObject): RoundedRectangle | null {
  const local = root.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle | null
  if (local) return local
  for (let index = 0; index < root.getChildrenCount(); index++) {
    const found = findRoundedRectangle(root.getChild(index))
    if (found) return found
  }
  return null
}
