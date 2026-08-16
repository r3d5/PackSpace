/** PackSpaceAudioController owns low-latency feedback audio and no application state. */
const CONFIRM = requireAsset("../GeneratedSFX/PackConfirm.wav") as AudioTrackAsset
const WARNING = requireAsset("../GeneratedSFX/PackWarning.wav") as AudioTrackAsset
const COMPLETE = requireAsset("../GeneratedSFX/PackComplete.wav") as AudioTrackAsset

@component
export class PackSpaceAudioController extends BaseScriptComponent {
  private confirm: AudioComponent | null = null
  private warning: AudioComponent | null = null
  private complete: AudioComponent | null = null

  onAwake(): void {
    this.confirm = this.make("ConfirmAudio", CONFIRM)
    this.warning = this.make("WarningAudio", WARNING)
    this.complete = this.make("CompleteAudio", COMPLETE)
  }

  public playConfirm(): void { this.confirm?.play(1) }
  public playWarning(): void { this.warning?.play(1) }
  public playComplete(): void { this.complete?.play(1) }

  private make(name: string, track: AudioTrackAsset): AudioComponent {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.sceneObject)
    const audio = object.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track
    audio.playbackMode = Audio.PlaybackMode.LowLatency
    audio.volume = 0.65
    return audio
  }
}
