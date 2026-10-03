// Turns the "Wasfa Splash Gather" design export into the video the app plays
// at launch. The export is a 1920×1080 canvas showing the animation inside a
// mock phone, with a label and a timecode around it; this keeps only the mock
// phone's screen, paints over its rounded corners, island and home indicator,
// and scales the result up so the device has less stretching to do.
//
// Usage: swift scripts/crop-splash-video.swift <export.mp4> assets/videos/wasfa-splash-gather.mp4

import AVFoundation
import CoreImage

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  print("usage: swift scripts/crop-splash-video.swift <export.mp4> <output.mp4>")
  exit(1)
}
let input = URL(fileURLWithPath: arguments[1])
let output = URL(fileURLWithPath: arguments[2])

// The mock phone's screen inside the export, in pixels from the top left.
let screen = CGRect(x: 776, y: 160, width: 368, height: 796)
let upscale: CGFloat = 3
// The screen colour of the export, used to paint over the mock phone's chrome.
let cream = CIColor(red: 253 / 255, green: 249 / 255, blue: 243 / 255)
// Chrome to hide, in screen pixels from the top left: corners, island, home indicator.
let chrome = [
  CGRect(x: 0, y: 0, width: 44, height: 44),
  CGRect(x: 324, y: 0, width: 44, height: 44),
  CGRect(x: 0, y: 752, width: 44, height: 44),
  CGRect(x: 324, y: 752, width: 44, height: 44),
  CGRect(x: 114, y: 0, width: 140, height: 52),
  CGRect(x: 104, y: 772, width: 160, height: 24),
]

let asset = AVURLAsset(url: input)
guard let track = asset.tracks(withMediaType: .video).first else {
  print("no video track in \(input.path)")
  exit(1)
}
let frame = CGRect(origin: .zero, size: track.naturalSize)
let renderSize = CGSize(width: screen.width * upscale, height: screen.height * upscale)

/// Core Image counts rows from the bottom; the rects above count from the top.
func flipped(_ rect: CGRect, in height: CGFloat) -> CGRect {
  CGRect(x: rect.minX, y: height - rect.maxY, width: rect.width, height: rect.height)
}

let composition = AVMutableVideoComposition(asset: asset) { request in
  let crop = flipped(screen, in: frame.height)
  var image = request.sourceImage
    .cropped(to: crop)
    .transformed(by: CGAffineTransform(translationX: -crop.minX, y: -crop.minY))

  for patch in chrome {
    let area = flipped(patch, in: screen.height)
    image = CIImage(color: cream).cropped(to: area).composited(over: image)
  }

  let scaled = image
    .clampedToExtent()
    .applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: upscale, kCIInputAspectRatioKey: 1])
    .cropped(to: CGRect(origin: .zero, size: renderSize))
  request.finish(with: scaled, context: nil)
}
composition.renderSize = renderSize

try? FileManager.default.removeItem(at: output)
guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
  print("could not create an export session")
  exit(1)
}
export.videoComposition = composition
export.outputURL = output
export.outputFileType = .mp4
export.shouldOptimizeForNetworkUse = true

let done = DispatchSemaphore(value: 0)
export.exportAsynchronously { done.signal() }
done.wait()

if export.status == .completed {
  print("wrote \(output.path) at \(Int(renderSize.width))×\(Int(renderSize.height))")
} else {
  print("export failed: \(export.error?.localizedDescription ?? "unknown error")")
  exit(1)
}
